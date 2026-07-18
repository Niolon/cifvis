#!/usr/bin/env node
/* eslint-disable jsdoc/require-param -- local benchmark helpers */
import fs from 'node:fs';
import * as THREE from 'three';
import { CIF } from '../src/lib/read-cif/base.js';
import { parseCube } from '../src/lib/density/cube.js';
import { calculateContourWorkerTask } from '../src/lib/density/contour-worker-task.js';
import { DEFAULT_CONTOUR_LINE_OPTIONS } from '../src/lib/density/contour-line-options.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from '../src/lib/density/isosurface-options.js';
import { assertCellsMatch } from '../src/lib/density/cell-matching.js';
import { ThreeContourLineLayer } from '../src/lib/ortep3d/three-contour-line-layer.js';
import { CrystalStructure } from '../src/lib/structure/crystal.js';

const cifPath = process.argv[2];
const cubePath = process.argv[3];
const runCount = Math.max(1, Number(process.argv[4]) || 7);
if (!cifPath || !cubePath) {
    throw new Error('Usage: npm run bench:contours -- structure.cif field.cube [runs]');
}

/** @returns {number} Median of numeric observations. */
function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

/** Disposes generated GPU-side resource wrappers between observations. */
function disposeLayer(layer) {
    layer.clearMesh();
}

const structure = CrystalStructure.fromCIF(
    new CIF(fs.readFileSync(cifPath, 'utf8')).getBlock(0),
);
const field = parseCube(fs.readFileSync(cubePath, 'utf8'), { property: 'density' });
assertCellsMatch(field.cell, structure.cell, 'Benchmark Cube');
const variants = ['linear', 'tricubic'];
const fractions = DEFAULT_ISOSURFACE_OPTIONS.progressiveSteps;
const structurePayload = {
    cell: {
        a: structure.cell.a,
        b: structure.cell.b,
        c: structure.cell.c,
        alpha: structure.cell.alpha,
        beta: structure.cell.beta,
        gamma: structure.cell.gamma,
    },
    atoms: structure.atoms.map(atom => ({
        label: atom.label,
        position: { x: atom.position.x, y: atom.position.y, z: atom.position.z },
    })),
};
const output = {
    cifPath,
    cubePath,
    atoms: structure.atoms.length,
    sourceGrid: field.dimensions,
    runs: runCount,
    progressiveFractions: fractions,
    variants: {},
};

for (const interpolation of variants) {
    const layer = new ThreeContourLineLayer(new THREE.Group(), {
        ...DEFAULT_ISOSURFACE_OPTIONS,
        ...DEFAULT_CONTOUR_LINE_OPTIONS,
        enabled: true,
        interpolation,
    });
    layer.setField(field);
    layer.setStructure(structure);
    const contourRequest = {
        displayVersion: 0,
        structure: structurePayload,
        options: layer.options,
    };
    layer.rebuildFromContours(calculateContourWorkerTask(field, contourRequest, 1));
    disposeLayer(layer);

    output.variants[interpolation] = { stages: {} };
    for (const fraction of fractions) {
        const observations = [];
        for (let run = 0; run < runCount; run++) {
            const taskStarted = performance.now();
            const packed = calculateContourWorkerTask(field, contourRequest, fraction);
            const taskCompleted = performance.now();
            const statistics = layer.rebuildFromContours(packed);
            observations.push({
                ...statistics,
                workerTaskTimeMs: taskCompleted - taskStarted,
                workerPackingTimeMs: taskCompleted - taskStarted - packed.timings.totalTimeMs,
            });
            disposeLayer(layer);
        }
        const last = observations.at(-1);
        output.variants[interpolation].stages[fraction] = {
            dimensions: last.dimensions,
            levels: last.levels.length,
            segments: last.segmentCount,
            planeSetupTimeMs: median(observations.map(value => value.planeSetupTimeMs)),
            samplingTimeMs: median(observations.map(value => value.samplingTimeMs)),
            contourExtractionTimeMs: median(observations.map(
                value => value.contourExtractionTimeMs,
            )),
            workerTaskTimeMs: median(observations.map(value => value.workerTaskTimeMs)),
            workerPackingTimeMs: median(observations.map(value => value.workerPackingTimeMs)),
            mainThreadGeometryTimeMs: median(observations.map(value => value.generationTimeMs)),
            endToEndComponentTimeMs: median(observations.map(value =>
                value.workerTaskTimeMs + value.generationTimeMs)),
        };
    }
    layer.dispose();
}

console.log(JSON.stringify(output, null, 2));
