import { describe, expect, test } from 'vitest';
import {
    createAnomalousDispersionCorrection,
    lookupAnomalousDispersion,
} from './anomalous-dispersion.js';
import { parseDifferenceDensityDataset } from './difference-density.js';

const MODEL_CIF = `data_model
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
 '-x,-y,-z'
_cell_length_a 1
_cell_length_b 1
_cell_length_c 1
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_diffrn_radiation_wavelength 0.8
loop_
 _atom_type_symbol
 _atom_type_scat_dispersion_real
 _atom_type_scat_dispersion_imag
 C 0.5 0.25
loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_occupancy
 _atom_site_U_iso_or_equiv
 C1 C 0 0 0 0.5 0.1
loop_
 _atom_site_dispersion_label
 _atom_site_dispersion_real
 _atom_site_dispersion_imag
 C1 0.75 0.5
`;

const REFLECTION_CIF = `data_reflections
_computing_structure_refinement 'olex2.refine 1.5'
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
 _refln_A_first
 _refln_B_first
 _refln_A_second
 _refln_B_second
 1 0 0 5 2 1 -1
`;

const FCF4_CIF = `data_reflections
_computing_structure_refinement 'olex2.refine 1.5'
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
 _refln_phase_calc
 _refln_F_squared_meas
 _refln_F_squared_calc
 1 0 0 0 25 4
`;

/**
 * @param {number} positivePhase - Calculated phase for h.
 * @param {number} negativePhase - Calculated phase for -h.
 * @param {boolean} centrosymmetric - Whether to include inversion.
 * @param {number} negativeAmplitude - Calculated amplitude for -h.
 * @returns {string} Olex reflection CIF containing one Friedel pair.
 */
function pairedReflectionCif(
    positivePhase,
    negativePhase,
    centrosymmetric = false,
    negativeAmplitude = 5,
) {
    return `data_reflections
_computing_structure_refinement 'olex2.refine 1.5'
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
 ${centrosymmetric ? '\'-x,-y,-z\'' : ''}
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
 _refln_phase_calc
 _refln_F_calc
 _refln_A_first
 _refln_B_first
 _refln_A_second
 _refln_B_second
 1 0 0 ${positivePhase} 5 5 2 1 -1
 -1 0 0 ${negativePhase} ${negativeAmplitude} 5 -2 1 1
`;
}

