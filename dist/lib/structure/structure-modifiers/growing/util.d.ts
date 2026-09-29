/**
 * Creates a unique identifier string for an atom including its symmetry code.
 * @param {string} atomLabel - The base label of the atom (e.g., 'C1').
 * @param {string} symOpLabel - The symmetry code (e.g., '1_555').
 * @returns {string} The combined ID (e.g., 'C1|1_555').
 */
export function createAtomId(atomLabel: string, symOpLabel: string): string;
/**
 * Combines a new symmetry operation with an existing atom ID that may already contain a symmetry code.
 * @param {string} atomId - The ID or label of the atom (e.g., 'C1' or 'C1|1_555').
 * @param {string} symOpLabel - The new symmetry code to apply or combine (e.g., '2_655').
 * @param {CellSymmetry} symmetry - An instance of CellSymmetry, used to combine symmetry codes.
 * @returns {string} The combined atom ID with the new or combined symmetry code
 *   (e.g., 'C1|2_655').
 */
export function combineAtomId(atomId: string, symOpLabel: string, symmetry: CellSymmetry): string;
/**
 * Creates a unique identifier string for an atom including its symmetry code.
 * @param {string} atomLabel - The base label of the atom (e.g., 'C1').
 * @param {string} symOpLabel - The symmetry code (e.g., '1_555').
 * @returns {string} The combined ID (e.g., 'C1|1_555').
 */
export function createSymAtomLabel(atomLabel: string, symOpLabel: string): string;
/**
 * Combines a new symmetry operation with an existing atom ID that may already contain a symmetry code.
 * @param {string} atomId - The ID or label of the atom (e.g., 'C1' or 'C1|1_555').
 * @param {string} symOpLabel - The new symmetry code to apply or combine (e.g., '2_655').
 * @param {CellSymmetry} symmetry - An instance of CellSymmetry, used to combine symmetry codes.
 * @returns {string} The combined atom ID with the new or combined symmetry code
 *   (e.g., 'C1|2_655').
 */
export function combineSymAtomLabel(atomId: string, symOpLabel: string, symmetry: CellSymmetry): string;
import { CellSymmetry } from '../../cell-symmetry.js';
//# sourceMappingURL=util.d.ts.map