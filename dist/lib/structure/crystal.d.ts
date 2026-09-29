/**
 * Infers element symbol from an atom label using crystallographic naming conventions
 * @param {string} label - Atom label to analyze
 * @returns {string} Properly capitalized element symbol
 * @throws {Error} If no valid element symbol could be inferred
 */
export function inferElementFromLabel(label: string): string;
/**
 * Determines whether two atoms may be bonded given their disorder groups.
 * Disorder group 0 (ordered/common) is compatible with any group; two
 * distinct nonzero groups represent mutually-exclusive disorder alternatives
 * and are never compatible.
 * @param {Atom} atom1 - First atom
 * @param {Atom} atom2 - Second atom
 * @returns {boolean} Whether the two atoms' disorder groups allow a bond
 */
export function disorderGroupsCompatible(atom1: Atom, atom2: Atom): boolean;
/**
 * Represents a crystal structure with its unit cell, atoms, bonds and symmetry
 */
export class CrystalStructure {
    /**
     * Creates a CrystalStructure from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @returns {CrystalStructure} New crystal structure instance
     */
    static fromCIF(cifBlock: CifBlock): CrystalStructure;
    /**
     * Creates a new crystal structure
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {Atom[]} atoms - Array of atoms in the structure
     * @param {Bond[]} [bonds] - Array of bonds between atoms
     * @param {HBond[]} [hBonds] - Array of hydrogen bonds
     * @param {CellSymmetry} [symmetry] - Crystal symmetry information
     */
    constructor(unitCell: UnitCell, atoms: Atom[], bonds?: Bond[], hBonds?: HBond[], symmetry?: CellSymmetry);
    cell: UnitCell;
    atoms: Atom[];
    bonds: Bond[];
    hBonds: HBond[];
    symmetry: CellSymmetry;
    /**
     * Finds an atom by its unique ID
     * @param {string} atomId - Unique atom identifier (label|symmetry)
     * @returns {Atom} Found atom
     * @throws {Error} If atom with ID not found
     */
    getAtomById(atomId: string): Atom;
    /**
     * Finds an atom by its label
     * @param {string} atomLabel - Unique atom identifier
     * @returns {Atom} Found atom
     * @throws {Error} If atom with label not found
     */
    getAtomByLabel(atomLabel: string): Atom;
    /**
     * Groups atoms connected by bonds or H-bonds, excluding symmetry relationships
     * from the provided atoms and bonds
     * @returns {Array} Array of connected groups, each containing atoms, bonds, and H-bonds
     * @throws {Error} If atom with label not found
     */
    calculateConnectedGroups(): any[];
}
/**
 * Represents the unit cell parameters of a crystal structure
 */
export class UnitCell {
    /**
     * Creates a UnitCell from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @returns {UnitCell} New unit cell instance
     */
    static fromCIF(cifBlock: CifBlock): UnitCell;
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
    constructor(a: number, b: number, c: number, alpha: number, beta: number, gamma: number);
    _a: number;
    _b: number;
    _c: number;
    _alpha: number;
    _beta: number;
    _gamma: number;
    fractToCartMatrix: import("../math-lite.js").Matrix;
    set a(value: number);
    get a(): number;
    set b(value: number);
    get b(): number;
    set c(value: number);
    get c(): number;
    set alpha(value: number);
    get alpha(): number;
    set beta(value: number);
    get beta(): number;
    set gamma(value: number);
    get gamma(): number;
}
/**
 * Represents an atom in a crystal structure
 */
export class Atom {
    /**
     * Creates an Atom from CIF data from either the index or the atom in the
     * _atom_site_loop
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} [atomIndex] - Index in _atom_site loop
     * @param {string} [atomLabel] - Label to find atom by
     * @returns {Atom} New atom instance
     * @throws {Error} If neither index nor label provided
     */
    static fromCIF(cifBlock: CifBlock, atomIndex?: number, atomLabel?: string): Atom;
    constructor(label: any, atomType: any, position: any, adp?: null, disorderGroup?: number, appliedSymmetry?: null);
    label: string;
    atomType: any;
    position: any;
    adp: any;
    disorderGroup: number;
    appliedSymmetry: any;
    get uniqueId(): string;
    /**
     * Whether this atom is the untransformed image, i.e. carries no symmetry operation
     * or carries the identity of the structure it belongs to.
     * @param {string} [identitySymOpId] - Operation ID naming the identity in this structure.
     * @returns {boolean} True when the atom sits at its listed coordinates.
     */
    isIdentityImage(identitySymOpId?: string): boolean;
}
import { Bond } from './bonds.js';
import { HBond } from './bonds.js';
import { CellSymmetry } from './cell-symmetry.js';
import { CifBlock } from '../read-cif/base.js';
//# sourceMappingURL=crystal.d.ts.map