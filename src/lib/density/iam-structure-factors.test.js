/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    calculateIAMStructureFactors,
    createIAMStructureFactorCalculator,
    evaluateCromerMann,
    lookupCromerMann,
} from './iam-structure-factors.js';
import { createAnomalousDispersionCorrection } from './anomalous-dispersion.js';
import { CIF } from '../read-cif/base.js';
import { CrystalStructure } from '../structure/crystal.js';
import { UIsoADP } from '../structure/adp.js';
import {
    createStructureFactorModel,
    createStructureFactorModelInput,
} from './structure-factor-model.js';

function modelCif({
    position = '0 0 0',
    occupancy = 1,
    uiso = 0,
    inversion = false,
    typeRows = '',
    siteDispersion = '',
} = {}) {
    return `data_model
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
 ${inversion ? '\'-x,-y,-z\'' : ''}
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
${typeRows}
loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_occupancy
 _atom_site_U_iso_or_equiv
 C1 C ${position} ${occupancy} ${uiso}
${siteDispersion}
`;
}

const CIF_TYPE_FACTORS = `loop_
 _atom_type_symbol
 _atom_type_scat_dispersion_real
 _atom_type_scat_dispersion_imag
 _atom_type_scat_Cromer_Mann_a1
 _atom_type_scat_Cromer_Mann_a2
 _atom_type_scat_Cromer_Mann_a3
 _atom_type_scat_Cromer_Mann_a4
 _atom_type_scat_Cromer_Mann_b1
 _atom_type_scat_Cromer_Mann_b2
 _atom_type_scat_Cromer_Mann_b3
 _atom_type_scat_Cromer_Mann_b4
 _atom_type_scat_Cromer_Mann_c
 C 0.5 0.25 0 0 0 0 1 1 1 1 10
`;

