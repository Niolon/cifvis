import { CifBlock } from '../read-cif/base.js';

/**
 * Returns the chemical label portion of an atom ID.
 * @param {string} atomId - Atom ID or legacy atom label
 * @returns {string} Chemical atom label
 */
function getAtomLabel(atomId) {
    return String(atomId).split('|')[0];
}

/**
 * Normalizes an atom label or ID to the canonical label|symmetry form.
 * @param {string} atomId - Atom ID or legacy atom label
 * @param {string} [symmetry] - Symmetry used for legacy labels
 * @returns {string} Canonical atom ID
 */
function normalizeAtomId(atomId, symmetry = '1_555') {
    const stringId = String(atomId);
    return stringId.includes('|') ? stringId : `${stringId}|${symmetry}`;
}

/**
 * Represents a covalent bond between atoms in a crystal structure.
 */
export class Bond {
    /**
     * Creates a new bond
     * @param {string} atom1Id - Unique ID of first atom
     * @param {string} atom2Id - Unique ID of second atom
     * @param {number} [bondLength] - Bond length in Å
     * @param {number} [bondLengthSU] - Standard uncertainty in bond length
     * @param {string} [atom2SiteSymmetry] - Symmetry operation for second atom
     */
    constructor(atom1Id, atom2Id, bondLength = null, bondLengthSU = null, atom2SiteSymmetry = null) {
        this.atom1Id = normalizeAtomId(atom1Id);
        this.atom2Id = normalizeAtomId(
            atom2Id,
            atom2SiteSymmetry && atom2SiteSymmetry !== '.' ? atom2SiteSymmetry : '1_555',
        );
        this.bondLength = bondLength;
        this.bondLengthSU = bondLengthSU;
        this.atom2SiteSymmetry = atom2SiteSymmetry;
    }

    get atom1Label() {
        return getAtomLabel(this.atom1Id);
    }

    get atom2Label() {
        return getAtomLabel(this.atom2Id);
    }

    /**
     * Creates a Bond from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} bondIndex - Index in _geom_bond loop
     * @returns {Bond} New bond instance
     */
    static fromCIF(cifBlock, bondIndex) {
        const bondLoop = cifBlock.get('_geom_bond');

        let siteSymmetry2 = bondLoop.getIndex(
            ['_geom_bond.site_symmetry_2', '_geom_bond_site_symmetry_2'],
            bondIndex,
            '.',
        );

        const siteSymmetry1 = bondLoop.getIndex(
            ['_geom_bond.site_symmetry_1', '_geom_bond_site_symmetry_1'],
            bondIndex,
            false,
        );

        if (siteSymmetry1 && siteSymmetry1 === siteSymmetry2) {
            siteSymmetry2 = '.';
        }

        if (siteSymmetry2 === '?') {
            siteSymmetry2 = '.';
        }
        if (siteSymmetry2 !== '.' && !siteSymmetry2.includes('_')) {
            siteSymmetry2 = `${siteSymmetry2}_555`;
        }

        const atom1Label = bondLoop.getIndex(
            ['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1'],
            bondIndex,
        );
        // Atom 1 is always in the asymmetric unit in standard CIF bond lists, so we use identity symmetry 1_555
        const atom1Id = `${atom1Label}|1_555`;

        const atom2Label = bondLoop.getIndex(
            ['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2'],
            bondIndex,
        );
        const atom2Symmetry = siteSymmetry2 !== '?' ? siteSymmetry2 : '.';
        // If symmetry is identity ('.'), use 1_555, otherwise use the symmetry code
        const atom2Id = `${atom2Label}|${atom2Symmetry === '.' ? '1_555' : atom2Symmetry}`;

        return new Bond(
            atom1Id,
            atom2Id,
            bondLoop.getIndex(['_geom_bond.distance', '_geom_bond_distance'], bondIndex),
            bondLoop.getIndex(['_geom_bond.distance_su', '_geom_bond_distance_su'], bondIndex, NaN),
            atom2Symmetry,
        );
    }
}

/**
 * Represents a hydrogen bond between atoms in a crystal structure
 */
