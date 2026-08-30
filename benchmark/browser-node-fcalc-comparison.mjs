#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- focused browser/Node benchmark */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { CIF } from '../src/lib/read-cif/base.js';
import { createCifDifferenceDensityDataset } from '../src/lib/density/difference-density.js';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';
import { createStructureFactorModelInput } from '../src/lib/density/structure-factor-model.js';
import {
    canonicalReflectionIndex,
    isGeneralPositionSystematicAbsence,
} from '../src/lib/density/reciprocal-symmetry.js';
import { readCodStructure } from './lib/cod-sample.mjs';
import { parseCsv } from './lib/csv.mjs';
import * as math from '../src/lib/math-lite.js';

const repository = resolve(import.meta.dirname, '..');
const bundle = resolve(process.env.CIFVIS_BUNDLE ?? join(repository, 'dist/cifvis.alldeps.js'));
const output = resolve(process.argv[2] ?? '/tmp/browser-node-fcalc-comparison.json');
const TWO_PI = 2 * Math.PI;
const REPETITIONS = Number.parseInt(process.env.REPETITIONS ?? '3', 10);
const DWF_MODE = process.env.DWF_MODE ?? 'direct';
const PREWARM_WORKER = process.env.PREWARM_WORKER === 'true';
const SURFACE_MODE = process.env.SURFACE_MODE ?? 'legacy';
const USE_SYMMETRY = process.env.USE_SYMMETRY !== 'false';

function parseArguments(args) {
    const options = {
        paths: [],
        representativeCount: 50,
        representativeMetric: 'corePipelineMs',
        representativeRoot: null,
        representativeCsv: null,
    };
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--representative-csv') {
            options.representativeCsv = resolve(args[++index]);
        } else if (argument === '--representative-root') {
            options.representativeRoot = resolve(args[++index]);
        } else if (argument === '--representative-count') {
            options.representativeCount = Number.parseInt(args[++index], 10);
        } else if (argument === '--representative-metric') {
            options.representativeMetric = args[++index];
        } else {
            options.paths.push(resolve(argument));
        }
    }
    return options;
}

function selectRepresentatives(options) {
    if (!options.representativeCsv) {
        return options.paths.map(path => ({ path }));
    }
    if (!options.representativeRoot) {
        throw new Error('--representative-root is required with --representative-csv');
    }
    const candidates = parseCsv(readFileSync(options.representativeCsv, 'utf8'))
        .filter(row => row.success === 'true' && Number.isFinite(Number(row[options.representativeMetric])))
        .sort((first, second) => Number(first[options.representativeMetric]) -
            Number(second[options.representativeMetric]));
    const count = Math.min(options.representativeCount, candidates.length);
    if (!Number.isInteger(count) || count < 1) {
        throw new Error(`Invalid representative count: ${options.representativeCount}`);
    }
    return Array.from({ length: count }, (_, index) => {
        const start = Math.floor(index * candidates.length / count);
        const end = Math.max(start + 1, Math.floor((index + 1) * candidates.length / count));
        const midpoint = Math.floor((start + end - 1) / 2);
        const ranks = Array.from({ length: end - start }, (_, offset) => start + offset)
            .sort((first, second) => Math.abs(first - midpoint) - Math.abs(second - midpoint));
        return {
            representativeQuantile: (index + 0.5) / count,
            representativeTargetRank: midpoint,
            representativePopulationSize: candidates.length,
            censusMetric: options.representativeMetric,
            candidates: ranks.map(rank => ({
                path: resolve(options.representativeRoot, candidates[rank].path),
                representativeRank: rank,
                censusMetricValue: Number(candidates[rank][options.representativeMetric]),
                censusStructure: Object.fromEntries([
                    'asymmetricUnitAtoms', 'unitCellAtoms', 'symmetryOperationCount',
                    'reflectionCount', 'gridPoints', 'polygonCount', 'fieldSampleCount',
                ].map(name => [name, Number(candidates[rank][name])])),
            })),
        };
    });
}

const benchmarkOptions = parseArguments(process.argv.slice(3));
const representativeCases = selectRepresentatives(benchmarkOptions);

function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
}

