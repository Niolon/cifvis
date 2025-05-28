import { describe, test, expect } from 'vitest';
import { CIF } from '../../../read-cif/base.js';
import { CrystalStructure } from '../../crystal.js';
import { growCell } from './grow-cell.js';

const cifText = `
data_CaF2
_symmetry_space_group_name_H-M   'F m -3 m'
_symmetry_Int_Tables_number   225
_cell_length_a   5.464
_cell_length_b   5.464
_cell_length_c   5.464
_cell_angle_alpha   90.0
_cell_angle_beta   90.0
_cell_angle_gamma   90.0

loop_
 _space_group_symop_operation_xyz
 'x, y, z'
 '-x, -y, z'
 '-x, y, -z'
 'x, -y, -z'
 'z, x, y'
 'z, -x, -y'
 '-z, -x, y'
 '-z, x, -y'
 'y, z, x'
 '-y, z, -x'
 'y, -z, -x'
 '-y, -z, x'
 'y, x, -z'
 '-y, -x, -z'
 'y, -x, z'
 '-y, x, z'
 'x, z, -y'
 '-x, z, y'
 '-x, -z, -y'
 'x, -z, y'
 'z, y, -x'
 'z, -y, x'
 '-z, y, x'
 '-z, -y, -x'
 'x, y+1/2, z+1/2'
 '-x, -y+1/2, z+1/2'
 '-x, y+1/2, -z+1/2'
 'x, -y+1/2, -z+1/2'
 'z, x+1/2, y+1/2'
 'z, -x+1/2, -y+1/2'
 '-z, -x+1/2, y+1/2'
 '-z, x+1/2, -y+1/2'
 'y, z+1/2, x+1/2'
 '-y, z+1/2, -x+1/2'
 'y, -z+1/2, -x+1/2'
 '-y, -z+1/2, x+1/2'
 'y, x+1/2, -z+1/2'
 '-y, -x+1/2, -z+1/2'
 'y, -x+1/2, z+1/2'
 '-y, x+1/2, z+1/2'
 'x, z+1/2, -y+1/2'
 '-x, z+1/2, y+1/2'
 '-x, -z+1/2, -y+1/2'
 'x, -z+1/2, y+1/2'
 'z, y+1/2, -x+1/2'
 'z, -y+1/2, x+1/2'
 '-z, y+1/2, x+1/2'
 '-z, -y+1/2, -x+1/2'
 'x+1/2, y, z+1/2'
 '-x+1/2, -y, z+1/2'
 '-x+1/2, y, -z+1/2'
 'x+1/2, -y, -z+1/2'
 'z+1/2, x, y+1/2'
 'z+1/2, -x, -y+1/2'
 '-z+1/2, -x, y+1/2'
 '-z+1/2, x, -y+1/2'
 'y+1/2, z, x+1/2'
 '-y+1/2, z, -x+1/2'
 'y+1/2, -z, -x+1/2'
 '-y+1/2, -z, x+1/2'
 'y+1/2, x, -z+1/2'
 '-y+1/2, -x, -z+1/2'
 'y+1/2, -x, z+1/2'
 '-y+1/2, x, z+1/2'
 'x+1/2, z, -y+1/2'
 '-x+1/2, z, y+1/2'
 '-x+1/2, -z, -y+1/2'
 'x+1/2, -z, y+1/2'
 'z+1/2, y, -x+1/2'
 'z+1/2, -y, x+1/2'
 '-z+1/2, y, x+1/2'
 '-z+1/2, -y, -x+1/2'
 'x+1/2, y+1/2, z'
 '-x+1/2, -y+1/2, z'
 '-x+1/2, y+1/2, -z'
 'x+1/2, -y+1/2, -z'
 'z+1/2, x+1/2, y'
 'z+1/2, -x+1/2, -y'
 '-z+1/2, -x+1/2, y'
 '-z+1/2, x+1/2, -y'
 'y+1/2, z+1/2, x'
 '-y+1/2, z+1/2, -x'
 'y+1/2, -z+1/2, -x'
 '-y+1/2, -z+1/2, x'
 'y+1/2, x+1/2, -z'
 '-y+1/2, -x+1/2, -z'
 'y+1/2, -x+1/2, z'
 '-y+1/2, x+1/2, z'
 'x+1/2, z+1/2, -y'
 '-x+1/2, z+1/2, y'
 '-x+1/2, -z+1/2, -y'
 'x+1/2, -z+1/2, y'
 'z+1/2, y+1/2, -x'
 'z+1/2, -y+1/2, x'
 '-z+1/2, y+1/2, x'
 '-z+1/2, -y+1/2, -x'
 '-x, -y, -z'
 'x, y, -z'
 'x, -y, z'
 '-x, y, z'
 '-z, -x, -y'
 '-z, x, y'
 'z, x, -y'
 'z, -x, y'
 '-y, -z, -x'
 'y, -z, x'
 '-y, z, x'
 'y, z, -x'
 '-y, -x, z'
 'y, x, z'
 '-y, x, -z'
 'y, -x, -z'
 '-x, -z, y'
 'x, -z, -y'
 'x, z, y'
 '-x, z, -y'
 '-z, -y, x'
 '-z, y, -x'
 'z, -y, -x'
 'z, y, x'
 '-x, -y+1/2, -z+1/2'
 'x, y+1/2, -z+1/2'
 'x, -y+1/2, z+1/2'
 '-x, y+1/2, z+1/2'
 '-z, -x+1/2, -y+1/2'
 '-z, x+1/2, y+1/2'
 'z, x+1/2, -y+1/2'
 'z, -x+1/2, y+1/2'
 '-y, -z+1/2, -x+1/2'
 'y, -z+1/2, x+1/2'
 '-y, z+1/2, x+1/2'
 'y, z+1/2, -x+1/2'
 '-y, -x+1/2, z+1/2'
 'y, x+1/2, z+1/2'
 '-y, x+1/2, -z+1/2'
 'y, -x+1/2, -z+1/2'
 '-x, -z+1/2, y+1/2'
 'x, -z+1/2, -y+1/2'
 'x, z+1/2, y+1/2'
 '-x, z+1/2, -y+1/2'
 '-z, -y+1/2, x+1/2'
 '-z, y+1/2, -x+1/2'
 'z, -y+1/2, -x+1/2'
 'z, y+1/2, x+1/2'
 '-x+1/2, -y, -z+1/2'
 'x+1/2, y, -z+1/2'
 'x+1/2, -y, z+1/2'
 '-x+1/2, y, z+1/2'
 '-z+1/2, -x, -y+1/2'
 '-z+1/2, x, y+1/2'
 'z+1/2, x, -y+1/2'
 'z+1/2, -x, y+1/2'
 '-y+1/2, -z, -x+1/2'
 'y+1/2, -z, x+1/2'
 '-y+1/2, z, x+1/2'
 'y+1/2, z, -x+1/2'
 '-y+1/2, -x, z+1/2'
 'y+1/2, x, z+1/2'
 '-y+1/2, x, -z+1/2'
 'y+1/2, -x, -z+1/2'
 '-x+1/2, -z, y+1/2'
 'x+1/2, -z, -y+1/2'
 'x+1/2, z, y+1/2'
 '-x+1/2, z, -y+1/2'
 '-z+1/2, -y, x+1/2'
 '-z+1/2, y, -x+1/2'
 'z+1/2, -y, -x+1/2'
 'z+1/2, y, x+1/2'
 '-x+1/2, -y+1/2, -z'
 'x+1/2, y+1/2, -z'
 'x+1/2, -y+1/2, z'
 '-x+1/2, y+1/2, z'
 '-z+1/2, -x+1/2, -y'
 '-z+1/2, x+1/2, y'
 'z+1/2, x+1/2, -y'
 'z+1/2, -x+1/2, y'
 '-y+1/2, -z+1/2, -x'
 'y+1/2, -z+1/2, x'
 '-y+1/2, z+1/2, x'
 'y+1/2, z+1/2, -x'
 '-y+1/2, -x+1/2, z'
 'y+1/2, x+1/2, z'
 '-y+1/2, x+1/2, -z'
 'y+1/2, -x+1/2, -z'
 '-x+1/2, -z+1/2, y'
 'x+1/2, -z+1/2, -y'
 'x+1/2, z+1/2, y'
 '-x+1/2, z+1/2, -y'
 '-z+1/2, -y+1/2, x'
 '-z+1/2, y+1/2, -x'
 'z+1/2, -y+1/2, -x'
 'z+1/2, y+1/2, x'

loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_U_iso_or_equiv
 _atom_site_adp_type
 _atom_site_occupancy
 _atom_site_site_symmetry_order  
 _atom_site_calc_flag
 _atom_site_refinement_flags_posn
 _atom_site_refinement_flags_adp
 _atom_site_refinement_flags_occupancy
 _atom_site_disorder_assembly
 _atom_site_disorder_group
Ca01 Ca 0.500000 0.500000 0.500000 0.00321(6) Uani 1 48 d S T P . .
F002 F 0.250000 0.750000 0.750000 0.00486(8) Uani 1 24 d S T P . .

loop_
 _atom_site_aniso_label
 _atom_site_aniso_U_11
 _atom_site_aniso_U_22
 _atom_site_aniso_U_33
 _atom_site_aniso_U_23
 _atom_site_aniso_U_13
 _atom_site_aniso_U_12
Ca01 0.00321(6) 0.00321(6) 0.00321(6) 0.000 0.000 0.000
F002 0.00486(8) 0.00486(8) 0.00486(8) 0.000 0.000 0.000

loop_
 _geom_bond_atom_site_label_1
 _geom_bond_atom_site_label_2
 _geom_bond_distance
 _geom_bond_site_symmetry_2
 _geom_bond_publ_flag
Ca01 F002 2.36033(3) 121_666 ?
Ca01 F002 2.36033(2) 25_544 ?
Ca01 F002 2.36033(3) 169_566 ?
Ca01 F002 2.36033(3) 145_566 ?
Ca01 F002 2.36033(3) . ?
Ca01 F002 2.36033(3) 97_666 ?
Ca01 F002 2.36033(3) 73_545 ?
Ca01 F002 2.36033(3) 49_554 ?
Ca01 Ca01 3.85441(4) 25 ?
Ca01 Ca01 3.85441(4) 49 ?
Ca01 Ca01 3.85441(4) 73_445 ?
Ca01 Ca01 3.85441(4) 49_454 ?
`;

