import { create, all } from 'mathjs';

import { 
    CrystalStructure, UnitCell, Atom, inferElementFromLabel, 
} from './crystal.js';
import { Bond, HBond } from './bonds.js';
import { FractPosition } from './position.js';
import { UIsoADP, UAnisoADP } from './adp.js';
import { CIF } from '../read-cif/base.js';

const math = create(all);
describe('inferElementFromLabel', () => {
    // Test normal atom labels
    test('handles common crystallographic naming patterns', () => {
        expect(inferElementFromLabel('MgM1')).toBe('Mg');
        expect(inferElementFromLabel('SiT')).toBe('Si');
        expect(inferElementFromLabel('Mn1')).toBe('Mn');
        expect(inferElementFromLabel('H1')).toBe('H');
        expect(inferElementFromLabel('MG1')).toBe('Mg');
        expect(inferElementFromLabel('RH5')).toBe('Rh');
        expect(inferElementFromLabel('SO4')).toBe('S');
        expect(inferElementFromLabel('NH4')).toBe('N');
        expect(inferElementFromLabel('D2O')).toBe('D');
    });

    // Test pure element symbols with different capitalizations
    test('handles pure element symbols with various capitalizations', () => {
        expect(inferElementFromLabel('H')).toBe('H');
        expect(inferElementFromLabel('h')).toBe('H');
        expect(inferElementFromLabel('He')).toBe('He');
        expect(inferElementFromLabel('HE')).toBe('He');
        expect(inferElementFromLabel('he')).toBe('He');
    });

    // Test single-letter elements
    test('correctly identifies single-letter elements', () => {
        const singleLetterElements = ['H', 'B', 'C', 'N', 'O', 'F', 'P', 'S', 'K', 'V', 'Y', 'I', 'W', 'U', 'D'];
        singleLetterElements.forEach(element => {
            expect(inferElementFromLabel(`${element}1`)).toBe(element);
            expect(inferElementFromLabel(element.toLowerCase())).toBe(element);
        });
    });

    // Test two-letter elements
    test('correctly identifies two-letter elements', () => {
        const testCases = [
            'He', 'Li', 'Be', 'Na', 'Mg', 'Al', 'Si', 'Cl', 'Fe', 'Co',
            'Ni', 'Cu', 'Zn', 'Ag', 'Au', 
        ];
        
        testCases.forEach((element) => {
            expect(inferElementFromLabel(`${element}1`)).toBe(element);
            expect(inferElementFromLabel(element.toUpperCase())).toBe(element);
            expect(inferElementFromLabel(element.toLowerCase())).toBe(element);
        });
    });

    // Test ambiguous cases where two-letter match should take precedence
    test('prioritizes two-letter elements over single-letter ones', () => {
        expect(inferElementFromLabel('He1')).toBe('He'); // Should not match as 'H'
        expect(inferElementFromLabel('Na1')).toBe('Na'); // Should not match as 'N'
        expect(inferElementFromLabel('Cr1')).toBe('Cr'); // Should not match as 'C'
        expect(inferElementFromLabel('Br1')).toBe('Br'); // Should not match as 'B'
    });

    // Test invalid inputs
    test('throws error for invalid inputs', () => {
        expect(() => inferElementFromLabel('')).toThrow('Invalid atom label');
        expect(() => inferElementFromLabel(null)).toThrow('Invalid atom label');
        expect(() => inferElementFromLabel(undefined)).toThrow('Invalid atom label');
        expect(() => inferElementFromLabel(123)).toThrow('Invalid atom label');
        expect(() => inferElementFromLabel('Xx1')).toThrow('Could not infer element type');
        expect(() => inferElementFromLabel('QZ1')).toThrow('Could not infer element type');
        expect(() => inferElementFromLabel(' ')).toThrow('Could not infer element type');
    });

    // Test ionic notations
    test('handles various ionic notations', () => {
        expect(inferElementFromLabel('H+')).toBe('H');
        expect(inferElementFromLabel('OH-')).toBe('O');
        expect(inferElementFromLabel('Na+')).toBe('Na');
        expect(inferElementFromLabel('Na+0')).toBe('Na');
        expect(inferElementFromLabel('K1+')).toBe('K');
        expect(inferElementFromLabel('O2-')).toBe('O');
        expect(inferElementFromLabel('Zn2+')).toBe('Zn');
        expect(inferElementFromLabel('Zn+2')).toBe('Zn');
        expect(inferElementFromLabel('H+0')).toBe('H');
        expect(inferElementFromLabel('Fe3+')).toBe('Fe');
        expect(inferElementFromLabel('Fe+3')).toBe('Fe');
        expect(inferElementFromLabel('Ti4+')).toBe('Ti');
        expect(inferElementFromLabel('D+')).toBe('D');
    });
});

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

    test('fromCIF filters out dummy atoms', () => {
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
_atom_site_calc_flag
C1 C 0 0 0 .
C2 C 0 0 0 dum
C3 C . 0 0 .
C4 C 0 0 0 .`;
        const cif = new CIF(cifText);
        const structure = CrystalStructure.fromCIF(cif.getBlock(0));
        expect(structure.atoms.length).toBe(2);
        expect(structure.atoms.map(a => a.label)).toEqual(['C1', 'C4']);
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
            new HBond(
                'O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.',
            ),  // Regular H-bond in group 1
            new HBond(
                'N1', 'H1', 'F1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '2_665',
            ),  // Symmetry H-bond - should be excluded
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

    test('fromCIF throws informative error for missing parameters', () => {
        const cifText = `
data_test
_cell_length_a 10
_cell_length_c 20
_cell_angle_beta 90
_cell_angle_gamma 90
`;
        const cif = new CIF(cifText);
        expect(() => {
            UnitCell.fromCIF(cif.getBlock(0));
        }).toThrow(
            'Unit cell parameter entries missing in CIF for: b, alpha',
        );

    });

    test('fromCIF throws informative error for negative parameters', () => {
        const cifText = `
data_test
_cell_length_a 10
_cell_length_b 10
_cell_length_c -20
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma -90
`;
        const cif = new CIF(cifText);
        expect(() => {
            UnitCell.fromCIF(cif.getBlock(0));
        }).toThrow(
            'Unit cell parameter entries negative in CIF for: c, gamma',
        );

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

    test('rejects dummy atoms with invalid labels', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
. C 0 0 0
? C 0 0 0`;
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        expect(() => Atom.fromCIF(block, 0)).toThrow('Dummy atom: Invalid label');
        expect(() => Atom.fromCIF(block, 1)).toThrow('Dummy atom: Invalid label');
    });

    test('rejects dummy atoms with calc flag', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_calc_flag
C1 C 0 0 0 dum
C2 C 0 0 0 DUM`;
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        expect(() => Atom.fromCIF(block, 0)).toThrow('Dummy atom: calc_flag is dum');
        expect(() => Atom.fromCIF(block, 1)).toThrow('Dummy atom: calc_flag is dum');
    });

    test('rejects dummy atoms with invalid positions', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C . 0 0
C2 C 0 ? 0
C3 C 0 0 ?`;
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        expect(() => Atom.fromCIF(block, 0)).toThrow('Dummy atom: Invalid position');
        expect(() => Atom.fromCIF(block, 1)).toThrow('Dummy atom: Invalid position');
        expect(() => Atom.fromCIF(block, 2)).toThrow('Dummy atom: Invalid position');
    });

    test('rejects dummy atoms with invalid type', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 . 0 0 0
C2 ? 0 0 0`;
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        expect(() => Atom.fromCIF(block, 0)).toThrow('Dummy atom: Invalid atom type');
        expect(() => Atom.fromCIF(block, 1)).toThrow('Dummy atom: Invalid atom type');
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

    test('fromCIF creates atom missing atomType', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_U_iso_or_equiv
C1 0 0 0 0.05
    `;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.label).toBe('C1');
        expect(atom.atomType).toBe('C');
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
        expect(() => Atom.fromCIF(cif.getBlock(0), 0)).toThrow(
            'Atom C1 has ADP type Uani, but was not found in atom_site_aniso.label',
        );
    });
    test('handles Biso values', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
_atom_site_B_iso_or_equiv
C1 C 0 0 0 Biso 5.0
`;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.adp).toBeInstanceOf(UIsoADP);
        expect(atom.adp.uiso).toBeCloseTo(5.0 / (8 * Math.PI * Math.PI));
    });

    test('handles Bani values', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
_atom_site_biso
C1 C 0 0 0 Bani 0.03

loop_
_atom_site_aniso_label
_atom_site_aniso_B_11
_atom_site_aniso_B_22
_atom_site_aniso_B_33
_atom_site_aniso_B_12
_atom_site_aniso_B_13
_atom_site_aniso_B_23
C1 5.0 5.0 5.0 0 0 0
`;
        const cif = new CIF(cifText);
        const atom = Atom.fromCIF(cif.getBlock(0), 0);

        expect(atom.adp).toBeInstanceOf(UAnisoADP);
        const expectedU = 5.0 / (8 * Math.PI * Math.PI);
        expect(atom.adp.u11).toBeCloseTo(expectedU);
        expect(atom.adp.u22).toBeCloseTo(expectedU);
        expect(atom.adp.u33).toBeCloseTo(expectedU);
        expect(atom.adp.u12).toBeCloseTo(0);
        expect(atom.adp.u13).toBeCloseTo(0);
        expect(atom.adp.u23).toBeCloseTo(0);
    });

    test('throws error when Bani atom not found in aniso loop', () => {
        const cifText = `
data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_adp_type
C1 C 0 0 0 Bani

loop_
_atom_site_aniso_label
_atom_site_aniso_B_11
_atom_site_aniso_B_22
_atom_site_aniso_B_33
_atom_site_aniso_B_12
_atom_site_aniso_B_13
_atom_site_aniso_B_23
C2 5.0 5.0 5.0 0 0 0
`;
        const cif = new CIF(cifText);
        expect(() => Atom.fromCIF(cif.getBlock(0), 0))
            .toThrow('Atom C1 has ADP type Bani, but was not found in atom_site_aniso.label');
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