function reciprocalMatrix(cell) {
    const result = math.transpose(math.inv(cell.fractToCartMatrix));
    return Array.isArray(result) ? result : result.toArray();
}

function generateReflections(structure, dMin = 0.9, maximum = 60000) {
    const reciprocal = reciprocalMatrix(structure.cell);
    const inverse = math.inv(reciprocal);
    const inverseReciprocal = Array.isArray(inverse) ? inverse : inverse.toArray();
    const limit = 1 / dMin;
    const bounds = inverseReciprocal.map(row =>
        Math.ceil(Math.hypot(...row) * limit));
    const reflections = [];
    const seen = new Set();
    for (let h = -bounds[0]; h <= bounds[0]; h++) {
        for (let k = -bounds[1]; k <= bounds[1]; k++) {
            for (let l = -bounds[2]; l <= bounds[2]; l++) {
                if ((h === 0 && k === 0 && l === 0) ||
                    Math.hypot(...math.multiply(reciprocal, [h, k, l])) > limit + 1e-12 ||
                    isGeneralPositionSystematicAbsence(h, k, l, structure.symmetry)) {
                    continue;
                }
                const canonical = canonicalReflectionIndex(h, k, l, structure.symmetry, true);
                const key = canonical.join(',');
                if (!seen.has(key)) {
                    seen.add(key);
                    reflections.push(canonical);
                }
                if (reflections.length > maximum) {
                    throw new Error(`Reflection limit exceeded (${maximum})`);
                }
            }
        }
    }
    return reflections;
}

function appendObservedReflectionLoop(cifText, calculated) {
    const lines = [
        '', 'loop_', '_refln_index_h', '_refln_index_k', '_refln_index_l',
        '_refln_F_squared_meas', '_refln_F_squared_sigma',
    ];
    for (let index = 0; index < calculated.h.length; index++) {
        const amplitude = Math.sqrt(calculated.fSquared[index]);
        const modulation = 1 + 0.025 * Math.sin((index + 1) * 0.61803398875 * TWO_PI);
        const observedSquared = (amplitude * modulation) ** 2;
        lines.push(`${calculated.h[index]} ${calculated.k[index]} ${calculated.l[index]} ` +
            `${observedSquared.toPrecision(12)} ${Math.max(1e-6, observedSquared * 0.02).toPrecision(8)}`);
    }
    return `${cifText.trimEnd()}\n${lines.join('\n')}\n`;
}

function prepareCase(selection) {
    const { path } = selection;
    const cifText = readFileSync(path, 'utf8');
    const { structure } = readCodStructure(cifText);
    const reflections = generateReflections(structure);
    const calculator = createIAMStructureFactorCalculator(cifText, 0, { includeAnomalous: false });
    const calculated = calculator.calculatePrepared(reflections);
    const combinedText = appendObservedReflectionLoop(cifText, calculated);
    const cif = new CIF(combinedText);
    const block = cif.getBlock(0);
    const structureModel = createStructureFactorModelInput(structure, block);
    const nodeRuns = Array.from({ length: REPETITIONS }, () =>
        createCifDifferenceDensityDataset(combinedText, 0, {
            coordinateCifText: combinedText,
            coordinateCifBlock: 0,
            structureModel,
            iam: { dwfMode: DWF_MODE },
        }));
    return {
        ...selection,
        codId: basename(path, '.cif'),
        combinedText,
        reflectionCount: reflections.length,
        nodeIamModelBuildMs: median(nodeRuns.map(run => run.iam.modelBuildTimeMs)),
        nodeFcalcMs: median(nodeRuns.map(run => run.iam.calculation.timeMs)),
    };
}

function prepareRepresentative(selection) {
    if (!selection.candidates) {
        return prepareCase(selection);
    }
    const rejectedCandidates = [];
    for (const candidate of selection.candidates) {
        try {
            return prepareCase({
                ...selection,
                ...candidate,
                candidates: undefined,
                representativeAttemptCount: rejectedCandidates.length + 1,
                representativeRejectedCandidates: rejectedCandidates,
            });
        } catch (error) {
            rejectedCandidates.push({
                path: candidate.path,
                rank: candidate.representativeRank,
                error: error.message,
            });
        }
    }
    throw new Error(`No usable browser benchmark case in stratum near p${
        (100 * selection.representativeQuantile).toFixed(0)}`);
}