export class HBond {
    /**
     * Creates a new hydrogen bond
     * @param {string} donorAtomId - Unique ID of donor atom (D)
     * @param {string} hydrogenAtomId - Unique ID of hydrogen atom (H)
     * @param {string} acceptorAtomId - Unique ID of acceptor atom (A)
     * @param {number} donorHydrogenDistance - D-H distance in Å
     * @param {number} donorHydrogenDistanceSU - Standard uncertainty in D-H distance
     * @param {number} acceptorHydrogenDistance - H···A distance in Å
     * @param {number} acceptorHydrogenDistanceSU - Standard uncertainty in H···A distance
     * @param {number} donorAcceptorDistance - D···A distance in Å
     * @param {number} donorAcceptorDistanceSU - Standard uncertainty in D···A distance
     * @param {number} hBondAngle - D-H···A angle in degrees
     * @param {number} hBondAngleSU - Standard uncertainty in angle
     * @param {string} acceptorAtomSymmetry - Symmetry operation for acceptor atom
     */
    constructor(
        donorAtomId,
        hydrogenAtomId,
        acceptorAtomId,
        donorHydrogenDistance,
        donorHydrogenDistanceSU,
        acceptorHydrogenDistance,
        acceptorHydrogenDistanceSU,
        donorAcceptorDistance,
        donorAcceptorDistanceSU,
        hBondAngle,
        hBondAngleSU,
        acceptorAtomSymmetry,
    ) {
        this.donorAtomId = normalizeAtomId(donorAtomId);
        this.hydrogenAtomId = normalizeAtomId(hydrogenAtomId);
        this.acceptorAtomId = normalizeAtomId(
            acceptorAtomId,
            acceptorAtomSymmetry && acceptorAtomSymmetry !== '.' ? acceptorAtomSymmetry : '1_555',
        );
        this.donorHydrogenDistance = donorHydrogenDistance;
        this.donorHydrogenDistanceSU = donorHydrogenDistanceSU;
        this.acceptorHydrogenDistance = acceptorHydrogenDistance;
        this.acceptorHydrogenDistanceSU = acceptorHydrogenDistanceSU;
        this.donorAcceptorDistance = donorAcceptorDistance;
        this.donorAcceptorDistanceSU = donorAcceptorDistanceSU;
        this.hBondAngle = hBondAngle;
        this.hBondAngleSU = hBondAngleSU;
        this.acceptorAtomSymmetry = acceptorAtomSymmetry;
    }

    get donorAtomLabel() {
        return getAtomLabel(this.donorAtomId);
    }

    get hydrogenAtomLabel() {
        return getAtomLabel(this.hydrogenAtomId);
    }

    get acceptorAtomLabel() {
        return getAtomLabel(this.acceptorAtomId);
    }

