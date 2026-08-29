#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone numerical microbenchmark */
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { UnitCell } from '../src/lib/structure/crystal.js';
import {
    extractMarchingCubes,
    sampleActiveCellNodes,
} from '../src/lib/density/isosurface-extractor.js';
import { planSurfaceLattice } from '../src/lib/density/surface-lattice.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};
const numbers = (name, fallback) => option(name, fallback).split(',').map(Number);
const sizes = numbers('sizes', '32,64,96,128');
const fractions = numbers('fractions', '0.001,0.01,0.05,0.2,0.5');
const repeats = Math.max(1, Math.round(Number(option('repeats', '3'))));

const field = {
    sample(x, y, z) {
        return Math.sin(8 * Math.PI * x) +
            Math.sin(8 * Math.PI * y) + Math.sin(8 * Math.PI * z);
    },
};

function activeMask(lattice, fraction) {
    const mask = new Uint8Array(lattice.cellCount);
    const [nx, ny, nz] = lattice.cellDimensions;
    const sideFraction = Math.cbrt(fraction);
    // Three.js intentionally skips its outer cell layers. Keep the synthetic
    // active box inside that same traversable region for a like-for-like
    // polygonization and triangle-count comparison.
    const widths = [nx, ny, nz].map(length => {
        const available = Math.max(1, length - 2);
        return Math.max(1, Math.min(available, Math.round(available * sideFraction)));
    });
    const starts = [nx, ny, nz].map((length, axis) =>
        1 + Math.floor((length - 2 - widths[axis]) / 2));
    let count = 0;
    for (let z = starts[2]; z < starts[2] + widths[2]; z++) {
        for (let y = starts[1]; y < starts[1] + widths[1]; y++) {
            const row = (z * ny + y) * nx;
            for (let x = starts[0]; x < starts[0] + widths[0]; x++) {
                mask[row + x] = 1;
                count++;
            }
        }
    }
    return { mask, count };
}

function threePolygonization(lattice, samples, level) {
    const resolution = lattice.dimensions[0];
    const material = new THREE.MeshBasicMaterial();
    const maximumPolygons = Math.max(10000, 50 * resolution ** 2);
    const positive = new MarchingCubes(
        resolution, material, false, false, maximumPolygons,
    );
    const negative = new MarchingCubes(
        resolution, material, false, false, maximumPolygons,
    );
    positive.isolation = level;
    negative.isolation = level;
    for (let index = 0; index < samples.nodeKnown.length; index++) {
        if (samples.nodeKnown[index]) {
            positive.field[index] = samples.nodeValues[index];
            negative.field[index] = -samples.nodeValues[index];
        }
    }
    const started = performance.now();
    positive.update();
    negative.update();
    const milliseconds = performance.now() - started;
    const triangles = (positive.geometry.drawRange.count + negative.geometry.drawRange.count) / 3;
    positive.geometry.dispose();
    negative.geometry.dispose();
    material.dispose();
    return { milliseconds, triangles };
}

const rows = [];
for (const size of sizes) {
    const lattice = planSurfaceLattice(
        new UnitCell(1, 1, 1, 90, 90, 90),
        { minimum: [0, 0, 0], maximum: [1, 1, 1] },
        size,
    );
    for (const requestedFraction of fractions) {
        const active = activeMask(lattice, requestedFraction);
        const samples = sampleActiveCellNodes(lattice, active.mask, field, active.count);
        const measurements = [];
        for (let repeat = 0; repeat <= repeats; repeat++) {
            const custom = extractMarchingCubes({
                lattice,
                activeCellMask: active.mask,
                activeCellCount: active.count,
                field,
                level: 0.2,
                signs: 'both',
            });
            const three = threePolygonization(lattice, samples, 0.2);
            if (repeat > 0) {
                measurements.push({ custom, three });
            }
        }
        const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const customTimes = measurements.map(({ custom }) =>
            custom.statistics.surfaceClassificationTimeMs +
            custom.statistics.surfaceAllocationTimeMs +
            custom.statistics.surfaceInterpolationTimeMs);
        const threeTimes = measurements.map(({ three }) => three.milliseconds);
        rows.push({
            size,
            requestedActiveFraction: requestedFraction,
            activeFraction: active.count / lattice.cellCount,
            activeCellCount: active.count,
            fieldSampleCount: samples.fieldSampleCount,
            threePolygonizationMs: median(threeTimes),
            cifvisPolygonizationMs: median(customTimes),
            speedup: median(threeTimes) / median(customTimes),
            threeTriangleCount: measurements[0].three.triangles,
            cifvisTriangleCount: measurements[0].custom.statistics.positiveTriangleCount +
                measurements[0].custom.statistics.negativeTriangleCount,
        });
    }
}

console.log(JSON.stringify({ sizes, fractions, repeats, rows }, null, 2));
