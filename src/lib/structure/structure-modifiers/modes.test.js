import { CrystalStructure, UnitCell } from '../crystal.js';
import { CellSymmetry, SymmetryOperation } from '../cell-symmetry.js';
import {
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from './modes.js';
import { MockStructure } from './base.test.js';
import { growFragment } from './growing/grow-fragment.js';
import { growCell } from './growing/grow-cell.js';
import { growExternalHBonds } from './growing/grow-hbonds.js';

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
            
            // Should first grow fragment then HBonds
            const { grownStructure: fragmentGrown } = growFragment(structure);
            const expected = growExternalHBonds(fragmentGrown);
            
            expect(result.atoms.length).toBe(expected.atoms.length);
            expect(result.bonds.length).toBe(expected.bonds.length);
            expect(result.hBonds.length).toBe(expected.hBonds.length);
        });

        test('combines fragment and cell growth in FRAGMENT_CELL mode', () => {
            const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT_CELL);
            const result = grower.apply(structure);
            
            // Should first grow fragment then cell without cutting
            const { grownStructure: fragmentGrown } = growFragment(structure);
            const expected = growCell(fragmentGrown, false);
            
            expect(result.atoms.length).toBe(expected.atoms.length);
            expect(result.bonds.length).toBe(expected.bonds.length);
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
            console.log(grower.getApplicableModes(nonSymmetricStructure));
            
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
            
            // Find original and grown atoms
            const originalA0 = structure.atoms.find(a => a.label === 'A0');
            const grownA0 = result.atoms.find(a => a.label === 'A0@2_555');
            
            expect(grownA0).toBeDefined();
            expect(grownA0.atomType).toBe(originalA0.atomType);
            expect(grownA0.disorderGroup).toBe(originalA0.disorderGroup);
            
            // Check ADP preservation
            if (originalA0.adp) {
                expect(grownA0.adp).toBeDefined();
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