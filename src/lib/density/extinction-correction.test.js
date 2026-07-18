import { describe, expect, test } from 'vitest';
import { CifBlock } from '../read-cif/base.js';
import { UnitCell } from '../structure/crystal.js';
import {
    createShelxlExtinctionCorrection,
    shelxlExtinctionAmplitudeFactor,
} from './extinction-correction.js';

describe('SHELXL extinction correction', () => {
    test('evaluates the reported isotropic amplitude expression', () => {
        const factor = shelxlExtinctionAmplitudeFactor(
            78.07087746787245 ** 2,
            2 / 8.901,
            0.0323,
            0.71073,
        );

        expect(factor).toBeCloseTo(0.912237333, 8);
        expect(shelxlExtinctionAmplitudeFactor(100, 0.2, 0, 0.71073)).toBe(1);
    });

    test('reads a supported SHELXL model from CIF metadata', () => {
        const block = new CifBlock(`test
_refine_ls_extinction_method 'SHELXL-2018/3'
_refine_ls_extinction_coef 0.0323
_refine_ls_extinction_expression 'Fc*=kFc[1+0.001xFc^2lambda^3/sin(2theta)]^-1/4'`);
        const correction = createShelxlExtinctionCorrection(
            block,
            new UnitCell(8.264, 8.901, 8.9223, 90, 90, 90),
            0.71073,
            [{ h: 0, k: -2, l: 0 }],
            [{ amplitude: 78.07087746787245 }],
        );

        expect(correction.metadata).toMatchObject({
            enabled: true,
            model: 'SHELXL-isotropic',
            coefficient: 0.0323,
            wavelength: 0.71073,
            source: 'cif',
            correctedReflectionCount: 1,
        });
        expect(correction.factors[0]).toBeCloseTo(0.912237333, 8);
        expect(correction.metadata.maximumAmplitudeCorrection).toBeCloseTo(1.09620596, 8);
    });

    test('can be disabled for deliberately uncorrected amplitudes', () => {
        const correction = createShelxlExtinctionCorrection(
            new CifBlock('test\n_refine_ls_extinction_coef 0.1'),
            new UnitCell(10, 10, 10, 90, 90, 90),
            0.71073,
            [{ h: 1, k: 0, l: 0 }],
            [{ amplitude: 10 }],
            false,
        );

        expect(correction.factors).toEqual([1]);
        expect(correction.metadata).toMatchObject({ enabled: false, reason: 'disabled' });
    });
});
