import { calculateFractToCartMatrix } from './fract-to-cart.js';
import { CellSymmetry, SymmetryOperation } from './cell-symmetry.js';
import { ADPFactory } from './adp.js';
import { PositionFactory } from './position.js';
import { BondsFactory } from './bonds.js';

/**
 * Infers element symbol from an atom label using crystallographic naming conventions
 * @param {string} label - Atom label to analyze
 * @returns {string} Properly capitalized element symbol
 * @throws {Error} If no valid element symbol could be inferred
 */
export function inferElementFromLabel(label) {
    if (!label || typeof label !== 'string') {
        throw new Error(`Invalid atom label: ${label}`);
    }

    // Standardize to uppercase for matching
    const upperLabel = label.toUpperCase();
    
    // List of all two-letter elements for matching
    const TWO_LETTER_ELEMENTS = [
        'HE', 'LI', 'BE', 'NE', 'NA', 'MG', 'AL', 'SI', 'CL', 'AR',
        'CA', 'SC', 'TI', 'CR', 'MN', 'FE', 'CO', 'NI', 'CU', 'ZN',
        'GA', 'GE', 'AS', 'SE', 'BR', 'KR', 'RB', 'SR', 'ZR', 'NB',
        'MO', 'TC', 'RU', 'RH', 'PD', 'AG', 'CD', 'IN', 'SN', 'SB',
        'TE', 'XE', 'CS', 'BA', 'LA', 'CE', 'PR', 'ND', 'PM', 'SM',
        'EU', 'GD', 'TB', 'DY', 'HO', 'ER', 'TM', 'YB', 'LU', 'HF',
        'TA', 'RE', 'OS', 'IR', 'PT', 'AU', 'HG', 'TL', 'PB', 'BI',
        'PO', 'AT', 'RN', 'FR', 'RA', 'AC', 'TH', 'PA', 'NP', 'PU',
        'AM', 'CM',
    ];

    // First try: Match two-letter elements
    const twoLetterPattern = new RegExp(`^(${TWO_LETTER_ELEMENTS.join('|')})`);
    const twoLetterMatch = upperLabel.match(twoLetterPattern);
    
    if (twoLetterMatch) {
        return formatElementSymbol(twoLetterMatch[1]);
    }
    
    // Second try: Match single-letter elements
    const oneLetterMatch = upperLabel.match(/^(H|B|C|N|O|F|P|S|K|V|Y|I|W|U|D)/);
    
    if (oneLetterMatch) {
        return formatElementSymbol(oneLetterMatch[1]);
    }
    
    throw new Error(`Could not infer element type from atom label: ${label}`);
}

/**
 * Formats element symbol with correct capitalization
 * @param {string} element - Uppercase element symbol
 * @returns {string} Properly capitalized element symbol
 */
function formatElementSymbol(element) {
    if (element.length === 1) {
        return element;
    }
    return element[0] + element[1].toLowerCase();
}

/**
 * Represents a crystal structure with its unit cell, atoms, bonds and symmetry
 */
export class CrystalStructure {
    /**
     * Creates a new crystal structure
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {Atom[]} atoms - Array of atoms in the structure
     * @param {Bond[]} [bonds] - Array of bonds between atoms
     * @param {HBond[]} [hBonds] - Array of hydrogen bonds
     * @param {CellSymmetry} [symmetry] - Crystal symmetry information
     */
    constructor(unitCell, atoms, bonds=[], hBonds=[], symmetry=null) {
        this.cell = unitCell;
        this.atoms = atoms;
        this.bonds = bonds;
        this.hBonds = hBonds;
        this.recalculateConnectedGroups();
        this.symmetry = symmetry ? symmetry : new CellSymmetry('None', 0, [new SymmetryOperation('x,y,z')]);
    }

    /**
     * Creates a CrystalStructure from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @returns {CrystalStructure} New crystal structure instance
     */
    static fromCIF(cifBlock) {
        const cell = UnitCell.fromCIF(cifBlock);
        
        const atomSite = cifBlock.get('_atom_site');
        const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
        
        const atoms = Array.from({ length: labels.length }, (_, i) => {
            try {
                return Atom.fromCIF(cifBlock, i);
            } catch (e) {
                if (e.message.includes('Dummy atom')) {
                    return null;
                }
                throw e;
            }
        }).filter(atom => atom !== null);

        if (atoms.length === 0) {
            throw new Error('The cif file contains no valid atoms.');
        }

        const atomLabels = new Set(atoms.map(atom => atom.label));
        const bonds = BondsFactory.createBonds(cifBlock, atomLabels);
        const hBonds = BondsFactory.createHBonds(cifBlock, atomLabels);
        const symmetry = CellSymmetry.fromCIF(cifBlock);

        const bondValidationResult = BondsFactory.validateBonds(bonds, atoms, symmetry);
        const hBondValidationResult = BondsFactory.validateHBonds(hBonds, atoms, symmetry);

        if (!bondValidationResult.isValid() || !hBondValidationResult.isValid()) {
            const header = 'There were errors in the bond or H-bond creation\n';
            const bondReport = bondValidationResult.report(atoms, symmetry);
            const hBondReport = hBondValidationResult.report(atoms, symmetry);
            if (bondReport.length !== 0 && hBondReport.length !== 0) {
                throw new Error(header + bondReport + '\n' + hBondReport);
            }
            throw new Error(header + bondReport + hBondReport);
        }

        return new CrystalStructure(cell, atoms, bonds, hBonds, symmetry);
    }

