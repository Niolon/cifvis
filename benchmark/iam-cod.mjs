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
        seed: 20260829,
        iterations: 1,
        maxReflections: 60000,
        out: '/tmp/cifvis-iam-cod.json',
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

function time(calculation, iterations) {
    let result;
    const samples = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
        const started = performance.now();
        result = calculation();
        samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    return { result, milliseconds: samples[Math.floor(samples.length / 2)] };
}

function percentile(values, fraction) {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (sorted.length === 0) {
        return null;
    }
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function timingSummary(records, key) {
    const values = records.map(record => record[key]);
    return {
        p50: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
    };
}

function groupSummary(records, selector) {
    const groups = new Map();
    for (const record of records) {
        const name = selector(record);
        const group = groups.get(name) ?? [];
        group.push(record);
        groups.set(name, group);
    }
    return Object.fromEntries([...groups].map(([name, group]) => [name, {
        count: group.length,
        scalarMs: timingSummary(group, 'scalarMs'),
        preparedDirectMs: timingSummary(group, 'preparedDirectMs'),
        preparedTablesMs: timingSummary(group, 'preparedTablesMs'),
        tableSpeedup: timingSummary(group, 'tableSpeedup'),
        best: Object.fromEntries(['scalar', 'prepared-direct', 'prepared-tables'].map(mode => [
            mode,
            group.filter(record => record.bestMode === mode).length,
        ])),
    }]));
}

function quartileBounds(records, key) {
    return [0.25, 0.5, 0.75].map(fraction => percentile(records.map(record => record[key]), fraction));
}

function quartileName(value, bounds) {
    if (value <= bounds[0]) {
        return 'small';
    }
    if (value <= bounds[1]) {
        return 'medium';
    }
    if (value <= bounds[2]) {
        return 'large';
    }
    return 'very-large';
}

function maximumError(reference, candidate) {
    let absolute = 0;
    let relative = 0;
    for (let index = 0; index < reference.length; index++) {
        for (const key of ['real', 'imaginary']) {
            const expected = reference[index][key];
            const actual = candidate[key][index];
            absolute = Math.max(absolute, Math.abs(actual - expected));
            relative = Math.max(relative, Math.abs(actual - expected) / Math.max(1, Math.abs(expected)));
        }
    }
    return { absolute, relative };
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
        const calculator = createIAMStructureFactorCalculator(cifText, 0, {
            includeAnomalous: false,
        });
        calculator.calculate(reflections);
        calculator.calculatePrepared(reflections, { phaseMode: 'direct', dwfMode: 'direct' });
        calculator.calculatePrepared(reflections, { phaseMode: 'tables', dwfMode: 'direct' });
        const scalar = time(() => calculator.calculate(reflections), options.iterations);
        const direct = time(() => calculator.calculatePrepared(
            reflections,
            { phaseMode: 'direct', dwfMode: 'direct' },
        ), options.iterations);
        const tables = time(() => calculator.calculatePrepared(
            reflections,
            { phaseMode: 'tables', dwfMode: 'direct' },
        ), options.iterations);
        const timings = [
            ['scalar', scalar.milliseconds],
            ['prepared-direct', direct.milliseconds],
            ['prepared-tables', tables.milliseconds],
        ];
        timings.sort((left, right) => left[1] - right[1]);
        records.push({
            codId: basename(file.path, '.cif'),
            cifBytes: statSync(file.path).size,
            hklBytes: file.sizeBytes,
            reflectionCount: reflections.length,
            atomCount: calculator.metadata.atomCount,
            expandedAtomCount: calculator.metadata.expandedAtomCount,
            symmetryOperationCount: calculator.metadata.symmetryOperationCount,
            scatteringModelCount: calculator.metadata.scatteringModelCount,
            displacementModelCount: calculator.metadata.displacementModelCount,
            scalarMs: scalar.milliseconds,
            preparedDirectMs: direct.milliseconds,
            preparedTablesMs: tables.milliseconds,
            directSpeedup: scalar.milliseconds / direct.milliseconds,
            tableSpeedup: scalar.milliseconds / tables.milliseconds,
            phaseTableSpeedup: direct.milliseconds / tables.milliseconds,
            bestMode: timings[0][0],
            reflectionPreparationMs: tables.result.diagnostics.reflectionPreparationMs,
            scatteringPreparationMs: tables.result.diagnostics.scatteringPreparationMs,
            phaseTablePreparationMs: tables.result.diagnostics.phaseTablePreparationMs,
            accumulationMs: tables.result.diagnostics.accumulationMs,
            outputBytes: tables.result.diagnostics.outputBytes,
            workBufferBytes: tables.result.diagnostics.workBufferBytes,
            phaseTrigEvaluationCount: tables.result.diagnostics.phaseTrigEvaluationCount,
            directPhaseTrigEvaluationCount: direct.result.diagnostics.phaseTrigEvaluationCount,
            dwfExpEvaluationCount: tables.result.diagnostics.dwfExpEvaluationCount,
            cromerMannExpEvaluationCount: tables.result.diagnostics.cromerMannExpEvaluationCount,
            directError: maximumError(scalar.result, direct.result),
            tableError: maximumError(scalar.result, tables.result),
        });
    } catch (error) {
        failures.push({ codId: basename(file.path, '.cif'), error: error.message });
    }
    if ((fileIndex + 1) % 25 === 0) {
        process.stderr.write(`${fileIndex + 1}/${sampling.files.length}\n`);
    }
}
const atomBounds = quartileBounds(records, 'expandedAtomCount');
const reflectionBounds = quartileBounds(records, 'reflectionCount');
const symmetryBounds = quartileBounds(records, 'symmetryOperationCount');
const report = {
    options,
    populationSize: sampling.populationSize,
    successful: records.length,
    failed: failures.length,
    timings: Object.fromEntries([
        'scalarMs', 'preparedDirectMs', 'preparedTablesMs',
        'directSpeedup', 'tableSpeedup', 'phaseTableSpeedup',
    ].map(key => [key, timingSummary(records, key)])),
    best: Object.fromEntries(['scalar', 'prepared-direct', 'prepared-tables'].map(mode => [
        mode,
        records.filter(record => record.bestMode === mode).length,
    ])),
    dependencies: {
        expandedAtoms: { bounds: atomBounds, groups: groupSummary(records, record =>
            quartileName(record.expandedAtomCount, atomBounds)) },
        reflections: { bounds: reflectionBounds, groups: groupSummary(records, record =>
            quartileName(record.reflectionCount, reflectionBounds)) },
        symmetryOperations: { bounds: symmetryBounds, groups: groupSummary(records, record =>
            quartileName(record.symmetryOperationCount, symmetryBounds)) },
    },
    maximumAbsoluteError: Math.max(...records.flatMap(record => [
        record.directError.absolute, record.tableError.absolute,
    ])),
    maximumRelativeError: Math.max(...records.flatMap(record => [
        record.directError.relative, record.tableError.relative,
    ])),
    records,
    failures,
};
writeFileSync(resolve(options.out), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, records: undefined, failures: failures.slice(0, 20) }, null, 2));
