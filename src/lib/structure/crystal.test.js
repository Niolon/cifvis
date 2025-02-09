import { create, all } from 'mathjs';
import { CrystalStructure, UnitCell, Atom, Bond, HBond, UIsoADP, UAnisoADP, FractPosition, BasePosition, CartPosition } from './crystal.js';
import { CIF } from '../cif/read-cif.js';

const math = create(all);

describe('CrystalStructure', () => {
    test('constructs with minimal parameters', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [new Atom('C1', 'C', new FractPosition(0, 0, 0))];
        const structure = new CrystalStructure(cell, atoms);

        expect(structure.cell).toBe(cell);
        expect(structure.atoms).toEqual(atoms);
        expect(structure.bonds).toEqual([]);
        expect(structure.hBonds).toEqual([]);
    });

    test('fromCIF creates complete structure', () => {
        const cifText = `
data_test
 _cell_length_a 10
 _cell_length_b 10
 _cell_length_c 10
 _cell_angle_alpha 90
 _cell_angle_beta 90
 _cell_angle_gamma 90
 
 loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 C1 C 0 0 0
 O1 O 0.5 0.5 0.5
 H1 H 0.1 0.1 0.1
 
 loop_
 _geom_bond_atom_site_label_1
 _geom_bond_atom_site_label_2
 _geom_bond_distance
 C1 O1 1.5
 
 loop_
 _geom_hbond_atom_site_label_D
 _geom_hbond_atom_site_label_H
 _geom_hbond_atom_site_label_A
 _geom_hbond_distance_DH
 _geom_hbond_distance_HA
 _geom_hbond_distance_DA
 _geom_hbond_angle_DHA
 O1 H1 C1 1.0 2.0 2.8 175
 `;
 
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
 
        expect(structure.atoms).toHaveLength(3);
        expect(structure.bonds).toHaveLength(1);
        expect(structure.hBonds).toHaveLength(1);
        expect(structure.atoms[0].label).toBe('C1');
        expect(structure.bonds[0].atom1Label).toBe('C1');
        expect(structure.hBonds[0].donorAtomLabel).toBe('O1');
    });

    test('getAtomByLabel returns correct atom', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),
        ];
        const structure = new CrystalStructure(cell, atoms);

        const atom = structure.getAtomByLabel('C1');
        expect(atom.atomType).toBe('C');
        expect(() => structure.getAtomByLabel('X1')).toThrow();
    });

    test('findConnectedGroups identifies correct groups', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),
            new Atom('N1', 'N', new FractPosition(0.7, 0.7, 0.7)),
            new Atom('H1', 'H', new FractPosition(0.3, 0.4, 0.5)),
        ];
        const bonds = [
            new Bond('C1', 'O1', 1.5),
            new Bond('C1', 'N1', 1.5),
        ];
        const hBonds = [
            new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),
        ];

        const structure = new CrystalStructure(cell, atoms, bonds, hBonds);
        const groups = structure.connectedGroups;

        expect(groups).toHaveLength(2);
        expect(groups[0].atoms).toHaveLength(3);
    });

    test('findConnectedGroups handles complex connectivity correctly', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),
            new Atom('N1', 'N', new FractPosition(0.7, 0.7, 0.7)),
            new Atom('H1', 'H', new FractPosition(0.3, 0.4, 0.5)),
            new Atom('P1', 'P', new FractPosition(0.8, 0.8, 0.8)), // Unconnected atom
            new Atom('F1', 'F', new FractPosition(0.9, 0.9, 0.9)),  // Symmetry-only connected atom
        ];
        const bonds = [
            new Bond('C1', 'O1', 1.5),           // Regular bond forming group 1
            new Bond('O1', 'N1', 1.5),
            new Bond('C1', 'F1', 1.5, null, '2_665'),  // Symmetry bond - should be excluded
        ];
        const hBonds = [
            new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),  // Regular H-bond in group 1
            new HBond('N1', 'H1', 'F1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '2_665'),  // Symmetry H-bond - should be excluded
        ];

        const structure = new CrystalStructure(cell, atoms, bonds, hBonds);
        const groups = structure.connectedGroups;

        // Group 1: C1-O1-N1-H1 connected by regular bonds and H-bonds
        // Group 2: P1 alone (unconnected)
        // Group 3: F1 alone (only symmetry connections)
        expect(groups).toHaveLength(4);

        // Find main connected group
        const mainGroup = groups.find(g => g.atoms.length > 1);
        expect(mainGroup.atoms).toHaveLength(3);  // C1, O1, N1
        expect(mainGroup.atoms.map(a => a.label).sort()).toEqual(['C1', 'N1', 'O1']);
        expect(mainGroup.bonds).toHaveLength(2);  // C1-O1, O1-N1
        expect(mainGroup.hBonds).toHaveLength(1); // O1-H1-N1

        // Check isolated atoms are in their own groups
        const singleAtomGroups = groups.filter(g => g.atoms.length === 1);
        expect(singleAtomGroups).toHaveLength(3);
        //const test = singleAtomGroups.map(g => g.atoms[0].label).sort();
        expect(singleAtomGroups.map(g => g.atoms[0].label).sort()).toEqual(['F1', 'H1', 'P1']);
        expect(singleAtomGroups.every(g => g.bonds.length === 0)).toBe(true);
        expect(singleAtomGroups.every(g => g.hBonds.length === 0)).toBe(true);
    });

    test('group merging logic handles all cases correctly', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.1, 0.1, 0.1)),
            new Atom('N1', 'N', new FractPosition(0.2, 0.2, 0.2)),
            new Atom('C2', 'C', new FractPosition(0.3, 0.3, 0.3)),
            new Atom('H1', 'H', new FractPosition(0.3, 0.4, 0.5)),
        ];
    
        // Test cases:
        // 1. New group: C1-O1 bond
        // 2. Add to existing: O1-N1 bond 
        // 3. Merge groups: N1-C2 bond exists, then C2-C1 bond merges groups
        const bonds = [
            new Bond('C1', 'O1', 1.5),
            new Bond('O1', 'H1', 0.98),
            new Bond('N1', 'C2', 1.3),
            new Bond('C2', 'C1', 1.5),
            new Bond('O1', 'N1', 1.4),
        ];

        const hbonds = [
            new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),
        ];

        const structure = new CrystalStructure(cell, atoms, bonds, hbonds);
        const groups = structure.connectedGroups;

        expect(groups).toHaveLength(1);
        const group = groups[0];
        expect(group.atoms.length).toBe(5);
        expect(group.bonds.length).toBe(5);
        atoms.forEach(atom => 
            expect(group.atoms.includes(atom)).toBe(true),
        );
    });
    test('logs warning when no bonds found in CIF', () => {
        const consoleSpy = jest.spyOn(console, 'warn');
        const cifText = `
data_test
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0
`;
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));

        expect(consoleSpy).toHaveBeenCalledWith('No bonds found in CIF file');
        expect(structure.bonds).toHaveLength(0);
        consoleSpy.mockRestore();
    });

    test('logs warning when no H-bonds found in CIF', () => {
        const consoleSpy = jest.spyOn(console, 'warn'); 
        const cifText = `
data_test
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0
`;
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));

        expect(consoleSpy).toHaveBeenCalledWith('No hydrogen bonds found in CIF file');
        expect(structure.hBonds).toHaveLength(0);
        consoleSpy.mockRestore();
    });
  
});