describe('growCell with CaF2', () => {
    let structure;
    
    beforeEach(async () => {
        // Read the actual CaF2.cif file
        const cif = new CIF(cifText);
        structure = CrystalStructure.fromCIF(cif.getBlock(0));
    });

    test('should create expected number of atoms', () => {
        expect(structure.atoms.length).toBe(2); // Ca01 and F002
        
        const grownStructure = growCell(structure, true);
        
        console.log('Original atoms:', structure.atoms.length);
        console.log('Grown atoms:', grownStructure.atoms.length);
        console.log('Original bonds:', structure.bonds.length);
        console.log('Grown bonds:', grownStructure.bonds.length);
        
        // Log first few atoms with their labels and positions
        console.log('First few grown atoms:');
        grownStructure.atoms.slice(0, 10).forEach(atom => {
            console.log(`  ${atom.label}: (${atom.position.x.toFixed(3)}, ${atom.position.y.toFixed(3)}, ${atom.position.z.toFixed(3)})`);
        });
        
        // Log bonds
        console.log('Bonds:');
        grownStructure.bonds.forEach(bond => {
            console.log(`  ${bond.atom1Label} - ${bond.atom2Label}: ${bond.bondLength?.toFixed(3) || 'N/A'} Å (symm: ${bond.atom2SiteSymmetry || '.'})`);
        });
        
        // Expected number of atoms in CaF2 unit cell:
        // - Ca at (0.5, 0.5, 0.5) with 48-fold site symmetry -> 4 unique Ca positions 
        // - F at (0.25, 0.75, 0.75) with 24-fold site symmetry -> 8 unique F positions
        // Total: 12 atoms in unit cell
        expect(grownStructure.atoms.length).toBeGreaterThan(structure.atoms.length);
        
        // Check that we have Ca-F bonds
        const caFBonds = grownStructure.bonds.filter(bond => 
            (bond.atom1Label.startsWith('Ca') && bond.atom2Label.startsWith('F')) ||
            (bond.atom1Label.startsWith('F') && bond.atom2Label.startsWith('Ca')),
        );
        
        console.log('Ca-F bonds found:', caFBonds.length);
        expect(caFBonds.length).toBeGreaterThan(0);
    });

    test('should process inter-group bonds correctly', () => {
        console.log('Original structure info:');
        console.log('Atoms:', structure.atoms.map(a => `${a.label}: (${a.position.x}, ${a.position.y}, ${a.position.z})`));
        console.log('Original bonds from CIF:', structure.bonds.length);
        
        structure.bonds.forEach(bond => {
            console.log(`  Original bond: ${bond.atom1Label} - ${bond.atom2Label}, symm: ${bond.atom2SiteSymmetry}`);
        });
        
        // Analyze the connected groups
        const atomGroups = structure.calculateConnectedGroups();
        console.log('Connected groups:', atomGroups.length);
        atomGroups.forEach((group, i) => {
            console.log(`  Group ${i}: ${group.atoms.length} atoms, ${group.bonds.length} bonds`);
            group.atoms.forEach(atom => {
                console.log(`    Atom: ${atom.label}: (${atom.position.x}, ${atom.position.y}, ${atom.position.z})`);
            });
        });
        
        const grownStructure = growCell(structure, true);
        
        console.log('After growing:');
        console.log('Total atoms:', grownStructure.atoms.length);
        console.log('Total bonds:', grownStructure.bonds.length);
        
        // Check bonds with symmetry operations
        const interGroupBonds = structure.bonds.filter(b => b.atom2SiteSymmetry && b.atom2SiteSymmetry !== '.');
        console.log('Inter-group bonds from original structure:', interGroupBonds.length);
        
        interGroupBonds.forEach(bond => {
            console.log(`  Inter-group bond: ${bond.atom1Label} - ${bond.atom2Label}, symm: ${bond.atom2SiteSymmetry}, length: ${bond.bondLength}`);
        });
        
        expect(grownStructure.bonds.length).toBeGreaterThan(0);
    });

    test('should debug atom translation handling', () => {
        const grownStructure = growCell(structure, true);
        
        // Look for atoms that might have been translated
        const atomsOutsideOriginalCell = grownStructure.atoms.filter(atom => 
            atom.position.x < 0 || atom.position.x >= 1 ||
            atom.position.y < 0 || atom.position.y >= 1 ||
            atom.position.z < 0 || atom.position.z >= 1,
        );
        
        console.log('Atoms outside unit cell after growing:', atomsOutsideOriginalCell.length);
        
        // All atoms should be within the unit cell when moveAtomsInsideCell=true
        expect(atomsOutsideOriginalCell.length).toBe(0);
        
        // Check for atoms with complex labels indicating symmetry operations
        const symmAtoms = grownStructure.atoms.filter(atom => atom.label.includes('@'));
        console.log('Atoms with symmetry labels:', symmAtoms.length);
        
        symmAtoms.slice(0, 5).forEach(atom => {
            console.log(`  ${atom.label}: (${atom.position.x.toFixed(3)}, ${atom.position.y.toFixed(3)}, ${atom.position.z.toFixed(3)})`);
        });
        
        expect(symmAtoms.length).toBeGreaterThan(0);
    });

    test('should create bonds between translated atoms', () => {
        // Create a simpler test case to debug the translation issue
        const grownStructure = growCell(structure, true);
        
        // Find Ca atoms
        const caAtoms = grownStructure.atoms.filter(atom => atom.label.startsWith('Ca'));
        const fAtoms = grownStructure.atoms.filter(atom => atom.label.startsWith('F'));
        
        console.log('Ca atoms in grown structure:', caAtoms.length);
        console.log('F atoms in grown structure:', fAtoms.length);
        
        caAtoms.slice(0, 3).forEach(atom => {
            console.log(`  Ca: ${atom.label}: (${atom.position.x.toFixed(3)}, ${atom.position.y.toFixed(3)}, ${atom.position.z.toFixed(3)})`);
        });
        
        fAtoms.slice(0, 3).forEach(atom => {
            console.log(`  F: ${atom.label}: (${atom.position.x.toFixed(3)}, ${atom.position.y.toFixed(3)}, ${atom.position.z.toFixed(3)})`);
        });
        
        // Calculate expected distance between Ca and F in CaF2
        // Ca at (0.5, 0.5, 0.5) and F at (0.25, 0.75, 0.75)
        // Should be about 2.36 Å based on the CIF file
        
        // Find bonds between Ca and F
        const caFBonds = grownStructure.bonds.filter(bond => 
            (bond.atom1Label.startsWith('Ca') && bond.atom2Label.startsWith('F')) ||
            (bond.atom1Label.startsWith('F') && bond.atom2Label.startsWith('Ca')),
        );
        
        console.log('Ca-F bonds found:', caFBonds.length);
        caFBonds.forEach(bond => {
            console.log(`  ${bond.atom1Label} - ${bond.atom2Label}: ${bond.bondLength?.toFixed(3) || 'N/A'} Å`);
        });
        
        // We expect to find Ca-F bonds since they're specified in the CIF
        expect(caFBonds.length).toBeGreaterThan(0);
    });
});