    /**
     * Creates a HBond from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} hBondIndex - Index in _geom_hbond loop
     * @returns {HBond} New hydrogen bond instance
     */
    static fromCIF(cifBlock, hBondIndex) {
        const hBondLoop = cifBlock.get('_geom_hbond');
        const acceptorAtomSymmetry = hBondLoop.getIndex(
            ['_geom_hbond.site_symmetry_a', '_geom_hbond_site_symmetry_A'], hBondIndex,
            '.',
        );

        const donorLabel = hBondLoop.getIndex(
            ['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D'],
            hBondIndex,
        );
        const donorId = `${donorLabel}|1_555`;

        const hydrogenLabel = hBondLoop.getIndex(
            ['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'],
            hBondIndex,
        );
        const hydrogenId = `${hydrogenLabel}|1_555`;

        const acceptorLabel = hBondLoop.getIndex(
            ['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'],
            hBondIndex,
        );
        const acceptorSymmetry = acceptorAtomSymmetry !== '?' ? acceptorAtomSymmetry : '.';
        const acceptorId = `${acceptorLabel}|${acceptorSymmetry === '.' ? '1_555' : acceptorSymmetry}`;

        return new HBond(
            donorId,
            hydrogenId,
            acceptorId,
            hBondLoop.getIndex(['_geom_hbond.distance_dh', '_geom_hbond_distance_DH'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_dh_su', '_geom_hbond_distance_DH_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_ha', '_geom_hbond_distance_HA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_ha_su', '_geom_hbond_distance_HA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_da', '_geom_hbond_distance_DA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_da_su', '_geom_hbond_distance_DA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.angle_dha', '_geom_hbond_angle_DHA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.angle_dha_su', '_geom_hbond_angle_DHA_su'], hBondIndex, NaN),
            acceptorSymmetry,
        );
    }
}

/**
 * Result of bond validation containing error messages categorized by type
 */
export class ValidationResult {
    constructor() {
        this.atomLabelErrors = [];
        this.symmetryErrors = [];
    }

    /**
     * Add an atom label error message to the validation results
     * @param {string} error - Error message to add
     */
    addAtomLabelError(error) {
        this.atomLabelErrors.push(error);
    }

    /**
     * Add a symmetry error message to the validation results
     * @param {string} error - Error message to add
     */
    addSymmetryError(error) {
        this.symmetryErrors.push(error);
    }

    /**
     * Check if validation found any errors
     * @returns {boolean} True if validation passed with no errors
     */
    isValid() {
        return (this.atomLabelErrors.length + this.symmetryErrors.length) === 0;
    }

    /**
     * Generates a formatted report of all validation errors
     * @param {Array<object>} atoms - Array of atom objects with label property
     * @param {object} symmetry - Symmetry object with operationIds Map
     * @returns {string} Formatted error report
     */
    report(atoms, symmetry) {
        let reportString = '';
        if (this.atomLabelErrors.length !== 0) {
            reportString += 'Unknown atom label(s). Known labels are \n';
            reportString += atoms.map(atom => atom.label).join(', ');
            reportString += '\n';
            reportString += this.atomLabelErrors.join('\n');
        }

        if (this.symmetryErrors.length !== 0) {
            if (reportString.length !== 0) {
                reportString += '\n';
            }
            reportString += 'Unknown symmetry ID(s) or String format. Expected format is <id>_abc. ';
            reportString += 'Known IDs are:\n';
            reportString += Array.from(symmetry.operationIds.keys()).join(', ');
            reportString += '\n';
            reportString += this.symmetryErrors.join('\n');
        }

        return reportString;
    }
}

/**
 * Factory for creating and validating bonds and hydrogen bonds from CIF data
 */
export class BondsFactory {
    /**
     * Creates bonds from CIF data
     * @param {object} cifBlock - CIF data block to parse
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {Array<Bond>} Array of created bonds
     */
    static createBonds(cifBlock, atomLabels) {
        try {
            const bondLoop = cifBlock.get('_geom_bond');
            const nBonds = bondLoop.get(['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1']).length;
            const bonds = [];

            for (let i = 0; i < nBonds; i++) {
                const atom1Label = bondLoop.getIndex(
                    ['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1'],
                    i,
                );
                const atom2Label = bondLoop.getIndex(
                    ['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2'],
                    i,
                );

                if (BondsFactory.isValidBondPair(atom1Label, atom2Label, atomLabels)) {
                    bonds.push(Bond.fromCIF(cifBlock, i));
                }
            }
            return bonds;
        } catch {
            return [];
        }
    }

    /**
     * Creates hydrogen bonds from CIF data
     * @param {CifBlock} cifBlock - CIF data block to parse
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {HBond[]} Array of created hydrogen bonds
     */
    static createHBonds(cifBlock, atomLabels) {
        const hbondLoop = cifBlock.get('_geom_hbond', false);
        if (!hbondLoop) {
            return [];
        }

        const nHBonds = hbondLoop.get(['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D']).length;
        const hBonds = [];

        for (let i = 0; i < nHBonds; i++) {
            const donorLabel = hbondLoop.getIndex(
                ['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D'],
                i,
                '?',
            );
            const hydrogenLabel = hbondLoop.getIndex(
                ['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'],
                i,
                '?',
            );
            const acceptorLabel = hbondLoop.getIndex(
                ['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'],
                i,
                '?',
            );

            if (BondsFactory.isValidHBondTriplet(donorLabel, hydrogenLabel, acceptorLabel, atomLabels)) {
                hBonds.push(HBond.fromCIF(cifBlock, i));
            }
        }

        return hBonds;
    }

    /**
     * Validates bonds against a set of atoms and symmetry operations
     * @param {Array<Bond>} bonds - Bonds to validate
     * @param {Array<object>} atoms - Atoms to validate against
     * @param {object} symmetry - Symmetry operations to validate against
     * @returns {ValidationResult} Validation results
     */
    static validateBonds(bonds, atoms, symmetry) {
        const result = new ValidationResult();
        const atomLabels = new Set(atoms.map(atom => atom.label));

        for (const bond of bonds) {
            const missingAtoms = [];
            // Extract label from ID (format: label|symmetry)
            const atom1Label = bond.atom1Id.split('|')[0];
            const atom2Label = bond.atom2Id.split('|')[0];

            if (!atomLabels.has(atom1Label)) {
                missingAtoms.push(atom1Label);
            }
            if (!atomLabels.has(atom2Label)) {
                missingAtoms.push(atom2Label);
            }
            if (missingAtoms.length > 0) {
                result.addAtomLabelError(
                    `Non-existent atoms in bond: ${bond.atom1Label} - ${bond.atom2Label}, ` +
                    `non-existent atom(s): ${missingAtoms.join(', ')}`,
                );
            }

            if (bond.atom2SiteSymmetry && bond.atom2SiteSymmetry !== '.') {
                try {
                    symmetry.parsePositionCode(bond.atom2SiteSymmetry);
                } catch {
                    result.addSymmetryError(
                        `Invalid symmetry in bond: ${bond.atom1Label} - ${bond.atom2Label}, ` +
                        `invalid symmetry operation: ${bond.atom2SiteSymmetry}`,
                    );
                }
            }
        }
        return result;
    }

    /**
     * Validates hydrogen bonds against a set of atoms and symmetry operations
     * @param {Array<HBond>} hBonds - Hydrogen bonds to validate
     * @param {Array<object>} atoms - Atoms to validate against
     * @param {object} symmetry - Symmetry operations to validate against
     * @returns {ValidationResult} Validation results
     */
    static validateHBonds(hBonds, atoms, symmetry) {
        const result = new ValidationResult();
        const atomsLabels = new Set(atoms.map(atom => atom.label));

        for (const hbond of hBonds) {
            const missingAtoms = [];
            const donorLabel = hbond.donorAtomId.split('|')[0];
            const hydrogenLabel = hbond.hydrogenAtomId.split('|')[0];
            const acceptorLabel = hbond.acceptorAtomId.split('|')[0];

            if (!atomsLabels.has(donorLabel)) {
                missingAtoms.push(donorLabel);
            }
            if (!atomsLabels.has(hydrogenLabel)) {
                missingAtoms.push(hydrogenLabel);
            }
            if (!atomsLabels.has(acceptorLabel)) {
                missingAtoms.push(acceptorLabel);
            }
            if (missingAtoms.length > 0) {
                result.addAtomLabelError(
                    `Non-existent atoms in H-bond: ${hbond.donorAtomLabel} - ` +
                        `${hbond.hydrogenAtomLabel} - ${hbond.acceptorAtomLabel}, ` +
                    `non-existent atom(s): ${missingAtoms.join(', ')}`,
                );
            }

            if (hbond.acceptorAtomSymmetry && hbond.acceptorAtomSymmetry !== '.') {
                try {
                    symmetry.parsePositionCode(hbond.acceptorAtomSymmetry);
                } catch {
                    result.addSymmetryError(
                        `Invalid symmetry in H-bond: ${hbond.donorAtomLabel} - ` +
                        `${hbond.hydrogenAtomLabel} - ${hbond.acceptorAtomLabel}, ` +
                        `invalid symmetry operation: ${hbond.acceptorAtomSymmetry}`,
                    );
                }
            }
        }
        return result;
    }

    /**
     * Checks for an atom label whether it is valid (exclude centroids)
     * @param {string} atomLabel - An atom Label
     * @returns {boolean} Whether the label is valid
     */
    static isValidLabel(atomLabel) {
        return /^(Cg|Cnt|CG|CNT)/.test(atomLabel);
    }

    /**
     * Checks if bond atom pair is valid (not centroids unless in atom list)
     * @private
     * @param {string} atom1Label - First atom label
     * @param {string} atom2Label - Second atom label
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {boolean} Whether bond pair is valid
     */
    static isValidBondPair(atom1Label, atom2Label, atomLabels) {
        const atom1IsCentroid = BondsFactory.isValidLabel(atom1Label);
        const atom2IsCentroid = BondsFactory.isValidLabel(atom2Label);

        if (atom1Label === '?' || atom2Label === '?') {
            return false;
        }

        return (!atom1IsCentroid || atomLabels.has(atom1Label)) &&
            (!atom2IsCentroid || atomLabels.has(atom2Label));
    }

    /**
     * Checks if H-bond atom triplet is valid (not centroids unless in atom list)
     * @private
     * @param {string} donorLabel - Donor atom label
     * @param {string} hydrogenLabel - Hydrogen atom label  
     * @param {string} acceptorLabel - Acceptor atom label
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {boolean} Whether H-bond triplet is valid
     */
    static isValidHBondTriplet(donorLabel, hydrogenLabel, acceptorLabel, atomLabels) {
        const donorIsCentroid = BondsFactory.isValidLabel(donorLabel);
        const hydrogenIsCentroid = BondsFactory.isValidLabel(hydrogenLabel);
        const acceptorIsCentroid = BondsFactory.isValidLabel(acceptorLabel);

        if (donorLabel === '?' || hydrogenLabel === '?' || acceptorLabel === '?') {
            return false;
        }

        return (!donorIsCentroid || atomLabels.has(donorLabel)) &&
            (!hydrogenIsCentroid || atomLabels.has(hydrogenLabel)) &&
            (!acceptorIsCentroid || atomLabels.has(acceptorLabel));
    }
}
