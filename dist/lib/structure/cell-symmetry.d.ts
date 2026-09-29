/**
 * Formats a decimal number as a fraction with specified allowed denominators
 * @param {number} num - Number to format
 * @returns {string} Formatted number as fraction or decimal string
 */
export function formatTranslationAsFraction(num: number): string;
/**
 * Represents a crystallographic symmetry operation that can be applied to atomic coordinates
 * and displacement parameters
 */
export class SymmetryOperation {
    /**
     * Creates a symmetry operation from a CIF data block
     * @param {CifBlock} cifBlock - CIF data block containing symmetry operations
     * @param {number} symOpIndex - Index of the symmetry operation to extract
     * @returns {SymmetryOperation} New symmetry operation
     * @throws {Error} If no symmetry operations are found in the CIF block
     */
    static fromCIF(cifBlock: CifBlock, symOpIndex: number): SymmetryOperation;
    /**
     * Creates a new symmetry operation from a string instruction
     * @param {string} instruction - Symmetry operation in crystallographic notation (e.g. "x,y,z", "-x+1/2,y,-z")
     * @throws {Error} If instruction does not contain exactly three components
     */
    constructor(instruction: string);
    rotMatrix: number[][];
    transVector: number[];
    /**
     * Parses a symmetry instruction string into rotation matrix and translation vector
     * @private
     * @param {string} instruction - Symmetry operation in crystallographic notation
     * @returns {{matrix: number[][], vector: number[]}} Parsed rotation matrix and translation vector
     * @throws {Error} If instruction does not contain exactly three components
     */
    private parseSymmetryInstruction;
    /**
     * Applies the symmetry operation to a point in fractional coordinates
     * @param {number[]} point - Point in fractional coordinates [x, y, z]
     * @returns {number[]} Transformed point in fractional coordinates
     */
    applyToPoint(point: number[]): number[];
    /**
     * Applies the symmetry operation to an atom, including its displacement parameters if present
     * @param {object} atom - Atom object with fractional coordinates
     * @param {string} atom.label - Atom label
     * @param {string} atom.atomType - Chemical element symbol
     * @param {FractPosition} atom.position - Fractional position element
     * @param {(UAnisoADP|UIsoADP)} [atom.adp] - Anisotropic or isotropic displacement parameters
     * @param {number} [atom.disorderGroup] - Disorder group identifier
     * @returns {Atom} New atom instance with transformed coordinates and ADPs
     */
    applyToAtom(atom: {
        label: string;
        atomType: string;
        position: FractPosition;
        adp?: UAnisoADP | UIsoADP | undefined;
        disorderGroup?: number | undefined;
    }): Atom;
    /**
     * Applies the symmetry operation to multiple atoms
     * @param {Atom[]} atoms - Array of atom objects
     * @param {string} atoms[].label - Atom label
     * @param {string} atoms[].atomType - Chemical element symbol
     * @param {FractPosition} atoms[].position - Fractional position object
     * @param {(UAnisoADP|UIsoADP)} [atoms[].adp] - Anisotropic or isotropic displacement parameters
     * @param {number} [atoms[].disorderGroup] - Disorder group identifier
     * @returns {Atom[]} Array of new atom instances with transformed coordinates and ADPs
     */
    applyToAtoms(atoms: Atom[]): Atom[];
    /**
     * Creates a deep copy of this symmetry operation
     * @returns {SymmetryOperation} New independent symmetry operation with the same parameters
     */
    copy(): SymmetryOperation;
    /**
     * Generates a symmetry operation string from the internal matrix and vector
     * @param {Array<number>} [additionalTranslation] - Optional translation vector to add
     * @returns {string} Symmetry operation in crystallographic notation (e.g. "-x,y,-z" or "1-x,1+y,-z")
     */
    toSymmetryString(additionalTranslation?: Array<number>): string;
}
/**
 * Represents the complete symmetry information of a crystal structure
 */
export class CellSymmetry {
    static fromCIF(cifBlock: any): CellSymmetry;
    constructor(spaceGroupName: any, spaceGroupNumber: any, symmetryOperations: any, operationIds?: null);
    spaceGroupName: any;
    spaceGroupNumber: any;
    symmetryOperations: any;
    operationIds: Map<any, any>;
    identitySymOpId: any;
    _combineSymmetryCodesCache: Map<any, any>;
    _invertPositionCodeCache: Map<any, any>;
    _combineOperationCache: Map<any, any>;
    _operationIdsByIndex: Map<any, any>;
    _rotationMatrixIndex: Map<any, any>;
    _buildRotationIndex(): void;
    _matrixToKey(matrix: any): string;
    _getCacheKey(outerCode: any, innerCode: any): string;
    generateEquivalentPositions(point: any): any;
    parsePositionCode(positionCode: any): {
        symOp: any;
        transVector: number[];
    };
    _multiplyMatrices3x3(a: any, b: any): number[][];
    _multiplyMatrixVector3x3(m: any, v: any): number[];
    /**
     * Combines two position codes to create a new position code
     * @param {string} symmetryCodeOuter - Outer position code (applied second)
     * @param {string} symmetryCodeInner - Inner position code (applied first)
     * @returns {string} Combined position code
     * @throws {Error} If no matching symmetry operation is found
     */
    combineSymmetryCodes(symmetryCodeOuter: string, symmetryCodeInner: string): string;
    /**
     * Returns the position code for the inverse of a symmetry transform.
     * @param {string|number} positionCode - Position code to invert
     * @returns {string} Inverse position code
     * @throws {Error} If no matching inverse operation exists in the symmetry group
     */
    invertPositionCode(positionCode: string | number): string;
    /**
     * Applies the symmetry operation of a position code to multiple atoms, but return atoms on special
     * positions separately
     * @param {string} positionCode - A valid position code.
     * @param {Atom[]} atoms - Array of atom objects
     * @returns {Atom[]} - Array of symmetry transformed atoms
     */
    applySymmetry(positionCode: string, atoms: Atom[]): Atom[];
    /**
     * Applies the symmetry operation of a position code to multiple atoms, but return atoms on special
     * positions separately
     * @param {string} positionCode - A valid position code.
     * @param {Atom[]} atoms - Array of atom objects
     * @param {UnitCell} unitCell - Unit cell object
     * @returns {{atoms: Atom[], specialPositions: string[]}} - Array of unique symmetry transformed atoms
     *  and list of labels of atoms on special positions.
     */
    applySymmetryNonSpecial(positionCode: string, atoms: Atom[], unitCell: UnitCell): {
        atoms: Atom[];
        specialPositions: string[];
    };
}
import { FractPosition } from './position.js';
import { UAnisoADP } from './adp.js';
import { UIsoADP } from './adp.js';
import { Atom } from './crystal.js';
import { CifBlock } from '../read-cif/base.js';
import { UnitCell } from './crystal.js';
//# sourceMappingURL=cell-symmetry.d.ts.map