#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * Parses command-line options for the bundle startup benchmark.
 * @param {string[]} argv - Command-line arguments excluding the executable and script
 * @returns {{runs: number, out: string}} Validated benchmark options
 */
function parseArgs(argv) {
    const options = { runs: 15, out: resolve('bundle-startup.json') };
    for (let index = 0; index < argv.length; index++) {
        if (argv[index] === '--runs') {
            options.runs = Number(argv[++index]);
        } else if (argv[index] === '--out') {
            options.out = resolve(argv[++index]);
        } else {
            throw new Error(`Unknown argument: ${argv[index]}`);
        }
    }
    if (!Number.isInteger(options.runs) || options.runs < 1) {
        throw new Error('--runs must be a positive integer');
    }
    return options;
}

/**
 * Runs a child process and returns its trimmed standard output.
 * @param {string} command - Executable to invoke
 * @param {string[]} args - Arguments passed to the executable
 * @returns {string} Trimmed standard output
 */
function run(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
    }
    return result.stdout.trim();
}

/**
 * Calculates timing summary statistics.
 * @param {number[]} values - Timing observations in milliseconds
 * @returns {object} Aggregate timing statistics
 */
function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = fraction => sorted[Math.min(
        sorted.length - 1,
        Math.floor(fraction * sorted.length),
    )];
    return {
        runs: values.length,
        min_ms: sorted[0],
        median_ms: quantile(0.5),
        p90_ms: quantile(0.9),
        max_ms: sorted.at(-1),
        mean_ms: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
}

/**
 * Measures fresh-process import time for an ES module.
 * @param {string} modulePath - Module path relative to the working directory
 * @param {number} runs - Number of fresh processes to sample
 * @returns {object} Aggregate import timing statistics
 */
function coldImport(modulePath, runs) {
    const moduleUrl = pathToFileURL(resolve(modulePath)).href;
    const childSource = [
        'import { performance } from \'node:perf_hooks\';',
        '// The browser entry declares a custom-element class at module scope.',
        'globalThis.HTMLElement = class HTMLElement {};',
        'const started = performance.now();',
        `await import(${JSON.stringify(moduleUrl)});`,
        'process.stdout.write(String(performance.now() - started));',
    ].join('\n');
    return summarize(Array.from({ length: runs }, () =>
        Number(run(process.execPath, ['--input-type=module', '--eval', childSource]))));
}

/**
 * Measures raw and gzip sizes for JavaScript build artefacts.
 * @param {string} distDir - Distribution directory to inspect
 * @returns {Array<{name: string, bytes: number, gzip_bytes: number}>} Artefact sizes
 */
function artifactSizes(distDir) {
    return readdirSync(distDir)
        .filter(name => name.endsWith('.js') || name.endsWith('.cjs'))
        .sort()
        .map(name => {
            const content = readFileSync(join(distDir, name));
            return { name, bytes: content.length, gzip_bytes: gzipSync(content).length };
        });
}

/**
 * Builds one package variant and measures its artefacts and cold import time.
 * @param {{name: string, script: string, esmArtifact: string}} build - Build definition
 * @param {number} runs - Number of cold-import observations
 * @returns {object} Measurements for the build variant
 */
function measureBuild({ name, script, esmArtifact }, runs) {
    run('npm', ['run', script]);
    return {
        variant: name,
        artifacts: artifactSizes(resolve('dist')),
        cold_esm_import: coldImport(resolve('dist', esmArtifact), runs),
    };
}

/** Runs the bundle startup benchmark and writes its JSON report. */
function main() {
    const options = parseArgs(process.argv.slice(2));
    const result = {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        node: process.version,
        source_module_cold_import: {
            space_group_lookup: coldImport(
                'src/lib/structure/space-group-lookup.js', options.runs,
            ),
            public_core_entry: coldImport('src/core.js', options.runs),
        },
        builds: [
            measureBuild({
                name: 'normal', script: 'build', esmArtifact: 'cifvis.js',
            }, options.runs),
            measureBuild({
                name: 'all_dependencies', script: 'build:alldeps',
                esmArtifact: 'cifvis.alldeps.js',
            }, options.runs),
        ],
    };
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Wrote ${options.out}`);
}

main();
