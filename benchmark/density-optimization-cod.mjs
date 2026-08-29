#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- focused before/after benchmark */
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { basename, extname, resolve } from 'node:path';
import {
    calculateDifferenceDensityMap,
    createCifDifferenceDensityDataset,
} from '../src/lib/density/difference-density.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from '../src/lib/density/isosurface.js';
import {
    createSymmetryAwareIsosurfaces,
    SymmetryRegionSurfaceCache,
} from '../src/lib/density/symmetry-isosurface.js';
import {
    createPatchCachedIsosurfaces,
    SurfacePatchCache,
} from '../src/lib/density/surface-patches.js';
import { HydrogenFilter, SymmetryGrower } from '../src/lib/structure/structure-modifiers/modes.js';
import { realDataSample, readCodStructure, seededRandom } from './lib/cod-sample.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};
const codDirectory = resolve(option('cod-dir', '/home/niklas/cod/cif'));
const hklDirectory = resolve(option('hkl-dir', '/home/niklas/cod/hkl'));
const sampleCount = Math.max(1, Number(option('sample', 20)) || 20);
const seed = Number(option('seed', 20260829)) || 20260829;
const outputPath = resolve(option('out', 'benchmark/density-optimization-cod.csv'));
const includeSurfaces = option('surfaces', 'true') !== 'false';
const includeCellPatches = option('cell-patches', 'true') !== 'false';

function dispose(group) {
    const geometries = new Set();
    const materials = new Set();
    group.traverse(object => {
        if (object.geometry) {
            geometries.add(object.geometry);
        }
        if (object.material) {
            materials.add(object.material);
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
}

function timed(callback) {
    const started = performance.now();
    const value = callback();
    return { value, milliseconds: performance.now() - started };
}

function mapDifference(first, second) {
    let maximum = 0;
    let squared = 0;
    let count = 0;
    for (let z = 0; z < 8; z++) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const difference = first.sample(x / 8, y / 8, z / 8) -
            second.sample(x / 8, y / 8, z / 8);
                maximum = Math.max(maximum, Math.abs(difference));
                squared += difference ** 2;
                count++;
            }
        }
    }
    return { maximum, rms: Math.sqrt(squared / count) };
}

function determinant(matrix) {
    return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
        matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
        matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
}

function directDensity(dataset, x, y, z) {
    let value = 0;
    for (const coefficient of dataset.coefficients.values()) {
        const phase = -2 * Math.PI * (
            coefficient.h * x + coefficient.k * y + coefficient.l * z
        );
        const contribution = coefficient.real * Math.cos(phase) -
            coefficient.imaginary * Math.sin(phase);
        value += contribution;
        if (dataset.friedelImplicit && (
            coefficient.h !== 0 || coefficient.k !== 0 || coefficient.l !== 0
        )) {
            value += contribution;
        }
    }
    return value / Math.abs(determinant(dataset.cell.fractToCartMatrix.toArray()));
}

function directDifference(map, dataset) {
    const [nx, ny, nz] = map.dimensions;
    let maximum = 0;
    for (let index = 0; index < 16; index++) {
        const x = (index * 17 + 3) % nx / nx;
        const y = (index * 11 + 5) % ny / ny;
        const z = (index * 7 + 1) % nz / nz;
        maximum = Math.max(maximum, Math.abs(map.sample(x, y, z) -
            directDensity(dataset, x, y, z)));
    }
    return maximum;
}

