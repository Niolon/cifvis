#!/usr/bin/env node
// Speed evaluation for CifVis: loads one or more real CIF files in a headless
// browser against the built library and reports parse/build time, render
// time, and WebGL draw-call count per structure - the core metrics used
// throughout the cifvis-vs-JSMol performance investigation, now available
// directly in this repo instead of only in the external analysis/ scripts.
//
// Usage:
//   npm run bench -- <path> [options]
//   node benchmark/speed.mjs <path> [options]
//
// <path> may be:
//   - a single .cif file
//   - a directory (searched recursively for *.cif files)
//   - a text file listing one CIF path per line (optionally "path<TAB>size")
//
// Options:
//   --out <file>       Write per-structure results to this CSV (default: benchmark/results.csv)
//   --limit <n>        Only benchmark the first n files
//   --render-mode <m>  'onDemand' (default, matches the library default) or 'constant'
//   --chrome <path>    Chrome/Chromium executable (default: $CHROME_PATH or common install paths)
import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const bundlePath = join(repoRoot, 'dist', 'cifvis.alldeps.js');

/**
 * Parses `--flag value` pairs out of argv, leaving the first positional
 * argument as the target path.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{target: string, options: Record<string,string>}} Parsed target and options
 */
function parseArgs(argv) {
    const options = {};
    let target = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            options[arg.slice(2)] = argv[i + 1];
            i++;
        } else if (target === null) {
            target = arg;
        }
    }
    return { target, options };
}

/**
 * Recursively finds .cif files under a directory.
 * @param {string} dir - Directory to search
 * @returns {string[]} Absolute paths to every .cif file found
 */
function findCifFiles(dir) {
    const results = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findCifFiles(full));
        } else if (extname(entry.name).toLowerCase() === '.cif') {
            results.push(full);
        }
    }
    return results;
}

/**
 * Resolves the CLI target into a concrete list of absolute CIF file paths.
 * @param {string} target - Path to a .cif file, a directory, or a file-list
 * @returns {string[]} Absolute paths to benchmark
 */
function resolveFileList(target) {
    const abs = resolve(target);
    if (!existsSync(abs)) {
        throw new Error(`Path not found: ${target}`);
    }
    const stat = statSync(abs);
    if (stat.isDirectory()) {
        return findCifFiles(abs);
    }
    if (extname(abs).toLowerCase() === '.cif') {
        return [abs];
    }
    // Treat anything else as a file-list: one path per line, optionally
    // "path<TAB>size" (matches the format used by the analysis/ sample files).
    return readFileSync(abs, 'utf8').trim().split('\n').filter(Boolean)
        .map(line => {
            const path = line.split('\t')[0];
            return resolve(path.startsWith('/') ? path : join(scriptDir, path));
        });
}

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

