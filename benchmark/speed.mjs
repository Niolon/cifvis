#!/usr/bin/env node
// Speed evaluation for CifVis: loads one or more real CIF files in a headless
// browser against the built library and reports parse/build time, render
// time, and WebGL draw-call count per structure - the core metrics used
// throughout the cifvis-vs-JSMol performance investigation, now available
// directly in this repo instead of only in the external analysis/ scripts.
//
// This only ever exercises the library's default CrystalViewer options
// (default renderStyle/hydrogenMode/symmetryMode). The exploratory sweep
// across display modes lives in analysis/mode-matrix.mjs.
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
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { ensureBundleBuilt, startServer, launchBrowser, runOnPage } from './lib/browser-harness.mjs';
import { percentile, csvField, printPercentiles } from './lib/stats.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));

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

    ensureBundleBuilt();

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
    const browser = await launchBrowser({ chromePath });
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
        const metrics = await runOnPage(context, port, file, { renderMode });

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
        printPercentiles('Render time (ms)', ok.map(r => r.renderTimeMs));
        const drawCalls = ok.map(r => r.drawCalls);
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