    /**
     * Finds an atom by its label 
     * @param {string} atomLabel - Unique atom identifier
     * @returns {Atom} Found atom
     * @throws {Error} If atom with label not found
     */
    getAtomByLabel(atomLabel) {
        for (const atom of this.atoms) {
            if (atom.label === atomLabel) {
                return atom;
            }
        }
        const availableLabels = this.atoms.map(atom => atom.label).join(', ');
        throw new Error(`Could not find atom with label: ${atomLabel}, available are: ${availableLabels}`);
    }

    /**
     * Groups atoms connected by bonds or H-bonds, excluding symmetry relationships
     * from the provided atoms and bonds
     * @returns {Array<{atoms: Atom[], bonds: Bond[], hBonds: HBond[]}>} Array of connected groups
     */
    recalculateConnectedGroups() {
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
                hBonds: new Set(),
            };
            groups.push(newGroup);
            return newGroup;
        };

        // Process regular bonds first
        for (const bond of this.bonds) {
            const atom1 = this.getAtomByLabel(bond.atom1Label);
            const atom2 = this.getAtomByLabel(bond.atom2Label);

            // Skip bonds to symmetry equivalent positions for initial grouping
            if (bond.atom2SiteSymmetry !== '.' && bond.atom2SiteSymmetry !== null) {
                continue;
            }

            const group1 = atomGroupMap.get(atom1.label);
            const group2 = atomGroupMap.get(atom2.label);

            const targetGroup = group1 || group2;

            if (!targetGroup) {
            // Create new group
                const newGroup = getAtomGroup(atom1);
                newGroup.atoms.add(atom1);
                newGroup.atoms.add(atom2);
                newGroup.bonds.add(bond);
                atomGroupMap.set(atom1.label, newGroup);
                atomGroupMap.set(atom2.label, newGroup);
            } else {
                // Add atoms to existing group
                targetGroup.atoms.add(atom1);
                targetGroup.atoms.add(atom2);
                targetGroup.bonds.add(bond);
                atomGroupMap.set(atom1.label, targetGroup);
                atomGroupMap.set(atom2.label, targetGroup);
                
                if (group1 && group2 && group1 !== group2) {
                    // Merge groups if both exist and are different
                    for (const atom of group2.atoms) {
                        group1.atoms.add(atom);
                        atomGroupMap.set(atom.label, group1);
                    }
                    for (const bond of group2.bonds) {
                        group1.bonds.add(bond);
                    }
                    groups.splice(groups.indexOf(group2), 1);
                }
            }
        }

        // Process hydrogen bonds
        for (const hbond of this.hBonds) {
            const donorAtom = this.getAtomByLabel(hbond.donorAtomLabel);
            ///const hydrogenAtom = this.getAtomByLabel(hbond.hydrogenAtomLabel);
            const acceptorAtom = this.getAtomByLabel(hbond.acceptorAtomLabel);

            // Skip hbonds to symmetry equivalent positions for initial grouping
            if (hbond.acceptorAtomSymmetry !== '.' && hbond.acceptorAtomSymmetry !== null) {
                continue;
            }

            // Get or create groups for involved atoms
            const donorGroup = getAtomGroup(donorAtom);
            donorGroup.hBonds.add(hbond);

            if (atomGroupMap.has(acceptorAtom.label)) {
                const acceptorGroup = getAtomGroup(acceptorAtom);
                acceptorGroup.hBonds.add(hbond);
            }

        }
        const unboundAtoms = this.atoms
            .filter(atom => !groups.some(g => g.atoms.has(atom)));
        
        unboundAtoms.forEach(atom => {
            const newGroup = {
                atoms: new Set([atom]),
                bonds: new Set(),
                hBonds: new Set(),
            };
            groups.push(newGroup);
        });
        // Convert Sets to Arrays for easier handling
        this.connectedGroups = groups.map(group => ({
            atoms: Array.from(group.atoms),
            bonds: Array.from(group.bonds),
            hBonds: Array.from(group.hBonds),
        }));
    }
}

/**
 * Represents the unit cell parameters of a crystal structure
 */
export class UnitCell {
    /**
     * Creates a new unit cell
     * @param {number} a - a axis length in Å 
     * @param {number} b - b axis length in Å
     * @param {number} c - c axis length in Å 
     * @param {number} alpha - α angle in degrees
     * @param {number} beta - β angle in degrees
     * @param {number} gamma - γ angle in degrees
     * @throws {Error} If parameters invalid
     */
    constructor(a, b, c, alpha, beta, gamma) {
        this._a = a;
        this._b = b;
        this._c = c;
        this._alpha = alpha;
        this._beta = beta;
        this._gamma = gamma;
        
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }

