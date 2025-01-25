import { CrystalStructure, HBond, Bond } from './crystal.js';

export class HydrogenFilter {
    static label = "hydrogenfilter"
    static MODES = {
        NONE: 'none',
        CONSTANT: 'constant',
        ANISOTROPIC: 'anisotropic'
    };

    static get lowerModeMap() {
        return Object.entries(this.MODES).reduce((map, [key, value]) => {
            map[value] = this.MODES[key];
            return map;
        }, {});
    }

    constructor(mode = HydrogenFilter.MODES.NONE) {
        this.setMode(mode);
    }

    setMode(mode) {
        if (typeof mode === 'string') {
            const upperMode = mode.toUpperCase();
            if (upperMode in HydrogenFilter.MODES) {
                this.mode = HydrogenFilter.MODES[upperMode];
                return;
            }
            if (mode in HydrogenFilter.lowerModeMap) {
                this.mode = HydrogenFilter.lowerModeMap[mode];
                return;
            }
            throw new Error(`Unknown hydrogen mode: ${mode}. Valid modes are: ${Object.values(HydrogenFilter.MODES).join(', ')}`);
        }
        this.mode = mode;
    }

    apply(structure) {
        if (!this.getApplicableModes(structure).includes(this.mode)){
            const applicableModes = this.getApplicableModes(structure);
            const oldMode = this.mode;
            for (const mode of [HydrogenFilter.MODES.ANISOTROPIC, HydrogenFilter.MODES.CONSTANT, HydrogenFilter.MODES.NONE]) {
                if (applicableModes.includes(mode)) {
                    this.mode = mode;
                    break;
                }
            }
            
            console.warn(`Set hydrogen filter mode ${oldMode} is not applicable to structure. Changed it to ${this.mode}`);
        }
        const filteredAtoms = structure.atoms
            .filter(atom => {
                if (atom.atomType !== 'H') return true;
                return this.mode !== HydrogenFilter.MODES.NONE;
            })
            .map(atom => {
                const newAtom = { ...atom };
                if (atom.atomType === 'H' && this.mode === HydrogenFilter.MODES.CONSTANT) {
                    newAtom.adp = null;
                }
                return newAtom;
            });

        const filteredBonds = structure.bonds.filter(bond => {
            if (this.mode === HydrogenFilter.MODES.NONE) {
                const atom1 = structure.getAtomByLabel(bond.atom1Label);
                const atom2 = structure.getAtomByLabel(bond.atom2Label);
                return !(atom1.atomType === 'H' || atom2.atomType === 'H');
            }
            return true;
        }).map(bond => ({ ...bond }));

        const filteredHBonds = this.mode === HydrogenFilter.MODES.NONE ? 
            [] : structure.hBonds.map(hbond => ({ ...hbond }));

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry
        );
    }

    getApplicableModes(structure) {
        const modes = [HydrogenFilter.MODES.NONE];
        const hasHydrogens = structure.atoms.some(atom => atom.atomType === 'H');
        
        if (!hasHydrogens) return modes;
        
        modes.push(HydrogenFilter.MODES.CONSTANT);
        
        const hasAnisoHydrogens = structure.atoms.some(atom => 
            atom.atomType === 'H' && atom.adp?.constructor.name === 'UAnisoADP'
        );
        
        if (hasAnisoHydrogens) {
            modes.push(HydrogenFilter.MODES.ANISOTROPIC);
        }
        return modes;
    }

    cycleMode(structure) {
        const modes = this.getApplicableModes(structure);
        const currentIndex = modes.indexOf(this.mode);
        this.mode = modes[(currentIndex + 1) % modes.length];
        return this.mode;
    }
}

export class DisorderFilter {
    static label = "disorderfilter"
    static MODES = {
        ALL: 'all',
        GROUP1: 'group1',
        GROUP2: 'group2'
    };

    static get lowerModeMap() {
        return Object.entries(this.MODES).reduce((map, [key, value]) => {
            map[value] = this.MODES[key];
            return map;
        }, {});
    }

    constructor(mode = DisorderFilter.MODES.ALL) {
        this.setMode(mode);
    }

    setMode(mode) {
        if (typeof mode === 'string') {
            const upperMode = mode.toUpperCase();
            if (upperMode in DisorderFilter.MODES) {
                this.mode = DisorderFilter.MODES[upperMode];
                return;
            }
            if (mode in DisorderFilter.lowerModeMap) {
                this.mode = DisorderFilter.lowerModeMap[mode];
                return;
            }
            throw new Error(`Unknown disorder mode: ${mode}. Valid modes are: ${Object.values(DisorderFilter.MODES).join(', ')}`);
        }
        this.mode = mode;
    }

