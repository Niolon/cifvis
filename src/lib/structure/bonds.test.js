
import { Bond, HBond, BondsFactory } from './bonds.js';
import { Atom } from './crystal.js';
import { SymmetryOperation, CellSymmetry } from './cell-symmetry.js';
import { FractPosition } from './position.js';
import { CIF } from '../read-cif/base.js';

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
_geom_bond_distance_su
_geom_bond_site_symmetry_2
C1 O1 1.5 0.002 2_665
C1 O1 1.5 0.002 ?

    `;
        const cif = new CIF(cifText);
        const bond = Bond.fromCIF(cif.getBlock(0), 0);

        // atom1Id is always label|1_555 (ASU), atom2Id uses provided symmetry
        expect(bond.atom1Id).toBe('C1|1_555');
        expect(bond.atom2Id).toBe('O1|2_665');
        expect(bond.bondLength).toBe(1.5);
        expect(bond.bondLengthSU).toBe(0.002);
        expect(bond.atom2SiteSymmetry).toBe('2_665');

        const bond2 = Bond.fromCIF(cif.getBlock(0), 1);
        expect(bond2.atom2SiteSymmetry).toBe('.');

    });

    test('normalizes two recorded endpoint symmetries through CellSymmetry caches', () => {
        const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_1
_geom_bond_site_symmetry_2
C1 O1 1.5 2_555 .
C2 O2 1.5 2_555 .
C3 O3 1.5 2_555 2_555
`;
        const symmetry = new CellSymmetry(
            'P -1', 2,
            [new SymmetryOperation('x,y,z'), new SymmetryOperation('-x,-y,-z')],
        );
        const block = new CIF(cifText).getBlock(0);

        const first = Bond.fromCIF(block, 0, symmetry);
        const second = Bond.fromCIF(block, 1, symmetry);
        const sameImage = Bond.fromCIF(block, 2, symmetry);

        expect(first.atom1Id).toBe('C1|1_555');
        expect(first.atom2Id).toBe('O1|2_555');
        expect(first.atom2SiteSymmetry).toBe('2_555');
        expect(second.atom2SiteSymmetry).toBe('2_555');
        expect(sameImage.atom2Id).toBe('O3|1_555');
        expect(sameImage.atom2SiteSymmetry).toBe('.');
        expect(symmetry._invertPositionCodeCache.size).toBe(1);
        expect(symmetry._combineOperationCache.size).toBe(2);
        expect(symmetry._combineSymmetryCodesCache.size).toBe(2);
    });

    test('normalizes endpoint lattice translations relative to site 1', () => {
        const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_1
_geom_bond_site_symmetry_2
C1 O1 1.5 1_655 1_555
`;
        const symmetry = new CellSymmetry('P 1', 1, [new SymmetryOperation('x,y,z')]);

        const bond = Bond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);

        expect(bond.atom1Id).toBe('C1|1_555');
        expect(bond.atom2Id).toBe('O1|1_455');
        expect(bond.atom2SiteSymmetry).toBe('1_455');
    });

    test('uses the file identity ID when operation 1 is not identity', () => {
        const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_1
_geom_bond_site_symmetry_2
C1 O1 1.5 7_555 .
`;
        const symmetry = new CellSymmetry(
            'P -1', 2,
            [new SymmetryOperation('-x,-y,-z'), new SymmetryOperation('x,y,z')],
            new Map([['7', 0], ['9', 1]]),
        );

        const bond = Bond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);

        expect(bond.atom1Id).toBe('C1|9_555');
        expect(bond.atom2Id).toBe('O1|7_555');
        expect(bond.atom2SiteSymmetry).toBe('7_555');
    });

    test('retains an invalid site-1 symmetry for row-level validation', () => {
        const cifText = `
data_test
loop_
_geom_bond_atom_site_label_1
_geom_bond_atom_site_label_2
_geom_bond_distance
_geom_bond_site_symmetry_1
_geom_bond_site_symmetry_2
C1 O1 1.5 9_555 .
`;
        const symmetry = new CellSymmetry('P 1', 1, [new SymmetryOperation('x,y,z')]);

        const bond = Bond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);
        const result = BondsFactory.validateBonds(bond ? [bond] : [], [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0, 0, 0)),
        ], symmetry);

        expect(result.symmetryErrors).toContainEqual(expect.stringContaining(
            'Invalid symmetry at bond site 1',
        ));
    });
});

