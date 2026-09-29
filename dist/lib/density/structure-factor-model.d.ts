/**
 * Captures the already constructed/repaired coordinate model for worker use.
 * Occupancies remain sourced from the atom-site loop because display Atom
 * objects intentionally do not carry refinement-only site metadata.
 * @param {object} structure - Finished, repaired crystal structure.
 * @param {object} block - Coordinate CIF block supplying occupancies.
 * @returns {object} Structured-clone-safe structure-factor input.
 */
export function createStructureFactorModelInput(structure: object, block: object): object;
/**
 * Builds a symmetry-expanded atom sum with occupancy and displacement factors.
 * The supplied resolver provides the reflection-dependent complex scattering
 * factor for each independent atom. Equal `scatteringKey` values identify
 * numerically identical models that share one evaluation per reflection.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {number|string} cifBlock - CIF block index or name.
 * @param {object} options - Model options.
 * @param {object} [options.expectedCell] - Optional reflection cell to validate.
 * @param {function(object): object} options.resolveAtom - Atom factor resolver.
 * @returns {object} Reusable structure-factor model.
 */
export function createStructureFactorModel(cifText: string, cifBlock?: number | string, options?: {
    expectedCell?: object | undefined;
    resolveAtom: (arg0: object) => object;
}): object;
export { finiteNumber } from "./cif-values.js";
export { cellMatches };
import { cellsMatch as cellMatches } from './cell-matching.js';
//# sourceMappingURL=structure-factor-model.d.ts.map