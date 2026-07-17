/* eslint-disable jsdoc/require-jsdoc -- compact crystallographic helpers */
import * as math from '../math-lite.js';
import { finiteNumber } from './structure-factor-model.js';

function scalar(block, names) {
    for (const name of names) {
        try {
            const value = finiteNumber(block.get(name, null));
            if (value !== null) {
                return value;
            }
        } catch {
            // Try the next dictionary spelling.
        }
    }
    return null;
}

function text(block, names) {
    for (const name of names) {
        try {
            const value = block.get(name, null);
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        } catch {
            // Try the next dictionary spelling.
        }
    }
    return null;
}

/**
 * SHELXL isotropic extinction factor applied to an Fc amplitude.
 * @param {number} fSquared - Unextinguished calculated amplitude squared.
 * @param {number} reciprocalLength - Reciprocal-vector length in inverse Angstrom.
 * @param {number} coefficient - SHELXL EXTI parameter.
 * @param {number} wavelength - Radiation wavelength in Angstrom.
 * @returns {number} Multiplicative amplitude factor in the interval (0, 1].
 */
export function shelxlExtinctionAmplitudeFactor(
    fSquared,
    reciprocalLength,
    coefficient,
    wavelength,
) {
    if (!(fSquared > 0) || !(reciprocalLength > 0) || coefficient === 0) {
        return 1;
    }
    const sinTheta = wavelength * reciprocalLength / 2;
    if (!(sinTheta > 0 && sinTheta < 1)) {
        throw new Error(
            `Cannot apply SHELXL extinction at sin(theta)=${sinTheta}; ` +
            'check the radiation wavelength and reflection indices',
        );
    }
    const sinTwoTheta = 2 * sinTheta * Math.sqrt(1 - sinTheta ** 2);
    return (1 + 0.001 * coefficient * fSquared * wavelength ** 3 / sinTwoTheta) ** -0.25;
}

/**
 * Resolves a SHELXL extinction correction and evaluates it for IAM reflections.
 * @param {object} block - Coordinate CIF block containing refinement metadata.
 * @param {object} cell - Unit cell used by the reflections.
 * @param {number|null} modelWavelength - Wavelength selected by the IAM model.
 * @param {object[]} reflections - Merged observed reflection indices.
 * @param {object[]} calculated - Matching IAM structure factors.
 * @param {boolean|number|object} option - Auto/disabled or configured correction.
 * @returns {{factors:number[], metadata:object}} Per-reflection amplitude factors and metadata.
 */
export function createShelxlExtinctionCorrection(
    block,
    cell,
    modelWavelength,
    reflections,
    calculated,
    option = true,
) {
    const noCorrection = (reason, extra = {}) => ({
        factors: Array(reflections.length).fill(1),
        metadata: {
            enabled: false,
            model: 'SHELXL-isotropic',
            reason,
            ...extra,
        },
    });
    if (option === false) {
        return noCorrection('disabled');
    }
    if (
        option !== true && typeof option !== 'number' &&
        (typeof option !== 'object' || option === null || Array.isArray(option))
    ) {
        throw new Error('extinctionCorrection must be true, false, a coefficient, or an object');
    }

    const configured = typeof option === 'number' ? option : option?.coefficient;
    const configuredCoefficient = finiteNumber(configured);
    const cifCoefficient = scalar(block, [
        '_refine_ls.extinction_coef',
        '_refine_ls_extinction_coef',
    ]);
    const coefficient = configuredCoefficient ?? cifCoefficient;
    const source = configuredCoefficient === null ? 'cif' : 'configured';
    if (coefficient === null) {
        return noCorrection('not-reported');
    }
    if (coefficient < 0) {
        throw new Error('SHELXL extinction coefficient must not be negative');
    }
    if (coefficient === 0) {
        return noCorrection('zero-coefficient', { coefficient, source });
    }

    const method = text(block, [
        '_refine_ls.extinction_method',
        '_refine_ls_extinction_method',
    ]);
    const expression = text(block, [
        '_refine_ls.extinction_expression',
        '_refine_ls_extinction_expression',
    ]);
    const supported = /shelxl/i.test(method ?? '') || (
        /0\.001/i.test(expression ?? '') && /sin\s*\(?\s*2/i.test(expression ?? '')
    );
    if (!supported && configuredCoefficient === null) {
        return noCorrection('unsupported-model', { coefficient, source, method, expression });
    }

    const configuredWavelength = typeof option === 'object'
        ? finiteNumber(option.wavelength)
        : null;
    const wavelength = configuredWavelength ?? modelWavelength;
    if (!(wavelength > 0)) {
        throw new Error('SHELXL extinction correction requires a positive radiation wavelength');
    }
    if (reflections.length !== calculated.length) {
        throw new Error('Extinction correction requires matching observed and calculated reflections');
    }

    const reciprocalTransform = math.transpose(math.inv(cell.fractToCartMatrix));
    const factors = reflections.map((reflection, index) => {
        const reciprocalLength = math.norm(math.multiply(
            reciprocalTransform,
            [reflection.h, reflection.k, reflection.l],
        ));
        return shelxlExtinctionAmplitudeFactor(
            calculated[index].amplitude ** 2,
            reciprocalLength,
            coefficient,
            wavelength,
        );
    });
    const minimumAmplitudeFactor = factors.reduce(
        (minimum, factor) => Math.min(minimum, factor),
        1,
    );
    return {
        factors,
        metadata: {
            enabled: true,
            model: 'SHELXL-isotropic',
            coefficient,
            wavelength,
            source,
            method,
            expression,
            correctedReflectionCount: factors.filter(factor => factor < 1).length,
            minimumAmplitudeFactor,
            maximumAmplitudeCorrection: 1 / minimumAmplitudeFactor,
        },
    };
}