    apply(structure) {
        if (!this.getApplicableModes(structure).includes(this.mode)) {
            const applicableModes = this.getApplicableModes(structure);
            const oldMode = this.mode;
            this.mode = applicableModes.find(mode => [
                DisorderFilter.MODES.ALL,
                DisorderFilter.MODES.GROUP1,
                DisorderFilter.MODES.GROUP2
            ].includes(mode)) || applicableModes[0];
            console.warn(`Disorder filter mode ${oldMode} not applicable, changed to ${this.mode}`);
        }
        const filteredAtoms = structure.atoms.filter(atom => {
            if (this.mode === DisorderFilter.MODES.GROUP1 && atom.disorderGroup > 1) return false;
            if (this.mode === DisorderFilter.MODES.GROUP2 && atom.disorderGroup === 1) return false;
            return true;
        });

        const filteredBonds = structure.bonds.filter(bond => {
            const atom1 = structure.getAtomByLabel(bond.atom1Label);
            const atom2 = structure.getAtomByLabel(bond.atom2Label);
            
            if (this.mode === DisorderFilter.MODES.GROUP1 && 
                (atom1.disorderGroup > 1 || atom2.disorderGroup > 1)) return false;
            
            if (this.mode === DisorderFilter.MODES.GROUP2 && 
                (atom1.disorderGroup === 1 || atom2.disorderGroup === 1)) return false;
            
            return true;
        });

        const filteredHBonds = structure.hBonds.filter(hbond => {
            const donor = structure.getAtomByLabel(hbond.donorAtomLabel);
            const hydrogen = structure.getAtomByLabel(hbond.hydrogenAtomLabel);
            const acceptor = structure.getAtomByLabel(hbond.acceptorAtomLabel);

            if (this.mode === DisorderFilter.MODES.GROUP1 && 
                (donor.disorderGroup > 1 || hydrogen.disorderGroup > 1 || acceptor.disorderGroup > 1)) {
                return false;
            }

            if (this.mode === DisorderFilter.MODES.GROUP2 && 
                (donor.disorderGroup === 1 || hydrogen.disorderGroup === 1 || acceptor.disorderGroup === 1)) {
                return false;
            }

            return true;
        });

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry
        );
    }

    getApplicableModes(structure) {
        const modes = [DisorderFilter.MODES.ALL];
        const hasDisorder = structure.atoms.some(atom => atom.disorderGroup > 0);
        
        if (!hasDisorder) return modes;
        
        const hasGroup1 = structure.atoms.some(atom => atom.disorderGroup === 1);
        const hasGroup2Plus = structure.atoms.some(atom => atom.disorderGroup > 1);
        
        if (hasGroup1 && hasGroup2Plus) {
            modes.push(DisorderFilter.MODES.GROUP1, DisorderFilter.MODES.GROUP2);
        } else if (hasGroup1) {
            modes.push(DisorderFilter.MODES.GROUP1);
        } else if (hasGroup2Plus) {
            modes.push(DisorderFilter.MODES.GROUP2);
        }
        
        return modes;
    }

    cycleMode(structure) {
        const modes = this.getApplicableModes(structure);
        const currentIndex = modes.indexOf(this.mode);
        this.mode = modes[(currentIndex + 1) % modes.length];
        return this.mode;
    }
}

export class SymmetryGrower {
    static MODES = {
        BONDS_YES_HBONDS_YES: 'bonds-yes-hbonds-yes',
        BONDS_YES_HBONDS_NO: 'bonds-yes-hbonds-no',
        BONDS_NO_HBONDS_NO: 'bonds-no-hbonds-no',
        BONDS_NONE_HBONDS_YES: 'bonds-none-hbonds-yes',
        BONDS_NONE_HBONDS_NO: 'bonds-none-hbonds-no',
        BONDS_YES_HBONDS_NONE: 'bonds-yes-hbonds-none',
        BONDS_NO_HBONDS_NONE: 'bonds-no-hbonds-none',
        BONDS_NONE_HBONDS_NONE: 'bonds-none-hbonds-none'
    };

    constructor(mode = SymmetryGrower.MODES.BONDS_NO_HBONDS_NO) {
        this.mode = mode;
    }

    setMode(mode) {
        if (!Object.values(SymmetryGrower.MODES).includes(mode)) {
            throw new Error(`Invalid growth mode: ${mode}`);
        }
        this.mode = mode;
    }

    findGrowableAtoms(structure) {
        const bondAtoms = structure.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry && atom2SiteSymmetry !== ".")
            .map(({ atom2Label, atom2SiteSymmetry }) => [atom2Label, atom2SiteSymmetry]);

