import {
    calculateFractToCartMatrix,
    uCifToUCart
} from "./fract-to-cart.js"

import { CellSymmetry } from "./cell-symmetry.js";

export class CrystalStructure {
    constructor(unitCell, atoms, bonds=[], hBonds=[], symmetry=null) {
        this.cell = unitCell;
        this.atoms = atoms;
        this.bonds = bonds;
        this.hBonds = hBonds;
        this.connectedGroups = this.findConnectedGroups();
        this.symmetry = symmetry ? symmetry : new CellSymmetry("None", 0, ["x,y,z"]);
    }
 
    static fromCIF(cifBlock) {
        const cell = UnitCell.fromCIF(cifBlock);
        
        const atomSite = cifBlock.get("_atom_site");
        const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
        
        const atoms = Array.from({length: labels.length}, (_, i) => Atom.fromCIF(cifBlock, i));

        const bonds = [];
        try {
            const bondLoop = cifBlock.get("_geom_bond");
            if (bondLoop) {
                const nBonds = bondLoop.get(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"]).length;
                for (let i = 0; i < nBonds; i++) {
                    bonds.push(Bond.fromCIF(cifBlock, i));
                }
            }
        } catch (error) {
            console.warn("No bonds found in CIF file");
        }

        const hBonds = [];
        try {
            const hbondLoop = cifBlock.get("_geom_hbond");
            if (hbondLoop) {
                const nHBonds = hbondLoop.get(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"]).length;
                for (let i = 0; i < nHBonds; i++) {
                    hBonds.push(HBond.fromCIF(cifBlock, i));
                }
            }
        } catch (error) {
            console.warn("No hydrogen bonds found in CIF file");
        }
        
        const symmetry = CellSymmetry.fromCIF(cifBlock);
        return new CrystalStructure(cell, atoms, bonds, hBonds, symmetry);
    }

    getAtomByLabel(atomLabel) {
        for (const atom of this.atoms) {
            if (atom.label === atomLabel) {
                return atom;
            }
        }
        throw new Error("Could not find atom with label: " + atomLabel);
    }

    findConnectedGroups() {
        // Map to track which atoms have been assigned to a group
        const atomGroupMap = new Map();
        const groups = [];
        
        // Helper function to get or create group for an atom
        const getAtomGroup = (atom) => {
            if (atomGroupMap.has(atom.label)) {
                return atomGroupMap.get(atom.label);
            }
            const newGroup = {
                atoms: new Set(),
                bonds: new Set(),
                hBonds: new Set()
            };
            groups.push(newGroup);
            return newGroup;
        };

        // Process regular bonds first
        for (const bond of this.bonds) {
            const atom1 = this.getAtomByLabel(bond.atom1Label);
            const atom2 = this.getAtomByLabel(bond.atom2Label);

            // Skip bonds to symmetry equivalent positions for initial grouping
            if (bond.atom2SiteSymmetry !== "." && bond.atom2SiteSymmetry !== undefined) {
                continue;
            }

            let group1 = atomGroupMap.get(atom1.label);
            let group2 = atomGroupMap.get(atom2.label);

            if (!group1 && !group2) {
                // Create new group
                const newGroup = getAtomGroup(atom1);
                newGroup.atoms.add(atom1);
                newGroup.atoms.add(atom2);
                newGroup.bonds.add(bond);
                atomGroupMap.set(atom1.label, newGroup);
                atomGroupMap.set(atom2.label, newGroup);
            } else if (group1 && !group2) {
                // Add atom2 to group1
                group1.atoms.add(atom2);
                group1.bonds.add(bond);
                atomGroupMap.set(atom2.label, group1);
            } else if (!group1 && group2) {
                // Add atom1 to group2
                group2.atoms.add(atom1);
                group2.bonds.add(bond);
                atomGroupMap.set(atom1.label, group2);
            } else if (group1 !== group2) {
                // Merge groups
                for (const atom of group2.atoms) {
                    group1.atoms.add(atom);
                    atomGroupMap.set(atom.label, group1);
                }
                for (const bond of group2.bonds) {
                    group1.bonds.add(bond);
                }
                for (const hbond of group2.hBonds) {
                    group1.hBonds.add(hbond);
                }
                const groupIndex = groups.indexOf(group2);
                groups.splice(groupIndex, 1);
            }
        }

        // Process hydrogen bonds
        for (const hbond of this.hBonds) {
            const donorAtom = this.getAtomByLabel(hbond.donorAtomLabel);
            const hydrogenAtom = this.getAtomByLabel(hbond.hydrogenAtomLabel);
            const acceptorAtom = this.getAtomByLabel(hbond.acceptorAtomLabel);

            // Skip hbonds to symmetry equivalent positions for initial grouping
            if (hbond.acceptorAtomSymmetry !== "." && hbond.acceptorAtomSymmetry !== undefined) {
                continue;
            }

            // Get or create groups for involved atoms
            const donorGroup = getAtomGroup(donorAtom);
            const hydrogenGroup = getAtomGroup(hydrogenAtom);
            const acceptorGroup = getAtomGroup(acceptorAtom);

            // Merge all groups into donor's group
            if (donorGroup !== hydrogenGroup) {
                for (const atom of hydrogenGroup.atoms) {
                    donorGroup.atoms.add(atom);
                    atomGroupMap.set(atom.label, donorGroup);
                }
                for (const bond of hydrogenGroup.bonds) {
                    donorGroup.bonds.add(bond);
                }
                for (const hb of hydrogenGroup.hBonds) {
                    donorGroup.hBonds.add(hb);
                }
                const groupIndex = groups.indexOf(hydrogenGroup);
                groups.splice(groupIndex, 1);
            }

            if (donorGroup !== acceptorGroup) {
                for (const atom of acceptorGroup.atoms) {
                    donorGroup.atoms.add(atom);
                    atomGroupMap.set(atom.label, donorGroup);
                }
                for (const bond of acceptorGroup.bonds) {
                    donorGroup.bonds.add(bond);
                }
                for (const hb of acceptorGroup.hBonds) {
                    donorGroup.hBonds.add(hb);
                }
                const groupIndex = groups.indexOf(acceptorGroup);
                groups.splice(groupIndex, 1);
            }

            donorGroup.hBonds.add(hbond);
        }

        // Convert Sets to Arrays for easier handling
        return groups.map(group => ({
            atoms: Array.from(group.atoms),
            bonds: Array.from(group.bonds),
            hBonds: Array.from(group.hBonds)
        }));
    }
}

export class UnitCell {
    constructor(a, b, c, alpha, beta, gamma) {
        this._a = a;
        this._b = b;
        this._c = c;
        this._alpha = alpha;
        this._beta = beta;
        this._gamma = gamma;
        
        this.fractToCartMatrix = calculateFractToCartMatrix(this)
    }

    static fromCIF(cifBlock) {
        try {
            return new UnitCell(
                cifBlock.get(['_cell.length_a', '_cell_length_a']),
                cifBlock.get(['_cell.length_b', '_cell_length_b']),
                cifBlock.get(['_cell.length_c', '_cell_length_c']),
                cifBlock.get(['_cell.angle_alpha', '_cell_angle_alpha']),
                cifBlock.get(['_cell.angle_beta', '_cell_angle_beta']),
                cifBlock.get(['_cell.angle_gamma', '_cell_angle_gamma'])
            );
        } catch (error) {
            throw new Error(`Failed to create UnitCell: ${error.message}`);
        }
    }
 
    get a() {
        return this._a;
    }
 
    set a(value) {
        if (value <= 0) {
            throw new Error("Cell parameter 'a' must be positive");
        }
        this._a = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get b() {
        return this._b;
    }
 
    set b(value) {
        if (value <= 0) {
            throw new Error("Cell parameter 'b' must be positive");
        }
        this._b = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get c() {
        return this._c;
    }
 
    set c(value) {
        if (value <= 0) {
            throw new Error("Cell parameter 'c' must be positive");
        }
        this._c = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get alpha() {
        return this._alpha;
    }
 
    set alpha(value) {
        if (value <= 0 || value >= 180) {
            throw new Error("Angle alpha must be between 0 and 180 degrees");
        }
        this._alpha = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get beta() {
        return this._beta;
    }
 
    set beta(value) {
        if (value <= 0 || value >= 180) {
            throw new Error("Angle beta must be between 0 and 180 degrees");
        }
        this._beta = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get gamma() {
        return this._gamma;
    }
 
    set gamma(value) {
        if (value <= 0 || value >= 180) {
            throw new Error("Angle gamma must be between 0 and 180 degrees");
        }
        this._gamma = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
}

export class Atom{
    constructor(label, atomType, fractX, fractY, fractZ, adp=null, disorderGroup=0) {
        this.label = label;
        this.atomType = atomType;
        this.fractX = fractX;
        this.fractY = fractY;
        this.fractZ = fractZ;
        this.adp = adp;
        this.disorderGroup = disorderGroup;
    }

    static fromCIF(cifBlock, atomIndex=null, atomLabel=null) {
        const atomSite = cifBlock.get("_atom_site");
        const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
        
        let index = atomIndex;
        if (atomIndex === null && atomLabel) {
            index = labels.indexOf(atomLabel);
        } else if (!atomIndex === null) {
            throw new Error("either atomIndex or atomLabel need to be provided");
        }
        
        const label = labels[index];
        
        const adpType = atomSite.getIndex( 
                ['_atom_site.adp_type', '_atom_site_adp_type', 
                 '_atom_site.thermal_displace_type', '_atom_site_thermal_displace_type'],
                index,
                "Uiso"
            );
        
        let adp = null;
        if (adpType === "Uiso") {
            adp = new UIsoADP(
                atomSite.getIndex(['_atom_site.u_iso_or_equiv', '_atom_site_U_iso_or_equiv'], index)
            );
        } else if (adpType === "Uani") {
            const anisoSite = cifBlock.get("_atom_site_aniso");
            const anisoLabels = anisoSite.get(['_atom_site_aniso.label', '_atom_site_aniso_label']);
            const anisoIndex = anisoLabels.indexOf(label);
     
            adp = new UAnisoADP(
                anisoSite.getIndex(['_atom_site_aniso.u_11', '_atom_site_aniso_U_11'], anisoIndex),
                anisoSite.getIndex(['_atom_site_aniso.u_22', '_atom_site_aniso_U_22'], anisoIndex),
                anisoSite.getIndex(['_atom_site_aniso.u_33', '_atom_site_aniso_U_33'], anisoIndex),
                anisoSite.getIndex(['_atom_site_aniso.u_12', '_atom_site_aniso_U_12'], anisoIndex),
                anisoSite.getIndex(['_atom_site_aniso.u_13', '_atom_site_aniso_U_13'], anisoIndex),
                anisoSite.getIndex(['_atom_site_aniso.u_23', '_atom_site_aniso_U_23'], anisoIndex)
            );
        }
        
        const disorderGroup = atomSite.getIndex(
            ["_atom_site.disorder_group", "_atom_site_disorder_group"],
            index,
            "."
        );
        
        return new Atom(
            label,
            atomSite.getIndex(['_atom_site.type_symbol', '_atom_site_type_symbol'], index),
            atomSite.getIndex(['_atom_site.fract_x', '_atom_site_fract_x'], index),
            atomSite.getIndex(['_atom_site.fract_y', '_atom_site_fract_y'], index),
            atomSite.getIndex(['_atom_site.fract_z', '_atom_site_fract_z'], index),
            adp, 
            disorderGroup === "." ? 0 : disorderGroup
        );
    }
}


export class UIsoADP {
    constructor(uiso) {
        this.uiso = uiso;
    }
}

export class UAnisoADP {
    constructor(u11, u22, u33, u12, u13, u23) {
        this.u11 = u11;
        this.u22 = u22;
        this.u33 = u33;
        this.u12 = u12;
        this.u13 = u13;
        this.u23 = u23;
    }

    getUCart(unitCell) {
        return uCifToUCart(
            unitCell.fractToCartMatrix,
            [this.u11, this.u22, this.u33, this.u12, this.u13, this.u23]
        );
    }
}

export class Bond {
    constructor(atom1Label, atom2Label, bondLength=null, bondLengthSU=null, atom2SiteSymmetry=null) {
        this.atom1Label = atom1Label;
        this.atom2Label = atom2Label;
        this.bondLength = bondLength;
        this.bondLengthSU = bondLengthSU;
        this.atom2SiteSymmetry = atom2SiteSymmetry;
    }
    
    static fromCIF(cifBlock, bondIndex) {
        const bondLoop = cifBlock.get("_geom_bond");
 
        return new Bond(
            bondLoop.getIndex(["_geom_bond.atom_site_label_1", "_geom_bond_atom_site_label_1"], bondIndex),
            bondLoop.getIndex(["_geom_bond.atom_site_label_2", "_geom_bond_atom_site_label_2"], bondIndex),
            bondLoop.getIndex(["_geom_bond.distance", "_geom_bond_distance"], bondIndex),
            bondLoop.getIndex(["_geom_bond.distance_su", "_geom_bond_distance_su"], bondIndex, NaN),
            bondLoop.getIndex(["_geom_bond.site_symmetry_2", "_geom_bond_site_symmetry_2"], bondIndex, ".")
        );
    }
}

 export class HBond {
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
        acceptorAtomSymmetry
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
    
    static fromCIF(cifBlock, hBondIndex) {
        const hBondLoop = cifBlock.get("_geom_hbond");

        return new HBond(
            hBondLoop.getIndex(["_geom_hbond.atom_site_label_d", "_geom_hbond_atom_site_label_D"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.atom_site_label_h", "_geom_hbond_atom_site_label_H"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.atom_site_label_a", "_geom_hbond_atom_site_label_A"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.distance_dh", "_geom_hbond_distance_DH"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.distance_dh_su", "_geom_hbond_distance_DH_su"], hBondIndex, NaN),
            hBondLoop.getIndex(["_geom_hbond.distance_ha", "_geom_hbond_distance_HA"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.distance_ha_su", "_geom_hbond_distance_HA_su"], hBondIndex, NaN),
            hBondLoop.getIndex(["_geom_hbond.distance_da", "_geom_hbond_distance_DA"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.distance_da_su", "_geom_hbond_distance_DA_su"], hBondIndex, NaN),
            hBondLoop.getIndex(["_geom_hbond.angle_dha", "_geom_hbond_angle_DHA"], hBondIndex),
            hBondLoop.getIndex(["_geom_hbond.angle_dha_su", "_geom_hbond_angle_DHA_su"], hBondIndex, NaN),
            hBondLoop.getIndex(["_geom_hbond.site_symmetry_a", "_geom_hbond_site_symmetry_A"], hBondIndex, ".")
        );
    }
}