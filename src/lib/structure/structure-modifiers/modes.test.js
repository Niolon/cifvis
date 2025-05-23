import { HBond, Bond } from '../bonds.js';
import { CrystalStructure, UnitCell, Atom } from '../crystal.js';
import { FractPosition } from '../position.js';
import {
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from './modes.js';
import { MockStructure, checkSymmetryGrowth } from './base.test.js';

describe('HydrogenFilter', () => {
    test('handles structures without hydrogens', () => {
        const structure = MockStructure.createDefault().build();
        const filter = new HydrogenFilter();

        expect(filter.getApplicableModes(structure)).toEqual([HydrogenFilter.MODES.NONE]);
    });

    test('handles normal hydrogens', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true }).build();
        const filter = new HydrogenFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(HydrogenFilter.MODES.CONSTANT);
        expect(modes).not.toContain(HydrogenFilter.MODES.ANISOTROPIC);
    });

    test('handles anisotropic hydrogens', () => {
        const structure = MockStructure.createDefault({ hasAnisoHydrogens: true }).build();
        const filter = new HydrogenFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(HydrogenFilter.MODES.ANISOTROPIC);
    });

    test('filters hydrogen atoms in NONE mode', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true }).build();
        const filter = new HydrogenFilter(HydrogenFilter.MODES.NONE);

        const filtered = filter.apply(structure);
        expect(filtered.atoms.some(atom => atom.atomType === 'H')).toBe(false);
    });

    test('removes ADPs in CONSTANT mode', () => {
        const structure = MockStructure.createDefault({ hasAnisoHydrogens: true }).build();
        const filter = new HydrogenFilter(HydrogenFilter.MODES.CONSTANT);

        const filtered = filter.apply(structure);
        expect(filtered.atoms.find(atom => atom.atomType === 'H').adp).toBeNull();
    });
});
describe('DisorderFilter', () => {
    test('handles structures without disorder', () => {
        const structure = MockStructure.createDefault().build();
        const filter = new DisorderFilter();

        expect(filter.getApplicableModes(structure)).toEqual([DisorderFilter.MODES.ALL]);
    });

    test('handles group 1 disorder', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [1] }).build();
        const filter = new DisorderFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(DisorderFilter.MODES.GROUP1);
        expect(modes).not.toContain(DisorderFilter.MODES.GROUP2);
    });

    test('handles group 2 disorder', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [3] }).build();
        const filter = new DisorderFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(DisorderFilter.MODES.GROUP2);
        expect(modes).not.toContain(DisorderFilter.MODES.GROUP1);
    });

    test('handles mixed disorder groups', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [1, 2] }).build();
        const filter = new DisorderFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(DisorderFilter.MODES.GROUP1);
        expect(modes).toContain(DisorderFilter.MODES.GROUP2);
    });

    test('filters group 1 atoms in GROUP2 mode', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 2],
            hasHydrogens: true,
        }).build();
        const filter = new DisorderFilter(DisorderFilter.MODES.GROUP2);

        const filtered = filter.apply(structure);
        expect(filtered.atoms.some(atom => atom.disorderGroup === 1)).toBe(false);
    });

    test('filters bonds with group 1 atoms in GROUP2 mode', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 3], // Create atoms A0 (group 1) and A1 (group 3)
        })
            .addBond('A0', 'A1') // Bond between groups 1 and 3
            .build();

        const filter = new DisorderFilter(DisorderFilter.MODES.GROUP2);
        const filtered = filter.apply(structure);

        // Check bond is filtered out when in GROUP2 mode
        expect(filtered.bonds.some(bond => bond.atom1Label === 'A0' || bond.atom2Label === 'A1',
        )).toBe(false);
    });

    test('filters bonds between disorder groups', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 2],
        })
            .addBond('A0', 'A1') // Bond between disorder groups 1 and 2
            .build();

        const filter = new DisorderFilter(DisorderFilter.MODES.GROUP1);
        const filtered = filter.apply(structure);

        expect(filtered.bonds.some(bond => bond.atom1Label === 'A0' && bond.atom2Label === 'A1',
        )).toBe(false);
    });

    test('filters hydrogen bonds involving disordered atoms', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            disorderGroups: [1, 2],
        })
            .addHBond('A0', 'H1', 'O1') // H-bond with disordered donor
            .build();

        const filter = new DisorderFilter(DisorderFilter.MODES.GROUP2);
        const filtered = filter.apply(structure);

        expect(filtered.hBonds.some(hbond => hbond.donorAtomLabel === 'A0',
        )).toBe(false);
    });

    test('filters h-bonds with disordered hydrogens and acceptors', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            disorderGroups: [1, 2],
        })
            .addHBond('O1', 'A0', 'A1') // H-bond with disordered H and acceptor
            .build();

        const filter = new DisorderFilter(DisorderFilter.MODES.GROUP1);
        const filtered = filter.apply(structure);

        expect(filtered.hBonds.some(hbond => hbond.hydrogenAtomLabel === 'A0' &&
            hbond.acceptorAtomLabel === 'A1',
        )).toBe(false);
    });
});