describe('UnitCell', () => {
    test('constructs with valid parameters', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        expect(cell.a).toBe(10);
        expect(cell.fractToCartMatrix).toBeDefined();
    });
    
    test('fromCIF creates correct cell', () => {
        const cifText = `
data_test
_cell_length_a 10
_cell_length_b 15
_cell_length_c 20
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
`;
        const cif = new CIF(cifText);
        const cell = UnitCell.fromCIF(cif.getBlock(0));
    
        expect(cell.a).toBe(10);
        expect(cell.b).toBe(15);
        expect(cell.c).toBe(20);
    });
    
    describe('parameter validation', () => {
        let cell;
        
        beforeEach(() => {
            cell = new UnitCell(10, 10, 10, 90, 90, 90);
        });
    
        test('validates cell lengths', () => {
            expect(() => {
                cell.a = 0; 
            }).toThrow('Cell parameter \'a\' must be positive');
            expect(() => {
                cell.b = -1; 
            }).toThrow('Cell parameter \'b\' must be positive');
            expect(() => {
                cell.c = -5; 
            }).toThrow('Cell parameter \'c\' must be positive');
        });
    
        test('validates angles', () => {
            expect(() => {
                cell.alpha = 0; 
            }).toThrow('Angle alpha must be between 0 and 180 degrees');
            expect(() => {
                cell.beta = 180; 
            }).toThrow('Angle beta must be between 0 and 180 degrees');
            expect(() => {
                cell.gamma = -1; 
            }).toThrow('Angle gamma must be between 0 and 180 degrees');
            expect(() => {
                cell.alpha = 200; 
            }).toThrow('Angle alpha must be between 0 and 180 degrees');
        });
    
        test('allows valid parameters', () => {
            expect(() => {
                cell.a = 15; 
            }).not.toThrow();
            expect(() => {
                cell.alpha = 120; 
            }).not.toThrow();
        });
    });
    
    describe('fractToCartMatrix updates', () => {
        let cell;
        let originalMatrix;
        
        beforeEach(() => {
            cell = new UnitCell(10, 10, 10, 90, 90, 90);
            originalMatrix = math.clone(cell.fractToCartMatrix);
        });
    
        test('updates matrix when changing lengths', () => {
            cell.a = 15;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
          
            originalMatrix = math.clone(cell.fractToCartMatrix);
            cell.b = 12;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
          
            originalMatrix = math.clone(cell.fractToCartMatrix);
            cell.c = 8;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
        });
    
        test('updates matrix when changing angles', () => {
            cell.alpha = 100;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
          
            originalMatrix = math.clone(cell.fractToCartMatrix);
            cell.beta = 95;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
          
            originalMatrix = math.clone(cell.fractToCartMatrix);
            cell.gamma = 120;
            expect(math.deepEqual(cell.fractToCartMatrix, originalMatrix)).toBe(false);
        });
    });
});

