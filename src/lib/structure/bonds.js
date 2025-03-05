
/**
 * Represents a covalent bond between atoms
 */

export class Bond {
    /**
     * Creates a new bond
     * @param {string} atom1Label - Label of first atom
     * @param {string} atom2Label - Label of second atom
     * @param {number} [bondLength] - Bond length in Å
     * @param {number} [bondLengthSU] - Standard uncertainty in bond length
     * @param {string} [atom2SiteSymmetry] - Symmetry operation for second atom
     */
    constructor(atom1Label, atom2Label, bondLength = null, bondLengthSU = null, atom2SiteSymmetry = null) {
        this.atom1Label = atom1Label;
        this.atom2Label = atom2Label;
        this.bondLength = bondLength;
        this.bondLengthSU = bondLengthSU;
        this.atom2SiteSymmetry = atom2SiteSymmetry;
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

        return new Bond(
            bondLoop.getIndex(['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1'], bondIndex),
            bondLoop.getIndex(['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2'], bondIndex),
            bondLoop.getIndex(['_geom_bond.distance', '_geom_bond_distance'], bondIndex),
            bondLoop.getIndex(['_geom_bond.distance_su', '_geom_bond_distance_su'], bondIndex, NaN),
            siteSymmetry2 !== '?' ? siteSymmetry2: '.',
        );
    }
}
/**
 * Represents a hydrogen bond between atoms
 */

export class HBond {
    /**
     * Creates a new hydrogen bond
     * @param {string} donorAtomLabel - Label of donor atom
     * @param {string} hydrogenAtomLabel - Label of hydrogen atom
     * @param {string} acceptorAtomLabel - Label of acceptor atom
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
        donorAtomLabel,
        hydrogenAtomLabel,
        acceptorAtomLabel,
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
        this.donorAtomLabel = donorAtomLabel;
        this.hydrogenAtomLabel = hydrogenAtomLabel;
        this.acceptorAtomLabel = acceptorAtomLabel;
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

        return new HBond(
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.distance_dh', '_geom_hbond_distance_DH'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_dh_su', '_geom_hbond_distance_DH_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_ha', '_geom_hbond_distance_HA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_ha_su', '_geom_hbond_distance_HA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_da', '_geom_hbond_distance_DA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_da_su', '_geom_hbond_distance_DA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.angle_dha', '_geom_hbond_angle_DHA'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.angle_dha_su', '_geom_hbond_angle_DHA_su'], hBondIndex, NaN),
            acceptorAtomSymmetry !== '?' ? acceptorAtomSymmetry : '.',
        );
    }
}
/**
 * Result of bond validation containing any error messages
 */
export class ValidationResult {
    constructor() {
        this.atomLabelErrors = [];
        this.symmetryErrors = [];
    }

    /**
     * Add an error message to the validation results
     * @param {string} error - Error message to add
     */
    addAtomLabelError(error) {
        this.atomLabelErrors.push(error);
    }

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

export class BondsFactory {
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
     * Validates bonds against crystal structure
     * @param {CrystalStructure} structure - Structure to validate against
     * @param bonds
     * @param atoms
     * @param symmetry
     * @returns {ValidationResult} Validation results
     */
    static validateBonds(bonds, atoms, symmetry) {
        const result = new ValidationResult();
        const atomLabels = new Set(atoms.map(atom => atom.label));

        for (const bond of bonds) {
            const missingAtoms = [];
            if (!atomLabels.has(bond.atom1Label)) {
                missingAtoms.push(bond.atom1Label);
            }
            if (!atomLabels.has(bond.atom2Label)) {
                missingAtoms.push(bond.atom2Label);
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
     * Validates h-bonds against crystal structure
     * @param {CrystalStructure} structure - Structure to validate against
     * @param hBonds
     * @param atoms
     * @param symmetry
     * @returns {ValidationResult} Validation results
     */
    static validateHBonds(hBonds, atoms, symmetry) {
        const result = new ValidationResult();
        const atomsLabels = new Set(atoms.map(atom => atom.label));
        
        for (const hbond of hBonds) {
            const missingAtoms = [];
            if (!atomsLabels.has(hbond.donorAtomLabel)) {
                missingAtoms.push(hbond.donorAtomLabel);
            }
            if (!atomsLabels.has(hbond.hydrogenAtomLabel)) {
                missingAtoms.push(hbond.hydrogenAtomLabel);
            }
            if (!atomsLabels.has(hbond.acceptorAtomLabel)) {
                missingAtoms.push(hbond.acceptorAtomLabel);
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