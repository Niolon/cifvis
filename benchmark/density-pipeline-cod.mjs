#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- benchmark-local helpers */
import {
    existsSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CIF } from '../src/lib/read-cif/base.js';
import { tryToFixCifBlock } from '../src/lib/fix-cif/base.js';
import { Atom, CrystalStructure, UnitCell } from '../src/lib/structure/crystal.js';
import { CellSymmetry } from '../src/lib/structure/cell-symmetry.js';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';
import { calculateDifferenceDensityMap } from '../src/lib/density/difference-density.js';
import {
    canonicalReflectionIndex,
    isGeneralPositionSystematicAbsence,
    multiplyReflectionIndex,
    reciprocalSymmetryKernel,
} from '../src/lib/density/reciprocal-symmetry.js';
import {
    DEFAULT_ISOSURFACE_OPTIONS,
    isosurfaceResolution,
} from '../src/lib/density/isosurface.js';
import { createSymmetryAwareIsosurfaces } from '../src/lib/density/symmetry-isosurface.js';
import {
    densityPipelinePredictors,
    estimateDensityPipelineTimings,
    recommendProgressiveSchedule,
} from '../src/lib/density/progressive-timing.js';
import * as math from '../src/lib/math-lite.js';

const DEFAULT_COD_DIRECTORY = process.env.COD_DIR || '/home/niklas/cod/cif';
const TWO_PI = 2 * Math.PI;

function parseArguments(argv) {
    const options = {
        target: DEFAULT_COD_DIRECTORY,
        out: 'benchmark/density-pipeline-cod.csv',
        modelOut: 'benchmark/density-pipeline-heuristic.json',
        sample: 25,
        seed: 20260718,
        dMin: 0.9,
        noise: 0.03,
        maxReflections: 60000,
        maxGridPoints: 8_500_000,
        maxSurfaceResolution: 96,
        minStepMs: 100,
        maxStepMs: 200,
        progressEvery: 25,
        checkpointEvery: 25,
    };
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (!argument.startsWith('--') && index === 0) {
            options.target = argument;
            continue;
        }
        if (!argument.startsWith('--')) {
            throw new Error(`Unexpected argument: ${argument}`);
        }
        const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (!Object.hasOwn(options, key)) {
            throw new Error(`Unknown option: ${argument}`);
        }
        options[key] = argv[++index];
    }
    for (const name of [
        'sample', 'seed', 'dMin', 'noise', 'maxReflections', 'maxGridPoints',
        'maxSurfaceResolution', 'minStepMs', 'maxStepMs',
        'progressEvery', 'checkpointEvery',
    ]) {
        options[name] = Number(options[name]);
    }
    if (!(options.minStepMs > 0 && options.maxStepMs >= options.minStepMs)) {
        throw new Error('Step timing window must satisfy 0 < min-step-ms <= max-step-ms');
    }
    if (!(Number.isInteger(options.progressEvery) && options.progressEvery > 0 &&
        Number.isInteger(options.checkpointEvery) && options.checkpointEvery > 0)) {
        throw new Error('Progress and checkpoint intervals must be positive integers');
    }
    return options;
}

function seededRandom(seed) {
    let state = Math.trunc(seed) >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

function seedForText(text, seed) {
    let value = Math.trunc(seed) >>> 0;
    for (let index = 0; index < text.length; index++) {
        value ^= text.charCodeAt(index);
        value = Math.imul(value, 16777619) >>> 0;
    }
    return value;
}

function *walkCifFiles(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (['dictionaries', 'logs', 'manual-checks'].includes(entry.name)) {
            continue;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            yield *walkCifFiles(path);
        } else if (extname(entry.name).toLowerCase() === '.cif') {
            yield { path, sizeBytes: statSync(path).size };
        }
    }
}

