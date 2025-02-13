import { CrystalStructure, HBond, Bond, Atom, inferElementFromLabel } from './crystal.js';
import { create, all } from 'mathjs';
const math = create(all);

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
        this.PREFERRED_FALLBACK_ORDER = Object.freeze(fallBackOrder);
        this.filterName = filterName;
        this._mode = null;
        this.setMode(defaultMode);
    }

    get requiresCameraUpdate() {
        return false;
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
                `Valid modes are: ${validModes.join(', ')}`,
            );
        }
        this._mode = usedMode;
    }

    ensureValidMode(structure) {
        const validModes = this.getApplicableModes(structure);
        if (!validModes.includes(this.mode)) {
            const oldMode = this.mode;
            this.mode = this.PREFERRED_FALLBACK_ORDER.find( mode => validModes.includes(mode)) || validModes[0];
            console.warn(`${this.filterName} mode ${oldMode} was not applicable, chaged to ${this.mode}`);
        }
    }

    /**
     * Abstract method: Applies the filter to a structure
     * @abstract
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} Filtered structure
     * @throws {Error} If not implemented by subclass
     */
    apply(_structure) {
        throw new Error('Method "apply" must be implemented by subclass');
    }

    /**
     * Abstract method: Gets modes applicable to the given structure
     * @abstract
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {string[]} Array of applicable mode names
     * @throws {Error} If not implemented by subclass
     */
    getApplicableModes(_structure) {
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
        ANISOTROPIC: 'anisotropic',
    });

    static PREFERRED_FALLBACK_ORDER = [
        HydrogenFilter.MODES.ANISOTROPIC,
        HydrogenFilter.MODES.CONSTANT,
        HydrogenFilter.MODES.NONE,
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
            .map(atom => (new Atom(
                atom.label,
                atom.atomType,
                atom.position,
                atom.atomType === 'H' && this.mode === HydrogenFilter.MODES.CONSTANT ? 
                    null : atom.adp,
                atom.disorderGroup,
            )));

        const filteredBonds = structure.bonds
            .filter(bond => {
                if (this.mode === HydrogenFilter.MODES.NONE) {
                    const atom1 = structure.getAtomByLabel(bond.atom1Label);
                    const atom2 = structure.getAtomByLabel(bond.atom2Label);
                    return !(atom1.atomType === 'H' || atom2.atomType === 'H');
                }
                return true;
            });
            
        const filteredHBonds = this.mode === HydrogenFilter.MODES.NONE ? 
            [] : structure.hBonds;

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry,
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
        
        if (!hasHydrogens) {
            return modes; 
        }
        
        modes.push(HydrogenFilter.MODES.CONSTANT);
        
        const hasAnisoHydrogens = structure.atoms.some(atom => 
            atom.atomType === 'H' && atom.adp?.constructor.name === 'UAnisoADP',
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
        GROUP2: 'group2',
    });

    static PREFERRED_FALLBACK_ORDER = [
        DisorderFilter.MODES.ALL,
        DisorderFilter.MODES.GROUP1,
        DisorderFilter.MODES.GROUP2,
    ];                

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
            if (this.mode === DisorderFilter.MODES.GROUP1 && atom.disorderGroup > 1) {
                return false; 
            }
            if (this.mode === DisorderFilter.MODES.GROUP2 && atom.disorderGroup === 1) {
                return false; 
            }
            return true;
        });

        const filteredBonds = structure.bonds.filter(bond => {
            const atom1 = structure.getAtomByLabel(bond.atom1Label);
            const atom2 = structure.getAtomByLabel(bond.atom2Label);
            
            if (this.mode === DisorderFilter.MODES.GROUP1 && 
                (atom1.disorderGroup > 1 || atom2.disorderGroup > 1)) {
                return false; 
            }
            
            if (this.mode === DisorderFilter.MODES.GROUP2 && 
                (atom1.disorderGroup === 1 || atom2.disorderGroup === 1)) {
                return false; 
            }
            
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
            structure.symmetry,
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
        
        if (!hasDisorder) {
            return modes; 
        }
        
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
        BONDS_NONE_HBONDS_NONE: 'bonds-none-hbonds-none',
    });

    static PREFERRED_FALLBACK_ORDER = [
        SymmetryGrower.MODES.BONDS_NO_HBONDS_NO,
        SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE,
        SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO,
    ];

    /**
     * Creates a new symmetry grower
     * @param {SymmetryGrower.MODES} [mode=SymmetryGrower.MODES.BONDS_NO_HBONDS_NO] - Initial mode for growing symmetry 
     */
    constructor(mode = SymmetryGrower.MODES.BONDS_NO_HBONDS_NO) {
        super(SymmetryGrower.MODES, mode, 'SymmetryGrower', SymmetryGrower.PREFERRED_FALLBACK_ORDER);
    }

    get requiresCameraUpdate() {
        return true;
    }

    /**
     * Combines an atom label with a symmetry operation code to create a unique identifier
     * @param {string} atomLabel - Original atom label
     * @param {string} symOp - Symmetry operation code (e.g., "2_555")
     * @returns {string} Combined label or original label if no symmetry operation
     */
    static combineSymOpLabel(atomLabel, symOp) {
        return (!symOp || symOp === '.') ? atomLabel : `${atomLabel}@${symOp}`;
    }

    /**
     * Finds atoms that can be grown through symmetry operations
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {GrowableAtoms} Atoms that can be grown through bonds and hydrogen bonds
     */
    findGrowableAtoms(structure) {
        const bondAtoms = structure.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry && atom2SiteSymmetry !== '.')
            .map(({ atom2Label, atom2SiteSymmetry }) => [atom2Label, atom2SiteSymmetry]);

        const hBondAtoms = structure.hBonds
            .filter(({ acceptorAtomSymmetry }) => 
                acceptorAtomSymmetry && acceptorAtomSymmetry !== '.',
            )
            .map(({ acceptorAtomLabel, acceptorAtomSymmetry }) => 
                [acceptorAtomLabel, acceptorAtomSymmetry],
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
            if (growthState.labels.has(newLabel)) {
                continue; 
            }

            const group = structure.connectedGroups.find(group => 
                group.atoms.some(atom => atom.label === atomLabel),
            );

            if (!group) {
                throw new Error(
                    `Atom ${atomLabel} is not in any group. Typo or structure.recalculateConnectedGroups()?`,
                );
            }
            
            const symmetryAtoms = structure.symmetry.applySymmetry(symOp, group.atoms);
            symmetryAtoms.forEach(atom => {
                atom.label = SymmetryGrower.combineSymOpLabel(atom.label, symOp);
                growthState.labels.add(atom.label);
                growthState.atoms.add(atom);
            });

            group.bonds
                .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry === '.')
                .forEach(bond => {
                    growthState.bonds.add(new Bond(
                        SymmetryGrower.combineSymOpLabel(bond.atom1Label, symOp),
                        SymmetryGrower.combineSymOpLabel(bond.atom2Label, symOp),
                        bond.bondLength,
                        bond.bondLengthSU,
                        '.',
                    ));
                });

            group.hBonds
                .filter(({ acceptorAtomSymmetry }) => acceptorAtomSymmetry === '.')
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
                        '.',
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
            labels: new Set(structure.atoms.map(({ label }) => label)),
        };

        if (this.mode.startsWith('bonds-yes')) {
            this.growAtomArray(structure, growableAtoms.bondAtoms, growthState);
        }

        if (this.mode.includes('hbonds-yes')) {
            this.growAtomArray(structure, growableAtoms.hBondAtoms, growthState);
        }

        const atomArray = Array.from(growthState.atoms);

        for (const bond of structure.bonds) {
            if (bond.atom2SiteSymmetry === '.') {
                continue; 
            }
            const symmLabel = SymmetryGrower.combineSymOpLabel(bond.atom2Label, bond.atom2SiteSymmetry);
            if (atomArray.some(a => a.label === symmLabel)) {
                growthState.bonds.add(
                    new Bond(bond.atom1Label, symmLabel, bond.bondLength, bond.bondLengthSU, '.'),
                );
            }
        }
        for (const hBond of structure.hBonds) {
            if (hBond.acceptorAtomSymmetry === '.') {
                continue; 
            }
            const symmLabel = SymmetryGrower.combineSymOpLabel(hBond.acceptorAtomLabel, hBond.acceptorAtomSymmetry);
            if (atomArray.some(a => a.label === symmLabel)) {
                growthState.hBonds.add(
                    new HBond(
                        hBond.donorAtomLabel, hBond.hydrogenAtomLabel, symmLabel,
                        hBond.donorHydrogenDistance, hBond.donorHydrogenDistanceSU, 
                        hBond.acceptorHydrogenDistance, hBond.acceptorHydrogenDistanceSU,
                        hBond.donorAcceptorDistance, hBond.donorAcceptorDistanceSU, 
                        hBond.hBondAngle, hBond.hBondAngleSU, 
                        '.',
                    ),
                );
            }
        }

        const hbondArray = Array.from(growthState.hBonds)
            .filter(({ acceptorAtomLabel, hydrogenAtomLabel, donorAtomLabel }) => {
                const condition1 = growthState.labels.has(acceptorAtomLabel);
                const condition2 = growthState.labels.has(hydrogenAtomLabel);
                const condition3 = growthState.labels.has(donorAtomLabel);
                return condition1 && condition2 && condition3;
            });

        return new CrystalStructure(
            structure.cell,
            atomArray,
            Array.from(growthState.bonds),
            hbondArray,
            structure.symmetry,
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
                SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO,
            ];
        }

        if (!hasGrowableHBonds) {
            return [
                SymmetryGrower.MODES.BONDS_YES_HBONDS_NONE,
                SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE,
            ];
        }

        return [
            SymmetryGrower.MODES.BONDS_YES_HBONDS_YES,
            SymmetryGrower.MODES.BONDS_YES_HBONDS_NO,
            SymmetryGrower.MODES.BONDS_NO_HBONDS_YES,
            SymmetryGrower.MODES.BONDS_NO_HBONDS_NO,
        ];
    }
}