        const hBondAtoms = structure.hBonds
            .filter(({ acceptorAtomSymmetry }) => acceptorAtomSymmetry && acceptorAtomSymmetry !== ".")
            .map(({ acceptorAtomLabel, acceptorAtomSymmetry }) => [acceptorAtomLabel, acceptorAtomSymmetry]);
        return {bondAtoms: bondAtoms, hBondAtoms: hBondAtoms};
    }

    static combineSymOpLabel(atomLabel, symOp) {
        if (!symOp || symOp == ".") {
            return atomLabel;
        }
        return atomLabel + "@" + symOp;
    }

    growAtomArray(structure, atomsToGrow) {
        const connectedGroups = structure.connectedGroups;
        for (const [atomLabel, symOp] of atomsToGrow) {
            const newLabel = SymmetryGrower.combineSymOpLabel(atomLabel, symOp);
            // if an atom has already been added, the whole group has already been added
            if (this.grownAtomLabels.has(newLabel)) return;

            let group;
            for (const connectedGroup of connectedGroups) {
                const atomLabels = connectedGroup.atoms.map(atom => atom.label);
                if (atomLabels.includes(atomLabel)) {
                    group = connectedGroup;
                    break;
                }
            }

            // add atoms within group
            const symmetryAtoms = structure.symmetry.applySymmetry(symOp, group.atoms);
            symmetryAtoms.forEach(atom => {
                atom.label = SymmetryGrower.combineSymOpLabel(atom.label, symOp);
                this.grownAtomLabels.add(atom.label);
                this.grownAtoms.add(atom);
            })

            // add bonds
            group.bonds.forEach(bond => {
                this.grownBonds.add(
                    new Bond(
                        SymmetryGrower.combineSymOpLabel(bond.atom1Label, symOp),
                        SymmetryGrower.combineSymOpLabel(bond.atom2Label, symOp),
                        bond.bondLength,
                        bond.bondLengthSU,
                        "."
                    )
                )
            });

            // add hydrogen Bonds
            group.hBonds.forEach(hBond => {
                this.grownHBonds.add(
                    new HBond(
                        SymmetryGrower.combineSymOpLabel(hBond.donorAtomLabel, symOp),
                        SymmetryGrower.combineSymOpLabel(hBond.hydrogenAtomLabel, symOp),
                        SymmetryGrower.combineSymOpLabel(hBond.acceptorAtomLabel, symOp),
                        hBond.donorHydrogenDistance,
                        hBond.donorHydrogenDistanceSU,
                        hBond.acceptorHydrogenDistance,
                        hBond.acceptorHydrogenDistanceSU,
                        hBond.donorAcceptorDistance,
                        hBond.donorAcceptorDistanceSU,
                        hBond.hBondAngle,
                        hBond.hBondAngleSU,
                        "."
                    )
                );
            });

        }
    }

    apply(structure) {
        if (!this.getApplicableModes(structure).includes(this.mode)) {
            const applicableModes = this.getApplicableModes(structure);
            const oldMode = this.mode;
            this.mode = applicableModes.find(mode => [
                SymmetryGrower.MODES.BONDS_NO_HBONDS_NO,
                SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE,
                SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO
            ].includes(mode)) || applicableModes[0];
            console.warn(`Mode ${oldMode} not applicable, changed to ${this.mode}`);
        }

        const growableAtoms = this.findGrowableAtoms(structure);
        
        this.grownAtoms = new Set(structure.atoms);
        this.grownBonds = new Set(structure.bonds);
        this.grownHBonds = new Set(structure.hBonds);
        this.grownAtomLabels = new Set(); // original label + "@"" + symOp -> new label

        if (this.mode.startsWith("bonds-yes")) {
            this.growAtomArray(structure, growableAtoms.bondAtoms);
        }

        if (this.mode.includes("hbonds-yes")) {
            this.growAtomArray(structure, growableAtoms.hBondAtoms);
        }

        return new CrystalStructure(
            structure.cell,
            Array.from(this.grownAtoms),
            Array.from(this.grownBonds),
            Array.from(this.grownHBonds),
            structure.symmetry
        );
    }

    getApplicableModes(structure) {
        const growableAtoms = this.findGrowableAtoms(structure);
        const hasGrowableBonds = growableAtoms.bondAtoms.length > 0;
        const hasGrowableHBonds = growableAtoms.hBondAtoms.length > 0;

        if (!hasGrowableBonds && !hasGrowableHBonds) {
            return [SymmetryGrower.MODES.BONDS_NONE_HBONDS_NONE];
        }

        if (!hasGrowableBonds) {
            return [
                SymmetryGrower.MODES.BONDS_NONE_HBONDS_YES,
                SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO
            ];
        }

        if (!hasGrowableHBonds) {
            return [
                SymmetryGrower.MODES.BONDS_YES_HBONDS_NONE,
                SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE
            ];
        }

        return [
            SymmetryGrower.MODES.BONDS_YES_HBONDS_YES,
            SymmetryGrower.MODES.BONDS_YES_HBONDS_NO,
            SymmetryGrower.MODES.BONDS_NO_HBONDS_NO
        ];
    }

    cycleMode(structure) {
        const modes = this.getApplicableModes(structure);
        const currentIndex = modes.indexOf(this.mode);
        this.mode = modes[(currentIndex + 1) % modes.length];
        return this.mode;
    }
}