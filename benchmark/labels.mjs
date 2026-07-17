#!/usr/bin/env node
// Atom-label layout benchmark. With no positional paths it uses the demo CIFs
// shipped in site/public/cif, so the default is self-contained.
//
// Usage:
//   npm run bench:labels
//   npm run bench:labels -- path/to/file-or-directory --mode maximum-coverage
//
// Options:
//   --mode <mode>       auto-omit, quality-omit, performance-omit, or maximum-coverage
//   --callouts <policy> structure (default) or viewport
//   --max-connector <px> Optional hard connector-length ceiling
//   --show <selection>   all (default) or non-hydrogen
//   --max-visible <n>   Maximum labels attempted (default unlimited)
//   --repair-depth <n>  Displacement-chain depth (default 2)
//   --repair-limit <n>  Repair candidate budget per label (default 48)
//   --performance-cell <px> Performance-omit no-space tile size (default 24)
//   --auto-threshold <n> Visible-label threshold for adaptive auto-omit (default 500)
//   --iterations <n>    Timed layouts per structure (default 12)
//   --width <px>        Viewer width (default 1200)
//   --height <px>       Viewer height (default 900)
//   --zoom <factor>     Multiplies the fitted camera zoom (default 1)
//   --chrome <path>     Chrome executable (or set CHROME_PATH)

import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const bundlePath = join(repoRoot, 'dist', 'cifvis.alldeps.js');
const demoCifDirectory = join(repoRoot, 'site', 'public', 'cif');

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
 * Returns the demo CIFs shipped with this repository.
 * @returns {string[]} Absolute fixture paths
 */
