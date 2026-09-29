/**
 * SHELXL isotropic extinction factor applied to an Fc amplitude.
 * @param {number} fSquared - Unextinguished calculated amplitude squared.
 * @param {number} reciprocalLength - Reciprocal-vector length in inverse Angstrom.
 * @param {number} coefficient - SHELXL EXTI parameter.
 * @param {number} wavelength - Radiation wavelength in Angstrom.
 * @returns {number} Multiplicative amplitude factor in the interval (0, 1].
 */
export function shelxlExtinctionAmplitudeFactor(fSquared: number, reciprocalLength: number, coefficient: number, wavelength: number): number;
/**
 * Resolves a SHELXL extinction correction and evaluates it for IAM reflections.
 * @param {object} block - Coordinate CIF block containing refinement metadata.
 * @param {object} cell - Unit cell used by the reflections.
 * @param {number|null} modelWavelength - Wavelength selected by the IAM model.
 * @param {object[]} reflections - Merged observed reflection indices.
 * @param {object|object[]} calculated - Matching prepared or compatibility IAM factors.
 * @param {boolean|number|object} option - Auto/disabled or configured correction.
 * @returns {{factors:number[], metadata:object}} Per-reflection amplitude factors and metadata.
 */
export function createShelxlExtinctionCorrection(block: object, cell: object, modelWavelength: number | null, reflections: object[], calculated: object | object[], option?: boolean | number | object): {
    factors: number[];
    metadata: object;
};
//# sourceMappingURL=extinction-correction.d.ts.map