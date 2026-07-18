import { describe, expect, test } from 'vitest';
import {
    calculateContourWorkerTask,
    contourTransferables,
} from './contour-worker-task.js';

const field = {
    sigma: 0.1,
    surfaceSign: 'both',
    sample(x, y) {
        return 0.5 - 10 * ((x - 0.5) ** 2 + (y - 0.5) ** 2);
    },
    sampleCubic(x, y) {
        return this.sample(x, y);
    },
};

const request = {
    displayVersion: 7,
    structure: {
        cell: { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 },
        atoms: [{ label: 'C1', position: { x: 0.5, y: 0.5, z: 0.5 } }],
    },
    options: {
        plane: {
            coordinateSystem: 'fractional',
            origin: [0, 0, 0.5],
            normal: [0, 0, 1],
        },
        padding: 5,
        resolution: 40,
        maxResolution: 40,
        gridSpacing: 0.1,
        interpolation: 'tricubic',
        contourStep: 0.1,
        contourCount: 3,
        depthOffset: 0,
        sign: 'both',
        zeroLine: false,
    },
};

describe('contour worker task', () => {
    test('progressively calculates packed renderer-independent segments', () => {
        const rough = calculateContourWorkerTask(field, request, 0.5);
        const final = calculateContourWorkerTask(field, request, 1);

        expect(rough.displayVersion).toBe(7);
        expect(rough.packed).toBe(true);
        expect(rough.positiveSegments).toBeInstanceOf(Float32Array);
        expect(rough.negativeSegments).toBeInstanceOf(Float32Array);
        expect(rough.dimensions.every(value => value <= 20)).toBe(true);
        expect(final.dimensions.every((value, axis) => value >= rough.dimensions[axis])).toBe(true);
        expect(final.segmentCount).toBeGreaterThan(rough.segmentCount);
        expect(contourTransferables(final)).toEqual([
            final.positiveSegments.buffer,
            final.negativeSegments.buffer,
            final.zeroSegments.buffer,
        ]);
    });

    test('does no work when line contours were not requested', () => {
        expect(calculateContourWorkerTask(field, null, 1)).toBeNull();
        expect(contourTransferables(null)).toEqual([]);
    });
});