const html = `<!doctype html><html><body><div id="viewer"></div><script type="module">
import * as CifVis from '/bundle.js';
window.runCase = async (cifText, dwfMode, prewarmWorker, surfaceMode, useSymmetry) => {
  const viewer = new CifVis.CrystalViewer(document.getElementById('viewer'), {
    debug: true,
    renderMode: 'onDemand',
    scalarField: {useWorker: true},
    differenceDensity: prewarmWorker
      ? {autoLoad: true, iam: {dwfMode}}
      : {autoLoad: false},
    isosurface: {
      progressiveSteps: [1],
      visible: false,
      generationMode: surfaceMode,
      useSymmetry,
    },
  });
  if (prewarmWorker) {
    const deadline = performance.now() + 5000;
    while (viewer.scalarFieldWorkerReadyEpochMs === null && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  const started = performance.now();
  const structure = await viewer.loadCIF(cifText, 0, prewarmWorker ? {} : {
    differenceDensity: {progressiveSteps: [1], visible: false, iam: {dwfMode}},
  });
  const density = structure.differenceDensity ? await structure.differenceDensity : structure;
  const wallMs = performance.now() - started;
  viewer.dispose();
  return {structure, density, wallMs};
};
</script></body></html>`;

function startServer() {
    return new Promise(resolvePromise => {
        const server = createServer((request, response) => {
            const url = new URL(request.url, 'http://localhost');
            if (url.pathname === '/') {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end(html);
            } else if (url.pathname === '/bundle.js') {
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(bundle));
            } else if (url.pathname.startsWith('/assets/')) {
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(join(repository, 'dist', url.pathname)));
            } else {
                response.writeHead(404);
                response.end();
            }
        });
        server.listen(0, '127.0.0.1', () => resolvePromise({
            server,
            port: server.address().port,
        }));
    });
}

