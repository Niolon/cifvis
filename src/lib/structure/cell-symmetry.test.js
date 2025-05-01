import { SymmetryOperation, CellSymmetry, formatTranslationAsFraction } from './cell-symmetry.js';
import { CIF } from '../read-cif/base.js';
import { Atom } from './crystal.js';
import { FractPosition } from './position.js';
import { UAnisoADP, UIsoADP } from './adp.js';

describe('formatTranslationAsFraction', () => {
    test('simple fractions of 2', () => {
        expect(formatTranslationAsFraction(0.5)).toBe('1/2');
        expect(formatTranslationAsFraction(1.5)).toBe('3/2');
        expect(formatTranslationAsFraction(5.5)).toBe('11/2');
        expect(formatTranslationAsFraction(-0.5)).toBe('-1/2');
        expect(formatTranslationAsFraction(-2.5)).toBe('-5/2');
    });

    test('simple other fractions', () => {
        expect(formatTranslationAsFraction(1/3)).toBe('1/3');
        expect(formatTranslationAsFraction(-2/3)).toBe('-2/3');
        expect(formatTranslationAsFraction(1/4)).toBe('1/4');
        expect(formatTranslationAsFraction(3/4)).toBe('3/4');
        expect(formatTranslationAsFraction(1/6)).toBe('1/6');
        expect(formatTranslationAsFraction(-11/6)).toBe('-11/6');
    });

    test('low precision', () => {
        expect(formatTranslationAsFraction(0.333)).toBe('1/3');
        expect(formatTranslationAsFraction(1.167)).toBe('7/6');
    });

    test('no deminator', () => {
        expect(formatTranslationAsFraction(1.0)).toBe('1');
        expect(formatTranslationAsFraction(-11.0)).toBe('-11');
    });
});

