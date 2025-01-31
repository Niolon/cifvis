import { CrystalStructure, HBond, Bond } from './crystal.js';

/**
 * Base class for structure filters that implement mode-based behavior
 */
export class BaseFilter {
    /**
     * Creates a new filter
     * @param {Object.<string, string>} modes - Dictionary of valid modes
     * @param {string} defaultMode - Initial mode to use
     * @param {string} filterName - Name of the filter for error messages
     */
    constructor(modes, defaultMode, filterName, fallBackOrder=[]) {
        if (new.target === BaseFilter) {
            throw new TypeError('Cannot instantiate BaseFilter directly');
        }
        
        this.MODES = Object.freeze(modes);
        this.PREFERRED_FALLBACK_ORDER = Object.freeze(fallBackOrder)
        this.filterName = filterName;
        this._mode = null;
        this.setMode(defaultMode);
    }

    /**
     * Gets the current mode
     * @returns {string} Current mode
     */
    get mode() {
        return this._mode;
    }

    /**
     * Sets the current mode with validation
     * @param {string} value - New mode to set
     * @throws {Error} If mode is invalid
     */
    set mode(value) {
        this.setMode(value);
    }

    /**
     * Sets the filter mode with validation
     * @param {string} mode - Mode to set
     * @throws {Error} If mode is invalid
     */
    setMode(mode) {
        const usedMode = mode.toLowerCase().replace(/_/g, '-');
        const validModes = Object.values(this.MODES);
        if (!validModes.includes(usedMode)) {
            throw new Error(
                `Invalid ${this.filterName} mode: "${mode}". ` +
                `Valid modes are: ${validModes.join(', ')}`
            );
        }
        this._mode = usedMode;
    }

    ensureValidMode(structure) {
        const applicableModes = this.getApplicableModes(structure);
        if (!applicableModes.includes(this.mode)) {
            const oldMode = this.mode;
            this.mode = this.PREFERRED_FALLBACK_ORDER.find(mode => applicableModes.includes(mode)) || applicableModes[0];
            console.warn(`${this.filterName} mode ${oldMode} was not applicable, chaged to ${this.mode}`);
        }
    }

    /**
     * Abstract method: Applies the filter to a structure
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} Filtered structure
     * @throws {Error} If not implemented by subclass
     */
    apply(structure) {
        throw new Error('Method "apply" must be implemented by subclass');
    }

    /**
     * Abstract method: Gets modes applicable to the given structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {string[]} Array of applicable mode names
     * @throws {Error} If not implemented by subclass
     */
    getApplicableModes(structure) {
        throw new Error('Method "getApplicableModes" must be implemented by subclass');
    }

    /**
     * Cycles to the next applicable mode for the given structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {string} New mode after cycling
     */
    cycleMode(structure) {
        const modes = this.getApplicableModes(structure);
        
        this.ensureValidMode(structure);

        const currentIndex = modes.indexOf(this._mode);
        this._mode = modes[(currentIndex + 1) % modes.length];
        return this._mode;
    }
}

/**
 * Filters atoms, bonds, and H-bonds involving hydrogen atoms from a structure.
 * Supports displaying no hydrogens, hydrogens without ADPs, or hydrogens with anisotropic ADPs.
 * @extends BaseFilter
 */
export class HydrogenFilter extends BaseFilter {
    static MODES = Object.freeze({
        NONE: 'none',
        CONSTANT: 'constant',
        ANISOTROPIC: 'anisotropic'
    });

    static PREFERRED_FALLBACK_ORDER = [
        HydrogenFilter.MODES.ANISOTROPIC,
        HydrogenFilter.MODES.CONSTANT,
        HydrogenFilter.MODES.NONE
    ];

    /**
     * Creates a new hydrogen filter
     * @param {HydrogenFilter.MODES} [mode=HydrogenFilter.MODES.NONE] - Initial filter mode
     */
    constructor(mode = HydrogenFilter.MODES.NONE) {
        super(HydrogenFilter.MODES, mode, 'HydrogenFilter', HydrogenFilter.PREFERRED_FALLBACK_ORDER);
    }

