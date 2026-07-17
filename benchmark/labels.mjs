#!/usr/bin/env node
// Atom-label layout benchmark. With no positional paths it uses the larger
// CIFs in the sibling cifvis_presentation checkout when available.
//
// Usage:
//   npm run bench:labels
//   npm run bench:labels -- path/to/file-or-directory --mode complete
//
// Options:
//   --mode <mode>       auto-omit (default) or complete
//   --iterations <n>    Timed layouts per structure (default 12)
//   --width <px>        Viewer width (default 1200)
//   --height <px>       Viewer height (default 900)
//   --chrome <path>     Chrome executable (or set CHROME_PATH)

import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const bundlePath = join(repoRoot, 'dist', 'cifvis.alldeps.js');
const presentationAssets = resolve(repoRoot, '../cifvis_presentation/src/assets');

/**
 * Parses positional paths and `--name value` options.
 * @param {string[]} argv - CLI arguments
 * @returns {{paths: string[], options: Record<string, string>}} Parsed arguments
 */
function parseArgs(argv) {
    const paths = [];
    const options = {};
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument.startsWith('--')) {
            options[argument.slice(2)] = argv[index + 1];
            index++;
        } else {
            paths.push(argument);
        }
    }
    return { paths, options };
}

/**
 * Resolves a CIF path or recursively enumerates a directory.
 * @param {string} path - File or directory
 * @returns {string[]} Absolute CIF paths
 */
function findCifFiles(path) {
    const absolute = resolve(path);
    if (!existsSync(absolute)) {
        throw new Error(`Path not found: ${path}`);
    }
    if (!statSync(absolute).isDirectory()) {
        return extname(absolute).toLowerCase() === '.cif' ? [absolute] : [];
    }
    return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
        const child = join(absolute, entry.name);
        return entry.isDirectory() ? findCifFiles(child) :
            extname(entry.name).toLowerCase() === '.cif' ? [child] : [];
    });
}

/**
 * Returns the standard sibling-presentation stress fixtures that exist.
 * @returns {string[]} Absolute fixture paths
 */
function defaultPresentationFiles() {
    return ['capsaicin.cif', 'fullerene.cif', 'large_nobonds.cif', 'large_bonds.cif']
        .map(name => join(presentationAssets, name))
        .filter(existsSync);
}

/**
 * Locates a usable Chrome/Chromium executable.
 * @param {string} explicitPath - Optional CLI path
 * @returns {string|undefined} Browser executable path
 */
function findChrome(explicitPath) {
    return [
        explicitPath,
        process.env.CHROME_PATH,
        '/run/current-system/sw/bin/google-chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ].find(path => path && existsSync(path));
}

/**
 * Returns a nearest-rank percentile from numeric samples.
 * @param {number[]} values - Samples
 * @param {number} fraction - Percentile in [0, 1]
 * @returns {number} Percentile value
 */
function percentile(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(Math.floor(sorted.length * fraction), sorted.length - 1)];
}

const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>CifVis label benchmark</title></head>
<body><div id="viewer"></div><script type="module">
import * as CifVis from '/cifvis.alldeps.js';

window.runLabelBenchmark = async ({ cifText, mode, iterations, width, height }) => {
    const container = document.getElementById('viewer');
    container.replaceChildren();
    Object.assign(container.style, { width: width + 'px', height: height + 'px' });
    const viewer = new CifVis.CrystalViewer(container, {
        renderStyle: 'cutout-2d',
        atomLabels: { show: 'all', placementMode: mode },
    });
    const loadResult = await viewer.loadCIF(cifText);
    if (!loadResult.success) return loadResult;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Warm text metrics and shaders once, then measure complete forced layouts.
    viewer.atomLabelManager.invalidateLayout();
    await viewer.atomLabelManager.update();
    const samples = [];
    for (let index = 0; index < iterations; index++) {
        viewer.atomLabelManager.previousPlacements.clear();
        viewer.atomLabelManager.invalidateLayout();
        const start = performance.now();
        await viewer.atomLabelManager.update();
        samples.push(performance.now() - start);
    }
    const layout = viewer.getAtomLabelLayout();
    return {
        success: true,
        atoms: viewer.state.displayStructure.atoms.length,
        bonds: viewer.state.displayStructure.bonds.length,
        placed: layout.placed.length,
        hidden: layout.hidden.length,
        execution: viewer.atomLabelManager.lastExecutionMode,
        samples,
    };
};
</script></body></html>`;

/**
 * Starts the local benchmark harness server.
 * @returns {Promise<{server: import('http').Server, port: number}>} Server and port
 */
function startServer() {
    return new Promise(resolvePromise => {
        const server = createServer((request, response) => {
            const url = new URL(request.url, 'http://localhost');
            if (url.pathname === '/') {
                response.writeHead(200, { 'Content-Type': 'text/html' });
                response.end(HARNESS_HTML);
            } else if (url.pathname === '/cifvis.alldeps.js') {
                response.writeHead(200, { 'Content-Type': 'application/javascript' });
                response.end(readFileSync(bundlePath));
            } else if (url.pathname === '/cif') {
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(readFileSync(url.searchParams.get('path'), 'utf8'));
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

/**
 * Runs the requested benchmark set.
 */
async function main() {
    const { paths, options } = parseArgs(process.argv.slice(2));
    const mode = options.mode || 'auto-omit';
    if (!['auto-omit', 'complete'].includes(mode)) {
        throw new Error('--mode must be auto-omit or complete');
    }
    const iterations = Number.parseInt(options.iterations || '12', 10);
    const width = Number.parseInt(options.width || '1200', 10);
    const height = Number.parseInt(options.height || '900', 10);
    const files = (paths.length > 0 ? paths.flatMap(findCifFiles) : defaultPresentationFiles()).sort();
    if (files.length === 0) {
        throw new Error('No CIFs supplied and no presentation fixtures were found');
    }
    if (!existsSync(bundlePath)) {
        throw new Error('dist/cifvis.alldeps.js is missing; run npm run build:alldeps first');
    }

    const chromePath = findChrome(options.chrome);
    const { server, port } = await startServer();
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width, height } });

    console.log(`Label benchmark: mode=${mode}, viewport=${width}x${height}, iterations=${iterations}`);
    console.log('file\tatoms\tbonds\tplaced\thidden\texecution\tmedian_ms\tp95_ms');
    try {
        for (const file of files) {
            const page = await context.newPage();
            try {
                await page.goto(`http://127.0.0.1:${port}/`);
                const cifText = await page.evaluate(
                    async path => (await fetch(`/cif?path=${encodeURIComponent(path)}`)).text(),
                    file,
                );
                const result = await page.evaluate(
                    input => window.runLabelBenchmark(input),
                    { cifText, mode, iterations, width, height },
                );
                if (!result.success) {
                    console.log(`${file}\tERROR\t${result.error}`);
                    continue;
                }
                console.log([
                    file,
                    result.atoms,
                    result.bonds,
                    result.placed,
                    result.hidden,
                    result.execution,
                    percentile(result.samples, 0.5).toFixed(2),
                    percentile(result.samples, 0.95).toFixed(2),
                ].join('\t'));
            } finally {
                await page.close();
            }
        }
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