    /**
     * Creates a UnitCell from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @returns {UnitCell} New unit cell instance
     */
    static fromCIF(cifBlock) {
        const cellParameters = [
            cifBlock.get(['_cell.length_a', '_cell_length_a'], -9999.9),
            cifBlock.get(['_cell.length_b', '_cell_length_b'], -9999.9),
            cifBlock.get(['_cell.length_c', '_cell_length_c'], -9999.9),
            cifBlock.get(['_cell.angle_alpha', '_cell_angle_alpha'], -9999.9),
            cifBlock.get(['_cell.angle_beta', '_cell_angle_beta'], -9999.),
            cifBlock.get(['_cell.angle_gamma', '_cell_angle_gamma'], -9999.9),
        ];

        if (cellParameters.some(val => val < 0.0)) {
            const names = ['a', 'b', 'c', 'alpha', 'beta', 'gamma'];
            const missing = [];
            cellParameters.forEach((val, i) => {
                if (val < 0.0) {
                    missing.push(names[i]);
                }
            });
            const missingStr = missing.join(', ');
            throw new Error(
                `Unit cell parameter entries missing in CIF or negative for cell parameters: ${missingStr}`,
            );
        }

        return new UnitCell(...cellParameters);
    }
 
    get a() {
        return this._a;
    }
 
    set a(value) {
        if (value <= 0) {
            throw new Error('Cell parameter \'a\' must be positive');
        }
        this._a = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get b() {
        return this._b;
    }
 
    set b(value) {
        if (value <= 0) {
            throw new Error('Cell parameter \'b\' must be positive');
        }
        this._b = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get c() {
        return this._c;
    }
 
    set c(value) {
        if (value <= 0) {
            throw new Error('Cell parameter \'c\' must be positive');
        }
        this._c = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get alpha() {
        return this._alpha;
    }
 
    set alpha(value) {
        if (value <= 0 || value >= 180) {
            throw new Error('Angle alpha must be between 0 and 180 degrees');
        }
        this._alpha = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get beta() {
        return this._beta;
    }
 
    set beta(value) {
        if (value <= 0 || value >= 180) {
            throw new Error('Angle beta must be between 0 and 180 degrees');
        }
        this._beta = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
 
    get gamma() {
        return this._gamma;
    }
 
    set gamma(value) {
        if (value <= 0 || value >= 180) {
            throw new Error('Angle gamma must be between 0 and 180 degrees');
        }
        this._gamma = value;
        this.fractToCartMatrix = calculateFractToCartMatrix(this);
    }
}

/**
 * Represents an atom in a crystal structure
 */
export class Atom {
    constructor(label, atomType, position, adp=null, disorderGroup=0) {
        this.label = String(label);
        this.atomType = atomType;
        this.position = position;
        this.adp = adp;
        this.disorderGroup = disorderGroup;
    }

    /**
     * Creates an Atom from CIF data from either the index or the atom in the 
     * _atom_site_loop
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} [atomIndex] - Index in _atom_site loop
     * @param {string} [atomLabel] - Label to find atom by
     * @returns {Atom} New atom instance
     * @throws {Error} If neither index nor label provided
     */
    static fromCIF(cifBlock, atomIndex=null, atomLabel=null) {
        const atomSite = cifBlock.get('_atom_site');
        const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
        
        let index = atomIndex;
        if (atomIndex === null && atomLabel) {
            index = labels.indexOf(atomLabel);
        } else if (atomIndex === null) {
            throw new Error('either atomIndex or atomLabel need to be provided');
        }
        
        const label = labels[index];
        
        // Check if dummy atom
        const invalidValues = ['.', '?'];
        if (invalidValues.includes(label)) {
            throw new Error('Dummy atom: Invalid label');
        }

        // Check calc flag
        const calcFlag = String(atomSite.getIndex(
            ['_atom_site.calc_flag', '_atom_site_calc_flag'],
            index,
            '',
        )).toLowerCase();
        if (calcFlag === 'dum') {
            throw new Error('Dummy atom: calc_flag is dum');
        }

        let atomType = atomSite.getIndex(['_atom_site.type_symbol', '_atom_site_type_symbol'], index, false);
        if (!atomType) {
            atomType = inferElementFromLabel(label);
        }
        if (invalidValues.includes(atomType)) {
            throw new Error('Dummy atom: Invalid atom type');
        }

        const position = PositionFactory.fromCIF(cifBlock, index);
        
        const adp = ADPFactory.fromCIF(cifBlock, index);

        const disorderGroup = atomSite.getIndex(
            ['_atom_site.disorder_group', '_atom_site_disorder_group'],
            index,
            '.',
        );
        
        return new Atom(
            label,
            atomType,
            position,
            adp, 
            disorderGroup === '.' ? 0 : disorderGroup,
        );
    }   
}

