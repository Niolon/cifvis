import { CellSymmetry } from '../../cell-symmetry.js';

/**
 * Creates a unique identifier string for an atom including its symmetry code.
 * @param {string} atomLabel - The base label of the atom (e.g., 'C1').
 * @param {string} symOpLabel - The symmetry code (e.g., '1_555').
 * @returns {string} The combined ID (e.g., 'C1|1_555').
 */
export function createAtomId(atomLabel, symOpLabel) {
    return `${atomLabel}|${symOpLabel}`;
}

/**
 * Combines a new symmetry operation with an existing atom ID that may already contain a symmetry code.
 * @param {string} atomId - The ID or label of the atom (e.g., 'C1' or 'C1|1_555').
 * @param {string} symOpLabel - The new symmetry code to apply or combine (e.g., '2_655').
 * @param {CellSymmetry} symmetry - An instance of CellSymmetry, used to combine symmetry codes.
 * @returns {string} The combined atom ID with the new or combined symmetry code
 *   (e.g., 'C1|2_655').
 */
export function combineAtomId(atomId, symOpLabel, symmetry) {
    const parts = atomId.split('|');
    const baseLabel = parts[0];
    let currentSym = `${symmetry.identitySymOpId}_555`;

    if (parts.length === 2) {
        currentSym = parts[1];
    }

    // Combine the new symmetry code (outer) with the existing one (inner)
    // Note: The order depends on how we view the transform.
    // Usually newSym (applied to) -> oldSym.
    // If atom was at S1, and we apply S2, it is S2 * S1.
    const combinedSymm = symmetry.combineSymmetryCodes(symOpLabel, currentSym);

    return createAtomId(baseLabel, combinedSymm);
}

// Deprecated alias for backward compatibility until all call sites are updated
export const createSymAtomLabel = createAtomId;
export const combineSymAtomLabel = combineAtomId;
