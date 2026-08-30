#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone benchmark report */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsv } from './lib/csv.mjs';

const input = resolve(process.argv[2] ?? '/tmp/browser-density-consistency-50.json');
const output = resolve(process.argv[3] ?? '/tmp/browser-density-consistency-50-summary.json');
const markdownOutput = output.replace(/\.json$/u, '.md');
const benchmark = JSON.parse(readFileSync(input, 'utf8'));
const censusPath = benchmark.representativeSelection?.source;
const censusById = censusPath && existsSync(censusPath)
    ? new Map(parseCsv(readFileSync(censusPath, 'utf8')).map(row => [row.codId, row]))
    : new Map();

const difference = (timings, end, start) =>
    Number.isFinite(timings?.[end]) && Number.isFinite(timings?.[start])
        ? Math.max(0, timings[end] - timings[start])
        : null;
const subtract = (value, ...parts) => Number.isFinite(value)
    ? Math.max(0, value - parts.filter(Number.isFinite).reduce((sum, part) => sum + part, 0))
    : null;

const components = [
    {
        id: 'mainCifParse', lane: 'main', label: 'Parse coordinate CIF',
        value: run => difference(run.browserTimings, 'cifParsedMs', 'rawCifPostedMs'),
    },
    {
        id: 'mainCrystalModel', lane: 'main', label: 'Build crystallographic structure',
        value: run => difference(run.browserTimings, 'structureReadyMs', 'cifParsedMs'),
    },
    {
        id: 'mainDensityModel', lane: 'main', label: 'Prepare density model handoff',
        value: run => difference(run.browserTimings, 'structureModelReadyMs', 'structureReadyMs'),
    },
    {
        id: 'mainMolecularScene', lane: 'main', label: 'Build molecular scene',
        value: run => difference(
            run.browserTimings, 'structureSceneReadyMs', 'structureModelReadyMs',
        ),
    },
    {
        id: 'mainWaitAfterScene', lane: 'main', label: 'Wait for density map after structure display',
        value: run => difference(run.browserTimings, 'mapReceivedMs', 'structureSceneReadyMs'),
    },
    {
        id: 'mainMapTransfer', lane: 'handoff', label: 'Deliver map message to main thread',
        value: run => difference(run.browserTimings, 'mapReceivedMs', 'workerMapPostedMs'),
    },
    {
        id: 'mainPayloadReconstruction', lane: 'main', label: 'Reconstruct transferred map',
        value: run => run.applicationStages?.mapPayloadReconstructionTimeMs,
    },
    {
        id: 'mainApplication', lane: 'main', kind: 'roll-up',
        label: 'Apply density result — total',
        value: run => run.applicationStages?.mainThreadApplyTotalTimeMs,
    },
    {
        id: 'mainScalarFieldInstall', lane: 'main', label: 'Install scalar field',
        value: run => subtract(
            run.applicationStages?.mainThreadFieldStoreTimeMs,
            run.surfaceStages?.surfaceTotalTimeMs,
        ),
    },
    {
        id: 'mainSurface', lane: 'main', kind: 'roll-up',
        label: 'Extract and install isosurface — total',
        value: run => run.surfaceStages?.surfaceTotalTimeMs,
    },
    {
        id: 'surfaceMask', lane: 'main/surface', label: 'Define surface bounds and atom mask',
        value: run => (run.surfaceStages?.surfaceBoundsTimeMs ?? 0) +
            (run.surfaceStages?.surfaceMaskTimeMs ?? 0),
    },
    {
        id: 'surfaceSampling', lane: 'main/surface', label: 'Sample periodic density field',
        value: run => run.surfaceStages?.surfaceSamplingTimeMs,
    },
    {
        id: 'surfaceClassification', lane: 'main/surface', label: 'Classify marching-cubes cells',
        value: run => run.surfaceStages?.surfaceClassificationTimeMs,
    },
    {
        id: 'surfaceInterpolation', lane: 'main/surface',
        label: 'Allocate and interpolate surface vertices',
        value: run => (run.surfaceStages?.surfaceAllocationTimeMs ?? 0) +
            (run.surfaceStages?.surfaceInterpolationTimeMs ?? 0),
    },
    {
        id: 'surfaceGeometry', lane: 'main/surface', label: 'Build surface geometry and edges',
        value: run => (run.surfaceStages?.surfaceGeometryTimeMs ?? 0) +
            (run.surfaceStages?.surfaceWireframeTimeMs ?? 0),
    },
    {
        id: 'surfaceSymmetry', lane: 'main/surface', label: 'Assemble symmetry-related surfaces',
        value: run => run.surfaceStages?.surfaceSymmetryAssemblyTimeMs,
    },
    {
        id: 'mainDisplayAndRender', lane: 'main', label: 'Update display state and request render',
        value: run => (run.applicationStages?.mainThreadDisplayStateTimeMs ?? 0) +
            (run.applicationStages?.mainThreadRenderRequestTimeMs ?? 0),
    },
    {
        id: 'mainNotify', lane: 'main', label: 'Publish density update',
        value: run => run.applicationStages?.mainThreadUpdateNotificationTimeMs,
    },
    {
        id: 'workerStartup', lane: 'handoff', label: 'Dispatch CIF task to ready worker',
        value: run => difference(
            run.browserTimings, 'reflectionPreparationStartedMs', 'rawCifPostedMs',
        ),
    },
    {
        id: 'workerReflections', lane: 'worker', kind: 'roll-up',
        label: 'Prepare reflections — total',
        value: run => run.reflectionPreparationMs,
    },
    {
        id: 'workerReflectionDecode', lane: 'worker/reflections',
        label: 'Discover and decode reflection loop',
        value: run => (run.reflectionStages?.reflectionSourceDiscoveryMs ?? 0) +
            (run.reflectionStages?.reflectionSourceParseMs ?? 0) +
            (run.reflectionStages?.reflectionRowDecodeMs ?? 0),
    },
    {
        id: 'workerReflectionSymmetry', lane: 'worker/reflections',
        label: 'Apply absences and reciprocal symmetry',
        value: run => (run.reflectionStages?.reflectionSymmetrySetupMs ?? 0) +
            (run.reflectionStages?.reflectionAbsenceMs ?? 0) +
            (run.reflectionStages?.reflectionCanonicalizationMs ?? 0),
    },
    {
        id: 'workerReflectionMerge', lane: 'worker/reflections',
        label: 'Merge and sort equivalent reflections',
        value: run => (run.reflectionStages?.reflectionMergeAccumulationMs ?? 0) +
            (run.reflectionStages?.reflectionMergeFinalizationMs ?? 0) +
            (run.reflectionStages?.reflectionMergeSortMs ?? 0),
    },
    {
        id: 'workerModelWait', lane: 'worker', label: 'Wait for density model handoff',
        value: run => run.workerWaitForModelMs,
    },
    {
        id: 'workerIdleAfterReflections', lane: 'worker', kind: 'nested',
        label: 'Idle after reflection preparation (included in model wait)',
        value: run => run.workerIdleAfterReflectionPreparationMs,
    },
    {
        id: 'modelWaitForReflections', lane: 'handoff',
        label: 'Density model waits for prepared reflections',
        value: run => run.modelWaitForReflectionPreparationMs,
    },
    {
        id: 'workerJoin', lane: 'worker', label: 'Join reflections with density model',
        value: run => run.workerJoinDelayMs,
    },
    {
        id: 'workerIamModel', lane: 'worker', label: 'Build IAM scattering model',
        value: run => run.datasetStages?.datasetIamModelBuildMs,
    },
    {
        id: 'workerFcalc', lane: 'worker', label: 'Calculate Fcalc',
        value: run => run.datasetStages?.datasetFcalcMs,
    },
    {
        id: 'workerDatasetTotal', lane: 'worker', kind: 'roll-up',
        label: 'Prepare density dataset — total',
        value: run => run.datasetPreparationMs,
    },
    {
        id: 'workerDatasetSetup', lane: 'worker/dataset',
        label: 'Set up density source, cell, and symmetry',
        value: run => (run.datasetStages?.datasetSourceSetupMs ?? 0) +
            (run.datasetStages?.datasetCellSymmetrySetupMs ?? 0),
    },
    {
        id: 'workerObservations', lane: 'worker/dataset', label: 'Prepare observed intensities',
        value: run => run.datasetStages?.datasetObservationSetupMs,
    },
    {
        id: 'workerCoordinates', lane: 'worker/dataset', label: 'Prepare atomic coordinates',
        value: run => run.datasetStages?.datasetCoordinateSetupMs,
    },
    {
        id: 'workerSolventMask', lane: 'worker/dataset', label: 'Decode and apply solvent mask',
        value: run => (run.datasetStages?.datasetSolventMaskDiscoveryDecodeMs ?? 0) +
            (run.datasetStages?.datasetSolventMaskSymmetryExpansionMs ?? 0) +
            (run.datasetStages?.datasetSolventMaskCopyApplicationMs ?? 0) +
            (run.datasetStages?.datasetSolventMaskMetadataMs ?? 0),
    },
    {
        id: 'workerCorrections', lane: 'worker/dataset',
        label: 'Apply extinction and fit intensity scale',
        value: run => (run.datasetStages?.datasetExtinctionMs ?? 0) +
            (run.datasetStages?.datasetScaleFitMs ?? 0),
    },
    {
        id: 'workerCoefficients', lane: 'worker/dataset',
        label: 'Set up and symmetry-expand Fourier coefficients',
        value: run => (run.datasetStages?.datasetCoefficientInputSetupMs ?? 0) +
            (run.datasetStages?.datasetCoefficientExpansionMs ?? 0),
    },
    {
        id: 'workerDatasetFinalize', lane: 'worker/dataset', label: 'Finalize density dataset',
        value: run => run.datasetStages?.datasetFinalizationMs,
    },
    {
        id: 'workerDatasetOther', lane: 'worker/dataset', label: 'Unattributed dataset overhead',
        value: run => subtract(
            run.datasetPreparationMs,
            run.datasetStages?.datasetIamModelBuildMs,
            run.datasetStages?.datasetFcalcMs,
            run.datasetStages?.datasetSourceSetupMs,
            run.datasetStages?.datasetCellSymmetrySetupMs,
            run.datasetStages?.datasetObservationSetupMs,
            run.datasetStages?.datasetCoordinateSetupMs,
            run.datasetStages?.datasetSolventMaskDiscoveryDecodeMs,
            run.datasetStages?.datasetSolventMaskSymmetryExpansionMs,
            run.datasetStages?.datasetSolventMaskCopyApplicationMs,
            run.datasetStages?.datasetSolventMaskMetadataMs,
            run.datasetStages?.datasetExtinctionMs,
            run.datasetStages?.datasetScaleFitMs,
            run.datasetStages?.datasetCoefficientInputSetupMs,
            run.datasetStages?.datasetCoefficientExpansionMs,
            run.datasetStages?.datasetFinalizationMs,
        ),
    },
    {
        id: 'workerFftPlan', lane: 'worker/FFT',
        label: 'Choose FFT grid and validate Hermitian symmetry',
        value: run => (run.densityMapStages?.fftGridPlanningTimeMs ?? 0) +
            (run.densityMapStages?.fftHermitianValidationTimeMs ?? 0),
    },
    {
        id: 'workerFftAxisPlans', lane: 'worker/FFT', kind: 'nested',
        label: 'Build/reuse 1-D FFT plans (included in transform)',
        value: run => run.densityMapStages?.fftPlanSetupTimeMs,
    },
    {
        id: 'workerFftAllocate', lane: 'worker/FFT', label: 'Allocate FFT workspaces',
        value: run => run.densityMapStages?.fftAllocationTimeMs,
    },
    {
        id: 'workerFftPlace', lane: 'worker/FFT', label: 'Place Fourier coefficients',
        value: run => run.densityMapStages?.fftCoefficientPlacementTimeMs,
    },
    {
        id: 'workerFftTransform', lane: 'worker/FFT', label: 'Execute 3-D FFT',
        value: run => run.densityMapStages?.fftTransformTimeMs,
    },
    {
        id: 'workerFftStatistics', lane: 'worker/FFT', label: 'Calculate density statistics',
        value: run => run.densityMapStages?.fftStatisticsTimeMs,
    },
    {
        id: 'workerFftTotal', lane: 'worker/FFT', kind: 'roll-up',
        label: 'Build density grid with FFT — total',
        value: run => run.densityMapStages?.fftTotalTimeMs,
    },
    {
        id: 'workerMapAssembly', lane: 'worker/map',
        label: 'Select coefficients and assemble map object',
        value: run => (run.densityMapStages?.densityCoefficientSelectionTimeMs ?? 0) +
            (run.densityMapStages?.densityMapAssemblyTimeMs ?? 0),
    },
    {
        id: 'workerPayload', lane: 'worker/map', label: 'Prepare map transfer payload',
        value: run => run.workerStages?.workerPayloadPreparationTimeMs,
    },
    {
        id: 'workerProgressionSetup', lane: 'worker',
        label: 'Set up progressive density calculation',
        value: run => run.workerStages?.workerProgressionSetupTimeMs,
    },
    {
        id: 'workerComputeTotal', lane: 'worker', kind: 'roll-up',
        label: 'Calculate density maps — total',
        value: run => run.workerStages?.workerComputeTimeMs,
    },
    {
        id: 'workerTaskTotal', lane: 'worker', kind: 'roll-up',
        label: 'Density worker task — total',
        value: run => run.workerStages?.workerElapsedTimeMs,
    },
    {
        id: 'totalWall', lane: 'total', kind: 'roll-up',
        label: 'Load-to-density-display wall time',
        value: run => run.wallMs,
    },
];

