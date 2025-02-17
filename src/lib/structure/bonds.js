
/**
* Represents a covalent bond between atoms
*/

export class Bond {
    /**
    * Creates a new bond
    * @param {string} atom1Label - Label of first atom
    * @param {string} atom2Label - Label of second atom
    * @param {number} [bondLength=null] - Bond length in Å
    * @param {number} [bondLengthSU=null] - Standard uncertainty in bond length
    * @param {string} [atom2SiteSymmetry=null] - Symmetry operation for second atom
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

        return new Bond(
            bondLoop.getIndex(['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1'], bondIndex),
            bondLoop.getIndex(['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2'], bondIndex),
            bondLoop.getIndex(['_geom_bond.distance', '_geom_bond_distance'], bondIndex),
            bondLoop.getIndex(['_geom_bond.distance_su', '_geom_bond_distance_su'], bondIndex, NaN),
            bondLoop.getIndex(['_geom_bond.site_symmetry_2', '_geom_bond_site_symmetry_2'], bondIndex, '.'),
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

        return new HBond(
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.distance_dh', '_geom_hbond_distance_DH'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.distance_dh_su', '_geom_hbond_distance_DH_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_ha', '_geom_hbond_distance_HA'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.distance_ha_su', '_geom_hbond_distance_HA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.distance_da', '_geom_hbond_distance_DA'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.distance_da_su', '_geom_hbond_distance_DA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.angle_dha', '_geom_hbond_angle_DHA'], hBondIndex),
            hBondLoop.getIndex(['_geom_hbond.angle_dha_su', '_geom_hbond_angle_DHA_su'], hBondIndex, NaN),
            hBondLoop.getIndex(['_geom_hbond.site_symmetry_a', '_geom_hbond_site_symmetry_A'], hBondIndex, '.'),
        );
    }
}

export class BondsFactory {
    /**
     * Creates bonds from CIF data
     * @param {CifBlock} cifBlock - CIF data block to parse
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {Bond[]} Array of created bonds
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
            console.warn('No bonds found in CIF file');
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
            );
            const hydrogenLabel = hbondLoop.getIndex(
                ['_geom_hbond.atom_site_label_h', '_geom_hbond_atom_site_label_H'],
                i,
            );
            const acceptorLabel = hbondLoop.getIndex(
                ['_geom_hbond.atom_site_label_a', '_geom_hbond_atom_site_label_A'],
                i,
            );

            if (BondsFactory.isValidHBondTriplet(donorLabel, hydrogenLabel, acceptorLabel, atomLabels)) {
                hBonds.push(HBond.fromCIF(cifBlock, i));
            }
        }
        
        return hBonds;
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
        const atom1IsCentroid = /^(Cg|Cnt)/.test(atom1Label);
        const atom2IsCentroid = /^(Cg|Cnt)/.test(atom2Label);

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
        const donorIsCentroid = /^(Cg|Cnt)/.test(donorLabel);
        const hydrogenIsCentroid = /^(Cg|Cnt)/.test(hydrogenLabel);
        const acceptorIsCentroid = /^(Cg|Cnt)/.test(acceptorLabel);

        return (!donorIsCentroid || atomLabels.has(donorLabel)) &&
               (!hydrogenIsCentroid || atomLabels.has(hydrogenLabel)) &&
               (!acceptorIsCentroid || atomLabels.has(acceptorLabel));
    }
}
