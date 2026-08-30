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
import * as math from '../src/lib/math-lite.js';

const repository = resolve(import.meta.dirname, '..');
const bundle = join(repository, 'dist/cifvis.alldeps.js');
const output = resolve(process.argv[2] ?? '/tmp/browser-node-fcalc-comparison.json');
const cifPaths = process.argv.slice(3);
const TWO_PI = 2 * Math.PI;
const REPETITIONS = 3;
const DWF_MODE = process.env.DWF_MODE ?? 'direct';
const PREWARM_WORKER = process.env.PREWARM_WORKER === 'true';

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

function prepareCase(path) {
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
        codId: basename(path, '.cif'),
        combinedText,
        reflectionCount: reflections.length,
        nodeIamModelBuildMs: median(nodeRuns.map(run => run.iam.modelBuildTimeMs)),
        nodeFcalcMs: median(nodeRuns.map(run => run.iam.calculation.timeMs)),
    };
}

const html = `<!doctype html><html><body><div id="viewer"></div><script type="module">
import * as CifVis from '/bundle.js';
window.runCase = async (cifText, dwfMode, prewarmWorker) => {
  const viewer = new CifVis.CrystalViewer(document.getElementById('viewer'), {
    debug: true,
    renderMode: 'onDemand',
    scalarField: {useWorker: true},
    differenceDensity: prewarmWorker
      ? {autoLoad: true, iam: {dwfMode}}
      : {autoLoad: false},
    isosurface: {progressiveSteps: [1], visible: false},
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

if (cifPaths.length === 0) {
    throw new Error('Provide one or more coordinate CIF paths after the output path');
}
const preparedCases = cifPaths.map(prepareCase);
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
                ({ text, dwfMode, prewarmWorker }) =>
                    window.runCase(text, dwfMode, prewarmWorker),
                {
                    text: prepared.combinedText,
                    dwfMode: DWF_MODE,
                    prewarmWorker: PREWARM_WORKER,
                },
            ));
            await context.close();
        }
        const metric = select => median(browserRuns.map(select));
        results.push({
            codId: prepared.codId,
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
            browserDatasetPreparationMs:
                metric(run => run.density.workerDatasetPreparationTimeMs),
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
            browserWorkerElapsedMs: metric(run => run.density.workerElapsedTimeMs),
            browserWallMs: metric(run => run.wallMs),
            browserRuns: browserRuns.map(run => ({
                iamModelBuildMs: run.density.iam?.modelBuildTimeMs,
                fcalcMs: run.density.iam?.calculation?.timeMs,
                reflectionPreparationMs: run.density.workerReflectionPreparationTimeMs,
                workerIdleAfterReflectionPreparationMs:
                    run.density.workerIdleAfterReflectionPreparationMs,
                modelWaitForReflectionPreparationMs:
                    run.density.modelWaitForReflectionPreparationMs,
                workerWaitForModelMs: run.density.workerWaitForModelMs,
                workerJoinDelayMs: run.density.workerJoinDelayMs,
                browserTimings: run.structure.browserTimings,
                datasetPreparationMs: run.density.workerDatasetPreparationTimeMs,
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
    prewarmWorker: PREWARM_WORKER,
    results,
}, null, 2)}\n`);
console.log(JSON.stringify({ output, results }, null, 2));