describe('IAM structure factors', () => {
    test('contains neutral Cromer-Mann coefficients through Cf', () => {
        expect(lookupCromerMann('H')).toHaveLength(9);
        expect(lookupCromerMann('D')).toEqual(lookupCromerMann('H'));
        expect(lookupCromerMann('Cf')).toEqual([
            36.9185, 25.1995, 18.3317, 4.24391,
            0.437533, 3.00775, 12.4044, 83.7881, 13.2674,
        ]);
        expect(evaluateCromerMann(lookupCromerMann('C'), 0)).toBeCloseTo(5.9992, 12);
    });

    test('evaluates reciprocal resolution, occupancy, ADP, and crystallographic phase', () => {
        const cif = modelCif({ position: '0.25 0 0', occupancy: 0.5, uiso: 0.1 });
        const calculator = createIAMStructureFactorCalculator(cif, 0, { includeAnomalous: false });
        const coefficient = calculator.coefficientAt(1, 0, 0);
        const f0 = evaluateCromerMann(lookupCromerMann('C'), 0.1 ** 2 / 4);
        const expected = 0.5 * f0 * Math.exp(-2 * Math.PI ** 2 * 0.1 * 0.1 ** 2);

        expect(coefficient.real).toBeCloseTo(0, 12);
        expect(coefficient.imaginary).toBeCloseTo(expected, 12);
    });

    test('prefers complete CIF factors and can include or omit anomalous terms', () => {
        const cif = modelCif({ typeRows: CIF_TYPE_FACTORS });
        const withAnomalous = createIAMStructureFactorCalculator(cif);
        const normalOnly = createIAMStructureFactorCalculator(cif, 0, { includeAnomalous: false });

        expect(withAnomalous.coefficientAt(8, 0, 0)).toEqual({ real: 10.5, imaginary: 0.25 });
        expect(normalOnly.coefficientAt(8, 0, 0)).toEqual({ real: 10, imaginary: 0 });
        expect(withAnomalous.metadata.sourceCounts).toEqual({ 'cif/type-cif': 1 });
    });

    test('merges partial site dispersion values over type values', () => {
        const siteDispersion = `loop_
 _atom_site_dispersion_label
 _atom_site_dispersion_real
 C1 0.75
`;
        const calculator = createIAMStructureFactorCalculator(modelCif({
            typeRows: CIF_TYPE_FACTORS,
            siteDispersion,
        }));

        expect(calculator.coefficientAt(0, 0, 0)).toEqual({ real: 10.75, imaginary: 0.25 });
        expect(calculator.metadata.sourceCounts).toEqual({ 'cif/site-cif': 1 });
    });

    test('deduplicates special positions while expanding general symmetry positions', () => {
        const special = createIAMStructureFactorCalculator(
            modelCif({ inversion: true }),
            0,
            { includeAnomalous: false },
        );
        const general = createIAMStructureFactorCalculator(
            modelCif({ position: '0.25 0 0', inversion: true }),
            0,
            { includeAnomalous: false },
        );

        expect(special.metadata.expandedAtomCount).toBe(1);
        expect(general.metadata.expandedAtomCount).toBe(2);
        expect(general.coefficientAt(1, 0, 0).real).toBeCloseTo(0, 12);
        expect(general.coefficientAt(2, 0, 0).real).toBeCloseTo(
            -2 * evaluateCromerMann(lookupCromerMann('C'), 0.2 ** 2 / 4),
            12,
        );
    });

    test('evaluates a shared atomic form factor once per model and reflection', () => {
        const cif = modelCif().replace(
            'C1 C 0 0 0 1 0',
            'C1 C 0 0 0 1 0\n C2 C 0.25 0.25 0.25 1 0',
        );
        let evaluationCount = 0;
        const calculator = createStructureFactorModel(cif, 0, {
            resolveAtom() {
                return {
                    source: 'test',
                    scatteringKey: 'C',
                    scatteringAt(sSquared) {
                        evaluationCount++;
                        return { real: 6 - sSquared, imaginary: 0 };
                    },
                };
            },
        });

        calculator.coefficientAt(1, 0, 0);
        expect(evaluationCount).toBe(1);
        calculator.coefficientAt(-1, 0, 0);
        expect(evaluationCount).toBe(2);
        calculator.coefficientAt(2, 0, 0);
        expect(evaluationCount).toBe(3);
        expect(calculator.metadata).toMatchObject({
            atomCount: 2,
            expandedAtomCount: 2,
            scatteringModelCount: 1,
        });
    });

    test('returns amplitudes and phases for batched hkl arrays and objects', () => {
        const result = calculateIAMStructureFactors(
            modelCif({ position: '0.25 0 0', typeRows: CIF_TYPE_FACTORS }),
            [[0, 0, 0], { h: 1, k: 0, l: 0 }],
            { includeAnomalous: false },
        );

        expect(result[0]).toMatchObject({ h: 0, k: 0, l: 0, real: 10, amplitude: 10, phase: 0 });
        expect(result[1].real).toBeCloseTo(0, 12);
        expect(result[1].imaginary).toBeCloseTo(10, 12);
        expect(result[1].phase).toBeCloseTo(90, 12);
    });

    test('uses the same atom sum as the anomalous-only correction', () => {
        const cif = modelCif({ position: '0.125 0.25 0', typeRows: CIF_TYPE_FACTORS, inversion: true });
        const full = createIAMStructureFactorCalculator(cif);
        const normal = createIAMStructureFactorCalculator(cif, 0, { includeAnomalous: false });
        const anomalous = createAnomalousDispersionCorrection(cif);
        const fullCoefficient = full.coefficientAt(2, 1, 0);
        const normalCoefficient = normal.coefficientAt(2, 1, 0);
        const correction = anomalous.coefficientAt(2, 1, 0);

        expect(fullCoefficient.real - normalCoefficient.real).toBeCloseTo(correction.real, 12);
        expect(fullCoefficient.imaginary - normalCoefficient.imaginary).toBeCloseTo(correction.imaginary, 12);
    });

    test('uses an already built structure snapshot instead of reparsing its ADP', () => {
        const cif = modelCif({ uiso: 0.01 });
        const block = new CIF(cif).getBlock(0);
        const structure = CrystalStructure.fromCIF(block);
        structure.atoms[0].adp = new UIsoADP(0.2);
        const structureModel = createStructureFactorModelInput(structure, block);
        const calculator = createIAMStructureFactorCalculator(cif, 0, {
            includeAnomalous: false,
            structureModel,
        });
        const coefficient = calculator.coefficientAt(1, 0, 0);
        const f0 = evaluateCromerMann(lookupCromerMann('C'), 0.1 ** 2 / 4);

        expect(coefficient.real).toBeCloseTo(
            f0 * Math.exp(-2 * Math.PI ** 2 * 0.2 * 0.1 ** 2),
            12,
        );
    });

    test('reports but preserves negative displacement parameters', () => {
        const cif = modelCif({ uiso: 0.01 });
        const block = new CIF(cif).getBlock(0);
        const structure = CrystalStructure.fromCIF(block);
        structure.atoms[0].adp = new UIsoADP(-0.1);
        const structureModel = createStructureFactorModelInput(structure, block);
        const calculator = createIAMStructureFactorCalculator(cif, 0, {
            includeAnomalous: false,
            structureModel,
        });
        const coefficient = calculator.coefficientAt(1, 0, 0);
        const f0 = evaluateCromerMann(lookupCromerMann('C'), 0.1 ** 2 / 4);

        expect(calculator.metadata).toMatchObject({
            npdAdpCount: 1,
            npdAdpLabels: ['C1'],
        });
        expect(coefficient.real).toBeCloseTo(
            f0 * Math.exp(2 * Math.PI ** 2 * 0.1 * 0.1 ** 2),
            12,
        );
    });

    test('reproduces bundled SHELXL IAM F squared values', () => {
        const cif = readFileSync('site/public/cif/urea.cif', 'utf8');
        const calculator = createIAMStructureFactorCalculator(cif);
        const expected = [
            [[0, 0, 1], 10.239],
            [[0, 0, 2], 108.102],
            [[1, 0, 1], 149.777],
        ];

        for (const [hkl, fSquared] of expected) {
            const coefficient = calculator.coefficientAt(...hkl);
            expect(coefficient.real ** 2 + coefficient.imaginary ** 2).toBeCloseTo(fSquared, 0);
        }
    });
});