function stratifiedSizeSample(files, sampleSize, random) {
    const sorted = [...files].sort((first, second) =>
        first.sizeBytes - second.sizeBytes || first.path.localeCompare(second.path));
    const selectedCount = Math.min(sampleSize, sorted.length);
    const selected = [];
    for (let stratum = 0; stratum < selectedCount; stratum++) {
        const start = Math.floor(stratum * sorted.length / selectedCount);
        const end = Math.max(start + 1, Math.floor((stratum + 1) * sorted.length / selectedCount));
        const selectedIndex = start + Math.floor(random() * (end - start));
        selected.push({
            ...sorted[selectedIndex],
            sizeQuantile: (selectedIndex + 0.5) / sorted.length,
        });
    }
    for (let index = selected.length - 1; index > 0; index--) {
        const replacement = Math.floor(random() * (index + 1));
        [selected[index], selected[replacement]] = [selected[replacement], selected[index]];
    }
    return {
        files: selected,
        populationSize: sorted.length,
        fileSizeRangeBytes: sorted.length > 0
            ? [sorted[0].sizeBytes, sorted.at(-1).sizeBytes]
            : [0, 0],
    };
}

function sampledFiles(target, sampleSize, random) {
    const path = resolve(target);
    if (!existsSync(path)) {
        throw new Error(`COD path does not exist: ${path}`);
    }
    if (statSync(path).isFile()) {
        if (extname(path).toLowerCase() === '.cif') {
            return stratifiedSizeSample(
                [{ path, sizeBytes: statSync(path).size }],
                1,
                random,
            );
        }
        const listed = readFileSync(path, 'utf8').split(/\r?\n/).map(line => line.trim())
            .filter(line => line && !line.startsWith('#')).map(line => resolve(line))
            .map(file => ({ path: file, sizeBytes: statSync(file).size }));
        return stratifiedSizeSample(listed, sampleSize, random);
    }
    return stratifiedSizeSample(walkCifFiles(path), sampleSize, random);
}

function processorExercise(count) {
    let value = 0.6180339887498948;
    for (let index = 1; index <= count; index++) {
        value = Math.sqrt(value + (index % 97) * 0.0001 + 1.000001);
    }
    return value;
}

function processorSpeed(iterations = 3_000_000) {
    processorExercise(500000);
    processorExercise(500000);
    const observations = [];
    for (let sample = 0; sample < 5; sample++) {
        const started = performance.now();
        const check = processorExercise(iterations);
        const duration = performance.now() - started;
        if (!Number.isFinite(check) || duration <= 0) {
            throw new Error('Processor calibration failed');
        }
        observations.push(iterations / duration);
    }
    return median(observations);
}

function readStructure(cifText) {
    const block = new CIF(cifText).getBlock(0);
    try {
        return { block, structure: CrystalStructure.fromCIF(block) };
    } catch (originalError) {
        try {
            tryToFixCifBlock(block);
            return { block, structure: CrystalStructure.fromCIF(block) };
        } catch (fixedError) {
            try {
                const atomSite = block.get('_atom_site');
                const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
                const atoms = labels.map((_, index) => {
                    try {
                        return Atom.fromCIF(block, index);
                    } catch (error) {
                        if (error.message.includes('Dummy atom')) {
                            return null;
                        }
                        throw error;
                    }
                }).filter(Boolean);
                return {
                    block,
                    structure: new CrystalStructure(
                        UnitCell.fromCIF(block),
                        atoms,
                        [],
                        [],
                        CellSymmetry.fromCIF(block),
                    ),
                };
            } catch {
                throw fixedError.message ? fixedError : originalError;
            }
        }
    }
}

function reciprocalMatrix(cell) {
    const result = math.transpose(math.inv(cell.fractToCartMatrix));
    return Array.isArray(result) ? result : result.toArray();
}

function vectorLength(vector) {
    return Math.hypot(...vector);
}