describe('Atom', () => {
    test('constructs with basic parameters', () => {
        const atom = new Atom('C1', 'C', new FractPosition(0, 0, 0), 0, 0);
        expect(atom.label).toBe('C1');
        expect(atom.atomType).toBe('C');
        expect(atom.disorderGroup).toBe(0);
    });

    test('fromCIF creates atom with isotropic ADP', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 C 0 0 0 0.05
    `;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.label).toBe('C1');
        expect(atom.adp).toBeInstanceOf(UIsoADP);
        expect(atom.adp.uiso).toBe(0.05);
    });

    test('fromCIF creates atom with anisotropic ADP', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
C1 C 0 0 0 Uani

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
C1 0.05 0.05 0.05 0 0 0
    `;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.adp).toBeInstanceOf(UAnisoADP);
        expect(atom.adp.u11).toBe(0.05);
    });

    test('fromCIF throws error if atom with Uani not in atom_site_aniso loop', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
C1 C 0 0 0 Uani

loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
_atom_site_aniso_U_33
_atom_site_aniso_U_12
_atom_site_aniso_U_13
_atom_site_aniso_U_23
N1 0.05 0.05 0.05 0 0 0
    `;
        const cif = new CIF(cifText);
        expect(() => Atom.fromCIF(cif.getBlock(0), 0)).toThrow('Atom C1 has ADP type Uani, but was not found in atom_site_aniso.label');
    });

    test('fromCIF creates atom with label or index', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0 0 0`;
 
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
 
        // Test creation with index
        const atomFromIndex = Atom.fromCIF(block, 0);
        expect(atomFromIndex.label).toBe('C1');
 
        // Test creation with label
        const atomFromLabel = Atom.fromCIF(block, null, 'C1');
        expect(atomFromLabel.label).toBe('C1');
 
        // Test error when both missing
        expect(() => Atom.fromCIF(block)).toThrow('either atomIndex or atomLabel need to be provided');
    });

    test('handles disorder groups', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_disorder_group
C1 C 0 0 0 1
    `;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.disorderGroup).toBe(1);
    });
});

describe('Position Classes', () => {
    const unitCell = new UnitCell(10, 10, 10, 90, 90, 90);

    test('Position base class cannot be instantiated directly', () => {
        expect(() => new BasePosition(1, 2, 3))
            .toThrow('Position is an abstract class and cannot be instantiated directly');
    });

    test('Position provides array-like access', () => {
        const pos = new FractPosition(1, 2, 3);
        expect(pos[0]).toBe(1);
        expect(pos[1]).toBe(2);
        expect(pos[2]).toBe(3);
        expect([...pos]).toEqual([1, 2, 3]);
    });

    test('Position getters/setters work correctly', () => {
        const pos = new FractPosition(1, 2, 3);
      
        pos.x = 4;
        pos.y = 5;
        pos.z = 6;

        expect(pos.x).toBe(4);
        expect(pos.y).toBe(5);
        expect(pos.z).toBe(6);
        expect([...pos]).toEqual([4, 5, 6]);
    });

    test('FractPosition converts to CartPosition correctly', () => {
        const fPos = new FractPosition(0.5, 0.5, 0.5);
        const cPos = fPos.toCartesian(unitCell);
      
        expect(cPos).toBeInstanceOf(CartPosition);
        expect(cPos.x).toBeCloseTo(5.0);
        expect(cPos.y).toBeCloseTo(5.0);
        expect(cPos.z).toBeCloseTo(5.0);
    });

    test('CartPosition toCartesian returns self', () => {
        const cPos = new CartPosition(5, 5, 5);
        const result = cPos.toCartesian(unitCell);
      
        expect(result).toBe(cPos);
    });

    test('toCartesian throws error if not implemented', () => {
        class TestPosition extends BasePosition {}

        const testPosition = new TestPosition(0.0, 0.0, 0.0);
        expect(() => testPosition.toCartesian()).toThrow('toCartesian must be implemented by subclass');
    });
});

describe('Bond', () => {
    test('constructs with minimal parameters', () => {
        const bond = new Bond('C1', 'O1');
        expect(bond.atom1Label).toBe('C1');
        expect(bond.atom2Label).toBe('O1');
        expect(bond.bondLength).toBeNull();
    });

    test('fromCIF creates complete bond', () => {
        const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_2
C1 O1 1.5 2_665
    `;
        const cif = new CIF(cifText);
        const bond = Bond.fromCIF(cif.getBlock(0), 0);

        expect(bond.atom1Label).toBe('C1');
        expect(bond.atom2Label).toBe('O1');
        expect(bond.bondLength).toBe(1.5);
        expect(bond.atom2SiteSymmetry).toBe('2_665');
    });
});

