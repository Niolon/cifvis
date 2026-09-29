/**
 * Returns the neutral-atom International Tables 1992 Cromer-Mann coefficients.
 * Coefficients are ordered a1..a4, b1..b4, c.
 * @param {string} element - Element symbol.
 * @returns {number[]|null} A coefficient copy or null for unsupported elements.
 */
export function lookupCromerMann(element: string): number[] | null;
/**
 * Evaluates f0(s) where s = sin(theta) / wavelength.
 * @param {number[]} coefficients - a1..a4, b1..b4, c.
 * @param {number} sSquared - Squared reciprocal scattering coordinate in A^-2.
 * @returns {number} Normal atomic scattering factor in electrons.
 */
export function evaluateCromerMann(coefficients: number[], sSquared: number): number;
//# sourceMappingURL=cromer-mann.d.ts.map