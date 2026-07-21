// Single cif/fcf pair direct-vs-symmetry-aware isosurface timing. Needs a
// real reflection file (.fcf), which COD does not provide - see
// cod-sample.mjs / analysis/density-pipeline-cod.mjs's --fcf-dir for the
// COD-scale synthetic-data counterpart to this benchmark.
/* eslint-disable jsdoc/require-param -- local benchmark helpers */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CIF } from '../src/lib/read-cif/base.js';
import { CrystalStructure } from '../src/lib/structure/crystal.js';
import { tryToFixCifBlock } from '../src/lib/fix-cif/base.js';
import {
    HydrogenFilter,
    SymmetryGrower,
} from '../src/lib/structure/structure-modifiers/modes.js';
import {
    calculateDifferenceDensityMap,
    parseDifferenceDensitySource,
} from '../src/lib/density/difference-density.js';
import { isosurfaceResolution } from '../src/lib/density/isosurface.js';
import {
    createSymmetryAwareIsosurfaces,
} from '../src/lib/density/symmetry-isosurface.js';

const cifPath = process.argv[2];
const fcfPath = process.argv[3];
const runCount = Math.max(1, Number(process.argv[4]) || 5);
if (!cifPath || !fcfPath) {
    throw new Error(
        'Usage: node benchmark/difference-density-symmetry.mjs structure.cif reflections.fcf [runs]',
    );
}

/** @returns {CrystalStructure} Structure with the same repair fallback as the viewer. */
function readStructure(text) {
    const block = new CIF(text).getBlock(0);
    try {
        return CrystalStructure.fromCIF(tryToFixCifBlock(block));
    } catch (originalError) {
        try {
            return CrystalStructure.fromCIF(block);
        } catch {
            throw originalError;
        }
    }
}

/** Disposes one benchmark result without double-disposing shared resources. */
function disposeGroup(group) {
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

/** @returns {number} Median of numeric observations. */
function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

const structure = readStructure(fs.readFileSync(cifPath, 'utf8'));
const densityMap = calculateDifferenceDensityMap(parseDifferenceDensitySource(
    fs.readFileSync(fcfPath, 'utf8'),
    0,
    { inputMode: 'fcf' },
));
// The FCF cell has already passed the density parser's numeric validation and
// is the exact cell used for sampling; use it for geometry as the viewer does
// after validating the coordinate/FCF pair.
structure.cell = densityMap.cell;
const filteredStructure = new HydrogenFilter(HydrogenFilter.MODES.NONE).apply(structure);
const grownStructure = new SymmetryGrower(SymmetryGrower.MODES.CELL).apply(filteredStructure);
const baseOptions = {
    visible: true,
    sigmaLevel: 3,
    radius: 1.5,
    resolution: 64,
    gridSpacing: 0.15,
    maxResolution: 96,
    maxPolyCount: 100000,
};
baseOptions.resolution = isosurfaceResolution(grownStructure, baseOptions);

const observations = { direct: [], symmetry: [] };
for (let run = 0; run < runCount; run++) {
    const variants = run % 2 === 0
        ? [['direct', false], ['symmetry', true]]
        : [['symmetry', true], ['direct', false]];
    for (const [name, useSymmetry] of variants) {
        const started = performance.now();
        const group = createSymmetryAwareIsosurfaces(
            densityMap,
            grownStructure,
            { ...baseOptions, useSymmetry },
        );
        observations[name].push({
            wallTimeMs: performance.now() - started,
            marchingCubesTimeMs: group.userData.marchingCubesTimeMs,
            polygonizationTimeMs: group.userData.polygonizationTimeMs,
            stitchTimeMs: group.userData.stitchTimeMs ?? 0,
            removedDuplicateTriangles: group.userData.removedDuplicateTriangleCount ?? 0,
            polygons: group.userData.polygonCount,
            displayedRegions: group.userData.displayedRegionCount,
            generatedRegions: group.userData.generatedRegionCount,
            reusedRegions: group.userData.reusedRegionCount,
            passes: group.userData.marchingCubesPassCount,
        });
        disposeGroup(group);
    }
}

const summarize = values => ({
    ...values.at(-1),
    wallTimeMs: median(values.map(value => value.wallTimeMs)),
    marchingCubesTimeMs: median(values.map(value => value.marchingCubesTimeMs)),
    polygonizationTimeMs: median(values.map(value => value.polygonizationTimeMs)),
    stitchTimeMs: median(values.map(value => value.stitchTimeMs)),
});
const direct = summarize(observations.direct);
const symmetry = summarize(observations.symmetry);
const output = {
    cifPath,
    fcfPath,
    atoms: grownStructure.atoms.length,
    surfaceResolution: baseOptions.resolution,
    runs: runCount,
    direct,
    symmetry,
    speedup: direct.wallTimeMs / symmetry.wallTimeMs,
};
console.log(JSON.stringify(output, null, 2));