/**
 * Filter that removes specified atoms and their connected bonds from a structure
 * @extends BaseFilter
 */
export class AtomLabelFilter extends BaseFilter {
    static MODES = Object.freeze({
        ON: 'on',
        OFF: 'off',
    });

    /**
     * Creates a new atom label filter
     * @param {string[]} [filteredLabels=[]] - Array of atom labels to filter
     * @param {AtomLabelFilter.MODES} [mode=AtomLabelFilter.MODES.OFF] - Initial filter mode
     */
    constructor(filteredLabels = [], mode = AtomLabelFilter.MODES.OFF) {
        super(AtomLabelFilter.MODES, mode, 'AtomLabelFilter', []);
        this.filteredLabels = new Set(filteredLabels);
    }

    /**
     * Updates the list of filtered atom labels
     * @param {string[]} labels - New array of atom labels to filter
     */
    setFilteredLabels(labels) {
        this.filteredLabels = new Set(labels);
    }

    /**
     * Applies the filter to a structure, removing specified atoms and their bonds
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with atoms removed if filter is on
     */
    apply(structure) {
        if (this.mode === AtomLabelFilter.MODES.OFF) {
            return structure;
        }

        const filteredAtoms = structure.atoms.filter(atom => 
            !this.filteredLabels.has(atom.label),
        );

        const filteredBonds = structure.bonds.filter(bond => 
            !this.filteredLabels.has(bond.atom1Label) && 
            !this.filteredLabels.has(bond.atom2Label),
        );

        const filteredHBonds = structure.hBonds.filter(hBond => 
            !this.filteredLabels.has(hBond.donorAtomLabel) &&
            !this.filteredLabels.has(hBond.hydrogenAtomLabel) &&
            !this.filteredLabels.has(hBond.acceptorAtomLabel),
        );

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes - both modes are always available
     * @returns {Array<string>} Array containing both ON and OFF modes
     */
    getApplicableModes() {
        return Object.values(AtomLabelFilter.MODES);
    }
}

/**
 * Generates bonds between atoms based on their atomic radii and positions
 * @extends BaseFilter
 */
export class BondGenerator extends BaseFilter {
    static MODES = Object.freeze({
        KEEP: 'keep',         // Keep existing bonds only
        ADD: 'add',          // Add new bonds while keeping existing ones
        REPLACE: 'replace',   // Replace all bonds with generated ones
        CREATE: 'create',     // Create bonds only if none exist
        IGNORE: 'ignore',     // Don't create bonds if none exist
    });

