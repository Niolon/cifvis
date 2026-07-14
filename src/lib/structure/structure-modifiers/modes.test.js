import { readFileSync } from 'fs';
import { CrystalStructure, UnitCell } from '../crystal.js';
import { CellSymmetry, SymmetryOperation } from '../cell-symmetry.js';
import { CIF } from '../../read-cif/base.js';
import {
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from './modes.js';
import { MockStructure } from './base.test.js';
import { growFragment } from './growing/grow-fragment.js';
import { growCell } from './growing/grow-cell.js';
import { growExternalHBonds, reconcileHBondsByGeometry } from './growing/grow-hbonds.js';

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
        expect(modes).toContain(DisorderFilter.modeForGroup(1, 1));
        expect(modes).not.toContain(DisorderFilter.modeForGroup(2, 1));
    });

    test('names a single group by rank, not by its raw CIF group number', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [3] }).build();
        const filter = new DisorderFilter();

        // Only one group is present, so it is always rank 1 of 1, regardless
        // of its raw CIF disorder_group value.
        const modes = filter.getApplicableModes(structure);
        expect(modes).toEqual([DisorderFilter.MODES.ALL, DisorderFilter.modeForGroup(1, 1)]);
    });

    test('handles mixed disorder groups', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [1, 2] }).build();
        const filter = new DisorderFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toContain(DisorderFilter.modeForGroup(1, 2));
        expect(modes).toContain(DisorderFilter.modeForGroup(2, 2));
    });

    test('handles an arbitrary number of disorder groups', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [1, 2, 3, 4, 5] }).build();
        const filter = new DisorderFilter();

        const modes = filter.getApplicableModes(structure);
        expect(modes).toEqual([
            DisorderFilter.MODES.ALL,
            ...[1, 2, 3, 4, 5].map(rank => DisorderFilter.modeForGroup(rank, 5)),
        ]);
    });

    test('filters atoms of other groups while keeping non-disordered atoms', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 2, 3],
            hasHydrogens: true,
        }).build();
        const filter = new DisorderFilter(DisorderFilter.modeForGroup(2, 3));

        const filtered = filter.apply(structure);
        expect(filtered.atoms.some(atom => atom.disorderGroup === 1)).toBe(false);
        expect(filtered.atoms.some(atom => atom.disorderGroup === 3)).toBe(false);
        expect(filtered.atoms.some(atom => atom.disorderGroup === 2)).toBe(true);
        expect(filtered.atoms.some(atom => atom.disorderGroup === 0)).toBe(true);
    });

    test('filters bonds with atoms outside the selected group', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 3], // Create atoms A0 (group 1) and A1 (group 3)
        })
            .addBond('A0', 'A1') // Bond between groups 1 and 3
            .build();

        // A1's group (raw value 3) is the higher of the two present groups, so rank 2 of 2.
        const filter = new DisorderFilter(DisorderFilter.modeForGroup(2, 2));
        const filtered = filter.apply(structure);

        // Check bond is filtered out since A0 (group 1, rank 1) is not visible in this mode
        expect(filtered.bonds.some(bond => bond.atom1Id === 'A0|1_555' || bond.atom2Id === 'A1|1_555',
        )).toBe(false);
    });

    test('filters bonds between disorder groups', () => {
        const structure = MockStructure.createDefault({
            disorderGroups: [1, 2],
        })
            .addBond('A0', 'A1') // Bond between disorder groups 1 and 2
            .build();

        const filter = new DisorderFilter(DisorderFilter.modeForGroup(1, 2));
        const filtered = filter.apply(structure);

        expect(filtered.bonds.some(bond => bond.atom1Id === 'A0|1_555' && bond.atom2Id === 'A1|1_555',
        )).toBe(false);
    });

    test('filters hydrogen bonds involving disordered atoms', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            disorderGroups: [1, 2],
        })
            .addHBond('A0', 'H1', 'O1') // H-bond with disordered donor
            .build();

        const filter = new DisorderFilter(DisorderFilter.modeForGroup(2, 2));
        const filtered = filter.apply(structure);

        expect(filtered.hBonds.some(hbond => hbond.donorAtomId === 'A0|1_555',
        )).toBe(false);
    });

    test('filters h-bonds with disordered hydrogens and acceptors', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            disorderGroups: [1, 2],
        })
            .addHBond('O1', 'A0', 'A1') // H-bond with disordered H and acceptor
            .build();

        const filter = new DisorderFilter(DisorderFilter.modeForGroup(1, 2));
        const filtered = filter.apply(structure);

        expect(filtered.hBonds.some(hbond => hbond.hydrogenAtomId === 'A0|1_555' &&
            hbond.acceptorAtomId === 'A1|1_555',
        )).toBe(false);
    });

    test.each([
        [1, 'A1'],
        [2, 'A0'],
    ])('filters external h-bonds whose acceptor is removed in group%sof2 mode', (rank, acceptor) => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            disorderGroups: [1, 2],
        })
            .addHBond('O1', 'H1', acceptor, '2_555')
            .build();

        const filtered = new DisorderFilter(DisorderFilter.modeForGroup(rank, 2)).apply(structure);

        expect(filtered.hBonds.some(hbond => hbond.acceptorAtomLabel === acceptor)).toBe(false);
        expect(() => growExternalHBonds(filtered)).not.toThrow();
    });

    test('rejects syntactically invalid modes', () => {
        expect(() => new DisorderFilter('bogus')).toThrow('Invalid DisorderFilter mode');
    });

    test('falls back to ALL when the selected group is not present', () => {
        const structure = MockStructure.createDefault({ disorderGroups: [1, 2] }).build();
        const filter = new DisorderFilter(DisorderFilter.modeForGroup(5, 2));

        filter.ensureValidMode(structure);
        expect(filter.mode).toBe(DisorderFilter.MODES.ALL);
    });
});

