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
describe('SymmetryGrower', () => {
    describe('combineSymOpLabel', () => {
        test('combine with symmmetry', () => {
            const withSymmLabel = SymmetryGrower.combineSymOpLabel('B1', '2_643');
            expect(withSymmLabel).toBe('B1@2_643');
        });

        test('combine with no symmetry', () => {
            const noSymmLabel = SymmetryGrower.combineSymOpLabel('B1', '.');
            expect(noSymmLabel).toBe('B1');
        });
    });

    describe('findGrowableAtoms', () => {
        test('finds atoms with symmetry references in bonds', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: false,
            }).build();

            const grower = new SymmetryGrower();
            const { bondAtoms } = grower.findGrowableAtoms(structure);

            expect(bondAtoms).toContainEqual(['N2', '2_545']);
            expect(bondAtoms).toContainEqual(['N1', '3_565']);
            expect(bondAtoms).toContainEqual(['N2', '4_655']);
        });

        test('finds atoms with symmetry references in hbonds', () => {
            const structure = new CrystalStructure(
                new UnitCell(10, 10, 10, 90, 90, 90),
                [
                    new Atom('O1', 'O', new FractPosition(0.1, 0.1, 0.1)),
                    new Atom('H1', 'H', new FractPosition(0.2, 0.2, 0.2)),
                    new Atom('N1', 'N', new FractPosition(0.3, 0.3, 0.3)),
                ],
                [],
                [new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '2_555')],
            );

            const grower = new SymmetryGrower();
            const { hBondAtoms } = grower.findGrowableAtoms(structure);
            expect(hBondAtoms).toContainEqual(['N1', '2_555']);
        });

        test('ignores non-symmetry references', () => {
            const structure = new CrystalStructure(
                new UnitCell(10, 10, 10, 90, 90, 90),
                [
                    new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
                    new Atom('C2', 'C', new FractPosition(0.2, 0.2, 0.2)),
                ],
                [new Bond('C1', 'C2', 1.5, 0.01, '.')],
                [],
            );

            const grower = new SymmetryGrower();
            const { bondAtoms, hBondAtoms } = grower.findGrowableAtoms(structure);

            expect(bondAtoms).toHaveLength(0);
            expect(hBondAtoms).toHaveLength(0);
        });

        test('handles multiple symmetry references to same atom', () => {
            const structure = new CrystalStructure(
                new UnitCell(10, 10, 10, 90, 90, 90),
                [
                    new Atom('N1', 'N', new FractPosition(0.1, 0.1, 0.1)),
                    new Atom('C1', 'C', new FractPosition(0.2, 0.2, 0.2)),
                ],
                [
                    new Bond('C1', 'N1', 1.5, 0.01, '2_555'),
                    new Bond('C1', 'N1', 1.5, 0.01, '3_555'),
                ],
                [],
            );

            const grower = new SymmetryGrower();
            const { bondAtoms } = grower.findGrowableAtoms(structure);

            expect(bondAtoms).toContainEqual(['N1', '2_555']);
            expect(bondAtoms).toContainEqual(['N1', '3_555']);
        });
    });

    describe('growAtomArray', () => {
        test('grows atoms with their connected atoms and bonds', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
            }).build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_YES_HBONDS_YES);
            let growthState = {
                atoms: new Set(structure.atoms),
                bonds: new Set(structure.bonds),
                hBonds: new Set(structure.hBonds),
                labels: new Set(),
            };

            const atomsToGrow = [['N2', '2_555']];
            growthState = grower.growAtomArray(structure, atomsToGrow, growthState);

            // Check all atoms in connected group were grown
            const grownLabels = Array.from(growthState.labels);
            expect(grownLabels).toContain('N2@2_555');
            expect(grownLabels).toContain('C1@2_555');

            // Check bonds were grown with correct labels
            const grownBonds = Array.from(growthState.bonds);
            const bondLabels = grownBonds.map(b => [b.atom1Label, b.atom2Label]);
            expect(bondLabels).toContainEqual(['C1@2_555', 'C2@2_555']);
        });

        test('skips already grown atoms', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
            }).build();

            const grower = new SymmetryGrower();
            const growthState = {
                atoms: new Set(),
                bonds: new Set(),
                hBonds: new Set(),
                labels: new Set(['N1@2_555']),
            };

            const atomsToGrow = [['N1', '2_555']];
            grower.growAtomArray(structure, atomsToGrow, growthState);

            expect(growthState.atoms.size).toBe(0);
            expect(growthState.bonds.size).toBe(0);
        });

        test('grows h-bonds within connected groups', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            const grower = new SymmetryGrower();
            const growthState = {
                atoms: new Set(),
                bonds: new Set(),
                hBonds: new Set(),
                labels: new Set(),
            };

            const atomsToGrow = [['N2', '2_555']];
            grower.growAtomArray(structure, atomsToGrow, growthState);

            const grownHBonds = Array.from(growthState.hBonds);
            const hbondLabels = grownHBonds.map(h => [
                h.donorAtomLabel,
                h.hydrogenAtomLabel,
                h.acceptorAtomLabel,
            ]);
            expect(hbondLabels).toContainEqual(['O1@2_555', 'H1@2_555', 'N1@2_555']);
        });

        test('preserves atom properties through growth', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasAnisoHydrogens: true,
            }).build();

            const grower = new SymmetryGrower();
            const growthState = {
                atoms: new Set(),
                bonds: new Set(),
                hBonds: new Set(),
                labels: new Set(),
            };

            const atomsToGrow = [['H3', '2_555']];
            grower.growAtomArray(structure, atomsToGrow, growthState);

            const grownH3 = Array.from(growthState.atoms).find(a => a.label === 'H3@2_555');
            expect(grownH3.adp.constructor.name).toBe('UAnisoADP');
            expect(grownH3.adp.u11).toBe(0.01);
        });

        test('handles missing connected groups with error', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
            }).build();

            const grower = new SymmetryGrower();
            const growthState = {
                atoms: new Set(),
                bonds: new Set(),
                hBonds: new Set(),
                labels: new Set(),
            };

            const atomsToGrow = [['NonExistentAtom', '2_555']];
            expect(() => grower.growAtomArray(structure, atomsToGrow, growthState))
                .toThrow('Atom NonExistentAtom is not in any group. Typo or structure.recalculateConnectedGroups()?');

        });
    });

    describe('apply', () => {
        test('grows nothing in BONDS_NONE_HBONDS_NONE mode', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_NO_HBONDS_NO);
            const grown = grower.apply(structure);

            expect(grown.atoms.length).toBe(structure.atoms.length);
            expect(grown.bonds.length).toBe(structure.bonds.length);
            expect(grown.hBonds.length).toBe(structure.hBonds.length);
        });

        test('grows only bond symmetry in BONDS_YES_HBONDS_NO mode', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_YES_HBONDS_NO);
            const grown = grower.apply(structure);

            const errors = checkSymmetryGrowth(grown, {
                checkSymmetries: ['2_545', '3_565', '4_655'],
                excludeSymmetries: ['2_555', '3_568'],
            });
            expect(errors).toEqual([]);

            // check that original connecting bond is in set
            expect(grown.bonds.some(b => b.atom1Label === 'N1' && b.atom2Label === 'N2@2_545')).toBe(true);
        });

        test('grows both bond and hbond symmetry in BONDS_YES_HBONDS_YES mode', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_YES_HBONDS_YES);
            const grown = grower.apply(structure);

            const errors = checkSymmetryGrowth(grown, {
                checkSymmetries: ['3_568', '2_545', '3_565', '4_655'],
                excludeSymmetries: [
                    '2_555', // S1 is not connected to group
                ],
            });
            expect(errors).toEqual([]);

            expect(grown.atoms.some(a => a.label === 'S1@2_555')).toBe(true);
            expect(
                grown.hBonds.some(
                    hb => hb.donorAtomLabel === 'N2' 
                    && hb.hydrogenAtomLabel === 'H2' 
                    && hb.acceptorAtomLabel === 'O1@3_568',
                )).toBe(true);
            expect(grown.bonds.some(b => b.atom1Label === 'N1' && b.atom2Label === 'N2@2_545')).toBe(true);
        });

        test('maintains all properties in grown structure', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
                hasAnisoHydrogens: true,
                disorderGroups: [1, 2],
            }).build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_YES_HBONDS_YES);
            const grown = grower.apply(structure);

            // Check ADP preservation
            const originalH3 = structure.atoms.find(a => a.label === 'H3');
            const grownH3 = grown.atoms.find(a => a.label === 'H3@2_545');
            expect(grownH3.adp.constructor.name).toBe('UAnisoADP');
            expect(grownH3.adp.u11).toBe(originalH3.adp.u11);

            // Check disorder group preservation
            const originalA0 = structure.atoms.find(a => a.label === 'A0');
            const grownA0 = grown.atoms.find(a => a.label === 'A0@2_545');
            expect(grownA0.disorderGroup).toBe(originalA0.disorderGroup);

            // Check bond properties
            const originalBond = structure.bonds.find(b => b.atom1Label === 'N1' && b.atom2Label === 'N2');
            const grownBond = grown.bonds.find(b => b.atom1Label === 'N2@2_545' && b.atom2Label === 'C1@2_545',
            );
            expect(grownBond.bondLength).toBe(originalBond.bondLength);
            expect(grownBond.bondLengthSU).toBe(originalBond.bondLengthSU);
        });

        test('ensures valid mode before growing', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            // Start with invalid mode for structure
            const grower = new SymmetryGrower(SymmetryGrower.MODES.BONDS_NONE_HBONDS_NONE);
            grower.apply(structure);

            expect(grower.mode).toBe(SymmetryGrower.MODES.BONDS_NO_HBONDS_NO);
        });
    });

    describe('getApplicableModes', () => {
        test('returns BONDS_NONE_HBONDS_NONE for structure with no symmetry', () => {
            const structure = MockStructure.createDefault().build();
            const grower = new SymmetryGrower();

            expect(grower.getApplicableModes(structure))
                .toEqual([SymmetryGrower.MODES.BONDS_NONE_HBONDS_NONE]);
        });

        test('returns bond-only modes for structure with only bond symmetry', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: false,
            }).build();

            const grower = new SymmetryGrower();
            const modes = grower.getApplicableModes(structure);

            expect(modes).toContain(SymmetryGrower.MODES.BONDS_YES_HBONDS_NONE);
            expect(modes).toContain(SymmetryGrower.MODES.BONDS_NO_HBONDS_NONE);
            expect(modes).not.toContain(SymmetryGrower.MODES.BONDS_YES_HBONDS_YES);
        });

        test('returns hbond-only modes for structure with only hbond symmetry', () => {
            const structure = MockStructure.createDefault({
                hasHydrogens: true,
            })
                .addHBond('O1', 'H1', 'N1', '2_555')
                .build();

            const grower = new SymmetryGrower();
            const modes = grower.getApplicableModes(structure);

            expect(modes).toContain(SymmetryGrower.MODES.BONDS_NONE_HBONDS_YES);
            expect(modes).toContain(SymmetryGrower.MODES.BONDS_NONE_HBONDS_NO);
            expect(modes).not.toContain(SymmetryGrower.MODES.BONDS_YES_HBONDS_YES);
        });

        test('returns all modes for structure with both bond and hbond symmetry', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            }).build();

            const grower = new SymmetryGrower();
            const modes = grower.getApplicableModes(structure);

            expect(modes).toEqual([
                SymmetryGrower.MODES.BONDS_YES_HBONDS_YES,
                SymmetryGrower.MODES.BONDS_YES_HBONDS_NO,
                SymmetryGrower.MODES.BONDS_NO_HBONDS_NO,
            ]);
        });

        test('handles empty structure gracefully', () => {
            const structure = new CrystalStructure(
                new UnitCell(10, 10, 10, 90, 90, 90),
                [], [], [],
            );

            const grower = new SymmetryGrower();
            expect(grower.getApplicableModes(structure))
                .toEqual([SymmetryGrower.MODES.BONDS_NONE_HBONDS_NONE]);
        });
    });
});