function defaultDemoFiles() {
    return findCifFiles(demoCifDirectory);
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

window.runLabelBenchmark = async ({
    cifText, mode, callouts, maxConnector, show, maxVisible, repairDepth,
    repairLimit, performanceCell, autoThreshold, iterations, width, height, zoom,
}) => {
    const container = document.getElementById('viewer');
    container.replaceChildren();
    Object.assign(container.style, { width: width + 'px', height: height + 'px' });
    const atomLabels = {
        show,
        placementMode: mode,
        calloutPlacement: callouts,
        maxVisible,
        repairDepth,
        repairSearchLimit: repairLimit,
        performanceNoSpaceCellSize: performanceCell,
        autoPerformanceLabelThreshold: autoThreshold,
    };
    if (maxConnector !== null) atomLabels.maxConnectorLength = maxConnector;
    const viewer = new CifVis.CrystalViewer(container, {
        renderStyle: 'cutout-2d',
        atomLabels,
    });
    const loadResult = await viewer.loadCIF(cifText);
    if (!loadResult.success) return loadResult;
    viewer.camera.zoom *= zoom;
    viewer.camera.updateProjectionMatrix();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Warm text metrics and shaders once, then measure full forced layouts.
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
    const connectorLengths = layout.placed.filter(item => item.leaderSegment).map(item => Math.hypot(
        item.leaderSegment.x2 - item.leaderSegment.x1,
        item.leaderSegment.y2 - item.leaderSegment.y1,
    ));
    return {
        success: true,
        atoms: viewer.state.displayStructure.atoms.length,
        bonds: viewer.state.displayStructure.bonds.length,
        placed: layout.placed.length,
        hidden: layout.hidden.length,
        placementPolicy: layout.placementPolicy,
        staticNoSpace: layout.hidden.filter(item => item.reason === 'static-no-space').length,
        execution: viewer.atomLabelManager.lastExecutionMode,
        callouts: layout.placed.filter(item => item.isCallout).length,
        maximumConnector: Math.max(0, ...connectorLengths),
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
    if (![
        'auto-omit',
        'quality-omit',
        'performance-omit',
        'maximum-coverage',
    ].includes(mode)) {
        throw new Error(
            '--mode must be auto-omit, quality-omit, performance-omit, or maximum-coverage',
        );
    }
    const callouts = options.callouts || 'structure';
    if (!['structure', 'viewport'].includes(callouts)) {
        throw new Error('--callouts must be structure or viewport');
    }
    const maxConnector = options['max-connector'] === undefined ? null :
        Number.parseFloat(options['max-connector']);
    if (maxConnector !== null && (!Number.isFinite(maxConnector) || maxConnector <= 0)) {
        throw new Error('--max-connector must be a positive number');
    }
    const show = options.show || 'all';
    if (!['all', 'non-hydrogen'].includes(show)) {
        throw new Error('--show must be all or non-hydrogen');
    }
    const maxVisible = options['max-visible'] === undefined ? Infinity :
        Number.parseInt(options['max-visible'], 10);
    if (!(maxVisible === Infinity || Number.isInteger(maxVisible) && maxVisible >= 0)) {
        throw new Error('--max-visible must be a non-negative integer');
    }
    const repairDepth = Number.parseInt(options['repair-depth'] || '2', 10);
    const repairLimit = Number.parseInt(options['repair-limit'] || '48', 10);
    const performanceCell = Number.parseFloat(options['performance-cell'] || '24');
    const autoThreshold = Number.parseInt(options['auto-threshold'] || '500', 10);
    if (!Number.isInteger(repairDepth) || repairDepth < 0) {
        throw new Error('--repair-depth must be a non-negative integer');
    }
    if (!Number.isInteger(repairLimit) || repairLimit < 0) {
        throw new Error('--repair-limit must be a non-negative integer');
    }
    if (!Number.isFinite(performanceCell) || performanceCell <= 0) {
        throw new Error('--performance-cell must be a positive number');
    }
    if (!Number.isInteger(autoThreshold) || autoThreshold < 0) {
        throw new Error('--auto-threshold must be a non-negative integer');
    }
    const iterations = Number.parseInt(options.iterations || '12', 10);
    const width = Number.parseInt(options.width || '1200', 10);
    const height = Number.parseInt(options.height || '900', 10);
    const zoom = Number.parseFloat(options.zoom || '1');
    if (!Number.isFinite(zoom) || zoom <= 0) {
        throw new Error('--zoom must be a positive number');
    }
    const files = (paths.length > 0 ? paths.flatMap(findCifFiles) : defaultDemoFiles()).sort();
    if (files.length === 0) {
        throw new Error('No CIFs supplied and no shipped demo CIFs were found');
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

    console.log(
        `Label benchmark: mode=${mode}, callouts=${callouts}, ` +
        `show=${show}, maxVisible=${maxVisible}, repair=${repairDepth}/${repairLimit}, ` +
        `performanceCell=${performanceCell}, autoThreshold=${autoThreshold}, ` +
        `maxConnector=${maxConnector ?? 'none'}, viewport=${width}x${height}, ` +
        `zoom=${zoom}, iterations=${iterations}`,
    );
    console.log(
        'file\tatoms\tbonds\tpolicy\tplaced\thidden\tstatic_no_space\tcallouts\tmax_connector_px\t' +
        'execution\tmedian_ms\tp95_ms',
    );
    try {
        for (const file of files) {
            const page = await context.newPage();
            try {
                await page.goto(`http://127.0.0.1:${port}/`);
                const cifText = readFileSync(file, 'utf8');
                const result = await page.evaluate(
                    input => window.runLabelBenchmark(input),
                    {
                        cifText,
                        mode,
                        callouts,
                        maxConnector,
                        show,
                        maxVisible,
                        repairDepth,
                        repairLimit,
                        performanceCell,
                        autoThreshold,
                        iterations,
                        width,
                        height,
                        zoom,
                    },
                );
                if (!result.success) {
                    console.log(`${file}\tERROR\t${result.error}`);
                    continue;
                }
                console.log([
                    file,
                    result.atoms,
                    result.bonds,
                    result.placementPolicy,
                    result.placed,
                    result.hidden,
                    result.staticNoSpace,
                    result.callouts,
                    result.maximumConnector.toFixed(1),
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
