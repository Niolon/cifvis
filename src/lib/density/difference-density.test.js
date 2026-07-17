import { describe, expect, test } from 'vitest';
import {
    calculateDifferenceDensityMap,
    DifferenceDensityMap,
    parseDifferenceDensityDataset,
} from './difference-density.js';

const P1_FCF = `data_test
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
_cell_length_a 1
_cell_length_b 1
_cell_length_c 1
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 _refln_F_calc
 _refln_phase_calc
 1 0 0 4 1 0
`;

const MULTI_RESOLUTION_FCF = P1_FCF.replace(
    ' 1 0 0 4 1 0\n',
    ' 1 0 0 4 1 0\n 4 0 0 9 1 0\n',
);

describe('DifferenceDensityMap', () => {
    test('calculates a correctly normalized real Fo-Fc Fourier map', () => {
        const map = DifferenceDensityMap.fromCIF(P1_FCF);

        expect(map.reflectionCount).toBe(1);
        expect(map.coefficientCount).toBe(2);
        expect(map.dimensions).toEqual([4, 2, 2]);
        expect(map.sample(0, 0, 0)).toBeCloseTo(2, 6);
        expect(map.sample(0.25, 0, 0)).toBeCloseTo(0, 6);
        expect(map.sample(0.5, 0, 0)).toBeCloseTo(-2, 6);
        expect(map.sigma).toBeCloseTo(Math.sqrt(2), 6);
        expect(map.mean).toBeCloseTo(0, 12);
        expect(map.maxImaginary).toBeCloseTo(0, 12);
        expect(map.symmetryOperations).toEqual([{
            rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            translation: [0, 0, 0],
        }]);
    });

    test('samples periodically outside the base unit cell', () => {
        const map = DifferenceDensityMap.fromCIF(P1_FCF);

        expect(map.sample(1.125, 0, 0)).toBeCloseTo(map.sample(0.125, 0, 0), 6);
        expect(map.sample(-0.25, 0, 0)).toBeCloseTo(map.sample(0.75, 0, 0), 6);
    });

    test('progressively adds reciprocal-resolution shells and preserves the exact final map', () => {
        const dataset = parseDifferenceDensityDataset(MULTI_RESOLUTION_FCF);
        const rough = calculateDifferenceDensityMap(dataset, 0.3);
        const refined = calculateDifferenceDensityMap(dataset, 1);
        const direct = DifferenceDensityMap.fromCIF(MULTI_RESOLUTION_FCF);

        expect(rough.dimensions).toEqual([4, 2, 2]);
        expect(refined.dimensions).toEqual([16, 2, 2]);
        expect(rough.coefficientCount).toBe(2);
        expect(refined.coefficientCount).toBe(4);
        expect(refined.values).toEqual(direct.values);
        expect(refined.sigma).toBe(direct.sigma);
    });

    test('oversamples a fixed reciprocal map without changing its density', () => {
        const dataset = parseDifferenceDensityDataset(P1_FCF);
        const regular = calculateDifferenceDensityMap(dataset, 1, 1);
        const oversampled = calculateDifferenceDensityMap(dataset, 1, 2);

        expect(oversampled.dimensions).toEqual(regular.dimensions.map(size => size * 2));
        expect(oversampled.coefficientCount).toBe(regular.coefficientCount);
        for (const fractionalX of [0, 0.25, 0.5, 0.75]) {
            expect(oversampled.sample(fractionalX, 0, 0))
                .toBeCloseTo(regular.sample(fractionalX, 0, 0), 6);
        }
    });

    test('reports missing calculated phases clearly', () => {
        const withoutPhase = P1_FCF
            .replace(' _refln_phase_calc\n', '')
            .replace(' 1 0 0 4 1 0\n', ' 1 0 0 4 1\n');
        expect(() => DifferenceDensityMap.fromCIF(withoutPhase)).toThrow(/phase_calc/);
    });
});
