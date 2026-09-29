/**
 * Creates an independent-atom-model X-ray structure-factor calculator.
 * CIF Cromer-Mann and dispersion values take precedence over configured and
 * internal neutral-atom values. Missing anomalous terms are treated as zero.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {number|string} cifBlock - CIF block index or name.
 * @param {object} options - Calculation options.
 * @returns {object} Calculator with scalar and prepared batch calculation methods.
 */
export function createIAMStructureFactorCalculator(cifText: string, cifBlock?: number | string, options?: object): object;
/**
 * Convenience calculation for a collection of hkl arrays or objects.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {Array} reflections - Reflection indices.
 * @param {object} options - Calculator options, including cifBlock.
 * @returns {object[]} Calculated complex structure factors.
 */
export function calculateIAMStructureFactors(cifText: string, reflections: any[], options?: object): object[];
import { evaluateCromerMann } from './cromer-mann.js';
import { lookupCromerMann } from './cromer-mann.js';
export { evaluateCromerMann, lookupCromerMann };
//# sourceMappingURL=iam-structure-factors.d.ts.map