function percentile(values, fraction) {
    const sorted = values.filter(Number.isFinite).sort((first, second) => first - second);
    if (sorted.length === 0) {
        return null;
    }
    return sorted[Math.round(fraction * (sorted.length - 1))];
}

function ranks(values) {
    const sorted = values.map((value, index) => ({ value, index }))
        .sort((first, second) => first.value - second.value);
    const result = [];
    for (let start = 0; start < sorted.length;) {
        let end = start + 1;
        while (end < sorted.length && sorted[end].value === sorted[start].value) {
            end++;
        }
        const averageRank = (start + end - 1) / 2;
        for (let index = start; index < end; index++) {
            result[sorted[index].index] = averageRank;
        }
        start = end;
    }
    return result;
}

function correlation(first, second) {
    if (first.length < 3 || first.length !== second.length) {
        return null;
    }
    const firstRanks = ranks(first);
    const secondRanks = ranks(second);
    const firstMean = firstRanks.reduce((sum, value) => sum + value, 0) / firstRanks.length;
    const secondMean = secondRanks.reduce((sum, value) => sum + value, 0) / secondRanks.length;
    const covariance = firstRanks.reduce((sum, value, index) =>
        sum + (value - firstMean) * (secondRanks[index] - secondMean), 0);
    const firstScale = Math.sqrt(firstRanks.reduce(
        (sum, value) => sum + (value - firstMean) ** 2, 0,
    ));
    const secondScale = Math.sqrt(secondRanks.reduce(
        (sum, value) => sum + (value - secondMean) ** 2, 0,
    ));
    return firstScale && secondScale ? covariance / (firstScale * secondScale) : null;
}

