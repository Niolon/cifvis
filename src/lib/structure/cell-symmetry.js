import { create, all } from 'mathjs';

import { Atom, FractPosition } from './crystal.js';
import { UAnisoADP, UIsoADP } from './adp.js';
import { CifLoop } from '../cif/read-cif.js';

const math = create(all);

/**
 * Represents a crystallographic symmetry operation that can be applied to atomic coordinates 
 * and displacement parameters
 */
export class SymmetryOperation {
    /**
     * Creates a new symmetry operation from a string instruction
     * @param {string} instruction - Symmetry operation in crystallographic notation (e.g. "x,y,z", "-x+1/2,y,-z")
     * @throws {Error} If instruction does not contain exactly three components
     */
    constructor(instruction) {
        const { matrix, vector } = this.parseSymmetryInstruction(instruction);
        this.rotMatrix = matrix;
        this.transVector = vector;
    }

    /**
     * Parses a symmetry instruction string into rotation matrix and translation vector
     * @private
     * @param {string} instruction - Symmetry operation in crystallographic notation
     * @returns {{matrix: number[][], vector: number[]}} Parsed rotation matrix and translation vector
     * @throws {Error} If instruction does not contain exactly three components
     */
    parseSymmetryInstruction(instruction) {
        const matrix = Array(3).fill().map(() => Array(3).fill(0));
        const vector = Array(3).fill(0);
        
        const components = instruction.split(',').map(comp => comp.trim().toUpperCase());
        if (components.length !== 3) {
            throw new Error('Symmetry operation must have exactly three components');
        }
        
        components.forEach((component, xyz) => {
            // First find all variable terms
            const variablePattern = /([+-]?\d*\.?\d*(?:\/\d+)?)\*?([XYZ])/g;
            let match;
            
            while ((match = variablePattern.exec(component)) !== null) {
                let coefficient = match[1];
                const variable = match[2];
                
                // Handle coefficient parsing
                if (!coefficient || coefficient === '+') {
                    coefficient = '1'; 
                } else if (coefficient === '-') {
                    coefficient = '-1'; 
                } else if (coefficient.includes('/')) {
                    const [num, den] = coefficient.split('/');
                    coefficient = parseFloat(num) / parseFloat(den);
                }
                
                // Convert coefficient to number
                coefficient = parseFloat(coefficient);
                
                // Map variable to matrix column
                const col = variable === 'X' ? 0 : variable === 'Y' ? 1 : 2;
                matrix[xyz][col] = coefficient;
            }

            // Remove all variable terms and their coefficients
            const withoutVariables = component.replace(/[+-]?\d*\.?\d*(?:\/\d+)?\*?[XYZ]/g, '');
            
            // Now parse any remaining terms as translations
            const translationTerms = withoutVariables.match(/[+-]?\d*\.?\d+(?:\/\d+)?/g) || [];
            for (const term of translationTerms) {
                if (term.includes('/')) {
                    const [num, den] = term.split('/');
                    vector[xyz] += parseFloat(num) / parseFloat(den);
                } else {
                    vector[xyz] += parseFloat(term);
                }
            }
        });
        
        return { matrix, vector };
    }
    /**
     * Creates a symmetry operation from a CIF data block
     * @param {CifBlock} cifBlock - CIF data block containing symmetry operations
     * @param {number} symOpIndex - Index of the symmetry operation to extract
     * @returns {SymmetryOperation} New symmetry operation
     * @throws {Error} If no symmetry operations are found in the CIF block
     */
    static fromCIF(cifBlock, symOpIndex) {
        const symopLoop = cifBlock.get(
            [
                '_space_group_symop',
                '_symmetry_equiv',
                '_space_group_symop.operation_xyz',
                '_space_group_symop_operation_xyz',
                '_symmetry_equiv.pos_as_xyz',
                '_symmetry_equiv_pos_as_xyz',
            ],
        );

        const operation = symopLoop.getIndex([
            '_space_group_symop.operation_xyz',
            '_space_group_symop_operation_xyz',
            '_symmetry_equiv.pos_as_xyz',
            '_symmetry_equiv_pos_as_xyz',
        ], symOpIndex);

        return new SymmetryOperation(operation);
    }