describe('HBond', () => {
    test('constructs with all parameters', () => {
        const hBond = new HBond(
            'O1', 'H1', 'O2',
            1.0, 0.01, 2.0, 0.02,
            2.8, 0.03, 175, 1, '1_555',
        );
        expect(hBond.donorAtomLabel).toBe('O1');
        expect(hBond.hydrogenAtomLabel).toBe('H1');
        expect(hBond.acceptorAtomLabel).toBe('O2');
        expect(hBond.acceptorAtomSymmetry).toBe('1_555');
    });

    test('fromCIF creates complete hydrogen bond', () => {
        const cifText = `
data_test
loop_
_geom_hbond_atom_site_label_D
_geom_hbond_atom_site_label_H
_geom_hbond_atom_site_label_A
_geom_hbond_distance_DH
_geom_hbond_distance_HA
_geom_hbond_distance_DA
_geom_hbond_angle_DHA
_geom_hbond_site_symmetry_A
O1 H1 O2 1.0 2.0 2.8 175 1_555
`;
        const cif = new CIF(cifText);
        const hBond = HBond.fromCIF(cif.getBlock(0), 0);

        expect(hBond.donorAtomLabel).toBe('O1');
        expect(hBond.hydrogenAtomLabel).toBe('H1');
        expect(hBond.acceptorAtomSymmetry).toBe('1_555');
    });
});