    static PREFERRED_FALLBACK_ORDER = [
        BondGenerator.MODES.KEEP,
        BondGenerator.MODES.ADD,
        BondGenerator.MODES.REPLACE,
        BondGenerator.MODES.CREATE,
        BondGenerator.MODES.IGNORE,
    ];

    /**
     * Creates a new bond generator
     * @param {number} [toleranceFactor=1.3] - How much longer than the sum of atomic radii a bond can be
     * @param {BondGenerator.MODES} [mode=BondGenerator.MODES.KEEP] - Initial filter mode
     */
    constructor(elementProperties, toleranceFactor, mode=BondGenerator.MODES.KEEP) {
        super(BondGenerator.MODES, mode, 'BondGenerator', BondGenerator.PREFERRED_FALLBACK_ORDER);
        this.elementProperties = elementProperties;
        this.toleranceFactor = toleranceFactor;
    }

    /**
     * Gets the maximum allowed bond distance between two atoms
     * @param {string} element1 - First element symbol
     * @param {string} element2 - Second element symbol
     * @param {Object} elementProperties - Element property definitions
     * @returns {number} Maximum allowed bond distance
     */
    getMaxBondDistance(element1, element2, elementProperties) {
        const radius1 = elementProperties[element1]?.radius;
        const radius2 = elementProperties[element2]?.radius;

        if (!radius1 || !radius2) {
            throw new Error(`Missing radius for element ${!radius1 ? element1 : element2}`);
        }

        return (radius1 + radius2) * this.toleranceFactor;
    }

