#!/usr/bin/env node
// Usage: npm run bench:iam -- [coordinate.cif] [iterations]

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { CIF } from '../src/lib/read-cif/base.js';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';
import { readReflectionIntensities } from '../src/lib/density/reflection-intensities.js';

const path = resolve(process.argv[2] ?? 'site/public/cif/urea.cif');
const iterations = Number(process.argv[3] ?? 10);
const cifText = readFileSync(path, 'utf8');
const cif = new CIF(cifText);
let loop;
for (const block of cif.getAllBlocks()) {
    try {
        loop = block.get('_refln');
        break;
    } catch {
        let embedded = null;
        try {
            embedded = block.get('_iucr_refine_fcf_details');
        } catch {
            // This block has neither direct nor embedded reflections.
        }
        if (typeof embedded === 'string' && embedded.includes('data_')) {
            try {
                loop = new CIF(embedded).getBlock(0).get('_refln');
                break;
            } catch {
                // Continue searching later data blocks.
            }
        }
    }
}
let reflections;
let cifFSquared = null;
if (loop) {
    const h = loop.get(['_refln.index_h', '_refln_index_h']);
    const k = loop.get(['_refln.index_k', '_refln_index_k']);
    const l = loop.get(['_refln.index_l', '_refln_index_l']);
    try {
        cifFSquared = loop.get(['_refln.F_squared_calc', '_refln_F_squared_calc']);
    } catch {
        // Agreement reporting is optional.
    }
    reflections = h.map((value, index) => [value, k[index], l[index]]);
} else {
    reflections = readReflectionIntensities(cifText, 0, { mergeFriedel: false })
        .reflections.map(reflection => [reflection.h, reflection.k, reflection.l]);
}

// Warm the JIT independently without warming the measured calculator itself.
const warmupCalculator = createIAMStructureFactorCalculator(cifText);
warmupCalculator.calculate(reflections);
warmupCalculator.calculatePrepared(reflections, { phaseMode: 'direct', dwfMode: 'direct' });
warmupCalculator.calculatePrepared(reflections, { phaseMode: 'tables', dwfMode: 'direct' });

const buildStart = performance.now();
const calculator = createIAMStructureFactorCalculator(cifText);
const buildMilliseconds = performance.now() - buildStart;
/**
 * @param {function(): unknown} calculation - Calculation to time.
 * @returns {object} Warmed first/repeated timing and final value.
 */
function measure(calculation) {
    const firstStart = performance.now();
    let value = calculation();
    const firstMilliseconds = performance.now() - firstStart;
    const samples = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
        const start = performance.now();
        value = calculation();
        samples.push(performance.now() - start);
    }
    return {
        value,
        firstMilliseconds,
        averageMilliseconds: samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
    };
}
const scalar = measure(() => calculator.calculate(reflections));
const preparedDirect = measure(() =>
    calculator.calculatePrepared(reflections, { phaseMode: 'direct', dwfMode: 'direct' }));
const preparedTables = measure(() =>
    calculator.calculatePrepared(reflections, { phaseMode: 'tables', dwfMode: 'direct' }));

let comparison = {};
if (cifFSquared) {
    const predicted = [...preparedTables.value.fSquared];
    const observed = cifFSquared.map(Number);
    const scale = predicted.reduce((sum, value, index) => sum + value * observed[index], 0) /
        predicted.reduce((sum, value) => sum + value ** 2, 0);
    const amplitudeScale = Math.sqrt(scale);
    const r1 = predicted.reduce((sum, value, index) =>
        sum + Math.abs(amplitudeScale * Math.sqrt(value) - Math.sqrt(Math.max(0, observed[index]))), 0,
    ) / observed.reduce((sum, value) => sum + Math.sqrt(Math.max(0, value)), 0);
    comparison = { cifFSquaredScale: scale, cifFSquaredR1: r1 };
}

console.log(JSON.stringify({
    path,
    reflections: reflections.length,
    buildMilliseconds,
    scalar: {
        firstMilliseconds: scalar.firstMilliseconds,
        averageMilliseconds: scalar.averageMilliseconds,
    },
    preparedDirect: {
        firstMilliseconds: preparedDirect.firstMilliseconds,
        averageMilliseconds: preparedDirect.averageMilliseconds,
        diagnostics: preparedDirect.value.diagnostics,
    },
    preparedTables: {
        firstMilliseconds: preparedTables.firstMilliseconds,
        averageMilliseconds: preparedTables.averageMilliseconds,
        speedupOverScalar: scalar.averageMilliseconds / preparedTables.averageMilliseconds,
        speedupOverPreparedDirect:
            preparedDirect.averageMilliseconds / preparedTables.averageMilliseconds,
        diagnostics: preparedTables.value.diagnostics,
    },
    ...calculator.metadata,
    ...comparison,
}, null, 2));
