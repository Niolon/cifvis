#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- benchmark-local analysis helpers */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';
import { readReflectionIntensities } from '../src/lib/density/reflection-intensities.js';
import { realDataSample, seededRandom } from './lib/cod-sample.mjs';

function optionsFromArguments(argv) {
    const options = {
        cifDir: argv[0] ?? '/home/niklas/cod/cif',
        hklDir: argv[1] ?? '/home/niklas/cod/hkl',
        sample: 1000,
        seed: 20260830,
        iterations: 1,
        maxReflections: 60000,
        out: '/tmp/cifvis-fcalc-dwf-cod.json',
    };
    for (let index = 2; index < argv.length; index += 2) {
        const key = argv[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (!Object.hasOwn(options, key) || argv[index + 1] === undefined) {
            throw new Error(`Unknown or incomplete option ${argv[index]}`);
        }
        options[key] = argv[index + 1];
    }
    for (const key of ['sample', 'seed', 'iterations', 'maxReflections']) {
        options[key] = Number(options[key]);
    }
    return options;
}

function medianTime(calculation, iterations) {
    const samples = [];
    let result;
    for (let iteration = 0; iteration < iterations; iteration++) {
        const started = performance.now();
        result = calculation();
        samples.push(performance.now() - started);
    }
    samples.sort((first, second) => first - second);
    return { milliseconds: samples[Math.floor(samples.length / 2)], result };
}

function percentile(records, key, fraction) {
    const values = records.map(record => record[key]).filter(Number.isFinite)
        .sort((first, second) => first - second);
    return values[Math.min(values.length - 1, Math.floor(values.length * fraction))] ?? null;
}

function summary(records, key) {
    return Object.fromEntries([
        ['p25', 0.25], ['p50', 0.5], ['p90', 0.9], ['p95', 0.95], ['p99', 0.99],
    ].map(([name, fraction]) => [name, percentile(records, key, fraction)]));
}

function quartileGroups(records, key) {
    const bounds = [0.25, 0.5, 0.75].map(fraction => percentile(records, key, fraction));
    const names = ['small', 'medium', 'large', 'very-large'];
    return {
        bounds,
        groups: Object.fromEntries(names.map((name, groupIndex) => {
            const group = records.filter(record => {
                const value = record[key];
                return groupIndex === bounds.findIndex(bound => value <= bound) ||
                    (groupIndex === 3 && value > bounds[2]);
            });
            return [name, {
                count: group.length,
                directMs: summary(group, 'directMs'),
                uisoVectorsMs: summary(group, 'uisoVectorsMs'),
                speedup: summary(group, 'speedup'),
            }];
        })),
    };
}

function maximumDifference(first, second) {
    let maximum = 0;
    for (let index = 0; index < first.real.length; index++) {
        maximum = Math.max(
            maximum,
            Math.abs(first.real[index] - second.real[index]),
            Math.abs(first.imaginary[index] - second.imaginary[index]),
            Math.abs(first.fSquared[index] - second.fSquared[index]),
        );
    }
    return maximum;
}

const options = optionsFromArguments(process.argv.slice(2));
const sampling = realDataSample(
    resolve(options.cifDir),
    resolve(options.hklDir),
    options.sample,
    seededRandom(options.seed),
);
const records = [];
const failures = [];
for (let fileIndex = 0; fileIndex < sampling.files.length; fileIndex++) {
    const file = sampling.files[fileIndex];
    try {
        const cifText = readFileSync(file.path, 'utf8');
        const hklText = readFileSync(file.hklPath, 'utf8');
        const reflections = readReflectionIntensities(hklText, 0, { mergeFriedel: true }).reflections;
        if (reflections.length > options.maxReflections) {
            throw new Error(`reflection limit exceeded (${reflections.length})`);
        }
        const modelStarted = performance.now();
        const calculator = createIAMStructureFactorCalculator(cifText, 0, { includeAnomalous: false });
        const modelBuildMs = performance.now() - modelStarted;
        calculator.calculatePrepared(reflections, { dwfMode: 'direct' });
        calculator.calculatePrepared(reflections, { dwfMode: 'uiso-vectors' });
        const modes = fileIndex % 2 === 0
            ? ['direct', 'uiso-vectors']
            : ['uiso-vectors', 'direct'];
        const measured = Object.fromEntries(modes.map(mode => [mode, medianTime(
            () => calculator.calculatePrepared(reflections, { dwfMode: mode }),
            options.iterations,
        )]));
        const direct = measured.direct;
        const vectors = measured['uiso-vectors'];
        const diagnostics = vectors.result.diagnostics;
        records.push({
            codId: basename(file.path, '.cif'),
            cifBytes: statSync(file.path).size,
            hklBytes: file.sizeBytes,
            modelBuildMs,
            reflectionCount: reflections.length,
            expandedAtomCount: diagnostics.expandedAtomCount,
            symmetryOperationCount: calculator.metadata.symmetryOperationCount,
            noAdpExpandedAtomCount: diagnostics.noAdpExpandedAtomCount,
            uisoExpandedAtomCount: diagnostics.uisoExpandedAtomCount,
            uaniExpandedAtomCount: diagnostics.uaniExpandedAtomCount,
            uniqueUisoCount: diagnostics.uniqueUisoCount,
            uniqueReciprocalUaniTensorCount: diagnostics.uniqueReciprocalUaniTensorCount,
            uisoReuseFactor: diagnostics.uniqueUisoCount > 0
                ? diagnostics.uisoExpandedAtomCount / diagnostics.uniqueUisoCount
                : 0,
            directMs: direct.milliseconds,
            uisoVectorsMs: vectors.milliseconds,
            speedup: direct.milliseconds / vectors.milliseconds,
            savedMs: direct.milliseconds - vectors.milliseconds,
            dwfPreparationMs: diagnostics.dwfPreparationMs,
            directWorkBufferBytes: direct.result.diagnostics.workBufferBytes,
            vectorWorkBufferBytes: diagnostics.workBufferBytes,
            maximumDifference: maximumDifference(direct.result, vectors.result),
        });
    } catch (error) {
        failures.push({ codId: basename(file.path, '.cif'), error: error.message });
    }
    if ((fileIndex + 1) % 25 === 0) {
        process.stderr.write(`${fileIndex + 1}/${sampling.files.length}\n`);
    }
}

const report = {
    options,
    populationSize: sampling.populationSize,
    successful: records.length,
    failed: failures.length,
    timings: Object.fromEntries([
        'directMs', 'uisoVectorsMs', 'speedup', 'savedMs', 'dwfPreparationMs',
    ].map(key => [key, summary(records, key)])),
    wins: records.filter(record => record.uisoVectorsMs < record.directMs).length,
    regressions: records.filter(record => record.uisoVectorsMs >= record.directMs).length,
    noUiso: records.filter(record => record.uisoExpandedAtomCount === 0).length,
    maximumDifference: Math.max(0, ...records.map(record => record.maximumDifference)),
    dependencies: {
        reflections: quartileGroups(records, 'reflectionCount'),
        expandedAtoms: quartileGroups(records, 'expandedAtomCount'),
        symmetryOperations: quartileGroups(records, 'symmetryOperationCount'),
        uisoReuse: quartileGroups(records, 'uisoReuseFactor'),
    },
    records,
    failures,
};
writeFileSync(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, records: undefined, failures: failures.slice(0, 20) }, null, 2));
