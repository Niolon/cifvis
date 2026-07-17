#!/usr/bin/env node
// Usage: npm run bench:iam -- [coordinate.cif] [iterations]

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { CIF } from '../src/lib/read-cif/base.js';
import { createIAMStructureFactorCalculator } from '../src/lib/density/iam-structure-factors.js';

const path = resolve(process.argv[2] ?? 'site/public/cif/urea.cif');
const iterations = Number(process.argv[3] ?? 10);
const cifText = readFileSync(path, 'utf8');
const cif = new CIF(cifText);
let loop;
for (const block of cif.getAllBlocks()) {
    try {
        loop = block.get('_refln');
    } catch {
        const embedded = block.get('_iucr_refine_fcf_details', null);
        if (typeof embedded === 'string' && embedded.includes('data_')) {
            loop = new CIF(embedded).getBlock(0).get('_refln', null);
        }
    }
}
if (!loop) {
    throw new Error('The benchmark CIF contains no _refln loop');
}
const h = loop.get(['_refln.index_h', '_refln_index_h']);
const k = loop.get(['_refln.index_k', '_refln_index_k']);
const l = loop.get(['_refln.index_l', '_refln_index_l']);
const cifFSquared = loop.get(['_refln.F_squared_calc', '_refln_F_squared_calc'], null);
const reflections = h.map((value, index) => [value, k[index], l[index]]);

const buildStart = performance.now();
const calculator = createIAMStructureFactorCalculator(cifText);
const buildMilliseconds = performance.now() - buildStart;
calculator.calculate(reflections);
const samples = [];
let result;
for (let iteration = 0; iteration < iterations; iteration++) {
    const start = performance.now();
    result = calculator.calculate(reflections);
    samples.push(performance.now() - start);
}

let comparison = {};
if (cifFSquared) {
    const predicted = result.map(value => value.amplitude ** 2);
    const observed = cifFSquared.map(Number);
    const scale = predicted.reduce((sum, value, index) => sum + value * observed[index], 0) /
        predicted.reduce((sum, value) => sum + value ** 2, 0);
    const amplitudeScale = Math.sqrt(scale);
    const r1 = result.reduce((sum, value, index) =>
        sum + Math.abs(amplitudeScale * value.amplitude - Math.sqrt(Math.max(0, observed[index]))), 0,
    ) / observed.reduce((sum, value) => sum + Math.sqrt(Math.max(0, value)), 0);
    comparison = { cifFSquaredScale: scale, cifFSquaredR1: r1 };
}

console.log(JSON.stringify({
    path,
    reflections: reflections.length,
    buildMilliseconds,
    averageCalculationMilliseconds: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    ...calculator.metadata,
    ...comparison,
}, null, 2));
