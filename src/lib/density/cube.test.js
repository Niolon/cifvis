/* eslint-disable jsdoc/require-jsdoc -- compact Cube fixture builder */
import { describe, expect, test } from 'vitest';
import {
    BOHR_TO_ANGSTROM,
    parseCube,
} from './cube.js';
import { ScalarFieldGrid } from './scalar-field.js';

function cubeText({ atomCount = 1, dimensions = [2, 2, 2], values, extra = '' } = {}) {
    const usedValues = values ?? [0, 1, 2, 3, 4, 5, 6, 7];
    return `first comment
second comment
${atomCount} 0 0 0
${dimensions[0]} 1 0 0
${dimensions[1]} 0 1 0
${dimensions[2]} 0 0 1
1 1.0 0 0 0
${extra}${usedValues.join(' ')}
`;
}

describe('Gaussian Cube parsing', () => {
    test('normalizes Bohr coordinates and charge density to Angstrom units', () => {
        const map = parseCube(cubeText());

        expect(map.dimensions).toEqual([2, 2, 2]);
        expect(map.cell.a).toBeCloseTo(2 * BOHR_TO_ANGSTROM, 12);
        expect(map.axisVectors[0]).toEqual([BOHR_TO_ANGSTROM, 0, 0]);
        expect(map.values[1]).toBeCloseTo(4 / BOHR_TO_ANGSTROM ** 3, 5);
        expect(map.displayLabel).toBe('ρ/eÅ⁻³');
        expect(map.surfaceSign).toBe('positive');
        expect(map.defaultLevel).toBe(0.3);
    });

    test('normalizes Cube z-fastest input to x-fastest field sampling', () => {
        const map = parseCube(cubeText(), { property: 'generic' });

        expect(map.sample(0, 0, 0)).toBe(0);
        expect(map.sample(0.5, 0, 0)).toBe(4);
        expect(map.sample(0, 0.5, 0)).toBe(2);
        expect(map.sample(0, 0, 0.5)).toBe(1);
        expect(map.sample(0.25, 0.25, 0.25)).toBeCloseTo(3.5, 12);
        expect(map.sample(1, 0, 0)).toBe(0);
    });

    test('honours negative voxel counts as Angstrom coordinates', () => {
        const map = parseCube(cubeText({ dimensions: [-2, -2, -2] }));

        expect(map.coordinateUnit).toBe('angstrom');
        expect(map.cell.a).toBeCloseTo(2, 12);
        expect(map.values[1]).toBe(4);
    });

    test('selects one interleaved orbital dataset', () => {
        const values = Array.from({ length: 16 }, (_, index) => index);
        const map = parseCube(cubeText({
            atomCount: -1,
            values,
            extra: '2 5 7 ',
        }), {
            property: 'orbital',
            datasetIndex: 1,
        });

        expect(map.datasetCount).toBe(2);
        expect(map.datasetIds).toEqual([5, 7]);
        expect(map.datasetId).toBe(7);
        expect(Array.from(map.values)).toEqual([1, 9, 5, 13, 3, 11, 7, 15]);
        expect(map.surfaceSign).toBe('both');
    });

    test('round-trips transferable map payloads', () => {
        const original = parseCube(cubeText(), { property: 'generic' });
        const restored = ScalarFieldGrid.fromPayload(original.toPayload());

        expect(restored.dimensions).toEqual(original.dimensions);
        expect(restored.originFractional).toEqual(original.originFractional);
        expect(restored.sample(0.25, 0.25, 0.25)).toBeCloseTo(3.5, 12);
    });

    test('rejects incomplete scalar grids', () => {
        expect(() => parseCube(cubeText({ values: [1, 2] }))).toThrow(
            'grid contains 2 values; expected 8',
        );
    });
});
