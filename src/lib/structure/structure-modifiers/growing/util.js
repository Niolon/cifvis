import { CellSymmetry } from '../../cell-symmetry.js';

/**
 * Creates a unique identifier string for an atom including its symmetry code.
 * @param {string} atomLabel - The base label of the atom (e.g., 'C1').
 * @param {string} symOpLabel - The symmetry code (e.g., '1_555').
 * @returns {string} The combined label (e.g., 'C1@1_555').
 */
export function createSymAtomLabel(atomLabel, symOpLabel) {
    return `${atomLabel}@${symOpLabel}`;
}

/**
 * Combines a new symmetry operation with an existing atom label that may already contain a symmetry code.
 * If the atomLabel already has a symmetry code (e.g., 'C1@1_555'), it combines the new symOpLabel
 * with the existing one using the `symmetry.combineSymmetryCodes` method.
 * Otherwise, it creates a new symmetry atom label using the provided atomLabel and symOpLabel.
 * @param {string} atomLabel - The base label of the atom, which may or may not include an existing symmetry code 
 *   (e.g., 'C1' or 'C1@1_555').
 * @param {string} symOpLabel - The new symmetry code to apply or combine (e.g., '2_655').
 * @param {CellSymmetry} symmetry - An instance of CellSymmetry, used to combine symmetry codes.
 * @returns {string} The combined atom label with the new or combined symmetry code 
 *   (e.g., 'C1@2_655' or 'C1@combined_555').
 */
export function combineSymAtomLabel(atomLabel, symOpLabel, symmetry) {
    const labelParts = atomLabel.split('@');
    if (labelParts.length === 2) {
        const combinedSymm = symmetry.combineSymmetryCodes(symOpLabel, labelParts[1]);
        return createSymAtomLabel(labelParts[0], combinedSymm);
    } else {
        return createSymAtomLabel(atomLabel, symOpLabel);
    }
}
