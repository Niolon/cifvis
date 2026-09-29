/**
 * Attempts to guess and normalize a symmetry operation string from various formats.
 * Returns original string if format cannot be recognized.
 *
 * Known input formats:
 * - Standard: "2_555", "12_565"
 * - Space/dash separated: "2 555", "m1-565", "-2x 555"
 * - Encoded integers: "20555" (-> "2_555"), "565012" (-> "12_565")
 * @param {string|number} symOpString - The input symmetry operation string/code
 * @returns {string} Normalized symmetry operation string in format "id_xyz" or original string if not recognized
 */
export function guessSymmetryOperation(symOpString: string | number): string;
/**
 * Reconciles symmetry operation strings in a loop column by trying to guess and normalize their format
 * @param {CifLoop} loop - CIF loop containing the column to reconcile
 * @param {string} columnToReconcile - Name of column containing symmetry operations to reconcile
 */
export function reconcileSymmetryOperations(loop: CifLoop, columnToReconcile: string): void;
import { CifLoop } from '../read-cif/loop.js';
//# sourceMappingURL=guess-symmetry.d.ts.map