    /**
     * Generates bonds between atoms based on their distances
     * @private
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {Object} elementProperties - Element property definitions
     * @returns {Set<Bond>} Set of generated bonds
     */
    generateBonds(structure, elementProperties) {
        const generatedBonds = new Set();
        const { cell, atoms } = structure;

        // Create a map of atom positions for faster lookup
        const atomPositions = new Map();
        const elementMap = new Map();

        atoms.forEach(atom => {
            const cartPos = atom.position.toCartesian(cell);
            atomPositions.set(atom.label, [cartPos.x, cartPos.y, cartPos.z]);
            if (!elementMap.has(atom.atomType)) {
                elementMap.set(atom.atomType, inferElementFromLabel(atom.atomType));
            }
        });


        // Check distances between all atom pairs
        for (let i = 0; i < atoms.length; i++) {
            const atom1 = atoms[i];
            const pos1 = atomPositions.get(atom1.label);

            for (let j = i + 1; j < atoms.length; j++) {
                const atom2 = atoms[j];
                const pos2 = atomPositions.get(atom2.label);

                // Skip if either atom is hydrogen and we already have bonds
                if ((atom1.atomType === 'H' || atom2.atomType === 'H') && 
                    structure.bonds.some(bond => 
                        bond.atom1Label === atom1.label || bond.atom1Label === atom2.label ||
                        bond.atom2Label === atom1.label || bond.atom2Label === atom2.label)) {
                    continue;
                }

                // Calculate distance using mathjs
                const diff = math.subtract(pos1, pos2);
                const distance = math.norm(diff);
                const maxDistance = this.getMaxBondDistance(
                    elementMap.get(atom1.atomType),
                    elementMap.get(atom2.atomType),
                    elementProperties,
                );

                if (distance <= maxDistance) {
                    generatedBonds.add(new Bond(
                        atom1.label,
                        atom2.label,
                        distance,
                        null,  // No standard uncertainty for generated bonds
                        '.',    // No symmetry operation
                    ));
                }
            }
        }

        return generatedBonds;
    }

    /**
     * Applies bond generation to a structure according to current mode
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {CrystalStructure} Structure with modified bonds according to mode
     */
    apply(structure) {
        // First check if current mode is applicable
        this.ensureValidMode(structure);

        let finalBonds;

        switch (this.mode) {
        case BondGenerator.MODES.KEEP:
            return structure;  // Keep existing bonds unchanged

        case BondGenerator.MODES.ADD:
        { 
            const newBonds = this.generateBonds(structure, this.elementProperties);
            finalBonds = [...structure.bonds, ...newBonds];
            break; 
        }

        case BondGenerator.MODES.REPLACE:
            finalBonds = [...this.generateBonds(structure, this.elementProperties)];
            break;

        case BondGenerator.MODES.CREATE:
            finalBonds = [...this.generateBonds(structure, this.elementProperties)];
            break;

        case BondGenerator.MODES.IGNORE:
            finalBonds = [...structure.bonds];
            break;

        default:
            return structure;
        }

        return new CrystalStructure(
            structure.cell,
            structure.atoms,
            finalBonds,
            structure.hBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes based on current structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const hasBonds = structure.bonds.length > 0;
        
        if (hasBonds) {
            return [
                BondGenerator.MODES.KEEP,
                BondGenerator.MODES.ADD,
                BondGenerator.MODES.REPLACE,
            ];
        }
        
        return [
            BondGenerator.MODES.CREATE,
            BondGenerator.MODES.IGNORE,
        ];
    }
}