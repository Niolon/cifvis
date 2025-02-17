
import { Bond, HBond, BondsFactory } from './bonds.js';
import { CIF } from '../cif/read-cif.js';

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

describe('BondsFactory', () => {
    describe('createBonds', () => {
        test('creates regular bonds', () => {
            const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_2
C1 O1 1.5 .
C1 N1 1.4 .`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['C1', 'O1', 'N1']);
            const bonds = BondsFactory.createBonds(cif.getBlock(0), validAtoms);

            expect(bonds).toHaveLength(2);
            expect(bonds[0].atom1Label).toBe('C1');
            expect(bonds[0].atom2Label).toBe('O1');
            expect(bonds[1].atom1Label).toBe('C1');
            expect(bonds[1].atom2Label).toBe('N1');
        });

        test('filters out invalid centroid bonds', () => {
            const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
C1 O1 1.5
Cg1 N1 1.4
C1 Cnt1 1.4`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['C1', 'O1', 'N1']);
            const bonds = BondsFactory.createBonds(cif.getBlock(0), validAtoms);

            expect(bonds).toHaveLength(1);
            expect(bonds[0].atom1Label).toBe('C1');
            expect(bonds[0].atom2Label).toBe('O1');
        });

        test('includes centroid bonds if in atom list', () => {
            const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
C1 O1 1.5
Cg1 N1 1.4
C1 Cnt1 1.4`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['C1', 'O1', 'N1', 'Cg1', 'Cnt1']);
            const bonds = BondsFactory.createBonds(cif.getBlock(0), validAtoms);

            expect(bonds).toHaveLength(3);
        });

        test('handles missing bond data gracefully', () => {
            const cifText = 'data_test\n_cell_length_a 5.0';
            const cif = new CIF(cifText);
            const validAtoms = new Set(['C1']);
            
            const consoleSpy = jest.spyOn(console, 'warn');
            const bonds = BondsFactory.createBonds(cif.getBlock(0), validAtoms);
            
            expect(bonds).toHaveLength(0);
            expect(consoleSpy).toHaveBeenCalledWith('No bonds found in CIF file');
            consoleSpy.mockRestore();
        });
    });

    describe('createHBonds', () => {
        test('creates regular hydrogen bonds', () => {
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
O1 H1 N1 1.0 2.0 2.8 175
O2 H2 N2 0.9 2.1 2.9 170`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['O1', 'H1', 'N1', 'O2', 'H2', 'N2']);
            const hBonds = BondsFactory.createHBonds(cif.getBlock(0), validAtoms);

            expect(hBonds).toHaveLength(2);
            expect(hBonds[0].donorAtomLabel).toBe('O1');
            expect(hBonds[0].hydrogenAtomLabel).toBe('H1');
            expect(hBonds[0].acceptorAtomLabel).toBe('N1');
        });

        test('filters out invalid centroid H-bonds', () => {
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
O1 H1 N1 1.0 2.0 2.8 175
Cg1 H2 N2 0.9 2.1 2.9 170
O2 H3 Cnt1 0.9 2.1 2.9 170`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['O1', 'H1', 'N1', 'O2', 'H2', 'N2', 'H3']);
            const hBonds = BondsFactory.createHBonds(cif.getBlock(0), validAtoms);

            expect(hBonds).toHaveLength(1);
            expect(hBonds[0].donorAtomLabel).toBe('O1');
            expect(hBonds[0].hydrogenAtomLabel).toBe('H1');
            expect(hBonds[0].acceptorAtomLabel).toBe('N1');
        });

        test('includes centroid H-bonds if in atom list', () => {
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
O1 H1 N1 1.0 2.0 2.8 175
Cg1 H2 N2 0.9 2.1 2.9 170
O2 H3 Cnt1 0.9 2.1 2.9 170`;
            const cif = new CIF(cifText);
            const validAtoms = new Set(['O1', 'H1', 'N1', 'O2', 'H2', 'N2', 'H3', 'Cg1', 'Cnt1']);
            const hBonds = BondsFactory.createHBonds(cif.getBlock(0), validAtoms);

            expect(hBonds).toHaveLength(3);
        });

        test('handles missing H-bond data gracefully', () => {
            const cifText = 'data_test\n_cell_length_a 5.0';
            const cif = new CIF(cifText);
            const validAtoms = new Set(['O1']);
            const hBonds = BondsFactory.createHBonds(cif.getBlock(0), validAtoms);
            
            expect(hBonds).toHaveLength(0);
        });
    });

    describe('validation helpers', () => {
        test('isValidBondPair checks centroid atoms', () => {
            const validAtoms = new Set(['C1', 'O1', 'Cg2']);
            
            expect(BondsFactory.isValidBondPair('C1', 'O1', validAtoms)).toBe(true);
            expect(BondsFactory.isValidBondPair('C1', 'Cg1', validAtoms)).toBe(false);
            expect(BondsFactory.isValidBondPair('C1', 'Cg2', validAtoms)).toBe(true);
            expect(BondsFactory.isValidBondPair('Cnt1', 'O1', validAtoms)).toBe(false);
        });

        test('isValidHBondTriplet checks centroid atoms', () => {
            const validAtoms = new Set(['O1', 'H1', 'N1', 'Cg2']);
            
            expect(BondsFactory.isValidHBondTriplet('O1', 'H1', 'N1', validAtoms)).toBe(true);
            expect(BondsFactory.isValidHBondTriplet('Cg1', 'H1', 'N1', validAtoms)).toBe(false);
            expect(BondsFactory.isValidHBondTriplet('O1', 'Cg1', 'N1', validAtoms)).toBe(false);
            expect(BondsFactory.isValidHBondTriplet('O1', 'H1', 'Cg2', validAtoms)).toBe(true);
        });
    });
});