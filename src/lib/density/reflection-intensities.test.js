/* eslint-disable jsdoc/require-jsdoc */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CellSymmetry, SymmetryOperation } from '../structure/cell-symmetry.js';
import {
    isSystematicAbsence,
    mergeReflectionIntensities,
    mergeReflectionIntensitiesLegacy,
    readReflectionIntensities,
} from './reflection-intensities.js';
import {
    canonicalReflectionIndex,
    canonicalReflectionIndexLegacy,
    isGeneralPositionSystematicAbsence,
    isGeneralPositionSystematicAbsenceLegacy,
} from './reciprocal-symmetry.js';

function cifWithReflections(reflections, operations = ['\'x,y,z\'']) {
    return `data_test
loop_
 _space_group_symop_operation_xyz
 ${operations.join('\n ')}
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
${reflections}
`;
}

const P21_OPERATIONS = ['\'x,y,z\'', '\'-x,y+1/2,-z\''];

describe('reflection intensity input', () => {
    test('matches the legacy canonical orbit scan and merger on randomized observations', () => {
        const symmetry = new CellSymmetry('P212121', 19, [
            'x,y,z',
            '-x+1/2,-y,z+1/2',
            'x+1/2,-y+1/2,-z',
            '-x,y+1/2,-z+1/2',
        ].map(operation => new SymmetryOperation(operation)));
        let state = 0x5eed1234;
        const random = () => {
            state = (1664525 * state + 1013904223) >>> 0;
            return state / 0x100000000;
        };
        const observations = Array.from({ length: 600 }, (_, index) => ({
            h: Math.floor(random() * 17) - 8,
            k: Math.floor(random() * 15) - 7,
            l: Math.floor(random() * 13) - 6,
            intensity: random() * 1000 - 50,
            sigma: index % 17 === 0 ? null : index % 23 === 0 ? 0 : random() * 8 + 0.1,
        }));

        for (const mergeFriedel of [false, true]) {
            for (const reflection of observations.slice(0, 100)) {
                expect(canonicalReflectionIndex(
                    reflection.h, reflection.k, reflection.l, symmetry, mergeFriedel,
                )).toEqual(canonicalReflectionIndexLegacy(
                    reflection.h, reflection.k, reflection.l, symmetry, mergeFriedel,
                ));
            }
            for (const removeSystematicAbsences of [false, true]) {
                const options = { mergeFriedel, removeSystematicAbsences };
                expect(mergeReflectionIntensities(observations, symmetry, options)).toEqual(
                    mergeReflectionIntensitiesLegacy(observations, symmetry, options),
                );
            }
        }
    });

    test('emits detailed preparation diagnostics only in debug mode', () => {
        const cif = cifWithReflections(`loop_
 _diffrn_refln_index_h
 _diffrn_refln_index_k
 _diffrn_refln_index_l
 _diffrn_refln_intensity_net
 _diffrn_refln_intensity_u
 1 0 0 12 2
 -1 0 0 14 3
`);
        const normal = readReflectionIntensities(cif);
        const debug = readReflectionIntensities(cif, 0, { debug: true });

        expect(normal).not.toHaveProperty('diagnostics');
        expect(debug.diagnostics).toMatchObject({
            rawReflectionCount: 2,
            validReflectionCount: 2,
            invalidReflectionCount: 0,
            distinctInputHklCount: 2,
            mergedReflectionCount: 1,
            symmetryOperationCount: 1,
            canonicalCacheMissCount: 2,
        });
        expect(debug.diagnostics.reflectionPreparationTotalMs).toBeGreaterThanOrEqual(0);
    });

    test('matches legacy absence phase sums across representative crystal systems', () => {
        const operationSets = [
            ['x,y,z'],
            ['x,y,z', '-x,-y,-z'],
            ['x,y,z', '-x,y+1/2,-z'],
            ['x,y,z', '-x+1/2,-y,z+1/2', 'x+1/2,-y+1/2,-z', '-x,y+1/2,-z+1/2'],
            ['x,y,z', '-y,x,z', '-x,-y,z', 'y,-x,z'],
            ['x,y,z', '-y,x-y,z', '-x+y,-x,z'],
            ['x,y,z', 'x-y,x,z', '-y,x-y,z'],
            ['x,y,z', 'z,x,y', 'y,z,x'],
        ];
        for (const [setIndex, operations] of operationSets.entries()) {
            const symmetry = new CellSymmetry(`test-${setIndex}`, 0, operations.map(operation =>
                new SymmetryOperation(operation),
            ));
            for (let h = -5; h <= 5; h++) {
                for (let k = -4; k <= 4; k++) {
                    for (let l = -3; l <= 3; l++) {
                        expect(isGeneralPositionSystematicAbsence(h, k, l, symmetry)).toBe(
                            isGeneralPositionSystematicAbsenceLegacy(h, k, l, symmetry),
                        );
                        for (const mergeFriedel of [false, true]) {
                            expect(canonicalReflectionIndex(h, k, l, symmetry, mergeFriedel)).toEqual(
                                canonicalReflectionIndexLegacy(h, k, l, symmetry, mergeFriedel),
                            );
                        }
                    }
                }
            }
        }
    });

    test('continues past an unrelated _refln loop to a usable later block', () => {
        const text = `${cifWithReflections(`loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_status
 0 0 1 o
`)}
data_observations
loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 1 0 0 25
`;

        const result = readReflectionIntensities(text);

        expect(result.metadata.source).toBe('refln');
        expect(result.reflections).toMatchObject([{ h: 1, k: 0, l: 0, intensity: 25 }]);
    });
    test('preserves an already merged refln loop without remerging or absence filtering', () => {
        const cif = cifWithReflections(`loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 _refln_F_squared_sigma
 0 1 0 12 2
 0 1 0 14 3
`, P21_OPERATIONS);
        const result = readReflectionIntensities(cif);

        expect(result.reflections).toHaveLength(2);
        expect(result.reflections[0]).toMatchObject({ h: 0, k: 1, l: 0, intensity: 12, sigma: 2 });
        expect(result.metadata).toMatchObject({
            source: 'refln',
            valueKind: 'F-squared',
            alreadyMerged: true,
            systematicAbsenceCount: 0,
        });
    });

    test('converts merged F amplitudes and their uncertainties to intensities', () => {
        const cif = cifWithReflections(`loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_meas
 _refln_F_sigma
 1 0 0 3 0.5
`);
        const result = readReflectionIntensities(cif);

        expect(result.reflections[0]).toMatchObject({ intensity: 9, sigma: 3 });
        expect(result.metadata.valueKind).toBe('F-amplitude-squared');
    });

    test('falls through a calculated-only refln loop to measured raw observations', () => {
        const cif = cifWithReflections(`loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_calc
 1 0 0 9
loop_
 _diffrn_refln_index_h
 _diffrn_refln_index_k
 _diffrn_refln_index_l
 _diffrn_refln_intensity_net
 _diffrn_refln_intensity_u
 1 0 0 12 2
`);
        const result = readReflectionIntensities(cif);

        expect(result.metadata.source).toBe('diffrn_refln');
        expect(result.reflections[0].intensity).toBe(12);
    });

    test('removes screw-axis absences and inverse-variance merges raw observations', () => {
        const cif = cifWithReflections(`loop_
 _diffrn_refln_index_h
 _diffrn_refln_index_k
 _diffrn_refln_index_l
 _diffrn_refln_intensity_net
 _diffrn_refln_intensity_u
 0 1 0 100 10
 0 2 0 10 1
 0 -2 0 14 2
`, P21_OPERATIONS);
        const result = readReflectionIntensities(cif);

        expect(result.reflections).toHaveLength(1);
        expect(result.reflections[0]).toMatchObject({ h: 0, k: -2, l: 0, multiplicity: 2 });
        expect(result.reflections[0].intensity).toBeCloseTo(10.8, 12);
        expect(result.reflections[0].sigma).toBeCloseTo(Math.sqrt(0.8), 12);
        expect(result.metadata).toMatchObject({
            source: 'diffrn_refln',
            inputCount: 3,
            outputCount: 1,
            systematicAbsenceCount: 1,
            mergeFriedel: true,
        });
    });

    test('can preserve Friedel pairs in a non-centrosymmetric group', () => {
        const symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
        const result = mergeReflectionIntensities([
            { h: 1, k: 2, l: 3, intensity: 10, sigma: 1 },
            { h: -1, k: -2, l: -3, intensity: 14, sigma: 1 },
        ], symmetry, { mergeFriedel: false });

        expect(result.reflections).toHaveLength(2);
    });

    test('detects centering and screw/glide systematic absences from full operations', () => {
        const centered = new CellSymmetry('C1', 0, [
            new SymmetryOperation('x,y,z'),
            new SymmetryOperation('x+1/2,y+1/2,z'),
        ]);
        const p21 = new CellSymmetry('P21', 4, P21_OPERATIONS.map(value =>
            new SymmetryOperation(value.slice(1, -1)),
        ));

        expect(isSystematicAbsence(1, 0, 0, centered)).toBe(true);
        expect(isSystematicAbsence(1, 1, 0, centered)).toBe(false);
        expect(isSystematicAbsence(0, 1, 0, p21)).toBe(true);
        expect(isSystematicAbsence(0, 2, 0, p21)).toBe(false);
    });

    test('parses SHELX HKL multiline data and stops at its zero terminator', () => {
        const cif = cifWithReflections(`_shelx_hkl_file
;
   0   1   0  100.00   10.00   1
   1   0   0   10.00    1.00   1
  -1   0   0   14.00    2.00   2
   0   0   0    0.00    0.00   0
   2   0   0 9999.00    1.00   1
;
`, P21_OPERATIONS);
        const result = readReflectionIntensities(cif);

        expect(result.reflections).toHaveLength(1);
        expect(result.reflections[0]).toMatchObject({ h: -1, k: 0, l: 0, multiplicity: 2 });
        expect(result.metadata).toMatchObject({
            source: 'shelx_hkl_file',
            inputCount: 3,
            systematicAbsenceCount: 1,
        });
    });

    test('uses SHELX fixed widths when the l index touches the intensity', () => {
        const cif = cifWithReflections(`_shelx_hkl_file
;
   0   2   313079.00  538.22  10
   0   0   0    0.00    0.00   0
;
`);
        const result = readReflectionIntensities(cif, 0, {
            mergeFriedel: false,
            removeSystematicAbsences: false,
        });

        expect(result.reflections).toHaveLength(1);
        expect(result.reflections[0]).toMatchObject({
            h: 0,
            k: 2,
            l: 3,
            intensity: 13079,
            sigma: 538.22,
        });
    });

    test('prefers the bundled embedded merged FCF but can force raw diffrn observations', () => {
        const cif = readFileSync('site/public/cif/urea.cif', 'utf8');
        const merged = readReflectionIntensities(cif);
        const raw = readReflectionIntensities(cif, 0, { source: 'diffrn_refln' });

        expect(merged.metadata).toMatchObject({ source: 'embedded-refln', alreadyMerged: true });
        expect(raw.metadata).toMatchObject({ source: 'diffrn_refln', alreadyMerged: false });
        expect(raw.reflections.length).toBeLessThanOrEqual(raw.metadata.inputCount);
        expect(Math.abs(raw.reflections.length - merged.reflections.length)).toBeLessThan(30);
    });
});