if (representativeCases.length === 0) {
    throw new Error('Provide one or more coordinate CIF paths after the output path');
}
const preparedCases = representativeCases.map(prepareRepresentative);
const { server, port } = await startServer();
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH ?? '/run/current-system/sw/bin/google-chrome',
});
const results = [];
try {
    for (const prepared of preparedCases) {
        const browserRuns = [];
        for (let repetition = 0; repetition < REPETITIONS; repetition++) {
            const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
            const page = await context.newPage();
            await page.goto(`http://127.0.0.1:${port}/`);
            browserRuns.push(await page.evaluate(
                ({ text, dwfMode, prewarmWorker, surfaceMode, useSymmetry }) =>
                    window.runCase(
                        text,
                        dwfMode,
                        prewarmWorker,
                        surfaceMode,
                        useSymmetry,
                    ),
                {
                    text: prepared.combinedText,
                    dwfMode: DWF_MODE,
                    prewarmWorker: PREWARM_WORKER,
                    surfaceMode: SURFACE_MODE,
                    useSymmetry: USE_SYMMETRY,
                },
            ));
            await context.close();
        }
        const metric = select => median(browserRuns.map(select));
        results.push({
            codId: prepared.codId,
            success: browserRuns.every(run => run.structure.success && run.density.success),
            errors: browserRuns.flatMap(run => [
                run.structure.success ? null : run.structure.error,
                run.density.success ? null : run.density.error,
            ]).filter(Boolean),
            path: prepared.path,
            representativeQuantile: prepared.representativeQuantile ?? null,
            representativeTargetRank: prepared.representativeTargetRank ?? null,
            representativeRank: prepared.representativeRank ?? null,
            representativeAttemptCount: prepared.representativeAttemptCount ?? 1,
            representativeRejectedCandidates: prepared.representativeRejectedCandidates ?? [],
            representativePopulationSize: prepared.representativePopulationSize ?? null,
            censusMetric: prepared.censusMetric ?? null,
            censusMetricValue: prepared.censusMetricValue ?? null,
            censusStructure: prepared.censusStructure ?? null,
            dwfMode: DWF_MODE,
            reflectionCount: prepared.reflectionCount,
            nodeIamModelBuildMs: prepared.nodeIamModelBuildMs,
            nodeFcalcMs: prepared.nodeFcalcMs,
            browserIamModelBuildMs: metric(run => run.density.iam?.modelBuildTimeMs),
            browserFcalcMs: metric(run => run.density.iam?.calculation?.timeMs),
            browserDwfDiagnostics: Object.fromEntries([
                'dwfMode', 'dwfVectorReuseEnabled', 'dwfPreparationMs', 'noAdpExpandedAtomCount',
                'uisoExpandedAtomCount', 'uaniExpandedAtomCount', 'uniqueUisoCount',
                'uniqueReciprocalUaniTensorCount', 'uisoDwfExpEvaluationCount',
                'uaniDwfExpEvaluationCount', 'dwfExpEvaluationCount', 'workBufferBytes',
            ].map(name => [name, metric(run => run.density.iam?.calculation?.[name] ??
                run.density.iam?.calculation?.diagnostics?.[name])])),
            browserReflectionPreparationMs:
                metric(run => run.density.workerReflectionPreparationTimeMs),
            browserReflectionStages: Object.fromEntries([
                'reflectionSourceDiscoveryMs', 'reflectionSourceParseMs',
                'reflectionRowDecodeMs', 'reflectionSymmetrySetupMs',
                'reflectionAbsenceMs', 'reflectionCanonicalizationMs',
                'reflectionMergeAccumulationMs', 'reflectionMergeFinalizationMs',
                'reflectionMergeSortMs', 'reflectionPreparationTotalMs',
            ].map(name => [name, metric(run => run.density[name])])),
            browserReflectionCounts: Object.fromEntries([
                'rawReflectionCount', 'validReflectionCount', 'invalidReflectionCount',
                'distinctInputHklCount', 'systematicAbsenceCount', 'mergedReflectionCount',
                'symmetryOperationCount', 'absenceCacheHitCount', 'absenceCacheMissCount',
                'canonicalCacheHitCount', 'canonicalCacheMissCount',
                'shelxFallbackDecodeCount',
            ].map(name => [name, metric(run => run.density[name])])),
            browserWorkerIdleAfterReflectionPreparationMs:
                metric(run => run.density.workerIdleAfterReflectionPreparationMs),
            browserModelWaitForReflectionPreparationMs:
                metric(run => run.density.modelWaitForReflectionPreparationMs),
            browserWorkerWaitForModelMs:
                metric(run => run.density.workerWaitForModelMs),
            browserWorkerJoinDelayMs: metric(run => run.density.workerJoinDelayMs),
            browserTimings: Object.fromEntries([
                'workerCreatedMs', 'workerConstructedMs', 'workerReadyMs',
                'workerReadyToFirstTaskMs', 'rawCifPostedMs', 'cifParsedMs', 'structureReadyMs',
                'structureModelReadyMs', 'modelPostedMs', 'densityLoadStartedMs',
                'structureSceneReadyMs', 'reflectionPreparationStartedMs',
                'reflectionsPreparedMs', 'workerCalculationStartedMs',
                'workerMapPostedMs', 'mapReceivedMs', 'densityAppliedMs',
            ].map(name => [name, metric(run => run.structure.browserTimings?.[name])])),
            browserApplicationStages: Object.fromEntries([
                'mapPayloadReconstructionTimeMs', 'mainThreadApplyTimeMs',
                'mainThreadApplyTotalTimeMs', 'mainThreadValidationTimeMs',
                'mainThreadFieldStoreTimeMs', 'mainThreadDisplayStateTimeMs',
                'mainThreadRenderRequestTimeMs', 'mainThreadUpdateNotificationTimeMs',
            ].map(name => [name, metric(run => run.density[name])])),
            browserSurfaceStages: Object.fromEntries([
                'surfaceTotalTimeMs', 'surfaceBoundsTimeMs', 'surfaceMaskTimeMs',
                'surfaceSamplingTimeMs', 'surfaceClassificationTimeMs',
                'surfaceAllocationTimeMs', 'surfaceInterpolationTimeMs',
                'surfaceGeometryTimeMs', 'surfaceWireframeTimeMs',
                'surfaceSymmetryAssemblyTimeMs', 'surfacePatchPlanningTimeMs',
                'surfacePatchMaskTimeMs', 'surfacePatchCellSelectionTimeMs',
                'surfacePatchExtractionTimeMs',
                'surfaceAssemblyTimeMs', 'polygonCount', 'generatedCellCount',
                'reusedCellCount', 'fieldSampleCount', 'allocatedGeometryBytes',
            ].map(name => [name, metric(run => run.density[name])])),
            browserDatasetPreparationMs:
                metric(run => run.density.workerDatasetPreparationTimeMs),
            browserWorkerStages: Object.fromEntries([
                'workerProgressionSetupTimeMs', 'workerComputeTimeMs',
                'workerPayloadPreparationTimeMs', 'workerElapsedTimeMs',
            ].map(name => [name, metric(run => run.density[name])])),
            browserDatasetStages: Object.fromEntries([
                'datasetSelfDescriptionDetectionMs',
                'datasetExplicitCoefficientAttemptMs', 'datasetSourceDispatchTotalMs',
                'datasetSourceSetupMs', 'datasetCellSymmetrySetupMs',
                'datasetObservationSetupMs', 'datasetIamModelBuildMs',
                'datasetFcalcMs', 'datasetCoordinateSetupMs',
                'datasetSolventMaskDiscoveryDecodeMs',
                'datasetSolventMaskSymmetryExpansionMs',
                'datasetSolventMaskCopyApplicationMs', 'datasetSolventMaskMetadataMs',
                'datasetExtinctionMs', 'datasetScaleFitMs',
                'datasetCoefficientInputSetupMs', 'datasetCoefficientExpansionMs',
                'datasetFinalizationMs', 'datasetInstrumentedTotalMs',
            ].map(name => [name, metric(run => run.density[name])])),
            browserFftMs: metric(run => run.density.fftTotalTimeMs),
            browserDensityMapStages: Object.fromEntries([
                'densityCoefficientSelectionTimeMs', 'densityMapAssemblyTimeMs',
                'densityMapTotalTimeMs', 'fftPlanSetupTimeMs',
                'fftGridPlanningTimeMs', 'fftHermitianValidationTimeMs',
                'fftAllocationTimeMs', 'fftCoefficientPlacementTimeMs',
                'fftTransformTimeMs', 'fftStatisticsTimeMs', 'fftTotalTimeMs',
            ].map(name => [name, metric(run => run.density[name])])),
            browserWorkerElapsedMs: metric(run => run.density.workerElapsedTimeMs),
            browserWallMs: metric(run => run.wallMs),
            browserRuns: browserRuns.map(run => ({
                structureSuccess: run.structure.success,
                densitySuccess: run.density.success,
                structureError: run.structure.error ?? null,
                densityError: run.density.error ?? null,
                iamModelBuildMs: run.density.iam?.modelBuildTimeMs,
                fcalcMs: run.density.iam?.calculation?.timeMs,
                reflectionPreparationMs: run.density.workerReflectionPreparationTimeMs,
                reflectionStages: Object.fromEntries([
                    'reflectionSourceDiscoveryMs', 'reflectionSourceParseMs',
                    'reflectionRowDecodeMs', 'reflectionSymmetrySetupMs',
                    'reflectionAbsenceMs', 'reflectionCanonicalizationMs',
                    'reflectionMergeAccumulationMs', 'reflectionMergeFinalizationMs',
                    'reflectionMergeSortMs', 'reflectionPreparationTotalMs',
                ].map(name => [name, run.density[name]])),
                workerIdleAfterReflectionPreparationMs:
                    run.density.workerIdleAfterReflectionPreparationMs,
                modelWaitForReflectionPreparationMs:
                    run.density.modelWaitForReflectionPreparationMs,
                workerWaitForModelMs: run.density.workerWaitForModelMs,
                workerJoinDelayMs: run.density.workerJoinDelayMs,
                browserTimings: run.structure.browserTimings,
                applicationStages: Object.fromEntries([
                    'mapPayloadReconstructionTimeMs', 'mainThreadApplyTimeMs',
                    'mainThreadApplyTotalTimeMs', 'mainThreadValidationTimeMs',
                    'mainThreadFieldStoreTimeMs', 'mainThreadDisplayStateTimeMs',
                    'mainThreadRenderRequestTimeMs', 'mainThreadUpdateNotificationTimeMs',
                ].map(name => [name, run.density[name]])),
                surfaceStages: Object.fromEntries([
                    'surfaceTotalTimeMs', 'surfaceBoundsTimeMs', 'surfaceMaskTimeMs',
                    'surfaceSamplingTimeMs', 'surfaceClassificationTimeMs',
                    'surfaceAllocationTimeMs', 'surfaceInterpolationTimeMs',
                    'surfaceGeometryTimeMs', 'surfaceWireframeTimeMs',
                    'surfaceSymmetryAssemblyTimeMs', 'surfacePatchPlanningTimeMs',
                    'surfacePatchMaskTimeMs', 'surfacePatchCellSelectionTimeMs',
                    'surfacePatchExtractionTimeMs',
                    'surfaceAssemblyTimeMs', 'polygonCount', 'generatedCellCount',
                    'reusedCellCount', 'fieldSampleCount', 'allocatedGeometryBytes',
                ].map(name => [name, run.density[name]])),
                datasetPreparationMs: run.density.workerDatasetPreparationTimeMs,
                workerStages: Object.fromEntries([
                    'workerProgressionSetupTimeMs', 'workerComputeTimeMs',
                    'workerPayloadPreparationTimeMs', 'workerElapsedTimeMs',
                ].map(name => [name, run.density[name]])),
                datasetStages: Object.fromEntries([
                    'datasetSelfDescriptionDetectionMs',
                    'datasetExplicitCoefficientAttemptMs', 'datasetSourceDispatchTotalMs',
                    'datasetSourceSetupMs', 'datasetCellSymmetrySetupMs',
                    'datasetObservationSetupMs', 'datasetIamModelBuildMs',
                    'datasetFcalcMs', 'datasetCoordinateSetupMs',
                    'datasetSolventMaskDiscoveryDecodeMs',
                    'datasetSolventMaskSymmetryExpansionMs',
                    'datasetSolventMaskCopyApplicationMs',
                    'datasetSolventMaskMetadataMs', 'datasetExtinctionMs',
                    'datasetScaleFitMs', 'datasetCoefficientInputSetupMs',
                    'datasetCoefficientExpansionMs', 'datasetFinalizationMs',
                    'datasetInstrumentedTotalMs',
                ].map(name => [name, run.density[name]])),
                fftMs: run.density.fftTotalTimeMs,
                densityMapStages: Object.fromEntries([
                    'densityCoefficientSelectionTimeMs', 'densityMapAssemblyTimeMs',
                    'densityMapTotalTimeMs', 'fftPlanSetupTimeMs',
                    'fftGridPlanningTimeMs', 'fftHermitianValidationTimeMs',
                    'fftAllocationTimeMs', 'fftCoefficientPlacementTimeMs',
                    'fftTransformTimeMs', 'fftStatisticsTimeMs', 'fftTotalTimeMs',
                ].map(name => [name, run.density[name]])),
                workerElapsedMs: run.density.workerElapsedTimeMs,
                wallMs: run.wallMs,
            })),
        });
    }
} finally {
    await browser.close();
    await new Promise(resolvePromise => server.close(resolvePromise));
}
writeFileSync(output, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    bundle,
    prewarmWorker: PREWARM_WORKER,
    surfaceMode: SURFACE_MODE,
    useSymmetry: USE_SYMMETRY,
    repetitions: REPETITIONS,
    representativeSelection: benchmarkOptions.representativeCsv ? {
        source: benchmarkOptions.representativeCsv,
        root: benchmarkOptions.representativeRoot,
        count: representativeCases.length,
        metric: benchmarkOptions.representativeMetric,
        method: 'equal-count-stratum-midpoints',
    } : null,
    results,
}, null, 2)}\n`);
console.log(JSON.stringify({ output, results }, null, 2));
