/**
 * Represents a covalent bond between atoms in a crystal structure.
 */
export class Bond {
    /**
     * Creates a Bond from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} bondIndex - Index in _geom_bond loop
     * @param {string|object} [symmetryOrIdentity] - CellSymmetry used to normalize two-ended
     *  symmetry references, or the identity operation ID for backwards compatibility
     * @returns {Bond} New bond instance
     */
    static fromCIF(cifBlock: CifBlock, bondIndex: number, symmetryOrIdentity?: string | object): Bond;
    /**
     * Creates a new bond
     * @param {string} atom1Id - Unique ID of first atom
     * @param {string} atom2Id - Unique ID of second atom
     * @param {number} [bondLength] - Bond length in Å
     * @param {number} [bondLengthSU] - Standard uncertainty in bond length
     * @param {string} [atom2SiteSymmetry] - Symmetry operation for second atom
     */
    constructor(atom1Id: string, atom2Id: string, bondLength?: number, bondLengthSU?: number, atom2SiteSymmetry?: string);
    atom1Id: string;
    atom2Id: string;
    bondLength: number;
    bondLengthSU: number;
    atom2SiteSymmetry: string;
    get atom1Label(): string;
    get atom2Label(): string;
}
/**
 * Represents a hydrogen bond between atoms in a crystal structure
 */
export class HBond {
    /**
     * Creates a HBond from CIF data
     * @param {CifBlock} cifBlock - Parsed CIF data block
     * @param {number} hBondIndex - Index in _geom_hbond loop
     * @param {string|object} [symmetryOrIdentity] - CellSymmetry, or an identity operation ID
     * @returns {HBond} New hydrogen bond instance
     */
    static fromCIF(cifBlock: CifBlock, hBondIndex: number, symmetryOrIdentity?: string | object): HBond;
    /**
     * Creates a new hydrogen bond
     * @param {string} donorAtomId - Unique ID of donor atom (D)
     * @param {string} hydrogenAtomId - Unique ID of hydrogen atom (H)
     * @param {string} acceptorAtomId - Unique ID of acceptor atom (A)
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
    constructor(donorAtomId: string, hydrogenAtomId: string, acceptorAtomId: string, donorHydrogenDistance: number, donorHydrogenDistanceSU: number, acceptorHydrogenDistance: number, acceptorHydrogenDistanceSU: number, donorAcceptorDistance: number, donorAcceptorDistanceSU: number, hBondAngle: number, hBondAngleSU: number, acceptorAtomSymmetry: string);
    donorAtomId: string;
    hydrogenAtomId: string;
    acceptorAtomId: string;
    donorHydrogenDistance: number;
    donorHydrogenDistanceSU: number;
    acceptorHydrogenDistance: number;
    acceptorHydrogenDistanceSU: number;
    donorAcceptorDistance: number;
    donorAcceptorDistanceSU: number;
    hBondAngle: number;
    hBondAngleSU: number;
    acceptorAtomSymmetry: string;
    get donorAtomLabel(): string;
    get hydrogenAtomLabel(): string;
    get acceptorAtomLabel(): string;
}
/**
 * Result of bond validation containing error messages categorized by type
 */
export class ValidationResult {
    atomLabelErrors: any[];
    symmetryErrors: any[];
    /**
     * Add an atom label error message to the validation results
     * @param {string} error - Error message to add
     */
    addAtomLabelError(error: string): void;
    /**
     * Add a symmetry error message to the validation results
     * @param {string} error - Error message to add
     */
    addSymmetryError(error: string): void;
    /**
     * Check if validation found any errors
     * @returns {boolean} True if validation passed with no errors
     */
    isValid(): boolean;
    /**
     * Generates a formatted report of all validation errors
     * @param {Array<object>} atoms - Array of atom objects with label property
     * @param {object} symmetry - Symmetry object with operationIds Map
     * @returns {string} Formatted error report
     */
    report(atoms: Array<object>, symmetry: object): string;
}
/**
 * Factory for creating and validating bonds and hydrogen bonds from CIF data
 */
export class BondsFactory {
    /**
     * Creates bonds from CIF data
     * @param {object} cifBlock - CIF data block to parse
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @param {string|object} [symmetryOrIdentity] - CellSymmetry, or an identity operation ID
     * @returns {Array<Bond>} Array of created bonds
     */
    static createBonds(cifBlock: object, atomLabels: Set<string>, symmetryOrIdentity?: string | object): Array<Bond>;
    /**
     * Creates hydrogen bonds from CIF data
     * @param {CifBlock} cifBlock - CIF data block to parse
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @param {string|object} [symmetryOrIdentity] - CellSymmetry, or an identity operation ID
     * @returns {HBond[]} Array of created hydrogen bonds
     */
    static createHBonds(cifBlock: CifBlock, atomLabels: Set<string>, symmetryOrIdentity?: string | object): HBond[];
    /**
     * Validates bonds against a set of atoms and symmetry operations
     * @param {Array<Bond>} bonds - Bonds to validate
     * @param {Array<object>} atoms - Atoms to validate against
     * @param {object} symmetry - Symmetry operations to validate against
     * @returns {ValidationResult} Validation results
     */
    static validateBonds(bonds: Array<Bond>, atoms: Array<object>, symmetry: object): ValidationResult;
    /**
     * Validates hydrogen bonds against a set of atoms and symmetry operations
     * @param {Array<HBond>} hBonds - Hydrogen bonds to validate
     * @param {Array<object>} atoms - Atoms to validate against
     * @param {object} symmetry - Symmetry operations to validate against
     * @returns {ValidationResult} Validation results
     */
    static validateHBonds(hBonds: Array<HBond>, atoms: Array<object>, symmetry: object): ValidationResult;
    /**
     * Checks for an atom label whether it is valid (exclude centroids)
     * @param {string} atomLabel - An atom Label
     * @returns {boolean} Whether the label is valid
     */
    static isValidLabel(atomLabel: string): boolean;
    /**
     * Checks if bond atom pair is valid (not centroids unless in atom list)
     * @private
     * @param {string} atom1Label - First atom label
     * @param {string} atom2Label - Second atom label
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {boolean} Whether bond pair is valid
     */
    private static isValidBondPair;
    /**
     * Checks if H-bond atom triplet is valid (not centroids unless in atom list)
     * @private
     * @param {string} donorLabel - Donor atom label
     * @param {string} hydrogenLabel - Hydrogen atom label
     * @param {string} acceptorLabel - Acceptor atom label
     * @param {Set<string>} atomLabels - Set of valid atom labels
     * @returns {boolean} Whether H-bond triplet is valid
     */
    private static isValidHBondTriplet;
}
import { CifBlock } from '../read-cif/base.js';
//# sourceMappingURL=bonds.d.ts.map