import { create, all } from 'mathjs';
import { UAnisoADP } from './crystal.js';
import { CifLoop } from './read-cif.js';

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
        
        components.forEach((component, xyz) => {
            const fractionMatch = component.match(/(-?\d+)\/(\d+)(?![XYZ])/);
            const decimalMatch = component.match(/(-?\d*\.\d+)(?![XYZ])/);
            const integerMatch = component.match(/(-?\d+)(?![XYZ])/);
            
            if (fractionMatch) {
                vector[xyz] = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
            } else if (decimalMatch) {
                vector[xyz] = parseFloat(decimalMatch[1]);
            } else if (integerMatch) {
                vector[xyz] = parseInt(integerMatch[1]);
            }
            
            const terms = component.match(/(-?\d*\.?\d*[XYZ])/g) || [];
            
            terms.forEach(term => {
                let coefficient = 1;
                if (term.startsWith('-')) {
                    coefficient = -1;
                    term = term.substring(1);
                }
                if (term.length > 1 && term !== 'X' && term !== 'Y' && term !== 'Z') {
                    coefficient *= parseFloat(term.slice(0, -1));
                }
                
                const variable = term.slice(-1);
                const col = variable === 'X' ? 0 : variable === 'Y' ? 1 : 2;
                matrix[xyz][col] = coefficient;
            });
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
        const newOp = new SymmetryOperation('dummy');
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
        
        const combinedOp = symOp.copy();
        combinedOp.transVector = math.add(symOp.transVector, transVector);

        return Array.isArray(atoms) ? 
            combinedOp.applyToAtoms(atoms) : 
            combinedOp.applyToAtom(atoms);
    }

    static fromCIF(cifBlock) {
        let spaceGroupName, spaceGroupNumber;
        try {
            spaceGroupName = cifBlock.get([
                "_space_group.name_H-M_full",
                "_symmetry_space_group_name_H-M",
                "_space_group_name_H-M_alt"
            ],
            "Unknown spacegroup name"
            );
            
            spaceGroupNumber = cifBlock.get([
                "_space_group.IT_number",
                "_symmetry_Int_Tables_number",
                "_space_group_IT_number",
            ],
            0
        );
        } catch (error) {
            console.warn("Space group information not found in CIF block");
        }

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
            console.warn("No symmetry operations found in CIF block, will use P1")
            return new CellSymmetry("Unknown", 0, [new SymmetryOperation("x,y,z")])
        }
        
        const operations = symopLoop.get([
            "_space_group_symop.operation_xyz",
            "_space_group_symop_operation_xyz",
            "_symmetry_equiv.pos_as_xyz",
            "_symmetry_equiv_pos_as_xyz"
        ]);

        if (!operations) {
            throw new Error("No symmetry operation xyz strings found in CIF block");
        }

        const symmetryOperations = operations.map((op, _) => new SymmetryOperation(op));

        return new CellSymmetry(
            spaceGroupName || "Unknown",
            spaceGroupNumber || 0,
            symmetryOperations
        );
    }
}