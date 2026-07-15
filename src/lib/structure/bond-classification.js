import { COVALENT_RADII } from './covalent-radii.js';

/**
 * Covalent radii for non-metals commonly involved in intermolecular contacts
 * reported through `_geom_bond` loops, sourced from the shared Cordero (2008)
 * `COVALENT_RADII` table.
 *
 * Bonds involving metals are deliberately left to the CIF author because
 * coordination distances are not reliably classified by one radius sum.
 */
const NON_METAL_ELEMENTS = ['H', 'D', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'As', 'Se', 'Br', 'Te', 'I'];

const NON_METAL_COVALENT_RADII = Object.freeze(
    Object.fromEntries(NON_METAL_ELEMENTS.map(el => [el, COVALENT_RADII[el]])),
);

const MAX_CHEMICAL_BOND_LENGTH = 4;
const NON_METAL_RADIUS_TOLERANCE = 1.6;

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

    const radius1 = NON_METAL_COVALENT_RADII[atom1.atomType];
    const radius2 = NON_METAL_COVALENT_RADII[atom2.atomType];
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

        const radius1 = NON_METAL_COVALENT_RADII[atomType1];
        const radius2 = NON_METAL_COVALENT_RADII[atomType2];
        if (radius1 === undefined || radius2 === undefined) {
            return true;
        }

        return bond.bondLength <= NON_METAL_RADIUS_TOLERANCE * (radius1 + radius2);
    });
}
