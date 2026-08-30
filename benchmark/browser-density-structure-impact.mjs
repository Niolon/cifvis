#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- focused paired browser benchmark */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';
import {
    canonicalReflectionIndex,
    isGeneralPositionSystematicAbsence,
} from '../src/lib/density/reciprocal-symmetry.js';
import { readCodStructure } from './lib/cod-sample.mjs';
import * as math from '../src/lib/math-lite.js';

const repository = resolve(import.meta.dirname, '..');
const bundle = resolve(process.env.CIFVIS_BUNDLE ?? join(repository, 'dist/cifvis.alldeps.js'));
const bundleEntries = process.env.CIFVIS_BUNDLES
    ? Object.fromEntries(process.env.CIFVIS_BUNDLES.split(',').map(entry => {
        const separator = entry.indexOf('=');
        return [entry.slice(0, separator), resolve(entry.slice(separator + 1))];
    }))
    : { candidate: bundle };
const output = resolve(process.argv[2] ?? '/tmp/browser-density-structure-impact-50.json');
const cohortInput = resolve(process.argv[3] ?? '/tmp/browser-density-consistency-50.json');
const repetitions = Number.parseInt(process.env.REPETITIONS ?? '5', 10);
const warmupRepetitions = Number.parseInt(process.env.WARMUP_REPETITIONS ?? '1', 10);
const dwfMode = process.env.DWF_MODE ?? 'uiso-vectors';
const modes = (process.env.MODES ??
    'disabled,idle-worker,deferred-density,active-density').split(',');
const bundleComparison = Object.keys(bundleEntries).length > 1;
const variants = bundleComparison ? Object.keys(bundleEntries) : modes;

function reciprocalMatrix(cell) {
    const result = math.transpose(math.inv(cell.fractToCartMatrix));
    return Array.isArray(result) ? result : result.toArray();
}

