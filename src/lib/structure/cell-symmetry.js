import { create, all } from 'mathjs';

import { Atom } from './crystal.js';
import { FractPosition } from './position.js';
import { UAnisoADP, UIsoADP } from './adp.js';
import { CifLoop } from '../read-cif/loop.js';
import { CifBlock } from '../read-cif/base.js';

const math = create(all);

/**
 * Formats a decimal number as a fraction with specified allowed denominators
 * @param {number} num - Number to format
 * @returns {string} Formatted number as fraction or decimal string
 */
export function formatTranslationAsFraction(num) {
    if (Math.abs(num) < 2.1e-3) {
        return '';
    }
    
    const allowedDenominators = [2, 3, 4, 6];
    const sign = num < 0 ? '-' : '';
    const absNum = Math.abs(num);

    // Not actually a fraction
    if (Math.abs(absNum - Math.round(absNum)) < 2.1e-3) {
        return sign + Math.round(absNum);
    }
    
    // For each allowed denominator, check if the number can be represented as a fraction
    for (const denominator of allowedDenominators) {
        const scaled = absNum * denominator;
        const roundedScaled = Math.round(scaled);
        
        // Check if this is a close match (using epsilon for floating point comparison)
        if (Math.abs(scaled - roundedScaled) < 2.1e-3) {
            // If numerator equals denominator, return just the integer
            if (roundedScaled === denominator) {
                return sign + '1';
            }
            return sign + roundedScaled + '/' + denominator;
        }
    }
    
    // If no fraction match found, return as decimal
    return sign + absNum.toString();
}

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
     * @param {object} atom - Atom object with fractional coordinates
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
     * @param {object[]} atoms - Array of atom objects
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

    /**
     * Generates a symmetry operation string from the internal matrix and vector
     * @param {Array<number>} [additionalTranslation] - Optional translation vector to add
     * @returns {string} Symmetry operation in crystallographic notation (e.g. "-x,y,-z" or "1-x,1+y,-z")
     */
    toSymmetryString(additionalTranslation = null) {
        const variables = ['x', 'y', 'z'];
        const components = [];

        // Calculate total translation vector
        const translation = additionalTranslation ? 
            math.add(this.transVector, additionalTranslation) :
            this.transVector;

        for (let i = 0; i < 3; i++) {
            let expr = '';
            
            // Add variable components
            const terms = [];
            for (let j = 0; j < 3; j++) {
                const coeff = this.rotMatrix[i][j];
                if (Math.abs(coeff) > 1e-10) {
                    if (Math.abs(Math.abs(coeff) - 1) < 1e-10) {
                        terms.push(coeff > 0 ? variables[j] : `-${variables[j]}`);
                    } else {
                        const coeffStr = formatTranslationAsFraction(Math.abs(coeff));
                        terms.push(coeff > 0 ? `${coeffStr}${variables[j]}` : `-${coeffStr}${variables[j]}`);
                    }
                }
            }
            
            expr = terms.join('+');
            
            // Handle special case of zero expression
            if (expr === '') {
                expr = '0';
            }
            
            // Add translation to start if non-zero
            if (Math.abs(translation[i]) > 1e-10) {
                const translationStr = formatTranslationAsFraction(Math.abs(translation[i]));
                const translationTerm = translation[i] < 0 ? `-${translationStr}` : translationStr;
                if (expr === '0') {
                    expr = translationTerm;
                } else if (expr.startsWith('-')) {
                    expr = `${translationTerm}${expr}`;
                } else {
                    expr = `${translationTerm}+${expr}`;
                }
            }
            
            components.push(expr);
        }
        
        return components.join(',');
    }
}

/**
 * Represents the complete symmetry information of a crystal structure
 */
export class CellSymmetry {
    constructor(spaceGroupName, spaceGroupNumber, symmetryOperations, operationIds = null) {
        this.spaceGroupName = spaceGroupName;
        this.spaceGroupNumber = spaceGroupNumber;
        this.symmetryOperations = symmetryOperations;
        this.operationIds = operationIds || new Map(
            symmetryOperations.map((_, index) => [(index + 1).toString(), index]),
        );
        
        this.identitySymOpId = Array.from(this.operationIds.entries())
            .find(([_id, index]) => {
                const symOp = this.symmetryOperations[index];
                return math.equal(symOp.rotMatrix, math.identity(3)) && 
                       math.equal(symOp.transVector, math.zeros(3));
            })?.[0];
    }

    generateEquivalentPositions(point) {
        return this.symmetryOperations.map(op => op.applyToPoint(point));
    }

    parsePositionCode(positionCode) {
        let transVector, opId;
        try {
            // Split code into operation ID and translation
            const [symOpId, translations] = positionCode.split('_');
            opId = symOpId;
            transVector = translations.split('').map(t => parseInt(t) - 5);
        } catch {
            // Handle legacy case where positionCode is just a number
            opId = positionCode.toString();
            transVector = [0, 0, 0];
        }

        // Look up symmetry operation index using ID map
        const symOpIndex = this.operationIds.get(opId);
        if (symOpIndex === undefined) {
            throw new Error(
                `Invalid symmetry operation ID in string ${positionCode}: ${opId},`
                + ' expecting string format "<symOpId>_abc". ID entry in present symOp loop?',
            );
        }

        const symOp = this.symmetryOperations[symOpIndex];
        return { symOp, transVector };
    }

    applySymmetry(positionCode, atoms) {
        const { symOp, transVector } = this.parsePositionCode(positionCode);

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
            // Single symmetry operation as string
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
            // Get operation strings
            const operations = symopLoop.get([
                '_space_group_symop.operation_xyz',
                '_space_group_symop_operation_xyz',
                '_symmetry_equiv.pos_as_xyz',
                '_symmetry_equiv_pos_as_xyz',
            ]);

            // Try to get operation IDs if they exist
            let operationIds = null;
            try {
                const ids = symopLoop.get([
                    '_space_group_symop.id',
                    '_space_group_symop_id',
                    '_symmetry_equiv.id',
                    '_symmetry_equiv_pos_site_id',
                ]);
                operationIds = new Map(ids.map((id, index) => [id.toString(), index]));
            } catch {
                // No IDs found, will use default sequential numbering
            }

            const symmetryOperations = operations.map(op => new SymmetryOperation(op));
    
            return new CellSymmetry(
                spaceGroupName,
                spaceGroupNumber,
                symmetryOperations,
                operationIds,
            );
        } else {
            console.warn('No symmetry operations found in CIF block, will use P1');
            return new CellSymmetry('Unknown', 0, [new SymmetryOperation('x,y,z')]);
        }
    }
}