    /**
     * Applies the symmetry operation to a point in fractional coordinates
     * @param {number[]} point - Point in fractional coordinates [x, y, z]
     * @returns {number[]} Transformed point in fractional coordinates
     */
    applyToPoint(point) {
        const result = math.add(
            math.multiply(this.rotMatrix, point),
            this.transVector,
        );
        return Array.isArray(result) ? result : result.toArray();
    }

    /**
     * Applies the symmetry operation to an atom, including its displacement parameters if present
     * @param {Object} atom - Atom object with fractional coordinates
     * @param {string} atom.label - Atom label
     * @param {string} atom.atomType - Chemical element symbol
     * @param {FractPosition} atom.position - Fractional position element
     * @param {(UAnisoADP|UIsoADP)} [atom.adp] - Anisotropic or isotropic displacement parameters
     * @param {number} [atom.disorderGroup] - Disorder group identifier
     * @returns {Atom} New atom instance with transformed coordinates and ADPs
     */
    applyToAtom(atom) {
        const newPos = new FractPosition(...math.add(
            math.multiply(this.rotMatrix, [atom.position.x, atom.position.y, atom.position.z]),
            this.transVector,
        ));

        let newAdp = null;
        if (atom.adp && atom.adp instanceof UAnisoADP) {
            const uMatrix = [
                [atom.adp.u11, atom.adp.u12, atom.adp.u13],
                [atom.adp.u12, atom.adp.u22, atom.adp.u23],
                [atom.adp.u13, atom.adp.u23, atom.adp.u33],
            ];
            
            const R = this.rotMatrix;
            const Rt = math.transpose(R);
            const newU = math.multiply(math.multiply(R, uMatrix), Rt);
            
            newAdp = new UAnisoADP(
                newU[0][0], // u11
                newU[1][1], // u22
                newU[2][2], // u33
                newU[0][1], // u12
                newU[0][2], // u13
                newU[1][2],  // u23
            );
        } else if (atom.adp && atom.adp instanceof UIsoADP) {
            newAdp = new UIsoADP(atom.adp.uiso);
        }

        return new Atom(
            atom.label,
            atom.atomType,
            newPos,
            newAdp,
            atom.disorderGroup,
        );
    }

    /**
     * Applies the symmetry operation to multiple atoms
     * @param {Object[]} atoms - Array of atom objects
     * @param {string} atoms[].label - Atom label
     * @param {string} atoms[].atomType - Chemical element symbol
     * @param {FractPosition} atoms[].position - Fractional position object
     * @param {(UAnisoADP|UIsoADP)} [atoms[].adp] - Anisotropic or isotropic displacement parameters
     * @param {number} [atoms[].disorderGroup] - Disorder group identifier
     * @returns {Atom[]} Array of new atom instances with transformed coordinates and ADPs
     */
    applyToAtoms(atoms) {
        return atoms.map(atom => this.applyToAtom(atom));
    }

    /**
     * Creates a deep copy of this symmetry operation
     * @returns {SymmetryOperation} New independent symmetry operation with the same parameters
     */
    copy() {
        const newOp = new SymmetryOperation('x,y,z');
        newOp.rotMatrix = math.clone(this.rotMatrix);
        newOp.transVector = math.clone(this.transVector);
        return newOp;
    }
}

/**
 * Represents the complete symmetry information of a crystal structure
 */
export class CellSymmetry {
    /**
     * Creates a new cell symmetry instance
     * @param {string} spaceGroupName - Hermann-Mauguin symbol of the space group
     * @param {number} spaceGroupNumber - International Tables space group number
     * @param {SymmetryOperation[]} symmetryOperations - List of symmetry operations
     */
    constructor(spaceGroupName, spaceGroupNumber, symmetryOperations) {
        this.spaceGroupName = spaceGroupName;
        this.spaceGroupNumber = spaceGroupNumber;
        this.symmetryOperations = symmetryOperations;
    }

    /**
     * Generates all symmetry-equivalent positions for a given point
     * @param {number[]} point - Point in fractional coordinates [x, y, z]
     * @returns {number[][]} Array of equivalent positions in fractional coordinates
     */
    generateEquivalentPositions(point) {
        return this.symmetryOperations.map(op => op.applyToPoint(point));
    }

