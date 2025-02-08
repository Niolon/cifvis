import { SymmetryOperation, CellSymmetry } from './cell-symmetry.js';
import { CIF } from '../cif/read-cif.js';
import { UAnisoADP, UIsoADP, Atom, FractPosition } from './crystal.js';

describe('SymmetryOperation', () => {
    describe('parseSymmetryInstruction', () => {
        test('parses identity operation', () => {
            const op = new SymmetryOperation('x,y,z');
            expect(op.rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('parses inversion operation', () => {
            const op = new SymmetryOperation('-x,-y,-z');
            expect(op.rotMatrix).toEqual([
                [-1, 0, 0],
                [0, -1, 0],
                [0, 0, -1]
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('parses translation with fractions', () => {
            const op = new SymmetryOperation('x+1/2,y,z+1/4');
            expect(op.rotMatrix).toEqual([
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]);
            expect(op.transVector).toEqual([0.5, 0, 0.25]);
        });

        test('parses mixed coefficients', () => {
            const op = new SymmetryOperation('-y+1/4,z-0.5,x');
            expect(op.rotMatrix).toEqual([
                [0, -1, 0],
                [0, 0, 1],
                [1, 0, 0]
            ]);
            expect(op.transVector).toEqual([0.25, -0.5, 0]);
        });
        test('parses rotation with multiple terms', () => {
            const op = new SymmetryOperation('-x+y,-x,z+1/2');
            expect(op.rotMatrix).toEqual([
                [-1, 1, 0],
                [-1, 0, 0],
                [0, 0, 1]
            ]);
            expect(op.transVector).toEqual([0, 0, 0.5]);
        });

        test('parses rotation with symm operations != 1, -1', () => {
            const op = new SymmetryOperation('2x, 1/2*Y, 1/2+2*z');
            expect(op.rotMatrix).toEqual([
                [2, 0, 0],
                [0, 0.5, 0],
                [0, 0, 2]
            ]);
            expect(op.transVector).toEqual([0, 0, 0.5]);
        });

        test('more entries than 3', () => {
            expect(() => new SymmetryOperation('x,x,y,z')).toThrow('Symmetry operation must have exactly three components');
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
                new FractPosition(0.5, 0.25, 0.75)
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
                new UAnisoADP(0.01, 0.02, 0.03, 0.001, 0.002, 0.003)
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
                [0, 0, -1]
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
                [0, 0, -1]
            ]);
            expect(op.transVector).toEqual([0, 0, 0]);
        });

        test('throws error when no operations found', () => {
            const cifText = 'data_test\n_cell_length_a 5.0';
            const cif = new CIF(cifText);
            const block = cif.getBlock(0);
            expect(() => SymmetryOperation.fromCIF(block, 0))
                .toThrow('No symmetry operations found in CIF block');
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
                new SymmetryOperation('-x,-y,-z')
            ];
            const sym = new CellSymmetry('P-1', 2, ops);
            const point = [0.25, 0.25, 0.25];
            const positions = sym.generateEquivalentPositions(point);
            
            expect(positions).toHaveLength(2);
            expect(positions[0]).toEqual([0.25, 0.25, 0.25]);
            expect(positions[1]).toEqual([-0.25, -0.25, -0.25]);
        });
    });

    describe('applySymmetry', () => {
        test('applies symmetry operation with translation', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,y,-z')
            ];
            const sym = new CellSymmetry('P2/m', 10, ops);
            const atom = new Atom(
                'C1',
                'C',
                new FractPosition(0.5, 0.25, 0.75)
            );
            
            const result = sym.applySymmetry('2_456', atom);
            expect(result.position.x).toBeCloseTo(-1.5);
            expect(result.position.y).toBeCloseTo(0.25);
            expect(result.position.z).toBeCloseTo(0.25);
        });

        test('applies symmetry operation with translation to multiple atoms', () => {
            const ops = [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,y,-z')
            ];
            const sym = new CellSymmetry('P2/m', 10, ops);
            const atoms = [
                new Atom(
                    'C1',
                    'C',
                    new FractPosition(0.5, 0.25, 0.75)
                ),
                new Atom(
                    'B1',
                    'B',
                    new FractPosition(0.1, 0.9, -0.4)
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

        test('throws error for invalid symmetry operation number', () => {
            const ops = [new SymmetryOperation('x,y,z')];
            const sym = new CellSymmetry('P1', 1, ops);
            expect(() => sym.applySymmetry('2_555', {}))
                .toThrow('Invalid symmetry operation number: 2');
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
`,`
data_test2
_symmetry_space_group_name_H-M 'P 21/c'
_symmetry_Int_Tables_number 14
loop_
 _symmetry_equiv_id
 _symmetry_equiv_pos_as_xyz
 1 x,y,z
 2 -x,y+1/2,-z+1/2
 3 -x,-y,-z
 4 x,-y+1/2,z+1/2
`
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
                [0, 0, 1]
            ]);
        });
    });
});