function generateReflections(structure, dMin, maxReflections) {
    const reciprocal = reciprocalMatrix(structure.cell);
    const inverseResult = math.inv(reciprocal);
    const inverseReciprocal = Array.isArray(inverseResult)
        ? inverseResult
        : inverseResult.toArray();
    const reciprocalLimit = 1 / dMin;
    const bounds = inverseReciprocal.map(row => Math.ceil(vectorLength(row) * reciprocalLimit));
    const reflections = [];
    const seen = new Set();
    for (let h = -bounds[0]; h <= bounds[0]; h++) {
        for (let k = -bounds[1]; k <= bounds[1]; k++) {
            for (let l = -bounds[2]; l <= bounds[2]; l++) {
                if (h === 0 && k === 0 && l === 0) {
                    continue;
                }
                const reciprocalVector = math.multiply(reciprocal, [h, k, l]);
                if (vectorLength(reciprocalVector) > reciprocalLimit + 1e-12 ||
                    isGeneralPositionSystematicAbsence(h, k, l, structure.symmetry)) {
                    continue;
                }
                const canonical = canonicalReflectionIndex(h, k, l, structure.symmetry, true);
                const key = canonical.join(',');
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                reflections.push(canonical);
                if (reflections.length > maxReflections) {
                    throw new Error(`Reflection limit exceeded (${maxReflections})`);
                }
            }
        }
    }
    return reflections;
}

function normalRandom(random) {
    const first = Math.max(Number.EPSILON, random());
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(TWO_PI * random());
}

function addCoefficient(coefficients, h, k, l, real, imaginary) {
    const key = `${h},${k},${l}`;
    const existing = coefficients.get(key);
    if (existing) {
        existing.real += real;
        existing.imaginary += imaginary;
        existing.count++;
    } else {
        coefficients.set(key, { h, k, l, real, imaginary, count: 1 });
    }
}

function artificialDifferenceCoefficients(calculated, symmetry, noiseFraction, random, cell) {
    const maximumAmplitude = Math.max(...calculated.map(value => value.amplitude));
    const coefficients = new Map();
    for (const reflection of calculated) {
        const noise = normalRandom(random) * noiseFraction *
            (0.25 * maximumAmplitude + 0.75 * reflection.amplitude);
        const observedAmplitude = Math.max(0, reflection.amplitude + noise);
        const differenceAmplitude = observedAmplitude - reflection.amplitude;
        const phase = Math.atan2(reflection.imaginary, reflection.real);
        const baseReal = differenceAmplitude * Math.cos(phase);
        const baseImaginary = differenceAmplitude * Math.sin(phase);
        for (const kernel of reciprocalSymmetryKernel(symmetry)) {
            const operation = kernel.operation;
            const [h, k, l] = multiplyReflectionIndex(
                kernel.reciprocalRotation,
                [reflection.h, reflection.k, reflection.l],
            );
            const phaseShift = TWO_PI * (
                h * operation.transVector[0] +
                k * operation.transVector[1] +
                l * operation.transVector[2]
            );
            const cosine = Math.cos(phaseShift);
            const sine = Math.sin(phaseShift);
            const real = baseReal * cosine - baseImaginary * sine;
            const imaginary = baseReal * sine + baseImaginary * cosine;
            addCoefficient(coefficients, h, k, l, real, imaginary);
            addCoefficient(coefficients, -h, -k, -l, real, -imaginary);
        }
    }
    coefficients.delete('0,0,0');
    const reciprocal = reciprocalMatrix(cell);
    let maximumReciprocalLength = 0;
    for (const coefficient of coefficients.values()) {
        coefficient.real /= coefficient.count;
        coefficient.imaginary /= coefficient.count;
        coefficient.reciprocalLength = vectorLength(math.multiply(
            reciprocal,
            [coefficient.h, coefficient.k, coefficient.l],
        ));
        maximumReciprocalLength = Math.max(
            maximumReciprocalLength,
            coefficient.reciprocalLength,
        );
    }
    return { coefficients, maximumReciprocalLength };
}

