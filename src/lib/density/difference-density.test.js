import { describe, expect, test } from 'vitest';
import {
    calculateDifferenceDensityMap,
    createCifDifferenceDensityDataset,
    parseDifferenceDensityDataset,
    parseDifferenceDensitySource,
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

const CIF_WITH_OBSERVED_INTENSITIES = `data_observed
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_occupancy
 _atom_site_U_iso_or_equiv
 C1 C 0 0 0 1 0
loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 _refln_F_squared_sigma
 1 0 0 100 2
 2 0 0 25 1
`;

const CIF_WITH_SHELXL_EXTINCTION = CIF_WITH_OBSERVED_INTENSITIES.replace(
    '_cell_angle_gamma 90',
    `_cell_angle_gamma 90
_diffrn_radiation_wavelength 0.71073
_refine_ls_extinction_method 'SHELXL-2018/3'
_refine_ls_extinction_coef 0.0323
_refine_ls_extinction_expression
 'Fc*=kFc[1+0.001xFc^2lambda^3/sin(2theta)]^-1/4'`,
);

const CIF_WITH_EXTINCTION_CORRECTED_EMBEDDED_FCF = CIF_WITH_SHELXL_EXTINCTION.replace(
    `loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 _refln_F_squared_sigma
 1 0 0 100 2
 2 0 0 25 1`,
    `_iucr_refine_fcf_details
;
data_fcf
loop_
 _refln_index_h
 _refln_index_k
 _refln_index_l
 _refln_F_squared_meas
 _refln_F_squared_sigma
 1 0 0 100 2
 2 0 0 25 1
;`,
);

const SELF_DESCRIBED_CUSTOM_COEFFICIENT_FCF = CUSTOM_COEFFICIENT_FCF.replace(
    'loop_\n _refln_index_h',
    `_cifvis_difference_density_loop '_refln'
_cifvis_difference_density_h '_refln_index_h'
_cifvis_difference_density_k '_refln_index_k'
_cifvis_difference_density_l '_refln_index_l'
_cifvis_difference_density_a '_refln_A_first'
_cifvis_difference_density_b '_refln_B_first'
loop_
 _refln_index_h`,
);

/**
 * @param {object} columns - Custom coefficient-column definition.
 * @returns {object} Positive h=1 coefficient from a custom dataset.
 */
function customCoefficient(columns) {
    return parseDifferenceDensityDataset(CUSTOM_COEFFICIENT_FCF, 0, columns)
        .coefficients.get('1,0,0');
}

/**
 * @param {string} text - FCF source text.
 * @returns {import('./scalar-field.js').ScalarFieldGrid} Map parsed from explicit coefficients.
 */
function mapFromFcf(text) {
    return calculateDifferenceDensityMap(parseDifferenceDensitySource(
        text,
        0,
        { inputMode: 'fcf' },
    ));
}

describe('difference-density scalar fields', () => {
    test('calculates a correctly normalized real Fo-Fc Fourier map', () => {
        const map = mapFromFcf(P1_FCF);

        expect(map.reflectionCount).toBe(1);
        expect(map.fieldKind).toBe('difference-density');
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
        const map = mapFromFcf(P1_FCF);

        expect(map.sample(1.125, 0, 0)).toBeCloseTo(map.sample(0.125, 0, 0), 6);
        expect(map.sample(-0.25, 0, 0)).toBeCloseTo(map.sample(0.75, 0, 0), 6);
    });

    test('progressively adds reciprocal-resolution shells and preserves the exact final map', () => {
        const dataset = parseDifferenceDensityDataset(MULTI_RESOLUTION_FCF);
        const rough = calculateDifferenceDensityMap(dataset, 0.3);
        const refined = calculateDifferenceDensityMap(dataset, 1);
        const direct = mapFromFcf(MULTI_RESOLUTION_FCF);

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

    test('constructs a scaled IAM-phased Fo-Fc map from a reflection CIF', () => {
        const dataset = createCifDifferenceDensityDataset(CIF_WITH_OBSERVED_INTENSITIES);
        const map = calculateDifferenceDensityMap(dataset);

        expect(dataset).toMatchObject({
            sourceType: 'cif-iam',
            coefficientMode: 'fo-fc-iam-phase',
            reflectionCount: 2,
            observations: { source: 'refln', alreadyMerged: true },
            iam: { model: 'IAM' },
        });
        expect(dataset.intensityScale).toBeGreaterThan(0);
        expect(dataset.scaleFittedReflectionCount).toBe(2);
        expect(dataset.scaleR1).toBeGreaterThan(0);
        expect(map.sourceType).toBe('cif-iam');
        expect(map.sigma).toBeGreaterThan(0);
        expect([...map.values].every(Number.isFinite)).toBe(true);

        const parsedMap = calculateDifferenceDensityMap(parseDifferenceDensitySource(
            CIF_WITH_OBSERVED_INTENSITIES,
        ));
        expect(parsedMap.sourceType).toBe('cif-iam');
        expect(parsedMap.reflectionCount).toBe(2);
    });

    test('automatically falls back from absent FCF phases to CIF observations plus IAM', () => {
        const automatic = parseDifferenceDensitySource(CIF_WITH_OBSERVED_INTENSITIES);

        expect(automatic.sourceType).toBe('cif-iam');
        expect(() => parseDifferenceDensitySource(
            CIF_WITH_OBSERVED_INTENSITIES,
            0,
            { inputMode: 'fcf' },
        )).toThrow(/phase_calc/);
    });

    test('does not hide malformed advertised FCF coefficients behind IAM fallback', () => {
        const malformed = CIF_WITH_OBSERVED_INTENSITIES.replace(
            ' _refln_F_squared_sigma\n',
            ' _refln_F_squared_sigma\n _refln_F_calc\n _refln_phase_calc\n',
        ).replace(
            ' 1 0 0 100 2\n 2 0 0 25 1',
            ' 1 0 0 100 2 8 invalid\n 2 0 0 25 1 4 invalid',
        );

        expect(() => parseDifferenceDensitySource(malformed))
            .toThrow(/no usable difference-map coefficients/);
    });

    test('automatically selects a self-described cifvis custom coefficient loop', () => {
        const dataset = parseDifferenceDensitySource(SELF_DESCRIBED_CUSTOM_COEFFICIENT_FCF);

        expect(dataset.coefficientMode).toBe('a-b');
        expect(dataset.sourceType).toBe('fcf');
        expect(dataset.fieldKind).toBe('deformation-density');
        expect(dataset.coefficients.get('1,0,0')).toMatchObject({ real: 5, imaginary: 2 });
    });

    test('corrects raw Fobs for a reported SHELXL extinction model', () => {
        const corrected = createCifDifferenceDensityDataset(CIF_WITH_SHELXL_EXTINCTION);
        const uncorrected = createCifDifferenceDensityDataset(
            CIF_WITH_SHELXL_EXTINCTION,
            0,
            { extinctionCorrection: false },
        );
        const map = calculateDifferenceDensityMap(corrected);

        expect(corrected.extinctionCorrection).toMatchObject({
            enabled: true,
            model: 'SHELXL-isotropic',
            coefficient: 0.0323,
            wavelength: 0.71073,
            source: 'cif',
        });
        expect(corrected.extinctionCorrection.minimumAmplitudeFactor).toBeLessThan(1);
        expect(corrected.intensityScale).not.toBe(uncorrected.intensityScale);
        expect(uncorrected.extinctionCorrection).toMatchObject({
            enabled: false,
            reason: 'disabled',
        });
        expect(map.extinctionCorrection).toEqual(corrected.extinctionCorrection);
    });

    test('does not correct final embedded FCF observations a second time', () => {
        const dataset = createCifDifferenceDensityDataset(
            CIF_WITH_EXTINCTION_CORRECTED_EMBEDDED_FCF,
        );

        expect(dataset.observations.source).toBe('embedded-refln');
        expect(dataset.extinctionCorrection).toMatchObject({
            enabled: false,
            reason: 'embedded-fcf-already-corrected',
        });
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

    test('accepts custom coefficients in a coordinate CIF with cell uncertainties', () => {
        const withCellUncertainty = CUSTOM_COEFFICIENT_FCF.replace(
            '_cell_length_a 1',
            '_cell_length_a 1.000(1)',
        );
        const dataset = parseDifferenceDensityDataset(withCellUncertainty, 0, {
            a: '_refln_A_first',
            b: '_refln_B_first',
        });

        expect(dataset.maximumReciprocalLength).toBeGreaterThan(0);
        expect(dataset.fieldKind).toBe('deformation-density');
        expect(Number.isFinite(dataset.maximumReciprocalLength)).toBe(true);
        expect([...calculateDifferenceDensityMap(dataset).values].every(Number.isFinite)).toBe(true);
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
        expect(() => mapFromFcf(withoutPhase)).toThrow(/phase_calc/);
    });
});
