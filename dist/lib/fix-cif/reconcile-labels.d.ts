/**
 * Normalizes an atom label for comparison
 * @param {string} label - Atom label to normalize
 * @param {boolean} [removeSuffixes] - Whether to remove ^A, ^1, *$n suffixes
 * @returns {string} Normalized label
 * @throws {Error} If label is empty
 */
export function normalizeAtomLabel(label: string, removeSuffixes?: boolean): string;
/**
 * Creates a lookup map for atom labels with their original forms.
 * @param {Array<string>} labels - Array of atom labels
 * @param {boolean} [removeSuffixes] - Whether to handle special suffixes
 * @returns {Map<string, string>} Map of normalized labels to original labels
 */
export function createLabelMap(labels: Array<string>, removeSuffixes?: boolean): Map<string, string>;
/**
 * Reconciles atom labels in a loop column with reference labels
 * @param {CifLoop} loop - CIF loop containing the column to reconcile
 * @param {string} columnToReconcile - Name of column containing labels to reconcile
 * @param {Array<string>} referenceLabels - Array of reference atom labels
 * @param {boolean} [removeSuffixes] - Whether to handle special suffixes
 */
export function reconcileAtomLabels(loop: CifLoop, columnToReconcile: string, referenceLabels: Array<string>, removeSuffixes?: boolean): void;
/**
 * Test if two atom labels match after normalization
 * @param {string} label1 - First atom label
 * @param {string} label2 - Second atom label
 * @param {boolean} [removeSuffixes] - Whether to handle special suffixes
 * @returns {boolean} True if labels match after normalization
 * @throws {Error} If either label is empty
 */
export function atomLabelsMatch(label1: string, label2: string, removeSuffixes?: boolean): boolean;
import { CifLoop } from '../read-cif/loop.js';
//# sourceMappingURL=reconcile-labels.d.ts.map