    /**
     * Applies a symmetry operation with translation to atom(s)
     * @param {string} positionCode - Code specifying symmetry operation and translation (e.g. "2_555")
     * @param {(Object|Object[])} atoms - Single atom object or array of atom objects
     * @param {string} atoms.label - Atom label
     * @param {string} atoms.atomType - Chemical element symbol
     * @param {FractPosition} atoms.position - Fractional coordinates

     * @param {(UAnisoADP|UIsoADP)} [atoms.adp] - Anisotropic or isotropic displacement parameters
     * @param {number} [atoms.disorderGroup] - Disorder group identifier
     * @returns {(Atom|Atom[])} New atom instance(s) with transformed coordinates and ADPs
     * @throws {Error} If symmetry operation number is invalid
     */
    applySymmetry(positionCode, atoms) {
        let transVector, symOpIndex;
        try {
            const [symOpNum, translations] = positionCode.split('_');
            symOpIndex = parseInt(symOpNum) - 1;
            transVector = translations.split('').map(t => parseInt(t) - 5);
        } catch {
            symOpIndex = positionCode - 1;
            transVector = [0, 0, 0];
        } 
            
        if (symOpIndex < 0 || symOpIndex >= this.symmetryOperations.length) {
            throw new Error(`Invalid symmetry operation number: ${symOpIndex + 1}`);
        }

        const symOp = this.symmetryOperations[symOpIndex];
        
        //const combinedOp = symOp.copy();
        //combinedOp.transVector = math.add(symOp.transVector, transVector);

        if (Array.isArray(atoms)) {
            const newAtoms = symOp.applyToAtoms(atoms);
            newAtoms.forEach(newAtom => {
                newAtom.position.x += transVector[0];
                newAtom.position.y += transVector[1];
                newAtom.position.z += transVector[2];
            });
            return newAtoms;
        }

        const newAtom = symOp.applyToAtom(atoms);
        newAtom.position.x += transVector[0];
        newAtom.position.y += transVector[1];
        newAtom.position.z += transVector[2];
        return newAtom;

    }
    /**
     * Creates a cell symmetry instance from a CIF data block
     * @param {CifBlock} cifBlock - CIF data block containing symmetry information
     * @returns {CellSymmetry} New cell symmetry instance
     * @throws {Error} If no symmetry operation xyz strings found in CIF block
     */
    static fromCIF(cifBlock) {
        const spaceGroupName = cifBlock.get(
            [
                '_space_group.name_h-m_alt',
                '_space_group.name_H-M_full',
                '_symmetry_space_group_name_H-M',
                '_space_group_name_H-M_alt',
            ],
            'Unknown',
        );
            
        const spaceGroupNumber = cifBlock.get(
            [
                '_space_group.it_number',
                '_space_group.IT_number',
                '_symmetry_Int_Tables_number',
                '_space_group_IT_number',
            ],
            0,
        );

        const symopLoop = cifBlock.get(
            [
                '_space_group_symop',
                '_symmetry_equiv',
                '_symmetry_equiv_pos',
                '_space_group_symop.operation_xyz',
                '_space_group_symop_operation_xyz',
                '_symmetry_equiv.pos_as_xyz',
                '_symmetry_equiv_pos_as_xyz',
            ],
            false,
        );

        if (symopLoop && !(symopLoop instanceof CifLoop)) {
            // it is a string?
            return new CellSymmetry(
                spaceGroupName,
                spaceGroupNumber,
                [new SymmetryOperation(symopLoop)],
            );
        }

        if (!symopLoop) {
            console.warn(Object.keys(cifBlock).filter(key => key.includes('sym')));
        }

        if (symopLoop) {
            const operations = symopLoop.get([
                '_space_group_symop.operation_xyz',
                '_space_group_symop_operation_xyz',
                '_symmetry_equiv.pos_as_xyz',
                '_symmetry_equiv_pos_as_xyz',
            ]);
    
            const symmetryOperations = operations.map(op => new SymmetryOperation(op));
    
            return new CellSymmetry(
                spaceGroupName,
                spaceGroupNumber,
                symmetryOperations,
            );
        } else {
            console.warn('No symmetry operations found in CIF block, will use P1');
            return new CellSymmetry('Unknown', 0, [new SymmetryOperation('x,y,z')]);
        }
    }
}