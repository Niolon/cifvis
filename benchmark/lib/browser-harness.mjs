// Shared headless-browser harness for load-time benchmarks. Extracted from
// speed.mjs so analysis/mode-matrix.mjs (and any future viewer-option sweep) can
// reuse the same instrumented page instead of duplicating it.
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const libDir = fileURLToPath(new URL('.', import.meta.url));
export const repoRoot = resolve(libDir, '..', '..');
export const bundlePath = join(repoRoot, 'dist', 'cifvis.alldeps.js');

const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>cifvis benchmark</title></head>
<body>
<div id="viewer-container" style="width:800px;height:600px;"></div>
<script type="module">
import * as CifVis from '/cifvis.alldeps.js';

window.__drawCallCount = 0;
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const ctx = origGetContext.call(this, type, ...args);
    if (ctx && (type === 'webgl' || type === 'webgl2') && !ctx.__patched) {
        ctx.__patched = true;
        ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'].forEach(fn => {
            if (typeof ctx[fn] !== 'function') return;
            const orig = ctx[fn].bind(ctx);
            ctx[fn] = (...a) => { window.__drawCallCount++; return orig(...a); };
        });
    }
    return ctx;
};

window.__runBenchmark = async (cifText, viewerOptions) => {
    const container = document.getElementById('viewer-container');
    container.innerHTML = '';
    const viewer = new CifVis.CrystalViewer(container, viewerOptions);

    const buildStart = performance.now();
    const result = await viewer.loadCIF(cifText);
    const buildTimeMs = performance.now() - buildStart;

    if (!result.success) {
        viewer.dispose?.();
        return { success: false, error: result.error, buildTimeMs };
    }

    window.__drawCallCount = 0;
    const renderStart = performance.now();
    // Two rAF ticks: the first is the frame the load's requestRender() call
    // (onDemand mode) or the always-on loop (constant mode) actually draws
    // on; the second confirms no further draws happen once settled.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const renderTimeMs = performance.now() - renderStart;

    const displayStructure = viewer.state.displayStructure ?? viewer.state.baseStructure;
    const metrics = {
        success: true,
        buildTimeMs,
        renderTimeMs,
        drawCalls: window.__drawCallCount,
        atomCount: viewer.state.baseStructure?.atoms?.length ?? null,
        bondCount: viewer.state.baseStructure?.bonds?.length ?? null,
        displayAtomCount: displayStructure?.atoms?.length ?? null,
        displayBondCount: displayStructure?.bonds?.length ?? null,
    };
    viewer.dispose?.();
    return metrics;
};
</script>
</body></html>`;

/**
 * Builds the bundle if `dist/cifvis.alldeps.js` is missing.
 */
export function ensureBundleBuilt() {
    if (!existsSync(bundlePath)) {
        console.log('dist/cifvis.alldeps.js not found, building it first (npm run build:alldeps)...');
        execSync('npm run build:alldeps', { cwd: repoRoot, stdio: 'inherit' });
    }
}

/**
 * Minimal static server: serves the harness page, the built bundle, and CIF
 * file contents by absolute path - avoids any external dev/Django server.
 * @returns {Promise<{server: import('http').Server, port: number}>} Running server and its port
 */
export function startServer() {
    return new Promise((resolvePromise) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(HARNESS_HTML);
            } else if (url.pathname === '/cifvis.alldeps.js') {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(readFileSync(bundlePath));
            } else if (url.pathname === '/cif') {
                const path = url.searchParams.get('path');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(readFileSync(path, 'utf8'));
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        server.listen(0, '127.0.0.1', () => resolvePromise({ server, port: server.address().port }));
    });
}

/**
 * @param {{chromePath?: string}} [options] - Launch options
 * @returns {Promise<import('playwright-core').Browser>} A launched headless Chromium instance
 */
export async function launchBrowser({ chromePath } = {}) {
    const launchOptions = { headless: true };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    }
    return chromium.launch(launchOptions);
}

/**
 * Loads one CIF file in a fresh page and returns the harness's metrics.
 * @param {import('playwright-core').BrowserContext} context - Playwright context to open the page in
 * @param {number} port - Local harness server port
 * @param {string} file - Absolute path to the .cif file to load
 * @param {Record<string, unknown>} viewerOptions - Options passed to `new CrystalViewer(container, options)`
 * @returns {Promise<Record<string, unknown>>} Metrics returned by `window.__runBenchmark`
 */
export async function runOnPage(context, port, file, viewerOptions) {
    const page = await context.newPage();
    let metrics;
    try {
        await page.goto(`http://127.0.0.1:${port}/`);
        const cifText = await page.evaluate(
            async path => (await fetch(`/cif?path=${encodeURIComponent(path)}`)).text(),
            file,
        );
        metrics = await page.evaluate(
            ([text, options]) => window.__runBenchmark(text, options),
            [cifText, viewerOptions],
        );
    } catch (e) {
        metrics = { success: false, error: e.message };
    }
    await page.close();
    return metrics;
}