const predictorDefinitions = [
    ['asymmetricUnitAtoms', 'Asymmetric-unit atom count', result =>
        Number(result.censusStructure?.asymmetricUnitAtoms ??
            censusById.get(result.codId)?.asymmetricUnitAtoms)],
    ['unitCellAtoms', 'Unit-cell atom count', result =>
        Number(result.censusStructure?.unitCellAtoms ?? censusById.get(result.codId)?.unitCellAtoms)],
    ['reflectionCount', 'Reflection count', result => result.reflectionCount],
    ['symmetryOperationCount', 'Symmetry-operation count', result =>
        result.browserReflectionCounts?.symmetryOperationCount],
    ['expandedAtomCount', 'Expanded IAM atom count', result => [
        'noAdpExpandedAtomCount', 'uisoExpandedAtomCount', 'uaniExpandedAtomCount',
    ].reduce((sum, name) => sum + (result.browserDwfDiagnostics?.[name] ?? 0), 0)],
    ['fcalcWork', 'Reflections × expanded IAM atoms', result => result.reflectionCount * [
        'noAdpExpandedAtomCount', 'uisoExpandedAtomCount', 'uaniExpandedAtomCount',
    ].reduce((sum, name) => sum + (result.browserDwfDiagnostics?.[name] ?? 0), 0)],
    ['fftGridPoints', 'FFT grid-point count', result =>
        Number(result.censusStructure?.gridPoints ?? censusById.get(result.codId)?.gridPoints)],
    ['fieldSampleCount', 'Surface field-sample count', result =>
        result.browserSurfaceStages?.fieldSampleCount],
    ['polygonCount', 'Surface polygon count', result =>
        result.browserSurfaceStages?.polygonCount],
    ['censusPipelineTime', 'Frozen census pipeline rank', result => result.censusMetricValue],
];