describe('ADPs', () => {
    test('UIsoADP stores single parameter', () => {
        const adp = new UIsoADP(0.05);
        expect(adp.uiso).toBe(0.05);
    });

    test('UAnisoADP calculates cartesian parameters', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const adp = new UAnisoADP(0.05, 0.05, 0.05, 0, 0, 0);
        const cartParams = adp.getUCart(cell);
    
        expect(cartParams).toHaveLength(6);
        expect(cartParams[0]).toBeCloseTo(0.05);
    });

    describe('UAnisoADP getEllipsoidMatrix', () => {
        let mockUnitCell;
    
        beforeEach(() => {
            mockUnitCell = {
                fractToCartMatrix: math.matrix([
                    [10, 0, 0],
                    [0, 10, 0],
                    [0, 0, 10],
                ]),
            };
        });

        test('handles symmetric ADP matrix', () => {
            const adp = new UAnisoADP(0.01, 0.01, 0.01, 0, 0, 0);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
            //const rowMagnitudes = [];
            for (let i = 0; i < 3; i++) {
                const row = [
                    matrix.get([i, 0]),
                    matrix.get([i, 1]),
                    matrix.get([i, 2]),
                ];
                // Each row should have two zeros and one value abs(sqrt(0.01))
                expect(row.filter(v => Math.abs(v) < 1e-10)).toHaveLength(2);
                expect(Math.max(...row.map(Math.abs))).toBeCloseTo(0.1, 5);
            }
        });

        test('normalizes eigenvectors when determinant ≠ 1', () => {
            const adp = new UAnisoADP(0.02, 0.01, 0.03, 0.005, 0.008, 0.002);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
            const det = math.det(matrix);
      
            expect(det).toBeGreaterThan(0.0);

            const mockUnitCell2 = {
                fractToCartMatrix: math.matrix([
                    [0, 0, 10],
                    [0, 10, 0],
                    [10, 0, 0],
                ]),
            };
            const matrix2 = adp.getEllipsoidMatrix(mockUnitCell2);
            const det2 = math.det(matrix2);
      
            expect(det2).toBeGreaterThan(0.0);
        });

        test('transforms diagonal ADPs correctly', () => {
            const adp = new UAnisoADP(0.01, 0.02, 0.03, 0, 0, 0);
            const matrix = adp.getEllipsoidMatrix(mockUnitCell);
      
            // For diagonal ADPs, each row should have exactly one non-zero value
            // equal to sqrt(Uii), with the other two values being zero
            const expectedValues = [0.1, Math.sqrt(0.02), Math.sqrt(0.03)];
      
            // Count occurrences of each expected value in matrix rows
            const rowMagnitudes = [];
            for (let i = 0; i < 3; i++) {
                const row = [
                    matrix.get([i, 0]),
                    matrix.get([i, 1]),
                    matrix.get([i, 2]),
                ];
                // Each row should have two zeros and one value from expectedValues
                expect(row.filter(v => Math.abs(v) < 1e-10)).toHaveLength(2);
                rowMagnitudes.push(Math.max(...row.map(Math.abs)));
            }
      
            // Check that each expected value appears exactly once
            expectedValues.forEach(expected => {
                expect(rowMagnitudes.filter(v => Math.abs(v - expected) < 1e-10)).toHaveLength(1);
            });
        });
    });
});