window.__runBenchmark = async (cifText, renderMode) => {
    const container = document.getElementById('viewer-container');
    const viewer = new CifVis.CrystalViewer(container, { renderMode });

    const buildStart = performance.now();
    const result = await viewer.loadCIF(cifText);
    const buildTimeMs = performance.now() - buildStart;

    if (!result.success) {
        return { success: false, error: result.error, buildTimeMs };
    }

    window.__drawCallCount = 0;
    const renderStart = performance.now();
    // Two rAF ticks: the first is the frame the load's requestRender() call
    // (onDemand mode) or the always-on loop (constant mode) actually draws
    // on; the second confirms no further draws happen once settled.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const renderTimeMs = performance.now() - renderStart;

    return {
        success: true,
        buildTimeMs,
        renderTimeMs,
        drawCalls: window.__drawCallCount,
        atomCount: viewer.state.baseStructure?.atoms?.length ?? null,
        bondCount: viewer.state.baseStructure?.bonds?.length ?? null,
    };
};
</script>
</body></html>`;

/**
 * Minimal static server: serves the harness page, the built bundle, and CIF
 * file contents by absolute path - avoids any external dev/Django server.
 * @returns {Promise<{server: import('http').Server, port: number}>} Running server and its port
 */
function startServer() {
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
 * @param {*} value - Raw CSV field value
 * @returns {string} CSV-safe representation
 */
function csvField(value) {
    if (value === null || value === undefined) {
        return ''; 
    }
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * @param {number[]} values - Numeric samples
 * @param {number} p - Percentile in [0,1]
 * @returns {number} The value at that percentile
 */
function percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

/**
 *
 */
async function main() {
    const { target, options } = parseArgs(process.argv.slice(2));
    if (!target) {
        console.error('Usage: node benchmark/speed.mjs <cif-file|directory|file-list> [--out results.csv] ' +
            '[--limit n] [--render-mode onDemand|constant] [--chrome /path/to/chrome]');
        process.exit(1);
    }

    if (!existsSync(bundlePath)) {
        console.log('dist/cifvis.alldeps.js not found, building it first (npm run build:alldeps)...');
        const { execSync } = await import('child_process');
        execSync('npm run build:alldeps', { cwd: repoRoot, stdio: 'inherit' });
    }

    let files = resolveFileList(target);
    if (options.limit) {
        files = files.slice(0, parseInt(options.limit, 10));
    }
    if (files.length === 0) {
        console.error('No .cif files found.');
        process.exit(1);
    }
    console.log(`Benchmarking ${files.length} file(s)...`);

    const renderMode = options['render-mode'] || 'onDemand';
    const chromePath = options.chrome || process.env.CHROME_PATH;
    const outPath = resolve(options.out || join(scriptDir, 'results.csv'));

    const { server, port } = await startServer();
    const launchOptions = { headless: true };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    }
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext();

    const header = [
        'filename', 'file_size_kb', 'success', 'error',
        'build_time_ms', 'render_time_ms', 'draw_calls', 'atom_count', 'bond_count',
    ];
    const rows = [header.join(',')];
    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const sizeKb = statSync(file).size / 1024;
        const page = await context.newPage();
        let metrics;
        try {
            await page.goto(`http://127.0.0.1:${port}/`);
            const cifText = await page.evaluate(
                async path => (await fetch(`/cif?path=${encodeURIComponent(path)}`)).text(),
                file,
            );
            metrics = await page.evaluate(
                ([text, mode]) => window.__runBenchmark(text, mode),
                [cifText, renderMode],
            );
        } catch (e) {
            metrics = { success: false, error: e.message };
        }
        await page.close();

        results.push({ file, sizeKb, ...metrics });
        rows.push([
            file, sizeKb.toFixed(2), metrics.success, metrics.error || '',
            metrics.buildTimeMs?.toFixed(2) ?? '', metrics.renderTimeMs?.toFixed(2) ?? '',
            metrics.drawCalls ?? '', metrics.atomCount ?? '', metrics.bondCount ?? '',
        ].map(csvField).join(','));

        if ((i + 1) % 25 === 0 || i === files.length - 1) {
            console.log(`  ${i + 1}/${files.length} done`);
        }
    }

    await browser.close();
    server.close();
    writeFileSync(outPath, rows.join('\n') + '\n');
    console.log(`\nWrote ${outPath}`);

    const ok = results.filter(r => r.success);
    console.log(`\n${ok.length}/${results.length} succeeded.`);
    if (ok.length > 0) {
        const renderTimes = ok.map(r => r.renderTimeMs);
        const drawCalls = ok.map(r => r.drawCalls);
        console.log('\nRender time (ms):');
        for (const p of [0.5, 0.9, 0.95, 0.99]) {
            console.log(`  p${p * 100}: ${percentile(renderTimes, p).toFixed(1)}`);
        }
        console.log(`\nDraw calls: median=${percentile(drawCalls, 0.5)}, p99=${percentile(drawCalls, 0.99)}`);
    }
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.log(`\n${failed.length} failed, e.g.:`);
        failed.slice(0, 5).forEach(r => console.log(`  ${r.file}: ${r.error}`));
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
