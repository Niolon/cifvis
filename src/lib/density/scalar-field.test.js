import { describe, expect, test } from 'vitest';
import { UnitCell } from '../structure/crystal.js';
import { ScalarFieldGrid } from './scalar-field.js';

/** @returns {ScalarFieldGrid} Periodic samples of sin(2πx) on a four-point grid. */
function sineField() {
    const dimensions = [4, 4, 4];
    const xValues = [0, 1, 0, -1];
    const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2]);
    for (let z = 0; z < dimensions[2]; z++) {
        for (let y = 0; y < dimensions[1]; y++) {
            for (let x = 0; x < dimensions[0]; x++) {
                values[(z * dimensions[1] + y) * dimensions[0] + x] = xValues[x];
            }
        }
    }
    return new ScalarFieldGrid(
        new UnitCell(1, 1, 1, 90, 90, 90),
        dimensions,
        values,
    );
}

describe('ScalarFieldGrid cubic sampling', () => {
    test('preserves grid nodes and improves a smooth midpoint over linear sampling', () => {
        const field = sineField();

        expect(field.sampleCubic(0.25, 0, 0)).toBe(1);
        expect(field.sample(0.125, 0, 0)).toBe(0.5);
        expect(field.sampleCubic(0.125, 0, 0)).toBeCloseTo(0.625);
        expect(field.sampleCubic(1.125, 0, 0)).toBeCloseTo(0.625);
    });

    test('keeps finite grids zero outside their stored extent', () => {
        const periodic = sineField();
        const finite = new ScalarFieldGrid(
            periodic.cell,
            periodic.dimensions,
            periodic.values,
            { boundaryMode: 'zero' },
        );

        expect(finite.sampleCubic(-0.01, 0, 0)).toBe(0);
        expect(finite.sampleCubic(1, 0, 0)).toBe(0);
    });
});
