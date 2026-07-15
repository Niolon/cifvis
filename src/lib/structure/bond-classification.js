import { COVALENT_RADII } from './covalent-radii.js';

/**
 * Elements whose Cordero (2008) radius sum reliably distinguishes covalent
 * bonds from non-bonded contacts in `_geom_bond` rows.
 *
 * Metals are deliberately excluded: coordination distances are not reliably
 * classified by one radius sum, so bonds involving them are left to the CIF
 * author (see `nonMetalRadius` below).
 */
const NON_METAL_ELEMENTS = new Set([
    'H', 'D', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'As', 'Se', 'Br', 'Te', 'I',
]);

const MAX_CHEMICAL_BOND_LENGTH = 4;
const NON_METAL_RADIUS_TOLERANCE = 1.6;

/**
 * Returns the covalent radius for an element if it's on the non-metal
 * allowlist, or undefined otherwise (including for metals and unknown types).
 * @param {string} atomType - Element symbol
 * @returns {number|undefined} Covalent radius in Angstroms, or undefined
 */
function nonMetalRadius(atomType) {
    return NON_METAL_ELEMENTS.has(atomType) ? COVALENT_RADII[atomType] : undefined;
}

/**
 * Determines whether a CIF `_geom_bond` row is suitable as an edge in the
 * chemical connectivity graph.
 *
 * Unknown lengths and metal coordination bonds are retained conservatively;
 * clearly non-covalent non-metal contacts and implausibly long entries are not.
 * @param {import('./crystal.js').CrystalStructure} structure - Owning structure
 * @param {import('./bonds.js').Bond} bond - Bond/contact to classify
 * @returns {boolean} Whether the row should define chemical connectivity
 */
export function isChemicalBond(structure, bond) {
    if (!Number.isFinite(bond.bondLength)) {
        return true;
    }
    if (bond.bondLength > MAX_CHEMICAL_BOND_LENGTH) {
        return false;
    }

    let atom1;
    let atom2;
    try {
        atom1 = structure.getAtomByLabel(bond.atom1Label);
        atom2 = structure.getAtomByLabel(bond.atom2Label);
    } catch {
        return true;
    }

    const radius1 = nonMetalRadius(atom1.atomType);
    const radius2 = nonMetalRadius(atom2.atomType);
    if (radius1 === undefined || radius2 === undefined) {
        return true;
    }

    return bond.bondLength <= NON_METAL_RADIUS_TOLERANCE * (radius1 + radius2);
}

/**
 * Returns the subset of CIF bond rows that define chemical connectivity.
 * @param {import('./crystal.js').CrystalStructure} structure - Owning structure
 * @param {import('./bonds.js').Bond[]} [bonds] - Rows to classify
 * @returns {import('./bonds.js').Bond[]} Chemical graph edges
 */
export function chemicalBonds(structure, bonds = structure.bonds) {
    // CIF atom labels identify asymmetric-unit atoms. Build the same first-match
    // lookup used by getAtomByLabel once instead of scanning all atoms per bond.
    const atomTypesByLabel = new Map();
    for (const atom of structure.atoms) {
        if (!atomTypesByLabel.has(atom.label)) {
            atomTypesByLabel.set(atom.label, atom.atomType);
        }
    }

    return bonds.filter(bond => {
        if (!Number.isFinite(bond.bondLength)) {
            return true;
        }
        if (bond.bondLength > MAX_CHEMICAL_BOND_LENGTH) {
            return false;
        }

        const atomType1 = atomTypesByLabel.get(bond.atom1Label);
        const atomType2 = atomTypesByLabel.get(bond.atom2Label);
        if (atomType1 === undefined || atomType2 === undefined) {
            return true;
        }

        const radius1 = nonMetalRadius(atomType1);
        const radius2 = nonMetalRadius(atomType2);
        if (radius1 === undefined || radius2 === undefined) {
            return true;
        }

        return bond.bondLength <= NON_METAL_RADIUS_TOLERANCE * (radius1 + radius2);
    });
}
