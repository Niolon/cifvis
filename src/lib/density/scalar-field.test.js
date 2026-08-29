import { describe, expect, test } from 'vitest';
import { UnitCell } from '../structure/crystal.js';
import {
    quotientScalarFieldBySymmetry,
    ScalarFieldGrid,
    SymmetryReducedScalarFieldGrid,
} from './scalar-field.js';

const OPERATIONS = [
    {
        rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        translation: [0, 0, 0],
    },
    {
        rotation: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],
        translation: [0, 0, 0],
    },
];

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

describe('symmetry-reduced scalar fields', () => {
    test('quotients, samples, materializes, and transfers an inversion-symmetric grid', () => {
        const dimensions = [5, 5, 5];
        const values = Float32Array.from({ length: 125 }, (_, index) => {
            const x = index % 5;
            const y = Math.floor(index / 5) % 5;
            const z = Math.floor(index / 25);
            return Math.cos(2 * Math.PI * x / 5) +
                2 * Math.cos(2 * Math.PI * y / 5) +
                3 * Math.cos(2 * Math.PI * z / 5);
        });
        const full = new ScalarFieldGrid(
            new UnitCell(5, 5, 5, 90, 90, 90),
            dimensions,
            values,
            {
                symmetryOperations: OPERATIONS,
                boundaryMode: 'periodic',
                minimum: -6,
                maximum: 6,
            },
        );

        const reduced = quotientScalarFieldBySymmetry(full).field;
        expect(reduced).toBeInstanceOf(SymmetryReducedScalarFieldGrid);
        expect(reduced.representativeValues.length).toBeLessThan(values.length);
        expect(reduced.materializeValues()).toEqual(values);
        expect(reduced.sample(0.17, -0.23, 1.11)).toBeCloseTo(
            full.sample(0.17, -0.23, 1.11),
            7,
        );

        const restored = ScalarFieldGrid.fromPayload(reduced.toPayload());
        expect(restored).toBeInstanceOf(SymmetryReducedScalarFieldGrid);
        expect(restored.materializeValues()).toEqual(values);
    });

    test('rejects a field which is not invariant on its symmetry orbits', () => {
        const field = new ScalarFieldGrid(
            new UnitCell(3, 3, 3, 90, 90, 90),
            [3, 3, 3],
            Float32Array.from({ length: 27 }, (_, index) => index),
            { symmetryOperations: OPERATIONS, minimum: 0, maximum: 26 },
        );
        expect(quotientScalarFieldBySymmetry(field)).toMatchObject({
            field: null,
            fallbackReason: 'symmetry-orbit-validation-failed',
        });
    });
});