function summarizeComponent(component) {
    const structures = benchmark.results.map(result => {
        const samples = result.browserRuns.map(component.value).filter(Number.isFinite);
        const median = percentile(samples, 0.5);
        const spread = samples.length > 1 && median > 0
            ? (Math.max(...samples) - Math.min(...samples)) / median
            : null;
        const absoluteSpread = samples.length > 1 ? Math.max(...samples) - Math.min(...samples) : null;
        return {
            codId: result.codId,
            quantile: result.representativeQuantile,
            medianMs: median,
            runRangeOverMedian: spread,
            runRangeMs: absoluteSpread,
        };
    }).filter(row => Number.isFinite(row.medianMs));
    const medians = structures.map(row => row.medianMs);
    const spreads = structures.map(row => row.runRangeOverMedian).filter(Number.isFinite);
    const absoluteSpreads = structures.map(row => row.runRangeMs).filter(Number.isFinite);
    const runOrderMedianMs = Array.from({ length: benchmark.repetitions }, (_, runIndex) =>
        percentile(benchmark.results.map(result => component.value(result.browserRuns[runIndex])), 0.5));
    const dependencies = predictorDefinitions.map(([id, label, predictor]) => {
        const pairs = benchmark.results.map(result => ({
            duration: percentile(result.browserRuns.map(component.value), 0.5),
            predictor: predictor(result),
        })).filter(pair => Number.isFinite(pair.duration) && Number.isFinite(pair.predictor));
        return {
            id,
            label,
            spearman: correlation(
                pairs.map(pair => pair.duration),
                pairs.map(pair => pair.predictor),
            ),
        };
    }).filter(dependency => Number.isFinite(dependency.spearman))
        .sort((first, second) => Math.abs(second.spearman) - Math.abs(first.spearman));
    return {
        id: component.id,
        lane: component.lane,
        kind: component.kind ?? 'stage',
        label: component.label,
        availableStructureCount: structures.length,
        durationMs: {
            p10: percentile(medians, 0.1),
            p50: percentile(medians, 0.5),
            p90: percentile(medians, 0.9),
            p99: percentile(medians, 0.99),
        },
        runRangeOverMedian: {
            p50: percentile(spreads, 0.5),
            p90: percentile(spreads, 0.9),
            p99: percentile(spreads, 0.99),
        },
        runRangeMs: {
            p50: percentile(absoluteSpreads, 0.5),
            p90: percentile(absoluteSpreads, 0.9),
            p99: percentile(absoluteSpreads, 0.99),
        },
        runOrderMedianMs,
        strongestDependencies: dependencies.slice(0, 3),
        slowest: structures.sort((first, second) => second.medianMs - first.medianMs).slice(0, 3),
    };
}