function nextPowerOfTwo(value) {
    return 2 ** Math.ceil(Math.log2(Math.max(2, value)));
}

function predictedFourierDimensions(coefficients) {
    const maxima = [0, 0, 0];
    for (const coefficient of coefficients.values()) {
        maxima[0] = Math.max(maxima[0], Math.abs(coefficient.h));
        maxima[1] = Math.max(maxima[1], Math.abs(coefficient.k));
        maxima[2] = Math.max(maxima[2], Math.abs(coefficient.l));
    }
    return maxima.map(value => nextPowerOfTwo(2 * value + 1));
}

function cellVolume(cell) {
    return Math.abs(math.det(cell.fractToCartMatrix));
}

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

function benchmarkStructure(path, options, random) {
    const cifText = readFileSync(path, 'utf8');
    const { structure } = readStructure(cifText);

    // Requested untimed stage: derive a complete merged, absence-free HKL set.
    const reflections = generateReflections(structure, options.dMin, options.maxReflections);

    const modelStarted = performance.now();
    const calculator = createIAMStructureFactorCalculator(cifText, 0, {
        includeAnomalous: false,
    });
    const iamModelBuildMs = performance.now() - modelStarted;
    const fcalcStarted = performance.now();
    const calculated = calculator.calculate(reflections);
    const fcalcMs = performance.now() - fcalcStarted;

    // Requested untimed stage: perturb Fcalc amplitudes and retain their phases.
    const artificial = artificialDifferenceCoefficients(
        calculated,
        structure.symmetry,
        options.noise,
        random,
        structure.cell,
    );
    const predictedDimensions = predictedFourierDimensions(artificial.coefficients);
    const predictedGridPoints = predictedDimensions.reduce((product, value) => product * value, 1);
    if (predictedGridPoints > options.maxGridPoints) {
        throw new Error(`FFT grid limit exceeded (${predictedGridPoints} points)`);
    }
    const dataset = {
        cell: structure.cell,
        coefficients: artificial.coefficients,
        maximumReciprocalLength: artificial.maximumReciprocalLength,
        reflectionCount: reflections.length,
        coefficientMode: 'artificial-fo-fc-iam-phase',
        omitF000: true,
        sourceType: 'cod-artificial',
        fieldKind: 'difference-density',
        symmetryOperations: structure.symmetry.symmetryOperations.map(operation => ({
            rotation: operation.rotMatrix,
            translation: operation.transVector,
        })),
    };
    const densityStarted = performance.now();
    const field = calculateDifferenceDensityMap(dataset, 1, 1);
    const densityMs = performance.now() - densityStarted;

    const surfaceResolution = isosurfaceResolution(structure, {
        ...DEFAULT_ISOSURFACE_OPTIONS,
        maxResolution: options.maxSurfaceResolution,
    });
    const surfaceStarted = performance.now();
    const group = createSymmetryAwareIsosurfaces(field, structure, {
        ...DEFAULT_ISOSURFACE_OPTIONS,
        resolution: surfaceResolution,
        maxResolution: options.maxSurfaceResolution,
    });
    const surfaceWallMs = performance.now() - surfaceStarted;
    const surfaceStatistics = group.userData;
    disposeGroup(group);

    const gridPoints = field.dimensions.reduce((product, value) => product * value, 1);
    const predictors = densityPipelinePredictors({
        reflectionCount: reflections.length,
        unitCellAtoms: calculator.metadata.expandedAtomCount,
        scatteringModelCount: calculator.metadata.scatteringModelCount,
        gridPoints,
        coefficientCount: artificial.coefficients.size,
        surfaceResolution,
        marchingCubesPassCount: surfaceStatistics.marchingCubesPassCount,
    });
    return {
        path,
        success: true,
        error: '',
        asymmetricUnitAtoms: structure.atoms.length,
        unitCellAtoms: calculator.metadata.expandedAtomCount,
        scatteringModelCount: calculator.metadata.scatteringModelCount,
        symmetryOperationCount: structure.symmetry.symmetryOperations.length,
        cellA: structure.cell.a,
        cellB: structure.cell.b,
        cellC: structure.cell.c,
        cellAlpha: structure.cell.alpha,
        cellBeta: structure.cell.beta,
        cellGamma: structure.cell.gamma,
        cellVolume: cellVolume(structure.cell),
        dMin: options.dMin,
        reflectionCount: reflections.length,
        coefficientCount: artificial.coefficients.size,
        iamModelBuildMs,
        fcalcMs,
        gridX: field.dimensions[0],
        gridY: field.dimensions[1],
        gridZ: field.dimensions[2],
        gridPoints,
        densityMs,
        surfaceResolution,
        marchingCubesPassCount: surfaceStatistics.marchingCubesPassCount,
        polygonCount: surfaceStatistics.polygonCount,
        marchingCubesMs: surfaceStatistics.marchingCubesTimeMs,
        polygonizationMs: surfaceStatistics.polygonizationTimeMs,
        stitchMs: surfaceStatistics.stitchTimeMs ?? 0,
        surfaceWallMs,
        fcalcPredictor: predictors.fcalc,
        densityPredictor: predictors.density,
        surfacePredictor: predictors.surface,
    };
}