function csvValue(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const sample = realDataSample(codDirectory, hklDirectory, sampleCount, seededRandom(seed));
const records = [];
for (let index = 0; index < sample.files.length; index++) {
    const file = sample.files[index];
    const codId = basename(file.path, extname(file.path));
    try {
        const cifText = readFileSync(file.path, 'utf8');
        const hklText = readFileSync(file.hklPath, 'utf8');
        const { structure } = readCodStructure(cifText);
        const dataset = createCifDifferenceDensityDataset(hklText, 0, {
            coordinateCifText: cifText,
        });
        const fftModes = [
            { key: 'radixComplex', fftBackend: 'radix-2', realTransform: false },
            { key: 'radixReal', fftBackend: 'radix-2', realTransform: true },
            { key: 'mixedComplex', fftBackend: 'mixed-radix', realTransform: false },
            { key: 'mixedReal', fftBackend: 'mixed-radix', realTransform: true },
            {
                key: 'smoothHybrid',
                fftBackend: 'auto',
                fftGridPlanner: 'smooth',
                fftAxisKernel: 'auto',
                realTransform: true,
            },
        ];
        const transforms = {};
        for (let offset = 0; offset < fftModes.length; offset++) {
            const mode = fftModes[(index + offset) % fftModes.length];
            transforms[mode.key] = timed(() => calculateDifferenceDensityMap(dataset, 1, 1, mode));
        }
        const legacy = transforms.radixComplex;
        const optimized = transforms.smoothHybrid;
        const difference = mapDifference(transforms.mixedReal.value, optimized.value);
        const bestFftMode = fftModes.reduce((best, mode) =>
            transforms[mode.key].milliseconds < transforms[best.key].milliseconds ? mode : best,
        ).key;
        const cellVolume = Math.abs(determinant(structure.cell.fractToCartMatrix.toArray()));
        const symmetryOperationCount = structure.symmetry?.symmetryOperations?.length ??
            dataset.symmetryOperations?.length ?? 1;
        const record = {
            codId,
            cifBytes: cifText.length,
            hklBytes: hklText.length,
            asymmetricUnitAtoms: structure.atoms.length,
            symmetryOperationCount,
            cellA: structure.cell.a,
            cellB: structure.cell.b,
            cellC: structure.cell.c,
            cellVolume,
            reflectionCount: dataset.reflectionCount,
            legacyGridPoints: legacy.value.values.length,
            optimizedGridPoints: optimized.value.values.length,
            legacyDimensions: legacy.value.dimensions.join('x'),
            optimizedDimensions: optimized.value.dimensions.join('x'),
            legacyFftBytes: legacy.value.fftAllocatedBytes,
            optimizedFftBytes: optimized.value.fftAllocatedBytes,
            legacyFftMs: legacy.milliseconds,
            optimizedFftMs: optimized.milliseconds,
            radixComplexMs: transforms.radixComplex.milliseconds,
            radixRealMs: transforms.radixReal.milliseconds,
            mixedComplexMs: transforms.mixedComplex.milliseconds,
            mixedRealMs: transforms.mixedReal.milliseconds,
            smoothHybridMs: transforms.smoothHybrid.milliseconds,
            radixComplexBytes: transforms.radixComplex.value.fftAllocatedBytes,
            radixRealBytes: transforms.radixReal.value.fftAllocatedBytes,
            mixedComplexBytes: transforms.mixedComplex.value.fftAllocatedBytes,
            mixedRealBytes: transforms.mixedReal.value.fftAllocatedBytes,
            smoothHybridBytes: transforms.smoothHybrid.value.fftAllocatedBytes,
            smoothHybridPlanSetupMs: transforms.smoothHybrid.value.fftPlanSetupTimeMs,
            smoothHybridAxisStatistics: JSON.stringify(
                transforms.smoothHybrid.value.fftAxisStatistics,
            ),
            bestFftMode,
            mapMaximumDifference: difference.maximum,
            mapRmsDifference: difference.rms,
            mapMaximumDirectDifference: directDifference(optimized.value, dataset),
            success: true,
            error: '',
        };
        for (const mode of fftModes) {
            for (const axis of transforms[mode.key].value.fftAxisStatistics) {
                const prefix = `${mode.key}Axis${axis.axis}`;
                record[`${prefix}Length`] = axis.length;
                record[`${prefix}Factorization`] = JSON.stringify(axis.factorization);
                record[`${prefix}Kernel`] = axis.kernel;
                record[`${prefix}LineCount`] = axis.lineCount;
                record[`${prefix}KernelMs`] = axis.kernelTimeMs;
                record[`${prefix}PlanSetupMs`] = axis.planSetupTimeMs;
                record[`${prefix}PlanCacheHit`] = axis.planCacheHit;
            }
        }
        if (includeSurfaces) {
            structure.cell = optimized.value.cell;
            const filtered = new HydrogenFilter(HydrogenFilter.MODES.NONE).apply(structure);
            const fragment = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT).apply(filtered);
            const cell = new SymmetryGrower(SymmetryGrower.MODES.CELL).apply(filtered);
            const surfaceOptions = { ...DEFAULT_ISOSURFACE_OPTIONS, visible: true };
            const legacySurface = timed(() => createSymmetryAwareIsosurfaces(
                legacy.value, cell, { ...surfaceOptions, generationMode: 'legacy' },
            ));
            const regionCache = new SymmetryRegionSurfaceCache(surfaceOptions.patchCacheMaxBytes);
            const regionFragment = timed(() => createSymmetryAwareIsosurfaces(
                optimized.value, fragment, surfaceOptions, regionCache,
            ));
            const regionExpanded = timed(() => createSymmetryAwareIsosurfaces(
                optimized.value, cell, surfaceOptions, regionCache,
            ));
            const regionReturn = timed(() => createSymmetryAwareIsosurfaces(
                optimized.value, fragment, surfaceOptions, regionCache,
            ));
            Object.assign(record, {
                legacyCellSurfaceMs: legacySurface.milliseconds,
                regionFragmentColdMs: regionFragment.milliseconds,
                regionExpandCellMs: regionExpanded.milliseconds,
                regionReturnFragmentMs: regionReturn.milliseconds,
                regionExpandCacheHits: regionExpanded.value.userData.regionCacheHitCount,
                regionReturnCacheHits: regionReturn.value.userData.regionCacheHitCount,
                regionCacheBytes: regionCache.bytes,
                bestSurfaceMode: regionExpanded.milliseconds < legacySurface.milliseconds
                    ? 'region-cache'
                    : 'direct-legacy',
            });
            [legacySurface, regionFragment, regionExpanded, regionReturn].forEach(result =>
                dispose(result.value));
            regionCache.clear();
            if (includeCellPatches) {
                const cache = new SurfacePatchCache(surfaceOptions.patchCacheMaxBytes);
                const fragmentSurface = timed(() => createPatchCachedIsosurfaces(
                    optimized.value, fragment, surfaceOptions, cache,
                ));
                const expandedSurface = timed(() => createPatchCachedIsosurfaces(
                    optimized.value, cell, surfaceOptions, cache,
                ));
                const returnSurface = timed(() => createPatchCachedIsosurfaces(
                    optimized.value, fragment, surfaceOptions, cache,
                ));
                Object.assign(record, {
                    cachedFragmentColdMs: fragmentSurface.milliseconds,
                    cachedExpandCellMs: expandedSurface.milliseconds,
                    cachedReturnFragmentMs: returnSurface.milliseconds,
                    expandedCacheHitCells: expandedSurface.value.userData.cacheHitCellCount,
                    expandedCacheMissCells: expandedSurface.value.userData.cacheMissCellCount,
                    returnCacheHitCells: returnSurface.value.userData.cacheHitCellCount,
                    patchCacheBytes: cache.bytes,
                    bestSurfaceMode: expandedSurface.milliseconds < Math.min(
                        legacySurface.milliseconds,
                        regionExpanded.milliseconds,
                    ) ? 'patch-cache' : record.bestSurfaceMode,
                });
                [fragmentSurface, expandedSurface, returnSurface].forEach(result =>
                    dispose(result.value));
            }
        }
        records.push(record);
    } catch (error) {
        records.push({ codId, success: false, error: error.message });
    }
    console.error(`[${index + 1}/${sample.files.length}] ${codId}`);
}

const columns = [...new Set(records.flatMap(record => Object.keys(record)))];
writeFileSync(outputPath, `${[
    columns.join(','),
    ...records.map(record => columns.map(column => csvValue(record[column])).join(',')),
].join('\n')}\n`);
const successful = records.filter(record => record.success);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(JSON.stringify({
    output: outputPath,
    requested: records.length,
    successful: successful.length,
    medianGridPointRatio: median(successful.map(row => row.legacyGridPoints / row.optimizedGridPoints)),
    medianFftSpeedup: median(successful.map(row => row.legacyFftMs / row.optimizedFftMs)),
    medianFftMemoryRatio: median(successful.map(row => row.legacyFftBytes / row.optimizedFftBytes)),
    medianCachedReturnSpeedup: includeSurfaces && includeCellPatches ? median(successful.map(
        row => row.cachedFragmentColdMs / row.cachedReturnFragmentMs,
    )) : null,
    medianRegionReturnSpeedup: includeSurfaces ? median(successful.map(
        row => row.regionFragmentColdMs / row.regionReturnFragmentMs,
    )) : null,
}, null, 2));