const summaries = components.map(summarizeComponent);
const result = {
    generatedAt: new Date().toISOString(),
    source: input,
    selection: benchmark.representativeSelection,
    repetitions: benchmark.repetitions,
    naming: Object.fromEntries(components.map(component => [component.id, {
        lane: component.lane,
        kind: component.kind ?? 'stage',
        label: component.label,
    }])),
    components: summaries,
};
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);

const format = value => Number.isFinite(value) ? value.toFixed(2) : 'n/a';
const percent = value => Number.isFinite(value) ? `${(100 * value).toFixed(0)}%` : 'n/a';
const rows = summaries.map(summary => `| ${summary.lane} | ${summary.kind} | ${summary.label} | ` +
    `${format(summary.durationMs.p10)} | ${format(summary.durationMs.p50)} | ` +
    `${format(summary.durationMs.p90)} | ${format(summary.durationMs.p99)} | ` +
    `${format(summary.runRangeMs.p50)} | ${format(summary.runRangeMs.p90)} | ` +
    `${percent(summary.runRangeOverMedian.p90)} |`);
const markdown = '# Browser density consistency\n\n' +
    `${benchmark.results.length} equal-stratum representatives; ` +
    `${benchmark.repetitions} browser runs per structure. Durations are milliseconds. ` +
    'Run spread is (maximum - minimum) / median. Main and worker lanes overlap and must not ' +
    'be added together.\n\n' +
    '| Lane | Kind | Component | p10 | p50 | p90 | p99 | Median run range | p90 run range | p90 relative range |\n' +
    `|---|---|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n`;
writeFileSync(markdownOutput, markdown);
console.log(JSON.stringify({ output, markdownOutput, structureCount: benchmark.results.length }, null, 2));