describe('anomalous dispersion correction', () => {
    test('contains complete internal Cu and Mo tables through Cf', () => {
        expect(lookupAnomalousDispersion('C', 0.71073)).toMatchObject({
            real: 0.002,
            imaginary: 0.002,
            table: 'mo',
        });
        expect(lookupAnomalousDispersion('Cf', 1.54184)).toMatchObject({
            real: -6.798,
            imaginary: 16.93,
            table: 'cu',
        });
        expect(lookupAnomalousDispersion('Fe3+', 0.71073)).toMatchObject({
            real: 0.301,
            imaginary: 0.845,
        });
        expect(lookupAnomalousDispersion('C', 0.8)).toBeNull();
    });

    test('prefers site CIF values and includes occupancy, ADPs, and special-position deduplication', () => {
        const correction = createAnomalousDispersionCorrection(MODEL_CIF);
        const coefficient = correction.coefficientAt(1, 0, 0);
        const expectedScale = 0.5 * Math.exp(-2 * Math.PI ** 2 * 0.1);

        expect(coefficient.real).toBeCloseTo(0.75 * expectedScale, 12);
        expect(coefficient.imaginary).toBeCloseTo(0.5 * expectedScale, 12);
        expect(correction.metadata.sourceCounts).toEqual({ 'site-cif': 1 });
        expect(correction.metadata.internalTable).toBeNull();
    });

    test('uses the positive crystallographic phase for symmetry-expanded atom positions', () => {
        const shifted = MODEL_CIF
            .replace('C1 C 0 0 0 0.5 0.1', 'C1 C 0.25 0 0 1 0')
            .replace('C1 0.75 0.5', 'C1 1 0');
        const correction = createAnomalousDispersionCorrection(shifted);

        // The inversion mates at x=1/4 and x=3/4 contribute +i and -i,
        // cancelling a purely real f' contribution.
        expect(correction.coefficientAt(1, 0, 0).real).toBeCloseTo(0, 12);
        expect(correction.coefficientAt(1, 0, 0).imaginary).toBeCloseTo(0, 12);
        expect(correction.coefficientAt(2, 0, 0).real).toBeCloseTo(-2, 12);
    });

    test('subtracts from the first coefficient operand before reflection expansion', () => {
        const options = {
            cifText: MODEL_CIF.replace('C1 C 0 0 0 0.5 0.1', 'C1 C 0 0 0 1 0'),
            target: 'first',
        };
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const dataset = parseDifferenceDensityDataset(REFLECTION_CIF, 0, columns, options);
        const coefficient = dataset.coefficients.get('1,0,0');

        expect(coefficient.real).toBeCloseTo(3.25, 12);
        expect(coefficient.imaginary).toBeCloseTo(2.5, 12);
        expect(dataset.anomalousDispersion).toMatchObject({
            enabled: true,
            target: 'first',
            correctionScale: -1,
        });
    });

    test('can target the second operand or both operands explicitly', () => {
        const coordinateCif = MODEL_CIF.replace(
            'C1 C 0 0 0 0.5 0.1',
            'C1 C 0 0 0 1 0',
        );
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const second = parseDifferenceDensityDataset(REFLECTION_CIF, 0, columns, {
            cifText: coordinateCif,
            target: 'second',
        }).coefficients.get('1,0,0');
        const both = parseDifferenceDensityDataset(REFLECTION_CIF, 0, columns, {
            cifText: coordinateCif,
            target: 'both',
        }).coefficients.get('1,0,0');

        expect(second.real).toBeCloseTo(4.75, 12);
        expect(second.imaginary).toBeCloseTo(3.5, 12);
        expect(both.real).toBeCloseTo(4, 12);
        expect(both.imaginary).toBeCloseTo(3, 12);
    });

    test('corrects both anomalous operands by default for FCF4 Fo-squared and Fc-squared', () => {
        const coordinateCif = MODEL_CIF.replace(
            'C1 C 0 0 0 0.5 0.1',
            'C1 C 0 0 0 1 0',
        );
        const dataset = parseDifferenceDensityDataset(
            FCF4_CIF,
            0,
            null,
            { cifText: coordinateCif },
        );
        const coefficient = dataset.coefficients.get('1,0,0');

        expect(coefficient.real).toBeCloseTo(3, 12);
        expect(coefficient.imaginary).toBeCloseTo(0, 12);
        expect(dataset.anomalousDispersion).toMatchObject({
            enabled: true,
            target: 'both',
            correctionScale: 0,
        });
    });

    test('uses CIF type values before the wavelength-selected internal table', () => {
        const moModel = MODEL_CIF
            .replace('_diffrn_radiation_wavelength 0.8', '_diffrn_radiation_wavelength 0.71073')
            .replace(/loop_\n _atom_site_dispersion_label[\s\S]*?C1 0\.75 0\.5\n/, '');
        const correction = createAnomalousDispersionCorrection(moModel);

        expect(correction.metadata.internalTable).toBe('mo');
        expect(correction.metadata.sourceCounts).toEqual({ 'type-cif': 1 });
    });

    test('does not guess for non-Olex files when the exact test is unavailable', () => {
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const shelxl = parseDifferenceDensityDataset(
            REFLECTION_CIF.replace('olex2.refine 1.5', 'SHELXL-2019/3'),
            0,
            columns,
            { cifText: MODEL_CIF },
        );
        const unknown = parseDifferenceDensityDataset(
            REFLECTION_CIF.replace('_computing_structure_refinement \'olex2.refine 1.5\'\n', ''),
            0,
            columns,
            { cifText: MODEL_CIF },
        );

        expect(shelxl.anomalousDispersion).toMatchObject({
            enabled: false,
            generator: 'shelxl',
            reason: 'exact-test-unavailable',
        });
        expect(unknown.anomalousDispersion).toMatchObject({
            enabled: false,
            generator: 'unknown',
            reason: 'exact-test-unavailable',
        });
    });

    test('uses non-zero centrosymmetric phases to detect uncorrected Olex factors', () => {
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const corrected = parseDifferenceDensityDataset(
            pairedReflectionCif(0, 180, true),
            0,
            columns,
            { cifText: MODEL_CIF },
        );
        const uncorrected = parseDifferenceDensityDataset(
            pairedReflectionCif(4, 176, true),
            0,
            columns,
            { cifText: MODEL_CIF },
        );

        expect(corrected.anomalousDispersion).toMatchObject({
            enabled: false,
            reason: 'phases-already-corrected',
            phaseCheck: { method: 'inversion-phases', alreadyCorrected: true },
        });
        expect(uncorrected.anomalousDispersion).toMatchObject({
            enabled: true,
            phaseCheck: { method: 'inversion-phases', needsCorrection: true },
        });
    });

    test('uses unmerged calculated Friedel phases in non-centrosymmetric structures', () => {
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const p1Model = MODEL_CIF.replace(' \'-x,-y,-z\'\n', '');
        const corrected = parseDifferenceDensityDataset(
            pairedReflectionCif(25, 335),
            0,
            columns,
            { cifText: p1Model },
        );
        const uncorrected = parseDifferenceDensityDataset(
            pairedReflectionCif(25, 335, false, 4.9),
            0,
            columns,
            { cifText: p1Model },
        );

        expect(corrected.anomalousDispersion).toMatchObject({
            enabled: false,
            phaseCheck: {
                method: 'friedel-pair-phases',
                checkedPairCount: 1,
                alreadyCorrected: true,
            },
        });
        expect(uncorrected.anomalousDispersion).toMatchObject({
            enabled: true,
            phaseCheck: {
                method: 'friedel-pair-phases',
                checkedPairCount: 1,
                needsCorrection: true,
            },
        });
        expect(uncorrected.anomalousDispersion.phaseCheck.maximumAmplitudeDeviationRelative)
            .toBeCloseTo(0.02, 12);
    });

    test('uses the exact test for non-Olex files and allows it to be disabled', () => {
        const columns = {
            a: ['_refln_A_first', '_refln_A_second'],
            b: ['_refln_B_first', '_refln_B_second'],
        };
        const p1Model = MODEL_CIF.replace(' \'-x,-y,-z\'\n', '');
        const shelxlUncorrected = pairedReflectionCif(25, 335, false, 4.9)
            .replace('olex2.refine 1.5', 'SHELXL-2019/3');
        const detected = parseDifferenceDensityDataset(
            shelxlUncorrected,
            0,
            columns,
            { cifText: p1Model },
        );
        const disabled = parseDifferenceDensityDataset(
            shelxlUncorrected,
            0,
            columns,
            { cifText: p1Model, phaseDetection: false },
        );

        expect(detected.anomalousDispersion).toMatchObject({
            enabled: true,
            generator: 'shelxl',
            phaseCheck: { available: true, needsCorrection: true },
        });
        expect(disabled.anomalousDispersion).toMatchObject({
            enabled: false,
            reason: 'phase-detection-disabled',
            phaseCheck: { disabled: true },
        });
    });

    test('rejects unsupported wavelengths when the CIF has no usable values', () => {
        const withoutValues = MODEL_CIF
            .replace(/loop_\n _atom_type_symbol[\s\S]*?C 0\.5 0\.25\n/, '')
            .replace(/loop_\n _atom_site_dispersion_label[\s\S]*?C1 0\.75 0\.5\n/, '');

        expect(() => createAnomalousDispersionCorrection(withoutValues))
            .toThrow(/No complete anomalous-dispersion factors/);
    });
});
