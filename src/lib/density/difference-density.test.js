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

const CUSTOM_COEFFICIENT_FCF = `data_custom
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
 _refln_amp_first
 _refln_amp_second
 _refln_phase_common
 _refln_phase_first
 _refln_phase_second
 _refln_A_first
 _refln_B_first
 _refln_A_second
 _refln_B_second
 0 0 0 10 2 0 0 0 10 0 2 0
 1 0 0 4 1 60 0 90 5 2 1 -1
`;

/**
 * @param {object} columns - Custom coefficient-column definition.
 * @returns {object} Positive h=1 coefficient from a custom dataset.
 */
function customCoefficient(columns) {
    return parseDifferenceDensityDataset(CUSTOM_COEFFICIENT_FCF, 0, columns)
        .coefficients.get('1,0,0');
}

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

    test('supports custom amplitudes with one common phase', () => {
        const coefficient = customCoefficient({
            amplitudes: ['_refln_amp_first', '_refln_amp_second'],
            phases: '_refln_phase_common',
        });

        expect(coefficient.real).toBeCloseTo(1.5, 12);
        expect(coefficient.imaginary).toBeCloseTo(3 * Math.sqrt(3) / 2, 12);
    });

    test('supports amplitudes with independent phases', () => {
        const coefficient = customCoefficient({
            amplitudes: ['_refln_amp_first', '_refln_amp_second'],
            phases: ['_refln_phase_first', '_refln_phase_second'],
        });

        expect(coefficient.real).toBeCloseTo(4, 12);
        expect(coefficient.imaginary).toBeCloseTo(-1, 12);
    });

    test('supports a single amplitude and radian phase', () => {
        const coefficient = customCoefficient({
            amplitude: '_refln_amp_first',
            phase: '_refln_phase_common',
            phaseUnit: 'radians',
        });

        expect(coefficient.real).toBeCloseTo(4 * Math.cos(60), 12);
        expect(coefficient.imaginary).toBeCloseTo(4 * Math.sin(60), 12);
    });

    test('supports direct A/B coefficients and differences of A/B pairs', () => {
        const direct = customCoefficient({
            A: '_refln_A_first',
            B: '_refln_B_first',
        });
        const difference = customCoefficient({
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        });

        expect(direct.real).toBeCloseTo(5, 12);
        expect(direct.imaginary).toBeCloseTo(2, 12);
        expect(difference.real).toBeCloseTo(4, 12);
        expect(difference.imaginary).toBeCloseTo(3, 12);
    });

    test('retains custom F(000) unless explicitly omitted', () => {
        const columns = {
            a: '_refln_A_first',
            b: '_refln_B_first',
        };
        const retained = parseDifferenceDensityDataset(CUSTOM_COEFFICIENT_FCF, 0, columns);
        const omitted = parseDifferenceDensityDataset(CUSTOM_COEFFICIENT_FCF, 0, {
            ...columns,
            omitF000: true,
        });

        expect(retained.coefficients.get('0,0,0').real).toBe(10);
        expect(omitted.coefficients.has('0,0,0')).toBe(false);
        expect(calculateDifferenceDensityMap(retained).mean).toBeCloseTo(10, 6);
    });

    test('supports custom reflection-loop and index columns', () => {
        const customLoop = CUSTOM_COEFFICIENT_FCF
            .replaceAll('_refln_', '_qrefn_');
        const dataset = parseDifferenceDensityDataset(customLoop, 0, {
            loop: '_qrefn',
            h: '_qrefn_index_h',
            k: '_qrefn_index_k',
            l: '_qrefn_index_l',
            a: '_qrefn_A_first',
            b: '_qrefn_B_first',
        });

        expect(dataset.coefficientMode).toBe('a-b');
        expect(dataset.coefficients.get('1,0,0').real).toBe(5);
    });

    test('rejects incomplete or mismatched custom coefficient definitions', () => {
        expect(() => customCoefficient({ amplitudes: '_refln_amp_first' }))
            .toThrow(/amplitude and phase/);
        expect(() => customCoefficient({
            amplitudes: ['_refln_amp_first', '_refln_amp_second'],
            phases: ['_refln_phase_common'],
            a: '_refln_A_first',
            b: '_refln_B_first',
        })).toThrow(/either amplitudes\/phases or A\/B/);
    });

    test('reports missing calculated phases clearly', () => {
        const withoutPhase = P1_FCF
            .replace(' _refln_phase_calc\n', '')
            .replace(' 1 0 0 4 1 0\n', ' 1 0 0 4 1\n');
        expect(() => DifferenceDensityMap.fromCIF(withoutPhase)).toThrow(/phase_calc/);
    });
});
