#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

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

function run(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
    }
    return result.stdout.trim();
}

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

function coldImport(modulePath, runs) {
    const moduleUrl = pathToFileURL(resolve(modulePath)).href;
    const childSource = [
        "import { performance } from 'node:perf_hooks';",
        '// The browser entry declares a custom-element class at module scope.',
        'globalThis.HTMLElement = class HTMLElement {};',
        'const started = performance.now();',
        `await import(${JSON.stringify(moduleUrl)});`,
        'process.stdout.write(String(performance.now() - started));',
    ].join('\n');
    return summarize(Array.from({ length: runs }, () =>
        Number(run(process.execPath, ['--input-type=module', '--eval', childSource]))));
}

function artifactSizes(distDir) {
    return readdirSync(distDir)
        .filter(name => name.endsWith('.js') || name.endsWith('.cjs'))
        .sort()
        .map(name => {
            const content = readFileSync(join(distDir, name));
            return { name, bytes: content.length, gzip_bytes: gzipSync(content).length };
        });
}

function measureBuild({ name, script, esmArtifact }, runs) {
    run('npm', ['run', script]);
    return {
        variant: name,
        artifacts: artifactSizes(resolve('dist')),
        cold_esm_import: coldImport(resolve('dist', esmArtifact), runs),
    };
}

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
            public_nobrowser_entry: coldImport('src/index.nobrowser.js', options.runs),
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