describe('SymmetryOperation', () => {
    describe('parseSymmetryInstruction', () => {
        test('parses identity operation', () => {
            const op = new SymmetryOperation('x,y,z');
            expect(op.rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('parses identity operation with plus signs', () => {
            const op = new SymmetryOperation('+X,+Y,+Z');
            expect(op.rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('parses inversion operation', () => {
            const op = new SymmetryOperation('-x,-y,-z');
            expect(op.rotMatrix).toEqual([
                [-1, 0, 0],
                [0, -1, 0],
                [0, 0, -1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('parses translation with fractions', () => {
            const op = new SymmetryOperation('x+1/2,y,z+1/4');
            expect(op.rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ]);
            expect(op.transVector).toEqual([0.5, 0, 0.25]);
        });

        test('parses mixed coefficients', () => {
            const op = new SymmetryOperation('-y+1/4,z-0.5,x');
            expect(op.rotMatrix).toEqual([
                [0, -1, 0],
                [0, 0, 1],
                [1, 0, 0],
            ]);
            expect(op.transVector).toEqual([0.25, -0.5, 0]);
        });
        test('parses rotation with multiple terms', () => {
            const op = new SymmetryOperation('-x+y,-x,z+1/2');
            expect(op.rotMatrix).toEqual([
                [-1, 1, 0],
                [-1, 0, 0],
                [0, 0, 1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0.5]);
        });

        test('parses rotation with symm operations != 1, -1', () => {
            const op = new SymmetryOperation('2x, 1/2*Y, 1/2+2*z');
            expect(op.rotMatrix).toEqual([
                [2, 0, 0],
                [0, 0.5, 0],
                [0, 0, 2],
            ]);
            expect(op.transVector).toEqual([0, 0, 0.5]);
        });

        test('more entries than 3', () => {
            expect(
                () => new SymmetryOperation('x,x,y,z'),
            ).toThrow('Symmetry operation must have exactly three components');
        });
    });

    describe('applyToPoint', () => {
        test('applies identity operation', () => {
            const op = new SymmetryOperation('x,y,z');
            const point = [0.5, 0.25, 0.75];
            expect(op.applyToPoint(point)).toEqual(point);
        });

        test('applies inversion operation', () => {
            const op = new SymmetryOperation('-x,-y,-z');
            const point = [0.5, 0.25, 0.75];
            expect(op.applyToPoint(point)).toEqual([-0.5, -0.25, -0.75]);
        });

        test('applies translation', () => {
            const op = new SymmetryOperation('x+1/2,y,z+1/4');
            const point = [0.5, 0.25, 0.75];
            expect(op.applyToPoint(point)).toEqual([1.0, 0.25, 1.0]);
        });
    });

    describe('applyToAtom', () => {
        test('applies operation to atom position', () => {
            const op = new SymmetryOperation('-x+1/2,y+1/2,-z');
            const atom = new Atom(
                'C1',
                'C',
                new FractPosition(0.5, 0.25, 0.75),
            );
            const result = op.applyToAtom(atom);
            expect(result.position.x).toBeCloseTo(0.0);
            expect(result.position.y).toBeCloseTo(0.75);
            expect(result.position.z).toBeCloseTo(-0.75);
            expect(result.label).toBe('C1');
            expect(result.atomType).toBe('C');
        });

        test('transforms anisotropic displacement parameters', () => {
            const op = new SymmetryOperation('-x,y,-z');
            const atom = new Atom(
                'C1',
                'C',
                new FractPosition(0.5, 0.25, 0.75),
                new UAnisoADP(0.01, 0.02, 0.03, 0.001, 0.002, 0.003),
            );
            const result = op.applyToAtom(atom);
            expect(result.adp).toBeInstanceOf(UAnisoADP);
            expect(result.adp.u11).toBeCloseTo(0.01);
            expect(result.adp.u22).toBeCloseTo(0.02);
            expect(result.adp.u33).toBeCloseTo(0.03);
            expect(result.adp.u12).toBeCloseTo(-0.001);
            expect(result.adp.u13).toBeCloseTo(-0.002);
            expect(result.adp.u23).toBeCloseTo(-0.003);
        });

        test('preserves isotropic displacement parameters', () => {
            const op = new SymmetryOperation('-x,y,-z');
            const adp = new UIsoADP(0.025);
            const originalAtom = new Atom('C1', 'C', new FractPosition(0.5, 0.25, 0.75), adp);
            
            const result = op.applyToAtom(originalAtom);
            
            // Verify it's a new instance
            expect(result).toBeInstanceOf(Atom);
            expect(result.adp).toBeInstanceOf(UIsoADP);
            expect(result.adp).not.toBe(adp);
            
            // Verify isotropic ADP is preserved
            expect(result.adp.uiso).toBe(0.025);
            
            // Verify coordinates are transformed
            expect(result.position.x).toBeCloseTo(-0.5);
            expect(result.position.y).toBeCloseTo(0.25);
            expect(result.position.z).toBeCloseTo(-0.75);
        });
    
        test('handles null displacement parameters', () => {
            const op = new SymmetryOperation('x,y,z');
            const originalAtom = new Atom('C1', 'C', new FractPosition(0.5, 0.25, 0.75), null);
            
            const result = op.applyToAtom(originalAtom);
            
            expect(result).toBeInstanceOf(Atom);
            expect(result.adp).toBeNull();
        });
    });

    describe('fromCIF', () => {
        test('creates operation from CIF block', () => {
            const cifText = `
data_test
loop_
_symmetry_equiv_pos_as_xyz
x,y,z
-x,y,-z
`;
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const op = SymmetryOperation.fromCIF(block, 1);
            
            expect(op.rotMatrix).toEqual([
                [-1, 0, 0],
                [0, 1, 0],
                [0, 0, -1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('creates operation from CIF block with index loop key', () => {
            const cifText = `
data_test
loop_
_symmetry_equiv_id
_symmetry_equiv_pos_as_xyz
1 x,y,z
2 -x,y,-z
`;
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const op = SymmetryOperation.fromCIF(block, 1);
            
            expect(op.rotMatrix).toEqual([
                [-1, 0, 0],
                [0, 1, 0],
                [0, 0, -1],
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('throws error when no operations found', () => {
            const cifText = 'data_test\n_cell_length_a 5.0';
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            expect(() => SymmetryOperation.fromCIF(block, 0))
                .toThrow('None of the keys');
        });
    });
    describe('copy', () => {
        test('creates deep copy of operation', () => {
            const op1 = new SymmetryOperation('-x+y, -x+1/2, z+1/2');
            const op2 = op1.copy();
            
            // Test initial equality
            expect(op2.rotMatrix).toEqual(op1.rotMatrix);
            expect(op2.transVector).toEqual(op1.transVector);
            
            // Modify original to verify deep copy
            op1.rotMatrix[0][0] = 99;
            op1.transVector[0] = 99;
            
            // Verify copy wasn't affected
            expect(op2.rotMatrix[0][0]).toBe(-1);
            expect(op2.transVector[0]).toBe(0);
            
            // Modify copy to verify independence
            op2.rotMatrix[1][1] = 88;
            op2.transVector[1] = 88;
            
            // Verify original wasn't affected
            expect(op1.rotMatrix[1][1]).toBe(0);
            expect(op1.transVector[1]).toBe(0.5);
        });
    });

    describe('toSymmetryString', () => {
        test('generates basic symmetry operations', () => {
            const identityOp = new SymmetryOperation('x,y,z');
            expect(identityOp.toSymmetryString()).toBe('x,y,z');

            const inversionOp = new SymmetryOperation('-x,-y,-z');
            expect(inversionOp.toSymmetryString()).toBe('-x,-y,-z');

            const mirrorOp = new SymmetryOperation('-x,y,-z');
            expect(mirrorOp.toSymmetryString()).toBe('-x,y,-z');
        });

        test('handles translations', () => {
            const op1 = new SymmetryOperation('x+1/2,y,z');
            expect(op1.toSymmetryString()).toBe('1/2+x,y,z');

            const op2 = new SymmetryOperation('x,y+1/2,z-1/2');
            expect(op2.toSymmetryString()).toBe('x,1/2+y,-1/2+z');

            const op3 = new SymmetryOperation('x-1,y,z+1');
            expect(op3.toSymmetryString()).toBe('-1+x,y,1+z');
        });

        test('handles additional translations', () => {
            const op = new SymmetryOperation('-x,y,-z');
            expect(op.toSymmetryString([1, 0.5, -1])).toBe('1-x,1/2+y,-1-z');

            const op2 = new SymmetryOperation('x+1/2,y,z-1/2');
            expect(op2.toSymmetryString([0.5, 1, 0.5])).toBe('1+x,1+y,z');

            // Test combining positive and negative translations
            const op3 = new SymmetryOperation('x-1/2,y,z');
            expect(op3.toSymmetryString([1, 0, 0])).toBe('1/2+x,y,z');
            expect(op3.toSymmetryString([-1, 0, 0])).toBe('-3/2+x,y,z');
        });

        test('formats common fractions', () => {
            const op1 = new SymmetryOperation('x+0.5,y+0.25,z+0.75');
            expect(op1.toSymmetryString()).toBe('1/2+x,1/4+y,3/4+z');

            const op2 = new SymmetryOperation('x-0.3333333,y-0.6666667,z');
            expect(op2.toSymmetryString()).toBe('-1/3+x,-2/3+y,z');

            // Non-common fractions remain as decimals
            const op3 = new SymmetryOperation('x+0.4,y,z');
            expect(op3.toSymmetryString()).toBe('0.4+x,y,z');
        });

        test('handles coefficients', () => {
            const op = new SymmetryOperation('2x,-2y,z');
            expect(op.toSymmetryString()).toBe('2x,-2y,z');

            const op2 = new SymmetryOperation('1/2x,-1/2y,z');
            expect(op2.toSymmetryString()).toBe('1/2x,-1/2y,z');
        });

        test('handles special cases', () => {
            // Zero expression
            const zeroOp = new SymmetryOperation('0,y,0');
            expect(zeroOp.toSymmetryString()).toBe('0,y,0');

            // Very small coefficients (should be treated as zero)
            const op = new SymmetryOperation('x,y,z');
            op.rotMatrix[0][0] = 1e-11;  // Almost zero
            expect(op.toSymmetryString()).toBe('0,y,z');
        });
    });
});

describe('CellSymmetry', () => {
    describe('constructor', () => {
        test('creates cell symmetry with basic properties', () => {
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            expect(sym.spaceGroupName).toBe('P1');
            expect(sym.spaceGroupNumber).toBe(1);
            expect(sym.symmetryOperations).toHaveLength(1);
        });
    });

    describe('generateEquivalentPositions', () => {
        test('generates equivalent positions for P-1', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,-y,-z'),
            ];
            const sym = new CellSymmetry('P-1', 2, ops);
            const point = [0.25, 0.25, 0.25];
            const positions = sym.generateEquivalentPositions(point);
            
            expect(positions).toHaveLength(2);
            expect(positions[0]).toEqual([0.25, 0.25, 0.25]);
            expect(positions[1]).toEqual([-0.25, -0.25, -0.25]);
        });
    });

    describe('combinePositionCodes', () => {
        test('combines identity operations', () => {
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            expect(sym.combineSymmetryCodes('1_555', '1_555')).toBe('1_555');
        });
    
        test('combines integer translations', () => {
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            expect(sym.combineSymmetryCodes('1_655', '1_565')).toBe('1_665');
        });
    
        test('combines operations with rotations', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,-y,-z'),
            ];
            const operationIds = new Map([['1', 0], ['2', 1]]);
            const sym = new CellSymmetry('P-1', 2, ops, operationIds);
            expect(sym.combineSymmetryCodes('2_555', '2_555')).toBe('1_555');
        });
    
        test('combines rotation with translation', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,-y,-z'),
                new SymmetryOperation('-x,y,-z'),
            ];
            const operationIds = new Map([['1', 0], ['2', 1], ['3', 2]]);
            const sym = new CellSymmetry('P2/m', 10, ops, operationIds);
            expect(sym.combineSymmetryCodes('2_555', '1_655')).toBe('2_455');
        });
    
        test('throws error when no matching operation found', () => {
            // Create a case where the resulting symmetry operation doesn't exist
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            // Mock the parsePositionCode to return operations that would combine to something not in our list
            sym.parsePositionCode = vi.fn()
                .mockReturnValueOnce({
                    symOp: { rotMatrix: [[0, 1, 0], [1, 0, 0], [0, 0, 1]], transVector: [0, 0, 0] },
                    transVector: [0, 0, 0],
                })
                .mockReturnValueOnce({
                    symOp: { rotMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], transVector: [0, 0, 0] },
                    transVector: [0, 0, 0],
                });
                
            expect(() => sym.combineSymmetryCodes('1_555', '1_555')).toThrow('No matching symmetry operation found');
        });
    
        test('handles complex space group operations', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,y+1/2,-z'),
                new SymmetryOperation('-x,-y,-z'),
                new SymmetryOperation('x,-y+1/2,z'),
            ];
            const operationIds = new Map([['1', 0], ['2', 1], ['3', 2], ['4', 3]]);
            const sym = new CellSymmetry('P21/m', 11, ops, operationIds);
            
            // Combine a 2-fold rotation (2) with a translation
            expect(sym.combineSymmetryCodes('2_555', '1_655')).toBe('2_455');
            
            // Combine inversion (3) with a glide plane (2)
            expect(sym.combineSymmetryCodes('3_555', '2_555')).toBe('4_545');
        });

        test('handles operations with x,y switch (dev from paracyclophane)', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-y+1/2,x+1/2,z+1/2'),
                new SymmetryOperation('y+1/2,-x+1/2,z+1/2'),
                new SymmetryOperation('x+1/2,-y+1/2,-z+1/2'),
                new SymmetryOperation('-x+1/2,y+1/2,-z+1/2'),
                new SymmetryOperation('-x,-y,z'),
                new SymmetryOperation('y,x,-z'),
                new SymmetryOperation('-y,-x,-z'),
                new SymmetryOperation('-x,-y,-z'),
                new SymmetryOperation('y-1/2,-x-1/2,-z-1/2'),
                new SymmetryOperation('-y-1/2,x-1/2,-z-1/2'),
                new SymmetryOperation('-x-1/2,y-1/2,z-1/2'),
                new SymmetryOperation('x-1/2,-y-1/2,z-1/2'),
                new SymmetryOperation('x,y,-z'),
                new SymmetryOperation('-y,-x,z'),
                new SymmetryOperation('y,x,z'),
            ];
            const sym = new CellSymmetry('P 42/m n m', 136, ops);

            expect(sym.combineSymmetryCodes('15_665', '6_665')).toBe('16_555');
            expect(sym.combineSymmetryCodes('15_665', '7_556')).toBe('9_666');
            expect(sym.combineSymmetryCodes('15_665', '8_666')).toBe('14_556');
            expect(sym.combineSymmetryCodes('15_665', '16_555')).toBe('6_665');
            expect(sym.combineSymmetryCodes('15_665', '9_666')).toBe('7_556');
            expect(sym.combineSymmetryCodes('15_665', '14_556')).toBe('8_666');
            expect(sym.combineSymmetryCodes('14_556', '15_665')).toBe('8_666');
            expect(sym.combineSymmetryCodes('14_556', '9_666')).toBe('6_665');
            expect(sym.combineSymmetryCodes('14_556', '16_555')).toBe('7_556');
            expect(sym.combineSymmetryCodes('14_556', '8_666')).toBe('15_665');
            expect(sym.combineSymmetryCodes('14_556', '6_665')).toBe('9_666');
            expect(sym.combineSymmetryCodes('14_556', '7_556')).toBe('16_555');
        });
    });

    describe('applySymmetry', () => {
        test('applies symmetry operation with translation to multiple atoms', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,y,-z'),
            ];
            const sym = new CellSymmetry('P2/m', 10, ops);
            const atoms = [
                new Atom(
                    'C1',
                    'C',
                    new FractPosition(0.5, 0.25, 0.75),
                ),
                new Atom(
                    'B1',
                    'B',
                    new FractPosition(0.1, 0.9, -0.4),
                ),
            ];
            
            const results = sym.applySymmetry('2_456', atoms);
            expect(results[0].position.x).toBeCloseTo(-1.5);
            expect(results[0].position.y).toBeCloseTo(0.25);
            expect(results[0].position.z).toBeCloseTo(0.25);
            expect(results[1].position.x).toBeCloseTo(-1.1);
            expect(results[1].position.y).toBeCloseTo(0.9);
            expect(results[1].position.z).toBeCloseTo(1.4);
        });

        test('throws error for invalid symmetry operation ID', () => {
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            expect(() => sym.applySymmetry('2_555', {}))
                .toThrow('Invalid symmetry operation ID in string 2_555: 2');
        });

        test('transforms anisotropic displacement parameters', () => {
            const op = new SymmetryOperation('-x,y,-z');
            const adp = new UAnisoADP(0.01, 0.02, 0.03, 0.001, 0.002, 0.003);
            const originalAtom = new Atom('C1', 'C', new FractPosition(0.5, 0.25, 0.75), adp);
            
            const result = op.applyToAtom(originalAtom);
            
            // Verify it's a new instance
            expect(result).toBeInstanceOf(Atom);
            expect(result.adp).toBeInstanceOf(UAnisoADP);
            expect(result.adp).not.toBe(adp);
            
            // Verify transformed ADPs
            expect(result.adp.u11).toBeCloseTo(0.01);
            expect(result.adp.u22).toBeCloseTo(0.02);
            expect(result.adp.u33).toBeCloseTo(0.03);
            expect(result.adp.u12).toBeCloseTo(-0.001);
            expect(result.adp.u13).toBeCloseTo(-0.002);
            expect(result.adp.u23).toBeCloseTo(-0.003);
        });

        test('preserves disorder group', () => {
            const op = new SymmetryOperation('x,y,z');
            const originalAtom = new Atom('C1', 'C', new FractPosition(0.5, 0.25, 0.75), null, 2);
            
            const result = op.applyToAtom(originalAtom);
            
            expect(result).toBeInstanceOf(Atom);
            expect(result.disorderGroup).toBe(2);
        });
    });

    describe('fromCIF', () => {
        test('creates symmetry from CIF block', () => {
            const cifTexts = [`
data_test
_symmetry_space_group_name_H-M 'P 21/c'
_symmetry_Int_Tables_number 14
loop_
_symmetry_equiv_pos_as_xyz
x,y,z
-x,y+1/2,-z+1/2
-x,-y,-z
x,-y+1/2,z+1/2
`, `
data_test2
_symmetry_space_group_name_H-M 'P 21/c'
_symmetry_Int_Tables_number 14
loop_
 _symmetry_equiv_id
 _symmetry_equiv_pos_as_xyz
 a x,y,z
 b -x,y+1/2,-z+1/2
 c -x,-y,-z
 d x,-y+1/2,z+1/2
`,
            ];
            for (const cifText of cifTexts) {
                const cif = new CIF(cifText);
                const block = cif.getBlock(0);
                const sym = CellSymmetry.fromCIF(block);
                
                expect(sym.spaceGroupName).toBe('P 21/c');
                expect(sym.spaceGroupNumber).toBe(14);
                expect(sym.symmetryOperations).toHaveLength(4);
            }
        });

        test('defaults to P1 when no operations found', () => {
            const cifText = 'data_test\n_cell_length_a 5.0';
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const sym = CellSymmetry.fromCIF(block);
            
            expect(sym.spaceGroupName).toBe('Unknown');
            expect(sym.spaceGroupNumber).toBe(0);
            expect(sym.symmetryOperations).toHaveLength(1);
            expect(sym.symmetryOperations[0].rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ]);
        });
    });

    describe('CellSymmetry ID handling', () => {
        let mockAtoms;
        
        beforeEach(() => {
            mockAtoms = [new Atom(
                'C1',
                'C',
                new FractPosition(0.5, 0.5, 0.5),
            )];
        });
    
        test('handles custom operation IDs from CIF', () => {
            const cifText = `
data_test
loop_
_space_group_symop_id
_space_group_symop_operation_xyz
a1 x,y,z
b2 -x,-y,z`;
    
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const symmetry = CellSymmetry.fromCIF(block);
    
            // Check ID mapping
            expect(symmetry.operationIds.get('a1')).toBe(0);
            expect(symmetry.operationIds.get('b2')).toBe(1);

            expect(symmetry.identitySymOpId).toBe('a1');
    
            // Test applying operation with translation
            const transformed = symmetry.applySymmetry('b2_456', mockAtoms)[0];
            expect(transformed.position.x).toBeCloseTo(-1.5);
            expect(transformed.position.y).toBeCloseTo(-0.5);
            expect(transformed.position.z).toBeCloseTo(1.5);  // 0.5 + 1
        });
    
        test('falls back to sequential IDs when none provided', () => {
            const cifText = `
data_test
loop_
_symmetry_equiv_pos_as_xyz
x,y,z
-x,-y,z`;
    
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const symmetry = CellSymmetry.fromCIF(block);
    
            // Test sequential ID mapping
            expect(symmetry.operationIds.get('1')).toBe(0);
            expect(symmetry.operationIds.get('2')).toBe(1);
    
            // Test legacy numeric code still works
            const transformed = symmetry.applySymmetry('2', mockAtoms)[0];
            expect(transformed.position.x).toBeCloseTo(-0.5);
            expect(transformed.position.y).toBeCloseTo(-0.5);
            expect(transformed.position.z).toBeCloseTo(0.5);
        });
    
        test('throws error for invalid operation ID', () => {
            const cifText = `
data_test
loop_
_space_group_symop_id
_space_group_symop_operation_xyz
a1 x,y,z`;
    
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            const symmetry = CellSymmetry.fromCIF(block);
    
            expect(() => symmetry.applySymmetry('invalid_555', mockAtoms))
                .toThrow('Invalid symmetry operation ID in string invalid_555: invalid');
        });
    });
});