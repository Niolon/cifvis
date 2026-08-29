#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone numerical microbenchmark */
import { performance } from 'node:perf_hooks';
import { UnitCell } from '../src/lib/structure/crystal.js';
import { ScalarFieldGrid } from '../src/lib/density/scalar-field.js';
import {
    prepareRegularSurfaceSampler,
    samplePreparedSurfaceNodes,
} from '../src/lib/density/isosurface-extractor.js';
import { planSurfaceLattice } from '../src/lib/density/surface-lattice.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};
const numbers = (name, fallback) => option(name, fallback).split(',').map(Number);
const gridSizes = numbers('grid-sizes', '32,64,128');
const coordinateCounts = numbers('coordinates', '100000,500000,1000000');
const repeats = Math.max(1, Math.round(Number(option('repeats', '3'))));
const cell = new UnitCell(1, 1, 1, 90, 90, 90);
const lattice = planSurfaceLattice(
    cell,
    { minimum: [-0.15, -0.1, -0.05], maximum: [1.2, 1.15, 1.1] },
    100,
);

function median(values) {
    return values.sort((first, second) => first - second)[Math.floor(values.length / 2)];
}

const rows = [];
let checksum = 0;
for (const gridSize of gridSizes) {
    const dimensions = [gridSize, gridSize, gridSize];
    const values = new Float32Array(gridSize ** 3);
    for (let index = 0; index < values.length; index++) {
        values[index] = Math.sin(index * 0.0017) + Math.cos(index * 0.00031);
    }
    const field = new ScalarFieldGrid(cell, dimensions, values);
    const prepared = prepareRegularSurfaceSampler(field, lattice);
    for (const coordinateCount of coordinateCounts) {
        const indices = new Uint32Array(coordinateCount);
        for (let index = 0; index < coordinateCount; index++) {
            indices[index] = index % lattice.nodeCount;
        }
        const output = new Float32Array(lattice.nodeCount);
        const genericTimes = [];
        const preparedTimes = [];
        for (let repeat = 0; repeat <= repeats; repeat++) {
            let started = performance.now();
            for (let active = 0; active < indices.length; active++) {
                const flattened = indices[active];
                const z = Math.floor(flattened / 10000);
                const remainder = flattened - z * 10000;
                const y = Math.floor(remainder / 100);
                const x = remainder - y * 100;
                output[flattened] = field.sample(
                    lattice.bounds.minimum[0] + x * lattice.fractionalStep[0],
                    lattice.bounds.minimum[1] + y * lattice.fractionalStep[1],
                    lattice.bounds.minimum[2] + z * lattice.fractionalStep[2],
                );
            }
            const genericMs = performance.now() - started;
            started = performance.now();
            samplePreparedSurfaceNodes(prepared, lattice, indices, indices.length, output);
            const preparedMs = performance.now() - started;
            checksum += output[indices[indices.length - 1]];
            if (repeat > 0) {
                genericTimes.push(genericMs);
                preparedTimes.push(preparedMs);
            }
        }
        rows.push({
            gridSize,
            coordinateCount,
            genericMs: median(genericTimes),
            preparedMs: median(preparedTimes),
            speedup: median(genericTimes) / median(preparedTimes),
        });
    }
}

console.log(JSON.stringify({ gridSizes, coordinateCounts, repeats, checksum, rows }, null, 2));

