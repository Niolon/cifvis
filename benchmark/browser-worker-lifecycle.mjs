#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- focused browser worker-lifecycle benchmark */
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
const bundleName = process.env.CIFVIS_BUNDLE ?? 'cifvis.alldeps.js';
const bundle = join(repository, 'dist', bundleName);
const output = resolve(process.argv[2] ?? '/tmp/browser-worker-lifecycle.json');
const cifPaths = process.argv.slice(3);
const DWF_MODE = process.env.DWF_MODE ?? 'uiso-vectors';
const REPETITIONS = Number.parseInt(process.env.REPETITIONS ?? '3', 10);

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
        text: `${cifText.trimEnd()}\n${rows.join('\n')}\n`,
        reflectionCount: reflections.length,
    };
}

const html = `<!doctype html><html><head>
<script type="importmap">{"imports":{"three":"/three.js"}}</script>
</head><body><div id="viewer"></div><script type="module">
import * as CifVis from '/bundle.js';
const makeViewer = (prewarm, dwfMode) => new CifVis.CrystalViewer(
  document.getElementById('viewer'), {
    debug: true,
    renderMode: 'onDemand',
    scalarField: {useWorker: true},
    differenceDensity: prewarm ? {autoLoad: true, iam: {dwfMode}} : {autoLoad: false},
    isosurface: {progressiveSteps: [1], visible: false},
  });
const waitReady = async viewer => {
  const deadline = performance.now() + 5000;
  while (viewer.scalarFieldWorkerReadyEpochMs === null && performance.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
};
window.runLifecycle = async (cases, mode, dwfMode) => {
  const persistent = mode.includes('persistent');
  const prewarm = mode.includes('prewarm');
  let viewer = persistent ? makeViewer(prewarm, dwfMode) : null;
  if (viewer && prewarm) await waitReady(viewer);
  const runs = [];
  for (const entry of cases) {
    if (!viewer) {
      viewer = makeViewer(prewarm, dwfMode);
      if (prewarm) await waitReady(viewer);
    }
    const started = performance.now();
    const structure = await viewer.loadCIF(entry.text, 0, prewarm ? {} : {
      differenceDensity: {progressiveSteps: [1], visible: false, iam: {dwfMode}},
    });
    const density = structure.differenceDensity ? await structure.differenceDensity : structure;
    const timings = structure.browserTimings ?? {};
    runs.push({
      codId: entry.codId,
      success: density.success,
      wallMs: performance.now() - started,
      workerConstructedToReadyMs: Number.isFinite(timings.workerReadyMs) &&
        Number.isFinite(timings.workerConstructedMs)
          ? timings.workerReadyMs - timings.workerConstructedMs : null,
      workerReadyToFirstTaskMs: timings.workerReadyToFirstTaskMs ?? null,
      workerStartupToTaskMs: Number.isFinite(timings.reflectionPreparationStartedMs)
        ? timings.reflectionPreparationStartedMs - timings.rawCifPostedMs : null,
      workerConstructedMs: timings.workerConstructedMs ?? null,
      workerReadyMs: timings.workerReadyMs ?? null,
      reflectionPreparationStartedMs: timings.reflectionPreparationStartedMs ?? null,
      densityAppliedMs: timings.densityAppliedMs ?? null,
    });
    if (!persistent) {
      viewer.dispose();
      viewer = null;
    }
  }
  viewer?.dispose();
  return runs;
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
            } else if (url.pathname === '/three.js') {
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(join(repository, 'node_modules/three/build/three.module.js')));
            } else if (url.pathname === '/three.core.js') {
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(join(repository, 'node_modules/three/build/three.core.js')));
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

if (cifPaths.length < 3) {
    throw new Error('Provide at least three coordinate CIF paths after the output path');
}
const cases = cifPaths.map(combinedCif);
const { server, port } = await startServer();
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH ?? '/run/current-system/sw/bin/google-chrome',
});
const modes = ['recreate-lazy', 'persistent-lazy', 'prewarm-terminate', 'persistent-prewarm'];
const results = {};
try {
    for (const mode of modes) {
        results[mode] = [];
        for (let repetition = 0; repetition < REPETITIONS; repetition++) {
            const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
            const page = await context.newPage();
            page.on('pageerror', error => console.error(`Browser page error: ${error.message}`));
            page.on('response', response => {
                if (response.status() >= 400) {
                    console.error(`Browser response ${response.status()}: ${response.url()}`);
                }
            });
            page.on('console', message => {
                if (message.type() === 'error') {
                    console.error(`Browser console error: ${message.text()}`);
                }
            });
            await page.goto(`http://127.0.0.1:${port}/`);
            await page.waitForFunction(() => typeof window.runLifecycle === 'function');
            results[mode].push(await page.evaluate(
                ({ entries, selectedMode, dwfMode }) =>
                    window.runLifecycle(entries, selectedMode, dwfMode),
                { entries: cases, selectedMode: mode, dwfMode: DWF_MODE },
            ));
            await context.close();
        }
    }
} finally {
    await browser.close();
    await new Promise(resolvePromise => server.close(resolvePromise));
}
writeFileSync(output, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    bundleName,
    dwfMode: DWF_MODE,
    repetitions: REPETITIONS,
    cases: cases.map(({ codId, reflectionCount }) => ({ codId, reflectionCount })),
    results,
}, null, 2)}\n`);
console.log(JSON.stringify({ output, results }, null, 2));