    /**
     * Applies hydrogen filtering according to current mode
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with filtered hydrogens
     */
    apply(structure) {
        this.ensureValidMode(structure);

        const filteredAtoms = structure.atoms
            .filter(atom => atom.atomType !== 'H' || this.mode !== HydrogenFilter.MODES.NONE)
            .map(atom => ({
                ...atom,
                adp: atom.atomType === 'H' && this.mode === HydrogenFilter.MODES.CONSTANT ? 
                    null : atom.adp
            }));

        const filteredBonds = structure.bonds
            .filter(bond => {
                if (this.mode === HydrogenFilter.MODES.NONE) {
                    const atom1 = structure.getAtomByLabel(bond.atom1Label);
                    const atom2 = structure.getAtomByLabel(bond.atom2Label);
                    return !(atom1.atomType === 'H' || atom2.atomType === 'H');
                }
                return true;
            })
            .map(bond => ({ ...bond }));

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

    /**
     * Gets applicable modes based on presence of hydrogens and their ADPs
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
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
}

/**
 * Filters atoms, bonds, and h-bonds based on their disorder groups.
 * Can show all atoms, only disorder group 1, or only disorder groups > 1.
 * @extends BaseFilter
 */
export class DisorderFilter extends BaseFilter {
    static MODES = Object.freeze({
        ALL: 'all',
        GROUP1: 'group1',
        GROUP2: 'group2'
    });

    static PREFERRED_FALLBACK_ORDER = [
        DisorderFilter.MODES.ALL,
        DisorderFilter.MODES.GROUP1,
        DisorderFilter.MODES.GROUP2
    ]                

    /**
     * Creates a new disorder filter
     * @param {DisorderFilter.MODES} [mode=DisorderFilter.MODES.ALL] - Initial filter mode
     */
    constructor(mode = DisorderFilter.MODES.ALL) {
        super(DisorderFilter.MODES, mode, 'DisorderFilter', DisorderFilter.PREFERRED_FALLBACK_ORDER);
    }

    /**
     * Applies disorder filtering according to current mode
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with filtered disorder groups
     */
    apply(structure) {
        this.ensureValidMode(structure);

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
                (donor.disorderGroup > 1 || hydrogen.disorderGroup > 1 || 
                 acceptor.disorderGroup > 1)) {
                return false;
            }

            if (this.mode === DisorderFilter.MODES.GROUP2 && 
                (donor.disorderGroup === 1 || hydrogen.disorderGroup === 1 || 
                 acceptor.disorderGroup === 1)) {
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

    /**
     * Gets applicable modes based on presence of disorder groups
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const modes = [DisorderFilter.MODES.ALL];
        const hasDisorder = structure.atoms.some(atom => atom.disorderGroup > 0);
        
        if (!hasDisorder) return modes;
        
        if (structure.atoms.some(atom => atom.disorderGroup === 1)) {
            modes.push(DisorderFilter.MODES.GROUP1);
        } 
        if (structure.atoms.some(atom => atom.disorderGroup > 1)) {
            modes.push(DisorderFilter.MODES.GROUP2);
        }
        
        return modes;
    }
}

/**
 * Grows a crystal structure by applying symmetry operations to create symmetry-equivalent atoms and bonds. 
 * Can selectively grow based on regular bonds and/or hydrogen bonds.
 * @extends BaseFilter
 */
export class SymmetryGrower extends BaseFilter {
    static MODES = Object.freeze({
        BONDS_YES_HBONDS_YES: 'bonds-yes-hbonds-yes',
        BONDS_YES_HBONDS_NO: 'bonds-yes-hbonds-no',
        BONDS_YES_HBONDS_NONE: 'bonds-yes-hbonds-none',
        BONDS_NO_HBONDS_YES: 'bonds-no-hbonds-yes',
        BONDS_NO_HBONDS_NO: 'bonds-no-hbonds-no',
        BONDS_NO_HBONDS_NONE: 'bonds-no-hbonds-none',
        BONDS_NONE_HBONDS_YES: 'bonds-none-hbonds-yes',
        BONDS_NONE_HBONDS_NO: 'bonds-none-hbonds-no',
        BONDS_NONE_HBONDS_NONE: 'bonds-none-hbonds-none'
    });

    static PREFERRED_FALLBACK_ORDER = [
        SymmetryGrower.MODES.BONDS_NO_HBONDS_NO,
        SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE,
        SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO
    ];

    /**
     * Creates a new symmetry grower
     * @param {SymmetryGrower.MODES} [mode=SymmetryGrower.MODES.BONDS_NO_HBONDS_NO] - Initial mode for growing symmetry 
     */
    constructor(mode = SymmetryGrower.MODES.BONDS_NO_HBONDS_NO) {
        super(SymmetryGrower.MODES, mode, 'SymmetryGrower', SymmetryGrower.PREFERRED_FALLBACK_ORDER);
    }

    /**
     * Combines an atom label with a symmetry operation code to create a unique identifier
     * @param {string} atomLabel - Original atom label
     * @param {string} symOp - Symmetry operation code (e.g., "2_555")
     * @returns {string} Combined label or original label if no symmetry operation
     */
    static combineSymOpLabel(atomLabel, symOp) {
        return (!symOp || symOp === ".") ? atomLabel : `${atomLabel}@${symOp}`;
    }

    /**
     * Finds atoms that can be grown through symmetry operations
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {GrowableAtoms} Atoms that can be grown through bonds and hydrogen bonds
     */
    findGrowableAtoms(structure) {
        const bondAtoms = structure.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry && atom2SiteSymmetry !== ".")
            .map(({ atom2Label, atom2SiteSymmetry }) => [atom2Label, atom2SiteSymmetry]);

        const hBondAtoms = structure.hBonds
            .filter(({ acceptorAtomSymmetry }) => 
                acceptorAtomSymmetry && acceptorAtomSymmetry !== "."
            )
            .map(({ acceptorAtomLabel, acceptorAtomSymmetry }) => 
                [acceptorAtomLabel, acceptorAtomSymmetry]
            );

        return { bondAtoms, hBondAtoms };
    }

    /**
     * Grows a set of atoms and their connected groups using symmetry operations
     * @param {CrystalStructure} structure - Original structure containing atoms to grow
     * @param {Array<[string, string]>} atomsToGrow - Array of [atomLabel, symmetryOperation] pairs
     * @param {GrowthState} growthState - Current state of structure growth
     * @returns {GrowthState} Updated growth state including new atoms and bonds 
     * @throws {Error} If an atom is not found in any connected group
     */
    growAtomArray(structure, atomsToGrow, growthState) {
        for (const [atomLabel, symOp] of atomsToGrow) {
            const newLabel = SymmetryGrower.combineSymOpLabel(atomLabel, symOp);
            if (growthState.labels.has(newLabel)) continue;

            const group = structure.connectedGroups.find(group => 
                group.atoms.some(atom => atom.label === atomLabel)
            );

            if (!group) {
                throw new Error(`Atom ${atomLabel} is not in any group. Typo or structure.recalculateConnectedGroups()?`)
            }
            
            const symmetryAtoms = structure.symmetry.applySymmetry(symOp, group.atoms);
            symmetryAtoms.forEach(atom => {
                atom.label = SymmetryGrower.combineSymOpLabel(atom.label, symOp);
                growthState.labels.add(atom.label);
                growthState.atoms.add(atom);
            });

            group.bonds
                .filter(({atom2SiteSymmetry}) => atom2SiteSymmetry === ".")
                .forEach(bond => {
                    growthState.bonds.add(new Bond(
                        SymmetryGrower.combineSymOpLabel(bond.atom1Label, symOp),
                        SymmetryGrower.combineSymOpLabel(bond.atom2Label, symOp),
                        bond.bondLength,
                        bond.bondLengthSU,
                        "."
                    ));
                });

            group.hBonds
                .filter(({acceptorAtomSymmetry}) => acceptorAtomSymmetry === ".")
                .forEach(hBond => {
                    growthState.hBonds.add(new HBond(
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
                    ));
                });
        }
        return growthState;
    }
    /**
     * Grows the structure according to the current mode. Switches mode with a warning if 
     * current mode is not applicable.
     * @param {CrystalStructure} structure - Structure to grow
     * @returns {CrystalStructure} New structure with grown atoms and bonds
     */
    apply(structure) {
        this.ensureValidMode(structure);

        const growableAtoms = this.findGrowableAtoms(structure);
        
        const growthState = {
            atoms: new Set(structure.atoms),
            bonds: new Set(structure.bonds),
            hBonds: new Set(structure.hBonds),
            labels: new Set()
        };

        if (this.mode.startsWith("bonds-yes")) {
            this.growAtomArray(structure, growableAtoms.bondAtoms, growthState);
        }

        if (this.mode.includes("hbonds-yes")) {
            this.growAtomArray(structure, growableAtoms.hBondAtoms, growthState);
        }

        const atomArray = Array.from(growthState.atoms);

        for (const bond of structure.bonds) {
            if (bond.atom2SiteSymmetry === ".") continue;
            const symmLabel = SymmetryGrower.combineSymOpLabel(bond.atom2Label, bond.atom2SiteSymmetry);
            if (atomArray.some(a => a.label === symmLabel)) {
                growthState.bonds.add(
                    new Bond(bond.atom1Label, symmLabel, bond.bondLength, bond.bondLengthSU, ".")
                );
            }
        }
        for (const hBond of structure.hBonds) {
            if (hBond.acceptorAtomSymmetry === ".") continue;
            const symmLabel = SymmetryGrower.combineSymOpLabel(hBond.acceptorAtomLabel, hBond.acceptorAtomSymmetry);
            if (atomArray.some(a => a.label === symmLabel)) {
                growthState.hBonds.add(
                    new HBond(
                        hBond.donorAtomLabel, hBond.hydrogenAtomLabel, symmLabel, hBond.donorHydrogenDistance,
                        hBond.donorHydrogenDistanceSU, hBond.acceptorHydrogenDistance, hBond.acceptorHydrogenDistanceSU,
                        hBond.donorAcceptorDistance, hBond.donorAcceptorDistanceSU, hBond.hBondAngle, hBond.hBondAngleSU, 
                        "."
                    )
                );
            }
        }

        return new CrystalStructure(
            structure.cell,
            atomArray,
            Array.from(growthState.bonds),
            Array.from(growthState.hBonds),
            structure.symmetry
        );
    }
    /**
     * Gets the modes that can be applied to the structure based on content
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
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
            SymmetryGrower.MODES.BONDS_NO_HBONDS_YES,
            SymmetryGrower.MODES.BONDS_NO_HBONDS_NO
        ];
    }
}