describe('HBond', () => {
    test('constructs with all parameters', () => {
        const hBond = new HBond(
            'O1', 'H1', 'O2',
            1.0, 0.01, 2.0, 0.02,
            2.8, 0.03, 175, 1, '1_555',
        );
        // HBond constructor takes IDs, so check atomId properties
        expect(hBond.donorAtomId).toBe('O1|1_555');
        expect(hBond.hydrogenAtomId).toBe('H1|1_555');
        expect(hBond.acceptorAtomId).toBe('O2|1_555');
        expect(hBond.acceptorAtomSymmetry).toBe('1_555');
    });

    test('fromCIF creates complete hydrogen bonds', () => {
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
O1 H2 O2 1.0 2.0 2.8 175 ?
O1 H2 O2 1.0 2.0 2.8 175 2
`;
        const cif = new CIF(cifText);
        const hBond = HBond.fromCIF(cif.getBlock(0), 0);

        // fromCIF creates IDs with | separator: label|symmetry
        expect(hBond.donorAtomId).toBe('O1|1_555');
        expect(hBond.hydrogenAtomId).toBe('H1|1_555');
        expect(hBond.acceptorAtomSymmetry).toBe('1_555');

        const hBond2 = HBond.fromCIF(cif.getBlock(0), 1);
        expect(hBond2.acceptorAtomSymmetry).toBe('.');

        const hBond3 = HBond.fromCIF(cif.getBlock(0), 2);
        expect(hBond3.acceptorAtomSymmetry).toBe('2_555');
        expect(hBond3.acceptorAtomId).toBe('O2|2_555');

    });

    test('normalizes donor, hydrogen, and acceptor symmetries through shared caches', () => {
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
_geom_hbond_site_symmetry_D
_geom_hbond_site_symmetry_H
_geom_hbond_site_symmetry_A
O1 H1 O2 1.0 2.0 2.8 175 2_555 2_555 .
O3 H3 O4 1.0 2.0 2.8 175 2_555 2_555 .
`;
        const symmetry = new CellSymmetry(
            'P -1', 2,
            [new SymmetryOperation('x,y,z'), new SymmetryOperation('-x,-y,-z')],
        );
        const block = new CIF(cifText).getBlock(0);

        const first = HBond.fromCIF(block, 0, symmetry);
        const second = HBond.fromCIF(block, 1, symmetry);

        expect(first.donorAtomId).toBe('O1|1_555');
        expect(first.hydrogenAtomId).toBe('H1|1_555');
        expect(first.acceptorAtomId).toBe('O2|2_555');
        expect(first.acceptorAtomSymmetry).toBe('2_555');
        expect(second.hydrogenAtomId).toBe('H3|1_555');
        expect(second.acceptorAtomId).toBe('O4|2_555');
        expect(symmetry._invertPositionCodeCache.size).toBe(1);
        expect(symmetry._combineOperationCache.size).toBe(2);
        expect(symmetry._combineSymmetryCodesCache.size).toBe(2);
    });

    test('normalizes H-bond endpoint translations relative to the donor', () => {
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
_geom_hbond_site_symmetry_D
_geom_hbond_site_symmetry_H
_geom_hbond_site_symmetry_A
O1 H1 O2 1.0 2.0 2.8 175 1_655 1_655 1_555
`;
        const symmetry = new CellSymmetry('P 1', 1, [new SymmetryOperation('x,y,z')]);

        const hBond = HBond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);

        expect(hBond.donorAtomId).toBe('O1|1_555');
        expect(hBond.hydrogenAtomId).toBe('H1|1_555');
        expect(hBond.acceptorAtomId).toBe('O2|1_455');
        expect(hBond.acceptorAtomSymmetry).toBe('1_455');
    });

    test('an absent hydrogen-symmetry column inherits donor symmetry', () => {
        const cifText = `
data_test
loop_
_geom_hbond_atom_site_label_D
_geom_hbond_site_symmetry_D
_geom_hbond_atom_site_label_H
_geom_hbond_atom_site_label_A
_geom_hbond_site_symmetry_A
_geom_hbond_distance_DH
_geom_hbond_distance_HA
_geom_hbond_distance_DA
_geom_hbond_angle_DHA
O1 2_555 H1 O2 2_555 1.0 2.0 2.8 175
`;
        const symmetry = new CellSymmetry(
            'P -1', 2,
            [new SymmetryOperation('x,y,z'), new SymmetryOperation('-x,-y,-z')],
        );

        const hBond = HBond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);

        expect(hBond.donorAtomId).toBe('O1|1_555');
        expect(hBond.hydrogenAtomId).toBe('H1|1_555');
        expect(hBond.acceptorAtomId).toBe('O2|1_555');
        expect(hBond.acceptorAtomSymmetry).toBe('.');
    });

    test('an explicit identity hydrogen symmetry remains distinct from an absent column', () => {
        const cifText = `
data_test
loop_
_geom_hbond_atom_site_label_D
_geom_hbond_atom_site_label_H
_geom_hbond_atom_site_label_A
_geom_hbond_site_symmetry_D
_geom_hbond_site_symmetry_H
_geom_hbond_site_symmetry_A
_geom_hbond_distance_DH
_geom_hbond_distance_HA
_geom_hbond_distance_DA
_geom_hbond_angle_DHA
O1 H1 O2 1_655 . 1_655 1.0 2.0 2.8 175
`;
        const symmetry = new CellSymmetry('P 1', 1, [new SymmetryOperation('x,y,z')]);

        const hBond = HBond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);

        expect(hBond.donorAtomId).toBe('O1|1_555');
        expect(hBond.hydrogenAtomId).toBe('H1|1_455');
        expect(hBond.acceptorAtomId).toBe('O2|1_555');
    });

    test('retains an invalid donor symmetry for row-level validation', () => {
        const cifText = `
data_test
loop_
_geom_hbond_atom_site_label_D
_geom_hbond_atom_site_label_H
_geom_hbond_atom_site_label_A
_geom_hbond_site_symmetry_D
_geom_hbond_site_symmetry_H
_geom_hbond_site_symmetry_A
O1 H1 O2 9_555 . .
`;
        const symmetry = new CellSymmetry('P 1', 1, [new SymmetryOperation('x,y,z')]);

        const hBond = HBond.fromCIF(new CIF(cifText).getBlock(0), 0, symmetry);
        const result = BondsFactory.validateHBonds([hBond], [
            new Atom('O1', 'O', new FractPosition(0, 0, 0)),
            new Atom('H1', 'H', new FractPosition(0, 0, 0)),
            new Atom('O2', 'O', new FractPosition(0, 0, 0)),
        ], symmetry);

        expect(result.symmetryErrors).toContainEqual(expect.stringContaining(
            'Invalid symmetry at H-bond donor',
        ));
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
            // atom1Id is always label|1_555 (ASU), atom2Id is label|1_555 for identity symmetry
            expect(bonds[0].atom1Id).toBe('C1|1_555');
            expect(bonds[0].atom2Id).toBe('O1|1_555');
            expect(bonds[1].atom1Id).toBe('C1|1_555');
            expect(bonds[1].atom2Id).toBe('N1|1_555');
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
            expect(bonds[0].atom1Id).toBe('C1|1_555');
            expect(bonds[0].atom2Id).toBe('O1|1_555');
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

            const bonds = BondsFactory.createBonds(cif.getBlock(0), validAtoms);

            expect(bonds).toHaveLength(0);
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
            // donorAtomId is always label|1_555 (ASU) for CIF H-bonds
            expect(hBonds[0].donorAtomId).toBe('O1|1_555');
            expect(hBonds[0].hydrogenAtomId).toBe('H1|1_555');
            expect(hBonds[0].acceptorAtomId).toBe('N1|1_555');
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
            expect(hBonds[0].donorAtomId).toBe('O1|1_555');
            expect(hBonds[0].hydrogenAtomId).toBe('H1|1_555');
            expect(hBonds[0].acceptorAtomId).toBe('N1|1_555');
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

        test('isValidBondPair checks for ? entries', () => {
            expect(BondsFactory.isValidBondPair('?', '?')).toBe(false);
            expect(BondsFactory.isValidBondPair('?', 'A1')).toBe(false);
        });

        test('isValidHBondTriplet checks centroid atoms', () => {
            const validAtoms = new Set(['O1', 'H1', 'N1', 'Cg2']);

            expect(BondsFactory.isValidHBondTriplet('O1', 'H1', 'N1', validAtoms)).toBe(true);
            expect(BondsFactory.isValidHBondTriplet('Cg1', 'H1', 'N1', validAtoms)).toBe(false);
            expect(BondsFactory.isValidHBondTriplet('O1', 'Cg1', 'N1', validAtoms)).toBe(false);
            expect(BondsFactory.isValidHBondTriplet('O1', 'H1', 'Cg2', validAtoms)).toBe(true);
        });

        test('isValidHBondTriplet checks for ? entries', () => {
            expect(BondsFactory.isValidHBondTriplet('?', '?', '?')).toBe(false);
            expect(BondsFactory.isValidHBondTriplet('?', '?', 'A1')).toBe(false);
        });
    });
});

describe('Bond Validation', () => {
    let atoms;
    let symmetryOps;
    let symmetry;

    beforeEach(() => {
        symmetryOps = [new SymmetryOperation('x,y,z')];
        symmetry = new CellSymmetry('P1', 1, symmetryOps);

        atoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),
            new Atom('H1', 'H', new FractPosition(0.1, 0.1, 0.1)),
        ];
    });

    describe('validateBonds', () => {
        test('accepts valid bonds', () => {
            const bonds = [
                new Bond('C1', 'O1', 1.5),
                new Bond('O1', 'H1', 1.0),
            ];
            const result = BondsFactory.validateBonds(bonds, atoms, symmetry);
            expect(result.isValid()).toBe(true);
            expect(result.atomLabelErrors).toHaveLength(0);
            expect(result.symmetryErrors).toHaveLength(0);
            expect(result.report()).toBe('');
        });

        test('detects missing atoms in bonds', () => {
            const bonds = [
                new Bond('C1', 'X1', 1.5),
                new Bond('Y1', 'O1', 1.0),
            ];
            const result = BondsFactory.validateBonds(bonds, atoms, symmetry);
            expect(result.isValid()).toBe(false);
            expect(result.atomLabelErrors).toHaveLength(2);
            expect(result.atomLabelErrors[0]).toContain('Non-existent atoms in bond: C1 - X1');
            expect(result.atomLabelErrors[0]).toContain('non-existent atom(s): X1');
            expect(result.atomLabelErrors[1]).toContain('Non-existent atoms in bond: Y1 - O1');
            expect(result.atomLabelErrors[1]).toContain('non-existent atom(s): Y1');
            expect(result.symmetryErrors).toHaveLength(0);

            expect(result.report(atoms, symmetry)).toContain('Unknown atom label(s). Known labels are \nC1, O1, H1');
            expect(result.report(atoms, symmetry)).not.toContain(
                'Unknown symmetry ID(s) or String format. Expected format is <id>_abc. ',
            );
        });

        test('detects invalid symmetry operations in bonds', () => {
            const bonds = [
                new Bond('C1', 'O1', 1.5, 0.01, '9_555'),
            ];
            const result = BondsFactory.validateBonds(bonds, atoms, symmetry);
            expect(result.isValid()).toBe(false);
            expect(result.atomLabelErrors).toHaveLength(0);
            expect(result.symmetryErrors).toHaveLength(1);
            expect(result.symmetryErrors[0]).toContain('Invalid symmetry in bond: C1 - O1');
            expect(result.symmetryErrors[0]).toContain('invalid symmetry operation: 9_555');
            expect(result.report(atoms, symmetry)).not.toContain(
                'Unknown atom label(s). Known labels are \nC1, O1, H1',
            );
            expect(result.report(atoms, symmetry)).toContain(
                'Unknown symmetry ID(s) or String format. Expected format is <id>_abc. Known IDs are:\n1',
            );
        });

        test('accepts valid symmetry operations', () => {
            const bonds = [
                new Bond('C1', 'O1', 1.5, 0.01, '1_555'),
            ];
            const result = BondsFactory.validateBonds(bonds, atoms, symmetry);
            expect(result.isValid()).toBe(true);
        });

        test('detects invalid atom name and symmetry operation in bond', () => {
            const bonds = [
                new Bond('X1', 'O1', 1.5, 0.01, '9_555'),
            ];
            const result = BondsFactory.validateBonds(bonds, atoms, symmetry);
            expect(result.isValid()).toBe(false);
            expect(result.atomLabelErrors).toHaveLength(1);
            expect(result.atomLabelErrors[0]).toContain('Non-existent atoms in bond: X1 - O1');
            expect(result.atomLabelErrors[0]).toContain('non-existent atom(s): X1');
            expect(result.symmetryErrors).toHaveLength(1);
            expect(result.symmetryErrors[0]).toContain('Invalid symmetry in bond: X1 - O1');
            expect(result.symmetryErrors[0]).toContain('invalid symmetry operation: 9_555');
            expect(result.report(atoms, symmetry)).toContain('Unknown atom label(s). Known labels are \nC1, O1, H1');
            expect(result.report(atoms, symmetry)).toContain(
                '\nUnknown symmetry ID(s) or String format. Expected format is <id>_abc. Known IDs are:\n1',
            );
        });
    });

    describe('validateHBonds', () => {
        test('accepts valid h-bonds', () => {
            const hBonds = [
                new HBond('O1', 'H1', 'C1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1),
            ];
            const result = BondsFactory.validateHBonds(hBonds, atoms, symmetry);
            expect(result.isValid()).toBe(true);
            expect(result.atomLabelErrors).toHaveLength(0);
            expect(result.symmetryErrors).toHaveLength(0);
            expect(result.report()).toBe('');
        });

        test('detects missing atoms in h-bonds', () => {
            const hBonds = [
                new HBond('Z1', 'X1', 'Y1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1),
            ];
            const result = BondsFactory.validateHBonds(hBonds, atoms, symmetry);
            expect(result.isValid()).toBe(false);
            expect(result.atomLabelErrors).toHaveLength(1);
            expect(result.atomLabelErrors[0]).toContain('Non-existent atoms in H-bond: Z1 - X1 - Y1');
            expect(result.atomLabelErrors[0]).toContain('non-existent atom(s): Z1, X1, Y1');
            expect(result.symmetryErrors).toHaveLength(0);
            expect(result.report(atoms, symmetry)).toContain('Unknown atom label(s). Known labels are \nC1, O1, H1');
            expect(result.report(atoms, symmetry)).not.toContain(
                'Unknown symmetry ID(s) or String format. Expected format is <id>_abc. ',
            );
        });

        test('detects invalid symmetry operations in h-bonds', () => {
            const hBonds = [
                new HBond('O1', 'H1', 'C1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '9_555'),
            ];
            const result = BondsFactory.validateHBonds(hBonds, atoms, symmetry);
            expect(result.isValid()).toBe(false);
            expect(result.atomLabelErrors).toHaveLength(0);
            expect(result.symmetryErrors).toHaveLength(1);
            expect(result.symmetryErrors[0]).toContain('Invalid symmetry in H-bond: O1 - H1 - C1');
            expect(result.symmetryErrors[0]).toContain('invalid symmetry operation: 9_555');
            expect(result.report(atoms, symmetry)).not.toContain(
                'Unknown atom label(s). Known labels are \nC1, O1, H1',
            );
            expect(result.report(atoms, symmetry)).toContain(
                'Unknown symmetry ID(s) or String format. Expected format is <id>_abc. Known IDs are:\n1',
            );
        });

        test('accepts valid symmetry operations in h-bonds', () => {
            const hBonds = [
                new HBond('O1', 'H1', 'C1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '1_555'),
            ];
            const result = BondsFactory.validateHBonds(hBonds, atoms, symmetry);
            expect(result.isValid()).toBe(true);
        });
    });
});
