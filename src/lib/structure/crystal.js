import { create, all } from 'mathjs';

import { calculateFractToCartMatrix } from './fract-to-cart.js';
import { CellSymmetry } from './cell-symmetry.js';
import { ADPFactory } from './adp.js';

const math = create(all, {});

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
    * @param {Bond[]} [bonds=[]] - Array of bonds between atoms
    * @param {HBond[]} [hBonds=[]] - Array of hydrogen bonds
    * @param {CellSymmetry} [symmetry=null] - Crystal symmetry information
    */
    constructor(unitCell, atoms, bonds=[], hBonds=[], symmetry=null) {
        this.cell = unitCell;
        this.atoms = atoms;
        this.bonds = bonds;
        this.hBonds = hBonds;
        this.recalculateConnectedGroups();
        this.symmetry = symmetry ? symmetry : new CellSymmetry('None', 0, ['x,y,z']);
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
            throw new Error('The cif file contains no valid atoms.')
        }
        
        const bonds = [];
        try {
            const bondLoop = cifBlock.get('_geom_bond');
            const nBonds = bondLoop.get(['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1']).length;
            for (let i = 0; i < nBonds; i++) {
                bonds.push(Bond.fromCIF(cifBlock, i));
            }
        } catch {
            console.warn('No bonds found in CIF file');
        }

        const hBonds = [];
        const hbondLoop = cifBlock.get('_geom_hbond', false);
        if (hbondLoop) {
            const nHBonds = hbondLoop.get(['_geom_hbond.atom_site_label_d', '_geom_hbond_atom_site_label_D']).length;
            for (let i = 0; i < nHBonds; i++) {
                hBonds.push(HBond.fromCIF(cifBlock, i));
            }
        } 
        
        const symmetry = CellSymmetry.fromCIF(cifBlock);
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
            if (atom.label.toUpperCase() === atomLabel.toUpperCase()) {
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
        return new UnitCell(
            cifBlock.get(['_cell.length_a', '_cell_length_a']),
            cifBlock.get(['_cell.length_b', '_cell_length_b']),
            cifBlock.get(['_cell.length_c', '_cell_length_c']),
            cifBlock.get(['_cell.angle_alpha', '_cell_angle_alpha']),
            cifBlock.get(['_cell.angle_beta', '_cell_angle_beta']),
            cifBlock.get(['_cell.angle_gamma', '_cell_angle_gamma']),
        );
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
        this.label = label;
        this.atomType = atomType;
        this.position = position;
        this.adp = adp;
        this.disorderGroup = disorderGroup;
    }

    /**
     * Creates an Atom from CIF data from either the index or the atom in the 
     * _atom_site_loop
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} [atomIndex=null] - Index in _atom_site loop
     * @param {string} [atomLabel=null] - Label to find atom by
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
        const calcFlag = atomSite.getIndex(
            ['_atom_site.calc_flag', '_atom_site_calc_flag'],
            index,
            ''
        ).toLowerCase();
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

        const x = atomSite.getIndex(['_atom_site.fract_x', '_atom_site_fract_x'], index);
        const y = atomSite.getIndex(['_atom_site.fract_y', '_atom_site_fract_y'], index);
        const z = atomSite.getIndex(['_atom_site.fract_z', '_atom_site_fract_z'], index);

        if (invalidValues.includes(x) || invalidValues.includes(y) || invalidValues.includes(z)) {
            throw new Error('Dummy atom: Invalid position');
        }

        const position = new FractPosition(x, y, z);
        
        const adp = ADPFactory.createADP(cifBlock, index);

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
            disorderGroup === '.' ? 0 : disorderGroup
        );
    }   
}

/**
 * Abstract base class for representing positions in 3D space
 * @abstract
 * @implements {Iterable<number>}
 */
export class BasePosition {
    #coords;

    /**
     * Creates a new position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate 
     * @param {number} z - Z coordinate
     * @throws {TypeError} If instantiated directly
     */
    constructor(x, y, z) {
        if (new.target === BasePosition) {
            throw new TypeError(
                'BasePosition is an abstract class and cannot be instantiated directly, you probably want CartPosition',
            );
        }
        this.#coords = [x, y, z];
        Object.defineProperties(this, {
            0: { get: () => this.#coords[0] },
            1: { get: () => this.#coords[1] },
            2: { get: () => this.#coords[2] },
            length: { value: 3 },
            [Symbol.iterator]: { 
                value: function* () {
                    yield this.#coords[0];
                    yield this.#coords[1];
                    yield this.#coords[2];
                },
            },
        });
    }

    get x() {
        return this.#coords[0]; 
    }
    get y() {
        return this.#coords[1]; 
    }
    get z() {
        return this.#coords[2]; 
    }

    set x(value) {
        this.#coords[0] = value; 
    }
    set y(value) {
        this.#coords[1] = value; 
    }
    set z(value) {
        this.#coords[2] = value; 
    }

    /**
     * Converts from given coordinate system to Cartesian coordinates
     * @abstract
     * @param {UnitCell} _unitCell - Unit cell for conversion
     * @returns {CartPosition} Position in Cartesian coordinates
     * @throws {Error} If not implemented by subclass
     */
    toCartesian(_unitCell) {
        throw new Error('toCartesian must be implemented by subclass');
    }
}

/**
 * Represents a position in fractional coordinates
 * @extends BasePosition
 */
export class FractPosition extends BasePosition {
    /**
     * Creates a new fractional position
     * @param {number} x - X coordinate in fractional units
     * @param {number} y - Y coordinate in fractional units 
     * @param {number} z - Z coordinate in fractional units
     */
    constructor(x, y, z) {
        super(x, y, z);
    }

    /**
     * Converts to Cartesian coordinates using unit cell parameters
     * @param {UnitCell} unitCell - Unit cell for conversion
     * @returns {CartPosition} Position in Cartesian coordinates
     */
    toCartesian(unitCell) {
        const cartCoords = math.multiply(
            unitCell.fractToCartMatrix, 
            math.matrix([this.x, this.y, this.z]),
        );
        return new CartPosition(...cartCoords.toArray());
    }
}

/**
 * Represents a position in Cartesian coordinates
 * @extends BasePosition
 */
export class CartPosition extends BasePosition {
    /**
     * Creates a new Cartesian position
     * @param {number} x - X coordinate in Angstroms
     * @param {number} y - Y coordinate in Angstroms
     * @param {number} z - Z coordinate in Angstroms
     */
    constructor(x, y, z) {
        super(x, y, z);
    }

    /**
     * Returns self since already in Cartesian coordinates
     * @param {*} _ - Unused unit cell
     * @returns {CartPosition} This position instance
     */
    toCartesian(_unitCell) {
        return this;
    }
}

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
    constructor(atom1Label, atom2Label, bondLength=null, bondLengthSU=null, atom2SiteSymmetry=null) {
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