function generateReflections(structure, dMin = 0.9, maximum = 60000) {
    const reciprocal = reciprocalMatrix(structure.cell);
    const inverse = math.inv(reciprocal);
    const inverseReciprocal = Array.isArray(inverse) ? inverse : inverse.toArray();
    const limit = 1 / dMin;
    const bounds = inverseReciprocal.map(row => Math.ceil(Math.hypot(...row) * limit));
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

function combinedCif(path) {
    const cifText = readFileSync(path, 'utf8');
    const { structure } = readCodStructure(cifText);
    const reflections = generateReflections(structure);
    const calculator = createIAMStructureFactorCalculator(cifText, 0, {
        includeAnomalous: false,
    });
    const calculated = calculator.calculatePrepared(reflections);
    const rows = [
        '', 'loop_', '_refln_index_h', '_refln_index_k', '_refln_index_l',
        '_refln_F_squared_meas', '_refln_F_squared_sigma',
    ];
    for (let index = 0; index < calculated.h.length; index++) {
        const observed = calculated.fSquared[index] *
            (1 + 0.025 * Math.sin((index + 1) * 0.61803398875 * 2 * Math.PI)) ** 2;
        rows.push(`${calculated.h[index]} ${calculated.k[index]} ${calculated.l[index]} ` +
            `${observed.toPrecision(12)} ${Math.max(1e-6, observed * 0.02).toPrecision(8)}`);
    }
    return {
        codId: basename(path, '.cif'),
        path,
        text: `${cifText.trimEnd()}\n${rows.join('\n')}\n`,
        reflectionCount: reflections.length,
    };
}

const html = `<!doctype html><html><body><div id="viewer"></div><script type="module">
import * as CifVis from '__BUNDLE_PATH__';
const waitForWorker = async viewer => {
  const deadline = performance.now() + 5000;
  while (viewer.scalarFieldWorkerReadyEpochMs === null && performance.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
};
window.runStructureOnly = async (cifText, mode, dwfMode) => {
  const workerConfigured = mode !== 'disabled';
  const viewer = new CifVis.CrystalViewer(document.getElementById('viewer'), {
    debug: true,
    renderMode: 'onDemand',
    scalarField: {useWorker: true},
    differenceDensity: workerConfigured
      ? {autoLoad: true, iam: {dwfMode}}
      : {autoLoad: false},
    isosurface: {progressiveSteps: [1], visible: false},
  });
  if (workerConfigured) await waitForWorker(viewer);
  let finishDeferredDensity = null;
  if (mode === 'deferred-density') {
    viewer.loadDifferenceDensity = () => new Promise(resolve => {
      finishDeferredDensity = resolve;
    });
  }
  const started = performance.now();
  const structure = await viewer.loadCIF(cifText, 0,
    mode === 'idle-worker' ? {differenceDensity: false} : {});
  const structureWallMs = performance.now() - started;
  const timings = {...(structure.browserTimings ?? {})};
  const pendingDensity = structure.differenceDensity ?? null;
  viewer.dispose();
  finishDeferredDensity?.({success: false, cancelled: true});
  if (pendingDensity) await pendingDensity;
  return {
    success: structure.success,
    structureWallMs,
    timings,
    workerConfigured,
    reflectionsPreparedByStructureDisplay: Number.isFinite(timings.reflectionsPreparedMs),
  };
};
</script></body></html>`;

function startServer() {
    return new Promise(resolvePromise => {
        const server = createServer((request, response) => {
            const url = new URL(request.url, 'http://localhost');
            if (url.pathname === '/') {
                const bundleLabel = url.searchParams.get('bundle') ?? Object.keys(bundleEntries)[0];
                const bundlePath = `/bundle/${bundleLabel}.js`;
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end(html.replace('__BUNDLE_PATH__', bundlePath));
            } else if (url.pathname.startsWith('/bundle/')) {
                const bundleLabel = url.pathname.slice('/bundle/'.length, -'.js'.length);
                const selectedBundle = bundleEntries[bundleLabel];
                if (!selectedBundle) {
                    response.writeHead(404);
                    response.end();
                    return;
                }
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(selectedBundle));
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

const cohort = JSON.parse(readFileSync(cohortInput, 'utf8'));
const cases = cohort.results.map(result => combinedCif(result.path));
const { server, port } = await startServer();
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH ?? '/run/current-system/sw/bin/google-chrome',
});
const results = cases.map(entry => ({
    codId: entry.codId,
    path: entry.path,
    reflectionCount: entry.reflectionCount,
    runs: Object.fromEntries(variants.map(variant => [variant, []])),
}));
try {
    const totalRepetitions = warmupRepetitions + repetitions;
    for (let repetition = 0; repetition < totalRepetitions; repetition++) {
        for (let caseIndex = 0; caseIndex < cases.length; caseIndex++) {
            const entry = cases[caseIndex];
            const variantOffset = (repetition + caseIndex) % variants.length;
            const orderedVariants = [
                ...variants.slice(variantOffset), ...variants.slice(0, variantOffset),
            ];
            for (const variant of orderedVariants) {
                const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
                const page = await context.newPage();
                const bundleLabel = bundleComparison ? variant : Object.keys(bundleEntries)[0];
                const selectedMode = bundleComparison ? 'disabled' : variant;
                await page.goto(`http://127.0.0.1:${port}/?bundle=${bundleLabel}`);
                const run = await page.evaluate(
                    ({ text, selectedMode, selectedDwfMode }) =>
                        window.runStructureOnly(text, selectedMode, selectedDwfMode),
                    { text: entry.text, selectedMode, selectedDwfMode: dwfMode },
                );
                if (repetition >= warmupRepetitions) {
                    results[caseIndex].runs[variant].push(run);
                }
                await context.close();
            }
        }
    }
} finally {
    await browser.close();
    await new Promise(resolvePromise => server.close(resolvePromise));
}
writeFileSync(output, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    bundle,
    bundleEntries,
    bundleComparison,
    cohortInput,
    repetitions,
    warmupRepetitions,
    dwfMode,
    modes: variants,
    endpoint: 'structureSceneReady',
    workers: 'prewarmed-outside-timer-when-configured',
    results,
}, null, 2)}\n`);
console.log(JSON.stringify({
    output,
    structureCount: results.length,
    repetitions,
    warmupRepetitions,
    modes: variants,
}, null, 2));
