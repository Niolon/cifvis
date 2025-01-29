import { create, all } from 'mathjs';
import { UAnisoADP } from './crystal.js';
import { CifLoop } from '../cif/read-cif.js';

const math = create(all);

export class SymmetryOperation {
    constructor(instruction) {
        const { matrix, vector } = this.parseSymmetryInstruction(instruction);
        this.rotMatrix = matrix;
        this.transVector = vector;
    }

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
                if (!coefficient || coefficient === '+') coefficient = '1';
                else if (coefficient === '-') coefficient = '-1';
                else if (coefficient.includes('/')) {
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

    static fromCIF(cifBlock, symOpIndex) {
        let symopLoop = cifBlock.get(["_space_group_symop", "_symmetry_equiv"], "InVaLIdValue");

        if (symopLoop == "InVaLIdValue") {
            for (const entry of Object.entries(cifBlock.data)) {
                if ((entry[0].startsWith("_symmetry_equiv") || entry[0].startsWith("_space_group_symop")) && entry[1]instanceof(CifLoop) ) {
                    symopLoop = entry[1];
                    break
                }
            }
        }
        
        if (symopLoop == "InVaLIdValue") {
            throw new Error("No symmetry operations found in CIF block");
        }

        const operation = symopLoop.getIndex([
            "_space_group_symop.operation_xyz",
            "_space_group_symop_operation_xyz",
            "_symmetry_equiv.pos_as_xyz",
            "_symmetry_equiv_pos_as_xyz"
        ], symOpIndex);

        return new SymmetryOperation(operation);
    }

    applyToPoint(point) {
        const result = math.add(
            math.multiply(this.rotMatrix, point),
            this.transVector
        );
        return Array.isArray(result) ? result : result.toArray();
    }

    applyToAtom(atom) {
        const newPos = math.add(
            math.multiply(this.rotMatrix, [atom.fractX, atom.fractY, atom.fractZ]),
            this.transVector
        );

        const result = {
            ...atom,
            fractX: newPos[0],
            fractY: newPos[1],
            fractZ: newPos[2]
        };

        if (atom.adp && atom.adp instanceof UAnisoADP) {
            const uMatrix = [
                [atom.adp.u11, atom.adp.u12, atom.adp.u13],
                [atom.adp.u12, atom.adp.u22, atom.adp.u23],
                [atom.adp.u13, atom.adp.u23, atom.adp.u33]
            ];
            
            const R = this.rotMatrix;
            const Rt = math.transpose(R);
            const newU = math.multiply(math.multiply(R, uMatrix), Rt);
            
            result.adp = new UAnisoADP(
                newU[0][0], // u11
                newU[1][1], // u22
                newU[2][2], // u33
                newU[0][1], // u12
                newU[0][2], // u13
                newU[1][2]  // u23
            );
        }

        return result;
    }

    applyToAtoms(atoms) {
        return atoms.map(atom => this.applyToAtom(atom));
    }

    copy() {
        const newOp = new SymmetryOperation('x,y,z');
        newOp.rotMatrix = math.clone(this.rotMatrix);
        newOp.transVector = math.clone(this.transVector);
        return newOp;
    }
}

export class CellSymmetry {
    constructor(spaceGroupName, spaceGroupNumber, symmetryOperations) {
        this.spaceGroupName = spaceGroupName;
        this.spaceGroupNumber = spaceGroupNumber;
        this.symmetryOperations = symmetryOperations;
    }

    generateEquivalentPositions(point) {
        return this.symmetryOperations.map(op => op.applyToPoint(point));
    }

    applySymmetry(positionCode, atoms) {
        const [symOpNum, translations] = positionCode.split('_');
        const symOpIndex = parseInt(symOpNum) - 1;
        
        if (symOpIndex < 0 || symOpIndex >= this.symmetryOperations.length) {
            throw new Error(`Invalid symmetry operation number: ${symOpNum}`);
        }

        const transVector = translations.split('').map(t => parseInt(t) - 5);
        const symOp = this.symmetryOperations[symOpIndex];
        
        //const combinedOp = symOp.copy();
        //combinedOp.transVector = math.add(symOp.transVector, transVector);

        if (Array.isArray(atoms)) {
            const newAtoms = symOp.applyToAtoms(atoms);
            newAtoms.forEach(newAtom => {
                newAtom.fractX += transVector[0];
                newAtom.fractY += transVector[1];
                newAtom.fractZ += transVector[2];
            })
            return newAtoms;
        }

        const newAtom = symOp.applyToAtom(atoms);
        newAtom.fractX += transVector[0];
        newAtom.fractY += transVector[1];
        newAtom.fractZ += transVector[2];
        return newAtom;

    }

    static fromCIF(cifBlock) {
        let spaceGroupName, spaceGroupNumber;
        spaceGroupName = cifBlock.get(
            [
                "_space_group.name_H-M_full",
                "_symmetry_space_group_name_H-M",
                "_space_group_name_H-M_alt"
            ],
            "Unknown"
        );
            
        spaceGroupNumber = cifBlock.get(
            [
                "_space_group.IT_number",
                "_symmetry_Int_Tables_number",
                "_space_group_IT_number",
            ],
            0
        );


        let symopLoop = cifBlock.get(["_space_group_symop", "_symmetry_equiv"], "InVaLIdValue");

        if (symopLoop === "InVaLIdValue") {
            for (const entry of Object.entries(cifBlock.data)) {
                if ((entry[0].startsWith("_symmetry_equiv") || entry[0].startsWith("_space_group_symop")) && entry[1]instanceof(CifLoop) ) {
                    symopLoop = entry[1];
                    break
                }
            }
        }

        if (symopLoop == "InVaLIdValue") {
            console.warn("No symmetry operations found in CIF block, will use P1")
            return new CellSymmetry("Unknown", 0, [new SymmetryOperation("x,y,z")])
        }
        
        const operations = symopLoop.get([
            "_space_group_symop.operation_xyz",
            "_space_group_symop_operation_xyz",
            "_symmetry_equiv.pos_as_xyz",
            "_symmetry_equiv_pos_as_xyz"
        ]);

        const symmetryOperations = operations.map((op, _) => new SymmetryOperation(op));

        return new CellSymmetry(
            spaceGroupName,
            spaceGroupNumber,
            symmetryOperations
        );
    }
}