describe('SymmetryGrower', () => {
    describe('constructor and basic properties', () => {
        test('initializes with default mode NONE', () => {
            const grower = new SymmetryGrower();
            expect(grower.mode).toBe(SymmetryGrower.MODES.NONE);
            expect(grower.filterName).toBe('SymmetryGrower');
        });

        test('initializes with specified mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);
            expect(grower.mode).toBe(SymmetryGrower.MODES.FRAGMENT);
        });

        test('requiresCameraUpdate returns true', () => {
            const grower = new SymmetryGrower();
            expect(grower.requiresCameraUpdate).toBe(true);
        });

        test('drawCell property depends on mode', () => {
            const grower = new SymmetryGrower();

            grower.mode = SymmetryGrower.MODES.NONE;
            expect(grower.drawCell).toBe(false);

            grower.mode = SymmetryGrower.MODES.FRAGMENT;
            expect(grower.drawCell).toBe(false);

            grower.mode = SymmetryGrower.MODES.HBONDS;
            expect(grower.drawCell).toBe(false);

            grower.mode = SymmetryGrower.MODES.FRAGMENT_HBONDS;
            expect(grower.drawCell).toBe(false);

            grower.mode = SymmetryGrower.MODES.CELL;
            expect(grower.drawCell).toBe(true);

            grower.mode = SymmetryGrower.MODES.FRAGMENT_CELL;
            expect(grower.drawCell).toBe(true);
        });
    });

    describe('getApplicableModes', () => {
        test('returns only basic modes for structure without symmetry', () => {
            const structure = MockStructure.createDefault().build();
            const grower = new SymmetryGrower();

            const modes = grower.getApplicableModes(structure);
            expect(modes).toEqual([
                SymmetryGrower.MODES.NONE,
                SymmetryGrower.MODES.CELL,
                SymmetryGrower.MODES.FRAGMENT_CELL,
            ]);
        });

        test('includes fragment mode when growable bonds exist', () => {
            const structure = MockStructure.createDefault({ hasMultipleSymmetry: true })
                .addBond('C1', 'C2', '2_555')
                .build();
            const grower = new SymmetryGrower();

            const modes = grower.getApplicableModes(structure);
            expect(modes).toContain(SymmetryGrower.MODES.FRAGMENT);
        });

        test('includes hbonds mode when only growable HBonds exist', () => {
            const structure = MockStructure.createDefault({
                hasHydrogens: true,
            })
                .addHBond('O1', 'H1', 'N1', '2_555')
                .build();
            const grower = new SymmetryGrower();

            const modes = grower.getApplicableModes(structure);
            expect(modes).toContain(SymmetryGrower.MODES.HBONDS);
            expect(modes).not.toContain(SymmetryGrower.MODES.FRAGMENT_HBONDS);
        });

        test('includes fragment-hbonds mode when both growable bonds and HBonds exist', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            })
                .addBond('C1', 'C2', '2_555')
                .addHBond('O1', 'H1', 'N1', '3_565')
                .build();
            const grower = new SymmetryGrower();

            const modes = grower.getApplicableModes(structure);
            expect(modes).toContain(SymmetryGrower.MODES.FRAGMENT_HBONDS);
            expect(modes).not.toContain(SymmetryGrower.MODES.HBONDS);
        });

        test('handles structures with internal bonds/HBonds only', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: false,
                hasHydrogens: true,
            })
                .addBond('C1', 'C2', '.')  // Internal bond
                .addHBond('O1', 'H1', 'N1', '.')  // Internal HBond
                .build();
            const grower = new SymmetryGrower();

            const modes = grower.getApplicableModes(structure);
            expect(modes).not.toContain(SymmetryGrower.MODES.FRAGMENT);
            expect(modes).not.toContain(SymmetryGrower.MODES.HBONDS);
            expect(modes).not.toContain(SymmetryGrower.MODES.FRAGMENT_HBONDS);
        });
    });

    describe('apply method', () => {
        let structure;

        beforeEach(() => {
            structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            })
                .addBond('C1', 'C2', '2_555')
                .addHBond('O1', 'H1', 'N1', '3_565')
                .build();
        });

        test('returns unchanged structure in NONE mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.NONE);
            const result = grower.apply(structure);

            expect(result).toBe(structure);
            expect(result.atoms.length).toBe(structure.atoms.length);
            expect(result.bonds.length).toBe(structure.bonds.length);
            expect(result.hBonds.length).toBe(structure.hBonds.length);
        });

        test('grows fragment in FRAGMENT mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);
            const result = grower.apply(structure);

            // Compare with direct growFragment call
            const { grownStructure: expected } = growFragment(structure);
            expect(result.atoms.length).toBe(expected.atoms.length);
            expect(result.bonds.length).toBe(expected.bonds.length);
        });

        test('grows cell in CELL mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.CELL);
            const result = grower.apply(structure);

            // Compare with direct growCell call
            const expected = growCell(structure);
            expect(result.atoms.length).toBe(expected.atoms.length);
            expect(result.bonds.length).toBe(expected.bonds.length);
        });

        test('combines fragment and HBonds growth in FRAGMENT_HBONDS mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT_HBONDS);
            const result = grower.apply(structure);

            const atomIds = new Set(result.atoms.map(atom => atom.uniqueId));
            expect(result.hBonds.every(hbond =>
                hbond.acceptorAtomSymmetry === '.' &&
                atomIds.has(hbond.donorAtomId) &&
                atomIds.has(hbond.hydrogenAtomId) &&
                atomIds.has(hbond.acceptorAtomId),
            )).toBe(true);

            // All surviving H-bonds are internalized, so another growth pass must
            // terminate without adding a second shell of atoms or bonds.
            const repeated = growExternalHBonds(result);
            expect(repeated.atoms).toHaveLength(result.atoms.length);
            expect(repeated.bonds).toHaveLength(result.bonds.length);
            expect(repeated.hBonds).toHaveLength(result.hBonds.length);
        });

        test('keeps both H-bonds from a molecule completed across a special position', () => {
            const cifContent = readFileSync('site/public/cif/urea.cif', 'utf8');
            const urea = CrystalStructure.fromCIF(new CIF(cifContent).getBlock(0));
            const result = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT_HBONDS)
                .apply(urea);

            // The incoming molecule contains the directly generated N|1_556 half and
            // its N|6_566 special-position partner.
            expect(result.atoms.some(atom => atom.uniqueId === 'N|1_556')).toBe(true);
            expect(result.atoms.some(atom => atom.uniqueId === 'N|6_566')).toBe(true);

            expect(result.hBonds).toContainEqual(expect.objectContaining({
                donorAtomId: 'N|1_556',
                hydrogenAtomId: 'Ha|1_556',
                acceptorAtomId: 'O|1_555',
                acceptorAtomSymmetry: '.',
            }));
            expect(result.hBonds).toContainEqual(expect.objectContaining({
                donorAtomId: 'N|6_566',
                hydrogenAtomId: 'Ha|6_566',
                acceptorAtomId: 'O|1_555',
                acceptorAtomSymmetry: '.',
            }));
        });

        test('combines fragment and cell growth in FRAGMENT_CELL mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT_CELL);
            const result = grower.apply(structure);

            const { grownStructure, specialPositionAtoms } = growFragment(structure);
            const expected = reconcileHBondsByGeometry(
                growCell(grownStructure, false, specialPositionAtoms),
            );
            expect(result.atoms).toHaveLength(expected.atoms.length);
            expect(result.bonds).toHaveLength(expected.bonds.length);
            expect(result.hBonds).toHaveLength(expected.hBonds.length);

            for (const group of result.calculateConnectedGroups()) {
                for (const axis of ['x', 'y', 'z']) {
                    const coordinates = group.atoms.map(atom => atom.position[axis]);
                    const midpoint = (Math.min(...coordinates) + Math.max(...coordinates)) / 2;
                    expect(midpoint).toBeGreaterThanOrEqual(-1e-6);
                    expect(midpoint).toBeLessThanOrEqual(1 + 1e-6);
                }
            }
            const atomIds = new Set(result.atoms.map(atom => atom.uniqueId));
            expect(result.hBonds.every(hbond =>
                atomIds.has(hbond.donorAtomId) &&
                atomIds.has(hbond.hydrogenAtomId) &&
                atomIds.has(hbond.acceptorAtomId),
            )).toBe(true);
        });

        test('validates mode before applying', () => {
            // Create structure that only supports NONE and CELL modes
            const simpleStructure = MockStructure.createDefault().build();
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);

            // Should fallback to CELL mode (first in preferred order that's applicable)
            const result = grower.apply(simpleStructure);
            expect(grower.mode).toBe(SymmetryGrower.MODES.CELL);

            // Should apply cell growth
            const expected = growCell(simpleStructure);
            expect(result.atoms.length).toBe(expected.atoms.length);
        });

        test('grows external HBonds in HBONDS mode', () => {
            const nonSymmetricStructure = MockStructure.createDefault({
                hasHydrogens: true,
            })
                .addHBond('O1', 'H1', 'N1', '2_555')
                .build();
            const expected = growExternalHBonds(nonSymmetricStructure);
            const grower = new SymmetryGrower(SymmetryGrower.MODES.HBONDS);
            const result = grower.apply(nonSymmetricStructure);

            // Compare with direct growExternalHBonds call
            //const expected = growExternalHBonds(growFragment(structure));
            expect(result.atoms.length).toBe(expected.atoms.length);
            expect(result.hBonds.length).toBe(expected.hBonds.length);
        });
    });

    describe('mode cycling', () => {
        test('cycles through applicable modes correctly', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasHydrogens: true,
            })
                .addBond('C1', 'C2', '2_555')
                .addHBond('O1', 'H1', 'N1', '3_565')
                .build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.NONE);

            // Get all applicable modes
            const applicableModes = grower.getApplicableModes(structure);
            expect(applicableModes.length).toBeGreaterThan(3);

            // Cycle through all modes
            const seenModes = [grower.mode];
            for (let i = 0; i < applicableModes.length; i++) {
                const newMode = grower.cycleMode(structure);
                seenModes.push(newMode);
            }

            // Should cycle back to first mode
            expect(seenModes[seenModes.length - 1]).toBe(seenModes[0]);

            // Should have seen all applicable modes
            for (const mode of applicableModes) {
                expect(seenModes).toContain(mode);
            }
        });

        test('handles invalid initial mode when cycling', () => {
            const structure = MockStructure.createDefault().build();
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);

            // FRAGMENT is not applicable to this structure
            const newMode = grower.cycleMode(structure);

            // Should have corrected to a valid mode first
            expect([
                SymmetryGrower.MODES.NONE,
                SymmetryGrower.MODES.CELL,
                SymmetryGrower.MODES.FRAGMENT_CELL,
            ]).toContain(newMode);
        });
    });

    describe('integration test - cell/fragment combination', () => {
        test('preserves atom properties through growth operations', () => {
            const structure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
                hasAnisoHydrogens: true,
                disorderGroups: [1, 2],
            })
                .addBond('A0', 'C1', '2_555')  // A0 has disorder group 1
                .build();

            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);
            const result = grower.apply(structure);

            // Find original and grown atoms - label remains pure, uniqueId contains symmetry
            const originalA0 = structure.atoms.find(a => a.label === 'A0');
            const grownA0 = result.atoms.find(a => a.uniqueId === 'A0|2_555');

            expect(grownA0).toBeDefined();
            expect(grownA0.atomType).toBe(originalA0.atomType);
            expect(grownA0.disorderGroup).toBe(originalA0.disorderGroup);

            // Check ADP preservation
            if (originalA0.adp) {
                // eslint-disable-next-line vitest/no-conditional-expect -- adp presence is data-dependent
                expect(grownA0.adp).toBeDefined();
                // eslint-disable-next-line vitest/no-conditional-expect -- adp presence is data-dependent
                expect(grownA0.adp.constructor.name).toBe(originalA0.adp.constructor.name);
            }
        });
    });

    describe('error handling and edge cases', () => {
        test('handles empty structure gracefully', () => {
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const symmetryOps = [new SymmetryOperation('x,y,z')];
            const symmetry = new CellSymmetry('P1', 1, symmetryOps);
            const emptyStructure = new CrystalStructure(cell, [], [], [], symmetry);

            const grower = new SymmetryGrower(SymmetryGrower.MODES.CELL);
            const result = grower.apply(emptyStructure);

            expect(result.atoms.length).toBe(0);
            expect(result.bonds.length).toBe(0);
            expect(result.hBonds.length).toBe(0);
        });

        test('validates mode setting through setter', () => {
            const grower = new SymmetryGrower();

            // Valid mode
            grower.mode = SymmetryGrower.MODES.CELL;
            expect(grower.mode).toBe(SymmetryGrower.MODES.CELL);

            // Invalid mode should throw
            expect(() => {
                grower.mode = 'invalid-mode';
            }).toThrow();
        });
    });
});
