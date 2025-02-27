import { Bond } from '../bonds.js';
import { CrystalStructure, inferElementFromLabel } from '../crystal.js';
import { BaseFilter } from './base.js';

import { create, all } from 'mathjs';
const math = create(all);

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

    get requiresCameraUpdate() {
        return true;
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

        const filteredAtoms = structure.atoms.filter(atom => !this.filteredLabels.has(atom.label),
        );

        const filteredBonds = structure.bonds.filter(bond => !this.filteredLabels.has(bond.atom1Label) &&
            !this.filteredLabels.has(bond.atom2Label),
        );

        const filteredHBonds = structure.hBonds.filter(hBond => !this.filteredLabels.has(hBond.donorAtomLabel) &&
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
        KEEP: 'keep', // Keep existing bonds only
        ADD: 'add', // Add new bonds while keeping existing ones
        REPLACE: 'replace', // Replace all bonds with generated ones
        CREATE: 'create', // Create bonds only if none exist
        IGNORE: 'ignore', // Don't create bonds if none exist
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
    constructor(elementProperties, toleranceFactor, mode = BondGenerator.MODES.KEEP) {
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
            if (Object.prototype.hasOwnProperty.call(elementProperties, atom.atomType)
                && !elementMap.has(atom.atomType)) {
                elementMap.set(atom.atomType, atom.atomType);
            } else if (!elementMap.has(atom.atomType)) {
                try {
                    elementMap.set(atom.atomType, inferElementFromLabel(atom.atomType));
                } catch {
                    throw new Error(`Missing radius for element ${atom.atomType}`);
                }
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
                    structure.bonds.some(bond => bond.atom1Label === atom1.label || bond.atom1Label === atom2.label ||
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

                if (distance <= maxDistance && distance > 0.0001) {
                    generatedBonds.add(new Bond(
                        atom1.label,
                        atom2.label,
                        distance,
                        null, // No standard uncertainty for generated bonds
                        '.',
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
                return structure; // Keep existing bonds unchanged

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

/**
 * Structure modifier that fixes isolated hydrogen atoms by creating
 * bonds to nearby potential bonding partners.
 * @extends BaseFilter
 */
export class IsolatedHydrogenFixer extends BaseFilter {
    static MODES = Object.freeze({
        ON: 'on',
        OFF: 'off',
    });

    static PREFERRED_FALLBACK_ORDER = [
        IsolatedHydrogenFixer.MODES.ON,
        IsolatedHydrogenFixer.MODES.OFF,
    ];

    /**
     * Creates a new isolated hydrogen fixer
     * @param {IsolatedHydrogenFixer.MODES} [mode=IsolatedHydrogenFixer.MODES.OFF] - Initial filter mode
     * @param {number} [maxBondDistance=1.1] - Maximum distance in Angstroms to consider for hydrogen bonds
     */
    constructor(mode = IsolatedHydrogenFixer.MODES.OFF, maxBondDistance = 1.1) {
        super(
            IsolatedHydrogenFixer.MODES,
            mode,
            'IsolatedHydrogenFixer',
            IsolatedHydrogenFixer.PREFERRED_FALLBACK_ORDER,
        );
        this.maxBondDistance = maxBondDistance;
    }

    /**
     * Applies the filter to create bonds for isolated hydrogen atoms
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} Modified structure with additional bonds
     */
    apply(structure) {
        this.ensureValidMode(structure);

        // If mode is OFF, return the structure unchanged
        if (this.mode === IsolatedHydrogenFixer.MODES.OFF) {
            return structure;
        }

        // Find all isolated hydrogen atoms
        const isolatedHydrogenAtoms = this.findIsolatedHydrogenAtoms(structure);
        
        if (isolatedHydrogenAtoms.length === 0) {
            return structure;
        }

        // Create new bonds for isolated hydrogen atoms
        const newBonds = this.createBondsForIsolatedHydrogens(structure, isolatedHydrogenAtoms);
        
        // Return structure with additional bonds
        return new CrystalStructure(
            structure.cell,
            structure.atoms,
            [...structure.bonds, ...newBonds],
            structure.hBonds,
            structure.symmetry
        );
    }

    /**
     * Finds hydrogen atoms that are in connected groups of size one
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<Object>} Array of isolated hydrogen atoms with their indices
     */
    findIsolatedHydrogenAtoms(structure) {
        const isolatedHydrogenAtoms = [];

        // Find connected groups with only a single hydrogen atom
        structure.connectedGroups.forEach(group => {
            if (group.atoms.length === 1 && group.atoms[0].atomType === 'H') {
                const atom = group.atoms[0];
                const atomIndex = structure.atoms.findIndex(a => a.label === atom.label);
                isolatedHydrogenAtoms.push({ atom, atomIndex });
            }
        });

        return isolatedHydrogenAtoms;
    }

    /**
     * Creates bonds for isolated hydrogen atoms to nearby potential bonding partners
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {Array<Object>} isolatedHydrogenAtoms - Array of isolated hydrogen atoms with their indices
     * @returns {Array<Bond>} Array of new bonds
     */
    createBondsForIsolatedHydrogens(structure, isolatedHydrogenAtoms) {
        const newBonds = [];

        isolatedHydrogenAtoms.forEach(({ atom, atomIndex }) => {
            // Convert hydrogen position to Cartesian coordinates
            const cartPos = atom.position.toCartesian(structure.cell);
            const hydrogenPosition = [cartPos.x, cartPos.y, cartPos.z];
            
            // Try to bond with the previous atom first (common case)
            if (atomIndex > 0) {
                const previousAtom = structure.atoms[atomIndex - 1];
                
                if (previousAtom.atomType !== 'H' && 
                    (previousAtom.disorderGroup === atom.disorderGroup || 
                     previousAtom.disorderGroup === 0 || 
                     atom.disorderGroup === 0)) {
                    
                    const prevPos = previousAtom.position.toCartesian(structure.cell);
                    const prevPosition = [prevPos.x, prevPos.y, prevPos.z];
                    
                    const diff = math.subtract(hydrogenPosition, prevPosition);
                    const distance = math.norm(diff);
                    
                    if (distance <= this.maxBondDistance) {
                        // Create a bond to the previous atom
                        newBonds.push(new Bond(
                            previousAtom.label,
                            atom.label,
                            distance,
                            null,
                            '.',
                        ));
                        // Skip further search
                        return;
                    }
                }
            }
            
            // If no bond with previous atom, check others in reverse order
            let foundBond = false;
            
            // Check atoms before hydrogen (in reverse)
            for (let i = atomIndex - 1; i >= 0 && !foundBond; i--) {
                const partner = structure.atoms[i];
                
                if (partner.atomType === 'H') {
                    continue; 
                }
                
                if (!(partner.disorderGroup === atom.disorderGroup || 
                      partner.disorderGroup === 0 || 
                      atom.disorderGroup === 0)) {
                    continue; 
                }
                
                const partnerPos = partner.position.toCartesian(structure.cell);
                const partnerPosition = [partnerPos.x, partnerPos.y, partnerPos.z];
                
                const diff = math.subtract(hydrogenPosition, partnerPosition);
                const distance = math.norm(diff);
                
                if (distance <= this.maxBondDistance) {
                    newBonds.push(new Bond(
                        partner.label,
                        atom.label,
                        distance,
                        null,
                        '.',
                    ));
                    foundBond = true;
                }
            }
            
            // Only check atoms after hydrogen if no bond found yet
            if (!foundBond && atomIndex < structure.atoms.length - 1) {
                for (let i = atomIndex + 1; i < structure.atoms.length && !foundBond; i++) {
                    const partner = structure.atoms[i];
                    
                    if (partner.atomType === 'H') {
                        continue; 
                    }
                    
                    if (!(partner.disorderGroup === atom.disorderGroup || 
                          partner.disorderGroup === 0 || 
                          atom.disorderGroup === 0)) {
                        continue; 
                    }
                    
                    const partnerPos = partner.position.toCartesian(structure.cell);
                    const partnerPosition = [partnerPos.x, partnerPos.y, partnerPos.z];
                    
                    const diff = math.subtract(hydrogenPosition, partnerPosition);
                    const distance = math.norm(diff);
                    
                    if (distance <= this.maxBondDistance) {
                        newBonds.push(new Bond(
                            partner.label,
                            atom.label,
                            distance,
                            null,
                            '.',
                        ));
                        foundBond = true;
                    }
                }
            }
        });
        
        return newBonds;
    }

    /**
     * Gets applicable modes based on whether there are isolated hydrogen atoms
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        // Check if there are any bonds at all
        if (structure.bonds.length === 0) {
            return [IsolatedHydrogenFixer.MODES.OFF];
        }
        
        // Check if there are isolated hydrogen atoms
        const hasIsolatedHydrogens = structure.connectedGroups.some(group => 
            group.atoms.length === 1 && group.atoms[0].atomType === 'H',
        );
        
        if (hasIsolatedHydrogens) {
            return [
                IsolatedHydrogenFixer.MODES.ON,
                //IsolatedHydrogenFixer.MODES.OFF,
            ];
        }
        
        return [IsolatedHydrogenFixer.MODES.OFF];
    }
}