function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function fitHeuristic(records) {
    const ratio = (duration, predictor, speed) => duration * speed / predictor;
    return {
        fcalcWorkPerUnit: median(records.map(record =>
            ratio(record.fcalcMs, record.fcalcPredictor, record.processorSpeed))),
        densityWorkPerUnit: median(records.map(record =>
            ratio(record.densityMs, record.densityPredictor, record.processorSpeed))),
        surfaceWorkPerUnit: median(records.map(record =>
            ratio(record.surfaceWallMs, record.surfacePredictor, record.processorSpeed))),
    };
}

function csvValue(value) {
    const string = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function writeCsv(path, records) {
    const columns = [...new Set(records.flatMap(record => Object.keys(record)))];
    const lines = [columns.join(',')];
    for (const record of records) {
        lines.push(columns.map(column => csvValue(record[column])).join(','));
    }
    writeFileSync(resolve(path), `${lines.join('\n')}\n`);
}

function withoutLibraryDiagnostics(callback) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    try {
        return callback();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const random = seededRandom(options.seed);
    const sampling = sampledFiles(options.target, options.sample, random);
    const files = sampling.files;
    const resolvedTarget = resolve(options.target);
    const targetIsDirectory = existsSync(resolvedTarget) && statSync(resolvedTarget).isDirectory();
    console.error(`Selected ${files.length} COD CIFs; writing ${resolve(options.out)}`);
    const processorSpeedStart = processorSpeed();
    const records = [];
    let failureCount = 0;
    for (let index = 0; index < files.length; index++) {
        const sampledFile = files[index];
        const path = sampledFile.path;
        try {
            const record = withoutLibraryDiagnostics(() => benchmarkStructure(
                path, options, seededRandom(seedForText(path, options.seed)),
            ));
            record.path = targetIsDirectory ? relative(resolvedTarget, path) : basename(path);
            record.codId = basename(path, extname(path));
            record.fileSizeBytes = sampledFile.sizeBytes;
            record.fileSizeQuantile = sampledFile.sizeQuantile;
            record.sampleIndex = index;
            records.push(record);
        } catch (error) {
            failureCount++;
            records.push({
                path: targetIsDirectory ? relative(resolvedTarget, path) : basename(path),
                codId: basename(path, extname(path)),
                fileSizeBytes: sampledFile.sizeBytes,
                fileSizeQuantile: sampledFile.sizeQuantile,
                success: false,
                error: error.message,
                sampleIndex: index,
            });
        }
        const completed = index + 1;
        if (completed === 1 || completed === files.length ||
            completed % options.progressEvery === 0) {
            console.error(
                `[${completed}/${files.length}] completed; ` +
                `${completed - failureCount} successful, ${failureCount} skipped`,
            );
        }
        if (completed % options.checkpointEvery === 0) {
            writeCsv(options.out, records);
        }
    }
    const processorSpeedEnd = processorSpeed();
    const successful = records.filter(record => record.success);
    if (successful.length === 0) {
        throw new Error('No sampled COD structure completed the density benchmark');
    }
    for (const record of records) {
        const fraction = files.length <= 1 ? 0.5 : record.sampleIndex / (files.length - 1);
        record.processorSpeedStart = processorSpeedStart;
        record.processorSpeedEnd = processorSpeedEnd;
        record.processorSpeed = processorSpeedStart +
            fraction * (processorSpeedEnd - processorSpeedStart);
        record.processorSpeedDrift = processorSpeedEnd / processorSpeedStart;
    }
    const heuristic = fitHeuristic(successful);
    for (const record of successful) {
        record.fcalcWork = record.fcalcMs * record.processorSpeed;
        record.densityWork = record.densityMs * record.processorSpeed;
        record.surfaceWork = record.surfaceWallMs * record.processorSpeed;
        const estimate = estimateDensityPipelineTimings({
            reflectionCount: record.reflectionCount,
            unitCellAtoms: record.unitCellAtoms,
            scatteringModelCount: record.scatteringModelCount,
            gridPoints: record.gridPoints,
            coefficientCount: record.coefficientCount,
            surfaceResolution: record.surfaceResolution,
            marchingCubesPassCount: record.marchingCubesPassCount,
        }, heuristic, record.processorSpeed);
        record.estimatedFcalcMs = estimate.fcalcMs;
        record.estimatedDensityMs = estimate.densityMs;
        record.estimatedSurfaceMs = estimate.surfaceMs;
        record.estimatedTotalMs = estimate.totalMs;
        const recommendation = recommendProgressiveSchedule(record.estimatedTotalMs, {
            minimumStepMs: options.minStepMs,
            maximumStepMs: options.maxStepMs,
        });
        record.recommendedStepCount = recommendation.stepCount;
        record.recommendedStepMs = recommendation.estimatedStepMs;
        record.recommendedProgressiveSteps = recommendation.fractions.join(';');
    }
    writeCsv(options.out, records);
    const model = {
        generatedAt: new Date().toISOString(),
        sampleSize: successful.length,
        requestedSampleSize: files.length,
        codPopulationSize: sampling.populationSize,
        fileSizeRangeBytes: sampling.fileSizeRangeBytes,
        samplingSeed: options.seed,
        samplingMethod: 'one deterministic random CIF per equal-probability file-size stratum',
        dMin: options.dMin,
        processorSpeedStart,
        processorSpeedEnd,
        workPerUnit: heuristic,
        predictors: {
            fcalc: 'reflectionCount * (unitCellAtoms + scatteringModelCount)',
            density: 'gridPoints * (log2(gridPoints) + 1) + coefficientCount',
            surface: 'surfaceResolution^3 * marchingCubesPassCount',
        },
        progressiveTimingWindowMs: [options.minStepMs, options.maxStepMs],
        progressiveFractionModel: '(stepIndex / stepCount)^(1/3)',
    };
    writeFileSync(resolve(options.modelOut), `${JSON.stringify(model, null, 2)}\n`);
    console.log(JSON.stringify({
        output: resolve(options.out),
        modelOutput: resolve(options.modelOut),
        requested: files.length,
        successful: successful.length,
        processorSpeedStart,
        processorSpeedEnd,
        processorSpeedDrift: processorSpeedEnd / processorSpeedStart,
        heuristic,
    }, null, 2));
}

await main();
