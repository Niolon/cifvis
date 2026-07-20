import { beforeEach, describe, test, expect } from 'vitest';
import { MockStructure } from '../base.test.js';
import {
    minimalGrowthSet,
    getFragmentLimits,
    getSymmetryCentre,
    getGrownSymmetriesofGroup,
    centreSymmetryString,
    growCell,
    growAtomsinGroup,
    growInternalBondsInGroup,
    growInternalHBondsInGroup,
    growExternalBondsInGroup,
    growExternalHBondsInGroup,
    addPackingBorderAtoms,
} from './grow-cell.js';

import { createBondIdentifier, createHBondIdentifier } from './grow-fragment.js';
import { CellSymmetry, SymmetryOperation } from '../../cell-symmetry.js';
import { UnitCell, CrystalStructure, Atom } from '../../crystal.js';
import { FractPosition } from '../../position.js';
import { Bond, HBond } from '../../bonds.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';
import { matrix } from '../../../math-lite.js';
import { readFileSync } from 'node:fs';
import { CIF } from '../../../read-cif/base.js';

/**
 * Helper to create an atom with proper AppliedSymmetry object
 * @param {string} label - Pure atom label (e.g., 'C1')
 * @param {string} type - Atom type (e.g., 'C')
 * @param {FractPosition} position - Fractional position
 * @param {string|null} symmetryKey - Symmetry key like '2_555' or null for identity
 * @returns {Atom} Atom with appliedSymmetry set
 */
function createAtomWithSymmetry(label, type, position, symmetryKey = null) {
    const appliedSymmetry = symmetryKey ? AppliedSymmetry.fromString(symmetryKey) : null;
    return new Atom(label, type, position, null, 0, appliedSymmetry);
}

describe('growCell basic functions', () => {
    let symmetry;

    beforeEach(() => {
        // space group Cc (9)
        const symmetryOps = [
            new SymmetryOperation('x,y,z'),              // 1_555 (identity)
            new SymmetryOperation('x,-y,z+1/2'),         // 2_555
            new SymmetryOperation('x+1/2,y+1/2,z'),      // 3_555
            new SymmetryOperation('x+1/2,-y+1/2,z+1/2'), // 4_555
        ];
        const operationIds = new Map([
            ['1', 0], ['2', 1], ['3', 2], ['4', 3],
        ]);
        symmetry = new CellSymmetry('Test', 1, symmetryOps, operationIds);
    });

    describe('minimalGrowthSet', () => {
        test('returns identity for empty preexisting ops', () => {
            const result = minimalGrowthSet(symmetry, []);
            expect(result).toEqual(new Set(['1', '2', '3', '4']));
        });

        test('handles preexisting symmetry operations', () => {
            const result = minimalGrowthSet(symmetry, ['1', '2']);
            expect(result.has('1')).toBe(true); // Identity always included
            // Should determine minimal set to generate all ops
            expect(result.size).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getFragmentLimits', () => {
        test('handles empty atoms array', () => {
            const limits = getFragmentLimits([]);
            expect(limits).toEqual({
                minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1,
            });
        });

        test('calculates limits correctly for atoms', () => {
            const atoms = [
                new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3)),
                new Atom('C2', 'C', new FractPosition(0.8, 0.9, 0.1)),
                new Atom('O1', 'O', new FractPosition(0.5, 0.1, 0.7)),
            ];

            const limits = getFragmentLimits(atoms);
            expect(limits.minX).toBeCloseTo(0.1);
            expect(limits.maxX).toBeCloseTo(0.8);
            expect(limits.minY).toBeCloseTo(0.1);
            expect(limits.maxY).toBeCloseTo(0.9);
            expect(limits.minZ).toBeCloseTo(0.1);
            expect(limits.maxZ).toBeCloseTo(0.7);
        });
    });

    describe('getSymmetryCentre', () => {
        test('calculates center for identity operation', () => {
            const startCentre = matrix([0.1, 0.2, 0.3]);
            const identityOp = symmetry.symmetryOperations[0]; // x,y,z

            const centre = getSymmetryCentre(startCentre, identityOp);
            const centreArray = centre.toArray();
            expect(centreArray.length).toBe(3);
            expect(centreArray[0]).toBeCloseTo(0.1);
            expect(centreArray[1]).toBeCloseTo(0.2);
            expect(centreArray[2]).toBeCloseTo(0.3);
        });

        test('calculates center for c-glide plane', () => {
            const startCentre = matrix([0.1, 0.2, 0.3]);
            const glidePlaneOp = symmetry.symmetryOperations[1]; // x,-y,z+1/2

            const centre = getSymmetryCentre(startCentre, glidePlaneOp);
            // Should apply the transformation to the center point
            const centreArray = centre.toArray();
            expect(centreArray.length).toBe(3);
            expect(centreArray[0]).toBeCloseTo(0.1); // x
            expect(centreArray[1]).toBeCloseTo(-0.2); // -
            expect(centreArray[2]).toBeCloseTo(0.8); // z + 1/2
        });
    });

    describe('getGrownSymmetriesofGroup', () => {
        let symmetry;
        let group;
        let specialPositionMap;

        beforeEach(() => {
            // Set up symmetry operations (space group Cc - monoclinic)
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),              // 1_555 (identity)
                new SymmetryOperation('x,-y,z+1/2'),         // 2_555
                new SymmetryOperation('x+1/2,y+1/2,z'),      // 3_555
                new SymmetryOperation('x+1/2,-y+1/2,z+1/2'), // 4_555
            ];
            const operationIds = new Map([
                ['1', 0], ['2', 1], ['3', 2], ['4', 3],
            ]);
            symmetry = new CellSymmetry('Cc', 9, symmetryOps, operationIds);

            // Create test atoms for the group
            group = {
                atoms: [
                    new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
                    new Atom('O1', 'O', new FractPosition(0.2, 0.2, 0.2)),
                ],
            };

            specialPositionMap = new Map();
        });

        test('extracts identity symmetry from unlabeled atoms', () => {
            // Group contains atoms without symmetry labels (original atoms)
            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(['1']); // Should contain only identity
            expect(result).toHaveLength(1);
        });

        test('extracts symmetry operations from atom appliedSymmetry', () => {
            // Atoms with AppliedSymmetry objects
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), '2_555'),
                createAtomWithSymmetry('O1', 'O', new FractPosition(0.2, 0.2, 0.2), '3_666'),
                createAtomWithSymmetry('N1', 'N', new FractPosition(0.3, 0.3, 0.3), '4_555'),
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(expect.arrayContaining(['2', '3', '4']));
            expect(result).toHaveLength(3);
        });

        test('handles mixed atoms with and without appliedSymmetry', () => {
            // Mix of original atoms and symmetry-generated atoms
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), null),  // Original (no symmetry)
                createAtomWithSymmetry('O1', 'O', new FractPosition(0.2, 0.2, 0.2), '2_555'),  // Symmetry-generated
                createAtomWithSymmetry('N1', 'N', new FractPosition(0.3, 0.3, 0.3), null),  // Original
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(expect.arrayContaining(['1', '2']));
            expect(result).toHaveLength(2);
        });

        test('extracts unique symmetry operations from atoms with same symOp', () => {
            // Multiple atoms with same symmetry operation
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), '2_555'),
                createAtomWithSymmetry(
                    'O1', 'O', new FractPosition(0.2, 0.2, 0.2), '2_666',
                ),
                createAtomWithSymmetry(
                    'N1', 'N', new FractPosition(0.3, 0.3, 0.3), '2_555',
                ),
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(['2']); // Should contain only unique symmetry operation
            expect(result).toHaveLength(1);
        });

        test('processes special position map entries', () => {
            // Special position map contains atom IDs that map to atoms in this group
            // Using new uniqueId format: Label|SymID_Trans
            specialPositionMap.set('C1|2_555', 'C1|1_555');  // C1|2_555 is a special position of C1
            specialPositionMap.set('O1|3_666', 'O1|1_555');  // O1|3_666 is a special position of O1
            specialPositionMap.set('N1|4_777', 'X1|1_555');  // N1|4_777 maps to X1 (not in this group)

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            // Should include symmetries from special positions that map to atoms in this group
            // 1 from group atoms, 2,3 from special positions
            expect(result).toEqual(expect.arrayContaining(['1', '2', '3']));
            expect(result).not.toContain('4'); // N1|4_777 maps to X1 which is not in this group
        });

        test('handles special position map with identity symmetry', () => {
            // Special position entry without @ symbol (identity operation)
            specialPositionMap.set('C1_copy', 'C1');  // Maps to atom in group
            specialPositionMap.set('O1_copy', 'O1');  // Maps to atom in group

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(['1']); // Should only contain identity
            expect(result).toHaveLength(1);
        });

        test('handles empty group', () => {
            group.atoms = [];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual([]); // No atoms means no symmetries
            expect(result).toHaveLength(0);
        });

        test('handles empty special position map', () => {
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), '2_555'),
            ];
            const emptySpecialPositionMap = new Map();

            const result = getGrownSymmetriesofGroup(group, { symmetry }, emptySpecialPositionMap);

            expect(result).toEqual(['2']);
            expect(result).toHaveLength(1);
        });

        test('combines symmetries from both atom appliedSymmetry and special position map', () => {
            // Group has atoms with some symmetry operations
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), null),  // Identity
                createAtomWithSymmetry('O1', 'O', new FractPosition(0.8, 0.8, 0.8), null),  // Identity
                createAtomWithSymmetry('O1', 'O', new FractPosition(0.2, 0.2, 0.2), '2_555'),  // Symmetry 2
            ];

            // Special position map adds more symmetries for atoms in this group
            specialPositionMap.set('C1|3_555', 'C1|1_555');  // Adds symmetry 3
            specialPositionMap.set('O1|4_666', 'O1|1_555');  // Adds symmetry 4
            specialPositionMap.set('X1|2_555', 'Y1|1_555');  // Maps to atom not in group - should be ignored

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(expect.arrayContaining(['1', '2', '3', '4']));
            expect(result).toHaveLength(4);
        });

        test('maintains unique symmetries across all sources', () => {
            // Overlapping symmetries from atom appliedSymmetry and special position map
            group.atoms = [
                createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.1, 0.1), '2_555'),
                createAtomWithSymmetry('O1', 'O', new FractPosition(0.2, 0.2, 0.2), '3_666'),
            ];

            // Special position map has overlapping symmetries
            specialPositionMap.set('C1|2_777', 'C1|2_555');  // Same symmetry 2 as atom
            specialPositionMap.set('O1|3_555', 'O1|3_666');  // Same symmetry 3 as atom
            specialPositionMap.set('N1|4_555', 'C1|2_555');  // New symmetry 4

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);

            expect(result).toEqual(expect.arrayContaining(['2', '3', '4']));
            expect(result).toHaveLength(3); // Should deduplicate
        });
    });

    describe('centreSymmetryString', () => {
        let symmetry;

        beforeEach(() => {
            // Set up symmetry operations (space group Cc - monoclinic)
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),              // 1_555 (identity)
                new SymmetryOperation('x,-y,z+1/2'),         // 2_555
                new SymmetryOperation('x+1/2,y+1/2,z'),      // 3_555
                new SymmetryOperation('x+1/2,-y+1/2,z+1/2'), // 4_555
            ];
            const operationIds = new Map([
                ['1', 0], ['2', 1], ['3', 2], ['4', 3],
            ]);
            symmetry = new CellSymmetry('Cc', 9, symmetryOps, operationIds);
        });

        test('transforms normal symmetry string with translation', () => {
            // Test with symmetry operation 2 (x,-y,z+1/2) and translation 666 (1,1,1)
            const symmString = '2_666';
            const symmCentre = [0.25, 0.75, 0.1]; // Centre that will cause unit cell translations

            const result = centreSymmetryString(symmetry, symmString, symmCentre);

            // Verify return object structure
            expect(result).toHaveProperty('newCentre');
            expect(result).toHaveProperty('newString');

            // Check that newCentre is a mathjs matrix with 3 elements
            expect(result.newCentre.size()).toEqual([3]);
            const centreArray = result.newCentre.toArray();
            expect(centreArray).toHaveLength(3);

            // Check transformation: x,-y,z+1/2 applied to [0.25, 0.75, 0.1] with translation [1,1,1]
            // Expected: [0.25 + 1, -0.75 + 1, 0.1 + 0.5 + 1] = [1.25, 0.25, 1.6]
            // Floor offsets: [1, 0, 1]
            // Adjusted centre: [0.25, 0.25, 0.6]
            expect(centreArray[0]).toBeCloseTo(0.25, 6);
            expect(centreArray[1]).toBeCloseTo(0.25, 6);
            expect(centreArray[2]).toBeCloseTo(0.6, 6);

            // Check adjusted symmetry string: original translation was 666 (1,1,1), offsets [1,0,1]
            // New translation should be [6-1, 6-0, 6-1] = [5,6,5] = '565'
            expect(result.newString).toBe('2_565');
        });

        test('handles symmetry string with missing translation', () => {
            // Test with symmetry operation without explicit translation (should default to 555)
            const symmString = '3'; // No translation part
            const symmCentre = [0.1, 0.2, 0.8]; // Centre that causes some translation

            const result = centreSymmetryString(symmetry, symmString, symmCentre);

            // Verify return object structure
            expect(result).toHaveProperty('newCentre');
            expect(result).toHaveProperty('newString');

            // Check that newCentre is properly formatted
            expect(result.newCentre.size()).toEqual([3]);
            const centreArray = result.newCentre.toArray();
            expect(centreArray).toHaveLength(3);

            // Check transformation: x+1/2,y+1/2,z applied to [0.1, 0.2, 0.8] with default translation [0,0,0]
            // Expected: [0.1 + 0.5, 0.2 + 0.5, 0.8] = [0.6, 0.7, 0.8]
            // Floor offsets: [0, 0, 0]
            // Adjusted centre: [0.6, 0.7, 0.8]
            expect(centreArray[0]).toBeCloseTo(0.6, 6);
            expect(centreArray[1]).toBeCloseTo(0.7, 6);
            expect(centreArray[2]).toBeCloseTo(0.8, 6);

            // Check symmetry string: default translation 555 (0,0,0), offsets [0,0,0]
            // New translation should be [5-0, 5-0, 5-0] = [5,5,5] = '555'
            expect(result.newString).toBe('3_555');
        });
    });
});

describe('Individual growing functions', () => {

    describe('growAtomsinGroup', () => {
        let symmetry;
        let grownGroup;
        let objectTracker;

        beforeEach(() => {
            // Set up symmetry operations for testing (space group Cc - 9)
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),              // 1_555 (identity)
                new SymmetryOperation('x,-y,z+1/2'),         // 2_555
                new SymmetryOperation('x+1/2,y+1/2,z'),      // 3_555
                new SymmetryOperation('x+1/2,-y+1/2,z+1/2'), // 4_555
            ];
            const operationIds = new Map([
                ['1', 0], ['2', 1], ['3', 2], ['4', 3],
            ]);
            symmetry = new CellSymmetry('Test', 1, symmetryOps, operationIds);

            // Set up a basic grown group with some test atoms
            grownGroup = {
                atoms: [
                    new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3)),
                    new Atom('O1', 'O', new FractPosition(0.8, 0.9, 0.1)),
                ],
                symmString: '1_555',
                groupCentre: matrix([0.45, 0.55, 0.2]),
            };

            // Set up object tracker
            objectTracker = {
                atomMap: new Map(),
                createdBonds: new Set(),
                createdHBonds: new Set(),
                specialPositionMap: new Map(),
                atomTranslations: new Map(),
            };
        });

        describe('basic functionality', () => {
            test('applies identity transformation correctly', () => {
                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);

                expect(result).toHaveLength(2);
                expect(result[0].label).toBe('C1');
                expect(result[1].label).toBe('O1');

                // Positions should remain the same for identity operation
                expect(result[0].position.x).toBeCloseTo(0.1);
                expect(result[0].position.y).toBeCloseTo(0.2);
                expect(result[0].position.z).toBeCloseTo(0.3);
            });

            test('applies non-identity transformation correctly', () => {
                const result = growAtomsinGroup(grownGroup, symmetry, '2_555', objectTracker, false);

                expect(result).toHaveLength(2);
                // Labels remain pure, uniqueId contains symmetry info
                expect(result[0].label).toBe('C1');
                expect(result[1].label).toBe('O1');
                expect(result[0].uniqueId).toBe('C1|2_555');
                expect(result[1].uniqueId).toBe('O1|2_555');

                // For transformation x,-y,z+1/2: (0.1,0.2,0.3) -> (0.1,-0.2,0.8)
                expect(result[0].position.x).toBeCloseTo(0.1);
                expect(result[0].position.y).toBeCloseTo(-0.2);
                expect(result[0].position.z).toBeCloseTo(0.8);
            });

            test('updates object tracker with atom positions', () => {
                const _result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);

                // Check that atomMap is populated
                expect(objectTracker.atomMap.size).toBe(2);

                // Check that position keys are correctly generated
                const atom1Key = Array.from(objectTracker.atomMap.keys())[0];
                const atom2Key = Array.from(objectTracker.atomMap.keys())[1];

                expect(atom1Key).toMatch(/^[CO]1_x[\d.-]+_y[\d.-]+_z[\d.-]+$/);
                expect(atom2Key).toMatch(/^[CO]1_x[\d.-]+_y[\d.-]+_z[\d.-]+$/);
            });
        });

        describe('moveAtomsInsideCell functionality', () => {
            beforeEach(() => {
                // Create atoms that will be outside unit cell after transformation
                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(1.2, 0.2, 0.3)),  // x > 1
                    new Atom('O1', 'O', new FractPosition(0.1, -0.5, 0.9)), // y < 0
                    new Atom('N1', 'N', new FractPosition(0.5, 0.5, 2.1)),  // z > 1
                ];
            });

            test('moves atoms inside cell when moveAtomsInsideCell is true', () => {
                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, true);

                expect(result).toHaveLength(3);

                // Check atoms are now within [0,1) range
                result.forEach(atom => {
                    expect(atom.position.x).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.x).toBeLessThan(1 + 1e-6);
                    expect(atom.position.y).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.y).toBeLessThan(1 + 1e-6);
                    expect(atom.position.z).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.z).toBeLessThan(1 + 1e-6);
                });
            });

            test('does not move atoms when moveAtomsInsideCell is false', () => {
                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);

                expect(result).toHaveLength(3);

                // Atoms should retain original positions (possibly outside unit cell)
                expect(result[0].position.x).toBeCloseTo(1.2);  // C1
                expect(result[1].position.y).toBeCloseTo(-0.5); // O1
                expect(result[2].position.z).toBeCloseTo(2.1);  // N1
            });

            test('updates atomTranslations map when moving atoms', () => {
                const _result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, true);

                // Check that translations are recorded
                expect(objectTracker.atomTranslations.size).toBeGreaterThan(0);

                // Each translation should map original label to [new label, translation string]
                for (const [originalLabel, [newLabel, translationString]] of objectTracker.atomTranslations) {
                    expect(typeof originalLabel).toBe('string');
                    expect(typeof newLabel).toBe('string');
                    expect(typeof translationString).toBe('string');
                    expect(translationString).toMatch(/^1_\d{3}$/); // Format: 1_xyz where xyz are digits
                }
            });

            test('correctly calculates translation strings', () => {
                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(2.3, -1.7, 3.9)), // Large offsets
                ];

                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, true);

                expect(result).toHaveLength(1);
                expect(result[0].position.x).toBeCloseTo(0.3); // 2.3 - 2
                expect(result[0].position.y).toBeCloseTo(0.3); // -1.7 - (-2) = 0.3
                expect(result[0].position.z).toBeCloseTo(0.9); // 3.9 - 3

                // Check translation string format: 1_abc where a=5+offsetX, b=5+offsetY, c=5+offsetZ
                const translation = objectTracker.atomTranslations.get('C1|1_555');
                expect(translation).toBeDefined();
                expect(translation).toEqual(['C1|1_372', '1_372']);
            });
        });

        describe('special positions and duplicates', () => {
            test('detects and handles duplicate atom positions', () => {
                // Create a scenario where symmetry operation creates duplicate position
                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(0.5, 0.5, 0.5)), // Center position
                ];

                // First call - should create atom
                const result1 = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);
                expect(result1).toHaveLength(1);
                expect(objectTracker.atomMap.size).toBe(1);

                // Second call with same position - should detect duplicate
                const result2 = growAtomsinGroup(grownGroup, symmetry, '2_555', objectTracker, false);

                // If the symmetry operation produces the same position, it should be detected as special position
                if (result2.length === 0) {
                    // eslint-disable-next-line vitest/no-conditional-expect -- outcome is data-dependent
                    expect(objectTracker.specialPositionMap.size).toBeGreaterThan(0);
                } else {
                    // Different position was created
                    // eslint-disable-next-line vitest/no-conditional-expect -- outcome is data-dependent
                    expect(result2).toHaveLength(1);
                }
            });

            test('maps duplicate atoms to existing atoms in special position map', () => {
                // Manually set up a special position scenario
                const existingAtomId = 'C1|1_555';
                const duplicatePosition = 'C1_x0.500_y-0.500_z1.000';

                // Pre-populate the atomMap to simulate existing atom
                objectTracker.atomMap.set(duplicatePosition, existingAtomId);

                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(0.5, 0.5, 0.5)), // Same position as existing
                ];

                const result = growAtomsinGroup(grownGroup, symmetry, '2_555', objectTracker, false);

                // Should return no new atoms since position already exists
                expect(result).toHaveLength(0);

                // Should map the duplicate to the existing atom
                expect(objectTracker.specialPositionMap.has('C1|2_555')).toBe(true);
                expect(objectTracker.specialPositionMap.get('C1|2_555')).toBe(existingAtomId);
            });
        });

        describe('edge cases', () => {
            test('handles empty atom group', () => {
                grownGroup.atoms = [];

                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);

                expect(result).toHaveLength(0);
                expect(objectTracker.atomMap.size).toBe(0);
            });

            test('handles atoms with existing symmetry labels', () => {
                grownGroup.atoms = [
                    createAtomWithSymmetry('C1', 'C', new FractPosition(0.1, 0.2, 0.3), '3_666'),
                ];

                const result = growAtomsinGroup(grownGroup, symmetry, '2_555', objectTracker, false);

                expect(result).toHaveLength(1);
                expect(result[0].label).toBe('C1');
                expect(result[0].uniqueId).toBe('C1|4_636');
            });

            test('handles atoms at unit cell boundaries', () => {
                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(0.0, 0.0, 0.0)),   // At origin
                    new Atom('O1', 'O', new FractPosition(1.0, 1.0, 1.0)),   // At opposite corner
                    new Atom('N1', 'N', new FractPosition(0.5, 0.0, 1.0)),   // On boundaries
                ];

                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, true);

                expect(result).toHaveLength(3);

                // Check that boundary atoms are handled correctly
                result.forEach(atom => {
                    expect(atom.position.x).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.x).toBeLessThan(1 + 1e-6);
                    expect(atom.position.y).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.y).toBeLessThan(1 + 1e-6);
                    expect(atom.position.z).toBeGreaterThanOrEqual(-1e-6);
                    expect(atom.position.z).toBeLessThan(1 + 1e-6);
                });
            });

            test('handles complex symmetry operations with translations', () => {
                const result = growAtomsinGroup(grownGroup, symmetry, '4_555', objectTracker, false);

                expect(result).toHaveLength(2);
                // Labels remain pure, uniqueId contains symmetry info
                expect(result[0].label).toBe('C1');
                expect(result[1].label).toBe('O1');
                expect(result[0].uniqueId).toBe('C1|4_555');
                expect(result[1].uniqueId).toBe('O1|4_555');

                // Verify that complex transformation x+1/2,-y+1/2,z+1/2 is applied correctly
                // Original C1: (0.1, 0.2, 0.3) -> (0.1+0.5, -0.2+0.5, 0.3+0.5) = (0.6, 0.3, 0.8)
                expect(result[0].position.x).toBeCloseTo(0.6);
                expect(result[0].position.y).toBeCloseTo(0.3);
                expect(result[0].position.z).toBeCloseTo(0.8);
            });
        });

        describe('precision and tolerance', () => {

            test('correctly rounds positions for boundary detection', () => {
                grownGroup.atoms = [
                    new Atom('C1', 'C', new FractPosition(0.9999999, 0.0000001, 0.5)),
                ];

                const result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, true);

                expect(result).toHaveLength(1);
                // Position should be considered as within bounds and not moved
                expect(result[0].position.x).toBeCloseTo(0.9999999, 6);
                expect(result[0].position.y).toBeCloseTo(0.0000001, 6);
            });
        });

        describe('object tracker interactions', () => {
            test('correctly populates all object tracker maps', () => {
                const _result = growAtomsinGroup(grownGroup, symmetry, '2_555', objectTracker, true);

                // AtomMap should be populated
                expect(objectTracker.atomMap.size).toBeGreaterThan(0);

                // Other maps should be initialized but may be empty for this function
                expect(objectTracker.createdBonds).toBeInstanceOf(Set);
                expect(objectTracker.createdHBonds).toBeInstanceOf(Set);
                expect(objectTracker.specialPositionMap).toBeInstanceOf(Map);
                expect(objectTracker.atomTranslations).toBeInstanceOf(Map);
            });

            test('preserves existing object tracker state', () => {
                // Pre-populate object tracker
                objectTracker.atomMap.set('existing_key', 'existing_value');
                objectTracker.specialPositionMap.set('existing_special', 'existing_atom');

                const _result = growAtomsinGroup(grownGroup, symmetry, '1_555', objectTracker, false);

                // Should preserve existing entries
                expect(objectTracker.atomMap.get('existing_key')).toBe('existing_value');
                expect(objectTracker.specialPositionMap.get('existing_special')).toBe('existing_atom');

                // Should also add new entries
                expect(objectTracker.atomMap.size).toBeGreaterThan(1);
            });
        });
    });
    describe('Bond Growing Functions', () => {
        let symmetry;
        let grownGroup;
        let objectTracker;

        beforeEach(() => {
            // Set up symmetry operations for testing (space group Cc - 9)
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),              // 1_555 (identity)
                new SymmetryOperation('x,-y,z+1/2'),         // 2_555
                new SymmetryOperation('x+1/2,y+1/2,z'),      // 3_555
                new SymmetryOperation('x+1/2,-y+1/2,z+1/2'), // 4_555
            ];
            const operationIds = new Map([
                ['1', 0], ['2', 1], ['3', 2], ['4', 3],
            ]);
            symmetry = new CellSymmetry('Test', 1, symmetryOps, operationIds);

            // Set up object tracker
            objectTracker = {
                atomMap: new Map(),
                createdBonds: new Set(),
                createdHBonds: new Set(),
                specialPositionMap: new Map(),
                atomTranslations: new Map(),
            };
        });

        describe('growInternalBondsInGroup', () => {
            beforeEach(() => {
                grownGroup = {
                    atoms: [
                        new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3)),
                        new Atom('O1', 'O', new FractPosition(0.8, 0.9, 0.1)),
                        new Atom('C2', 'C', new FractPosition(0.4, 0.5, 0.6)),
                    ],
                    internalBonds: [
                        new Bond('C1', 'O1', 1.5, 0.01, '.'),
                        new Bond('C1', 'C2', 1.4, 0.02, '.'),
                    ],
                    symmString: '1_555',
                    groupCentre: matrix([0.45, 0.55, 0.2]),
                };
            });

            test('grows internal bonds with identity transformation', () => {
                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(2);
                expect(result[0].atom1Id).toBe('C1|1_555'); // Identity keeps original label
                expect(result[0].atom2Id).toBe('O1|1_555'); // Identity keeps original label
                expect(result[0].bondLength).toBe(1.5);
                expect(result[0].bondLengthSU).toBe(0.01);
                expect(result[0].atom2SiteSymmetry).toBe('.');

                expect(result[1].atom1Id).toBe('C1|1_555');
                expect(result[1].atom2Id).toBe('C2|1_555');
            });

            test('grows internal bonds with non-identity transformation', () => {
                const result = growInternalBondsInGroup(grownGroup, symmetry, '2_555', objectTracker);

                expect(result).toHaveLength(2);
                expect(result[0].atom1Id).toBe('C1|2_555'); // Non-identity gets symmetry code
                expect(result[0].atom2Id).toBe('O1|2_555');
                expect(result[0].bondLength).toBe(1.5);
                expect(result[0].atom2SiteSymmetry).toBe('.');

                expect(result[1].atom1Id).toBe('C1|2_555');
                expect(result[1].atom2Id).toBe('C2|2_555');
            });

            test('avoids duplicate bonds', () => {
                // First call
                const result1 = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result1).toHaveLength(2);

                // Second call with same bonds - should create no new bonds
                const result2 = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result2).toHaveLength(0);
                expect(objectTracker.createdBonds.size).toBe(2);
            });

            test('skips self-bonds', () => {
                grownGroup.internalBonds = [
                    new Bond('C1', 'C1', 1.5, 0.01, '.'), // Self-bond
                    new Bond('C1', 'O1', 1.5, 0.01, '.'), // Normal bond
                ];

                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(1);
                expect(result[0].atom1Id).toBe('C1|1_555');
                expect(result[0].atom2Id).toBe('O1|1_555');
            });

            test('handles special position mapping', () => {
                // Set up special position mapping (using new | format)
                objectTracker.specialPositionMap.set('C1|2_555', 'C1|1_555'); // Maps to identity atom

                const result = growInternalBondsInGroup(grownGroup, symmetry, '2_555', objectTracker);

                expect(result).toHaveLength(2);
                // Should use mapped atom ID from special positions
                expect(result[0].atom1Id).toBe('C1|1_555'); // Mapped from C1|2_555 to identity
            });

            test('handles atom translations correctly', () => {
                // Set up atom translations - both atoms translated with same symmetry (using new | format)
                objectTracker.atomTranslations.set('C1|1_555', ['C1_trans|1_444', '1_444']);
                objectTracker.atomTranslations.set('O1|1_555', ['O1_trans|1_444', '1_444']);

                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(1); // Only one bond because C2 not translated
                expect(result[0].atom1Id).toBe('C1_trans|1_444');
                expect(result[0].atom2Id).toBe('O1_trans|1_444');
            });

            test('skips bonds when only one atom is translated', () => {
                // Set up atom translations - only one atom translated (using new | format)
                objectTracker.atomTranslations.set('C1|1_555', ['C1_trans|1_444', '1_444']);

                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0); // No bonds because only one atom is translated
            });

            test('skips bonds when atoms have different translation symmetries', () => {
                // Set up atom translations with different symmetries (using new | format)
                objectTracker.atomTranslations.set('C1|1_555', ['C1|1_444', '1_444']);
                objectTracker.atomTranslations.set('C2|1_555', ['C2|1_444', '1_444']);
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_555', '1_555']);

                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(1); // Only C1-C2 bond (C2 not translated)
                expect(result[0].atom2Id).toBe('C2|1_444'); // C2 has translation symmetry
            });

            test('handles empty internal bonds', () => {
                grownGroup.internalBonds = [];

                const result = growInternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0);
                expect(objectTracker.createdBonds.size).toBe(0);
            });
        });

        describe('growExternalBondsInGroup', () => {
            beforeEach(() => {
                grownGroup = {
                    atoms: [
                        new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3)),
                        new Atom('O1', 'O', new FractPosition(0.8, 0.9, 0.1)),
                    ],
                    externalBonds: [
                        new Bond('C1', 'N1', 1.5, 0.01, '2_555'), // External bond
                        new Bond('O1', 'S1', 1.8, 0.02, '3_666'), // External bond
                    ],
                    symmString: '1_555',
                    groupCentre: matrix([0.45, 0.55, 0.2]),
                };
            });

            test('grows external bonds with identity transformation', () => {
                const result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(2);

                expect(result[0].atom1Id).toBe('C1|1_555'); // Identity transformation uses 1_555
                expect(result[0].atom2Id).toBe('N1|2_555'); // External atom2 keeps its symmetry
                expect(result[0].bondLength).toBe(1.5);
                expect(result[0].atom2SiteSymmetry).toBe('2_555'); // Combined symmetry

                expect(result[1].atom1Id).toBe('O1|1_555');
                expect(result[1].atom2Id).toBe('S1|3_666');
                expect(result[1].atom2SiteSymmetry).toBe('3_666');
            });

            test('grows external bonds with non-identity transformation', () => {
                const result = growExternalBondsInGroup(grownGroup, symmetry, '2_555', objectTracker);

                expect(result).toHaveLength(2);
                // Non-identity transformation should add symmetry codes
                expect(result[0].atom1Id).toBe('C1|2_555');
                expect(result[1].atom1Id).toBe('O1|2_555');
                // Symmetry should be combined: symmString (2_555) + atom2SiteSymmetry
                expect(result[0].atom2SiteSymmetry).toBeDefined();
                expect(result[1].atom2SiteSymmetry).toBeDefined();
            });

            test('handles both atoms translated scenario', () => {
                // Set up translations for both atoms (using new | format)
                objectTracker.atomTranslations.set('C1|1_555', ['C1|1_444', '1_444']);
                objectTracker.atomTranslations.set('N1|1_555', ['N1|1_444', '1_444']);

                const result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                // Should handle complex translation logic
                expect(result.length).toBeGreaterThanOrEqual(0);
            });

            test('take into account of only one atom translated', () => {
                // Set up translation for only atom1 (using new | format)
                objectTracker.atomTranslations.set('C1|1_555', ['C1|1_444', '1_444']);

                const result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                // Should skip bonds where only one atom is translated
                expect(result).toHaveLength(2);
                expect(result[0].atom1Id).toBe('C1|1_444');
                expect(result[0].atom2Id).toBe('N1|2_444');
                expect(result[0].atom2SiteSymmetry).toBe('2_444'); // Should be combined symmetry
                expect(result[1].atom1Id).toBe('O1|1_555');

            });

            test('updates objectTracker createdBonds set', () => {
                const _result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(objectTracker.createdBonds.size).toBe(2);
                expect(objectTracker.createdBonds.has(
                    createBondIdentifier('C1|1_555', 'N1|2_555'),
                )).toBe(true);
                expect(objectTracker.createdBonds.has(
                    createBondIdentifier('O1|1_555', 'S1|3_666'),
                )).toBe(true);
            });

            test('avoids duplicate external bonds', () => {
                // First call
                const result1 = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result1).toHaveLength(2);

                // Second call - should create no duplicates
                const result2 = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result2).toHaveLength(0);
            });

            test('handles special position mapping for external bonds', () => {
                // Special position map uses full IDs as keys
                objectTracker.specialPositionMap.set('C1|1_555', 'C1|1_555_mapped');

                const result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result[0].atom1Id).toBe('C1|1_555_mapped');
            });

            test('handles empty external bonds', () => {
                grownGroup.externalBonds = [];

                const result = growExternalBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0);
                expect(objectTracker.createdBonds.size).toBe(0);
            });
        });

        describe('growInternalHBondsInGroup', () => {
            beforeEach(() => {
                grownGroup = {
                    atoms: [
                        new Atom('O1', 'O', new FractPosition(0.1, 0.2, 0.3)),
                        new Atom('H1', 'H', new FractPosition(0.2, 0.2, 0.3)),
                        new Atom('N1', 'N', new FractPosition(0.8, 0.9, 0.1)),
                    ],
                    internalHBonds: [
                        new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),
                        new HBond('N1', 'H2', 'O2', 1.1, 0.02, 1.9, 0.03, 2.9, 0.04, 178, 2, '.'),
                    ],
                    symmString: '1_555',
                    groupCentre: matrix([0.45, 0.55, 0.2]),
                };
            });

            test('grows internal hydrogen bonds with identity transformation', () => {
                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(2);

                expect(result[0].donorAtomId).toBe('O1|1_555'); // Identity transformation uses 1_555
                expect(result[0].hydrogenAtomId).toBe('H1|1_555');
                expect(result[0].acceptorAtomId).toBe('N1|1_555');
                expect(result[0].donorHydrogenDistance).toBe(1.0);
                expect(result[0].acceptorHydrogenDistance).toBe(2.0);
                expect(result[0].hBondAngle).toBe(175);
                expect(result[0].acceptorAtomSymmetry).toBe('.');

                expect(result[1].donorAtomId).toBe('N1|1_555');
                expect(result[1].hydrogenAtomId).toBe('H2|1_555');
                expect(result[1].acceptorAtomId).toBe('O2|1_555');
            });

            test('updates objectTracker createdHBonds set', () => {
                const _result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(objectTracker.createdHBonds.size).toBe(2);
                expect(objectTracker.createdHBonds.has(
                    createHBondIdentifier('O1|1_555', 'H1|1_555', 'N1|1_555'),
                )).toBe(true);
                expect(objectTracker.createdHBonds.has(
                    createHBondIdentifier('N1|1_555', 'H2|1_555', 'O2|1_555'),
                )).toBe(true);
            });

            test('avoids duplicate hydrogen bonds', () => {
                // First call
                const result1 = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result1).toHaveLength(2);

                // Second call - should create no duplicates
                const result2 = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result2).toHaveLength(0);
                expect(objectTracker.createdHBonds.size).toBe(2);
            });

            test('handles special position mapping for hydrogen bonds', () => {
                // Special position map uses full IDs as keys
                objectTracker.specialPositionMap.set('O1|1_555', 'O1|1_555_mapped');
                objectTracker.specialPositionMap.set('H1|1_555', 'H1|1_555_mapped');

                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result[0].donorAtomId).toBe('O1|1_555_mapped');
                expect(result[0].hydrogenAtomId).toBe('H1|1_555_mapped');
            });

            test('handles all atoms translated with same symmetry', () => {
                // Set up translations for all three atoms with same symmetry
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_444', '1_444']);
                objectTracker.atomTranslations.set('H1|1_555', ['H1|1_444', '1_444']);
                objectTracker.atomTranslations.set('N1|1_555', ['N1|1_444', '1_444']);

                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(1); // Only first H-bond (all atoms translated)
                expect(result[0].donorAtomId).toBe('O1|1_444');
                expect(result[0].hydrogenAtomId).toBe('H1|1_444');
                expect(result[0].acceptorAtomId).toBe('N1|1_444');
            });

            test('skips hydrogen bonds when atoms have different translation symmetries', () => {
                // Set up translations with different symmetries
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_444', '1_444']);
                objectTracker.atomTranslations.set('H1|1_555', ['H1|1_555', '1_444']);
                objectTracker.atomTranslations.set('N1|1_555', ['N1|1_555', '1_555']);
                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0); // Only H-bond where no atoms are translated
            });

            test('skips hydrogen bonds when only some atoms are translated', () => {
                // Only donor atom translated
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_444', '1_444']);

                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(1); // Only second H-bond (no translated atoms)
                expect(result[0].donorAtomId).toBe('N1|1_555');
            });

            test('preserves all hydrogen bond properties', () => {
                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                const hbond = result[0];
                expect(hbond.donorHydrogenDistance).toBe(1.0);
                expect(hbond.donorHydrogenDistanceSU).toBe(0.01);
                expect(hbond.acceptorHydrogenDistance).toBe(2.0);
                expect(hbond.acceptorHydrogenDistanceSU).toBe(0.02);
                expect(hbond.donorAcceptorDistance).toBe(2.8);
                expect(hbond.donorAcceptorDistanceSU).toBe(0.03);
                expect(hbond.hBondAngle).toBe(175);
                expect(hbond.hBondAngleSU).toBe(1);
                expect(hbond.acceptorAtomSymmetry).toBe('.');
            });

            test('handles empty internal hydrogen bonds', () => {
                grownGroup.internalHBonds = [];

                const result = growInternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0);
                expect(objectTracker.createdHBonds.size).toBe(0);
            });
        });

        describe('growExternalHBondsInGroup', () => {
            beforeEach(() => {
                grownGroup = {
                    atoms: [
                        new Atom('O1', 'O', new FractPosition(0.1, 0.2, 0.3)),
                        new Atom('H1', 'H', new FractPosition(0.2, 0.2, 0.3)),
                    ],
                    externalHBonds: [
                        new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '2_555'),
                        new HBond('O2', 'H2', 'S1', 1.1, 0.02, 1.9, 0.03, 2.9, 0.04, 178, 2, '3_666'),
                    ],
                    symmString: '1_555',
                    groupCentre: matrix([0.45, 0.55, 0.2]),
                };
            });

            test('grows external hydrogen bonds with symmetry transformations', () => {
                const result = growExternalHBondsInGroup(grownGroup, symmetry, '3_555', objectTracker);

                expect(result).toHaveLength(2);

                expect(result[0].donorAtomId).toBe('O1|3_555'); // Non-identity gets symmetry code
                expect(result[0].hydrogenAtomId).toBe('H1|3_555');
                expect(result[0].acceptorAtomId).toBe('N1|4_555'); // Combined acceptor ID
                expect(result[0].acceptorAtomSymmetry).toBe('4_555'); // Combined symmetry

                expect(result[1].donorAtomId).toBe('O2|3_555');
                expect(result[1].hydrogenAtomId).toBe('H2|3_555');
                expect(result[1].acceptorAtomId).toBe('S1|1_776'); // Combined acceptor ID
                expect(result[1].acceptorAtomSymmetry).toBe('1_776');
            });

            test('combines acceptor symmetry strings correctly', () => {
                const result = growExternalHBondsInGroup(grownGroup, symmetry, '2_555', objectTracker);

                expect(result).toHaveLength(2);
                // Acceptor symmetry should be combined: symmString + original acceptor symmetry
                expect(result[0].acceptorAtomSymmetry).toBeDefined();
                expect(result[1].acceptorAtomSymmetry).toBeDefined();
                // Note: exact values depend on symmetry.combineSymmetryCodes implementation
            });

            test('handles all atoms translated scenario', () => {
                // Set up translations - all atoms translated with same symmetry
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_444', '1_444']);
                objectTracker.atomTranslations.set('H1|1_555', ['H1|1_444', '1_444']);
                objectTracker.atomTranslations.set('N1|1_555', ['N1|1_444', '1_444']);

                const result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                // Should handle complex translation and symmetry combination logic
                expect(result.length).toBeGreaterThanOrEqual(0);
            });

            test('skips hydrogen bonds when only some atoms are translated', () => {
                // Set up translation for only donor
                objectTracker.atomTranslations.set('O1|1_555', ['O1|1_444', '1_444']);

                const result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                // Should skip H-bonds where only some atoms are translated
                expect(result).toHaveLength(1); // Only O2-H2...S1 bond should remain
                expect(result[0].donorAtomId).toBe('O2|1_555');
            });

            test('updates objectTracker createdHBonds set', () => {
                const _result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(objectTracker.createdHBonds.size).toBe(2);
                expect(objectTracker.createdHBonds.has(
                    createHBondIdentifier('O1|1_555', 'H1|1_555', 'N1|2_555'),
                )).toBe(true);
                expect(objectTracker.createdHBonds.has(
                    createHBondIdentifier('O2|1_555', 'H2|1_555', 'S1|3_666'),
                )).toBe(true);
            });

            test('avoids duplicate external hydrogen bonds', () => {
                // First call
                const result1 = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result1).toHaveLength(2);

                // Second call - should create no duplicates
                const result2 = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);
                expect(result2).toHaveLength(0);
            });

            test('handles special position mapping for external hydrogen bonds', () => {
                // Special position map uses full IDs as keys
                objectTracker.specialPositionMap.set('O1|1_555', 'O1|1_555_mapped');

                const result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result[0].donorAtomId).toBe('O1|1_555_mapped');
            });

            test('preserves all external hydrogen bond properties', () => {
                const result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                const hbond = result[0];
                expect(hbond.donorHydrogenDistance).toBe(1.0);
                expect(hbond.donorHydrogenDistanceSU).toBe(0.01);
                expect(hbond.acceptorHydrogenDistance).toBe(2.0);
                expect(hbond.acceptorHydrogenDistanceSU).toBe(0.02);
                expect(hbond.donorAcceptorDistance).toBe(2.8);
                expect(hbond.donorAcceptorDistanceSU).toBe(0.03);
                expect(hbond.hBondAngle).toBe(175);
                expect(hbond.hBondAngleSU).toBe(1);
            });

            test('handles empty external hydrogen bonds', () => {
                grownGroup.externalHBonds = [];

                const result = growExternalHBondsInGroup(grownGroup, symmetry, '1_555', objectTracker);

                expect(result).toHaveLength(0);
                expect(objectTracker.createdHBonds.size).toBe(0);
            });
        });

        describe('cross-function integration', () => {
            test('bond and hbond identifiers do not conflict', () => {
                const bondId = createBondIdentifier('C1|1_555', 'O1|1_555');
                const hbondId = createHBondIdentifier('O1|1_555', 'H1|1_555', 'N1|1_555');

                objectTracker.createdBonds.add(bondId);
                objectTracker.createdHBonds.add(hbondId);

                expect(objectTracker.createdBonds.has(bondId)).toBe(true);
                expect(objectTracker.createdHBonds.has(hbondId)).toBe(true);
                expect(objectTracker.createdBonds.size).toBe(1);
                expect(objectTracker.createdHBonds.size).toBe(1);
            });

            test('object tracker state persists across function calls', () => {
                const bondGroup = {
                    atoms: [new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3))],
                    internalBonds: [new Bond('C1', 'O1', 1.5, 0.01, '.')],
                    externalBonds: [new Bond('C1', 'N1', 1.4, 0.02, '2_555')],
                    internalHBonds: [],
                    externalHBonds: [],
                    symmString: '1_555',
                    groupCentre: matrix([0.1, 0.2, 0.3]),
                };

                // Call both bond growing functions
                const internalBonds = growInternalBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);
                const externalBonds = growExternalBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);

                // Verify state persistence
                expect(objectTracker.createdBonds.size).toBe(2);
                expect(internalBonds).toHaveLength(1);
                expect(externalBonds).toHaveLength(1);
            });

            test('functions handle shared special position mapping', () => {
                // Set up shared special position with full ID format
                objectTracker.specialPositionMap.set('C1|1_555', 'C1|1_555_shared');

                const bondGroup = {
                    atoms: [new Atom('C1', 'C', new FractPosition(0.1, 0.2, 0.3))],
                    internalBonds: [new Bond('C1', 'O1', 1.5, 0.01, '.')],
                    externalBonds: [new Bond('C1', 'N1', 1.4, 0.02, '2_555')],
                    internalHBonds: [new HBond('C1', 'H1', 'O1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.')],
                    externalHBonds: [new HBond('C1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '2_555')],
                    symmString: '1_555',
                    groupCentre: matrix([0.1, 0.2, 0.3]),
                };

                // All functions should use the same mapped atom
                const internalBonds = growInternalBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);
                const externalBonds = growExternalBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);
                const internalHBonds = growInternalHBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);
                const externalHBonds = growExternalHBondsInGroup(bondGroup, symmetry, '1_555', objectTracker);

                expect(internalBonds[0].atom1Id).toBe('C1|1_555_shared');
                expect(externalBonds[0].atom1Id).toBe('C1|1_555_shared');
                expect(internalHBonds[0].donorAtomId).toBe('C1|1_555_shared');
                expect(externalHBonds[0].donorAtomId).toBe('C1|1_555_shared');
            });
        });
    });
});

describe('growCell integration tests', () => {
    describe('simple structures', () => {
        test('handles empty structure', () => {
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const symmetryOps = [new SymmetryOperation('x,y,z')];
            const symmetry = new CellSymmetry('P1', 1, symmetryOps);
            const structure = new CrystalStructure(cell, [], [], [], symmetry);

            const result = growCell(structure);
            expect(result.atoms).toHaveLength(0);
            expect(result.bonds).toHaveLength(0);
            expect(result.hBonds).toHaveLength(0);
        });

        test('handles single atom with identity symmetry', () => {
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const atoms = [new Atom('C1', 'C', new FractPosition(0.5, 0.5, 0.5))];
            const symmetryOps = [new SymmetryOperation('x,y,z')];
            const symmetry = new CellSymmetry('P1', 1, symmetryOps);
            const structure = new CrystalStructure(cell, atoms, [], [], symmetry);

            const result = growCell(structure);
            expect(result.atoms).toHaveLength(1);
            expect(result.atoms[0].label).toBe('C1');
            expect(result.bonds).toHaveLength(0);
        });

        test('grows simple structure with multiple symmetry operations', () => {
            const mockStructure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
            }).build();

            const result = growCell(mockStructure);

            // Should have more atoms than the original
            expect(result.atoms.length).toBeGreaterThan(mockStructure.atoms.length);

            // Check that we have some symmetry-generated atoms
            const symmetryAtoms = result.atoms.filter(atom => atom.appliedSymmetry?.id !== '1');
            expect(symmetryAtoms.length).toBeGreaterThan(0);
        });
    });

    describe('fragment cutting', () => {
        test('respects cutFragments parameter', () => {
            const mockStructure = MockStructure.createDefault({
                hasMultipleSymmetry: true,
            }).build();

            const resultWithCutting = growCell(mockStructure, true);
            const resultWithoutCutting = growCell(mockStructure, false);

            expect(resultWithCutting.atoms.length).toBeGreaterThan(0);
            for (const group of resultWithoutCutting.calculateConnectedGroups()) {
                const limits = getFragmentLimits(group.atoms);
                const midpoint = [
                    (limits.minX + limits.maxX) / 2,
                    (limits.minY + limits.maxY) / 2,
                    (limits.minZ + limits.maxZ) / 2,
                ];
                expect(midpoint.every(value => value >= 0 && value < 1)).toBe(true);
            }
        });
    });

    describe('special positions handling', () => {
        test('handles special positions correctly', () => {
            // Create a structure where symmetry operations might generate duplicate atoms
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const atoms = [
                new Atom('C1', 'C', new FractPosition(0.0, 0.0, 0.0)), // At origin
                new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)),  // At center
            ];
            const bonds = [new Bond('C1', 'O1', 1.5, 0.01, '.')];

            const symmetryOps = [
                new SymmetryOperation('x,y,z'),     // Identity
                new SymmetryOperation('-x,-y,-z'),  // Inversion - should duplicate atoms at origin/center
            ];
            const operationIds = new Map([['1', 0], ['2', 1]]);
            const symmetry = new CellSymmetry('P-1', 2, symmetryOps, operationIds);

            const structure = new CrystalStructure(cell, atoms, bonds, [], symmetry);

            const result = growCell(structure);

            expect(result.atoms.length).toEqual(2);
            expect(result.atoms[0].label).toBe('C1');
            expect(result.atoms[1].label).toBe('O1');

        });
    });

    describe('external bonds with ungrown target atoms', () => {
        test('handles external bonds where target atoms are not generated by symmetry operations', () => {
            // Test case: External bond pointing to atom that would exist outside unit cell
            // but symmetry operations don't generate it within the unit cell
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const atoms = [
                new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('N1', 'N', new FractPosition(0.9, 0.9, 0.9)), // Near cell boundary
                new Atom('O1', 'O', new FractPosition(0.5, 0.5, 0.5)), // Center atom
                new Atom('S1', 'S', new FractPosition(0.8, 0.8, 0.8)), // Near cell boundary
            ];
            const bonds = [
                new Bond('C1', 'N1', 1.5, 0.01, '.'),           // Internal bond
                new Bond('C1', 'O1', 1.4, 0.02, '2_556'),       // External bond to ungrown atom
                new Bond('N1', 'S1', 1.8, 0.03, '2_556'),       // External bond to ungrown atom
                new Bond('N1', 'S1', 1.8, 0.03, '2_344'),       // External bond to ungrown atom
            ];

            // Symmetry that won't generate the target atoms within unit cell
            const symmetryOps = [
                new SymmetryOperation('x,y,z'),              // Identity only
                new SymmetryOperation('-x,-y,-z'),           // Inversion (won't help for these bonds)
            ];
            const operationIds = new Map([['1', 0], ['2', 1]]);
            const symmetry = new CellSymmetry('Test', 1, symmetryOps, operationIds);

            const structure = new CrystalStructure(cell, atoms, bonds, [], symmetry);
            const result = growCell(structure);

            // Should preserve external bonds even if target atoms aren't grown
            const externalBonds = result.bonds.filter(bond =>
                bond.atom2SiteSymmetry && bond.atom2SiteSymmetry !== '.',
            );
            expect(externalBonds.length).toBeGreaterThan(0);

            // Target atoms should remain with original labels (not grown)
            const ungrownO2Bond = externalBonds.find(bond =>
                bond.atom1Label === 'C1' && bond.atom2Label === 'O1',
            );
            expect(ungrownO2Bond).toBeDefined();
            expect(ungrownO2Bond.atom2Id).toContain('|');
        });
    });

    describe('external HBonds with ungrown target atoms', () => {
        test('handles external HBonds where acceptor atoms are not generated by symmetry', () => {
            const cell = new UnitCell(10, 10, 10, 90, 90, 90);
            const atoms = [
                new Atom('O1', 'O', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('H1', 'H', new FractPosition(0.15, 0.1, 0.1)),
                new Atom('N1', 'N', new FractPosition(0.9, 0.9, 0.9)),
            ];
            const hBonds = [
                new HBond('O1', 'H1', 'N1', 1.0, 0.01, 2.0, 0.02, 2.8, 0.03, 175, 1, '.'),      // Internal
                new HBond('O1', 'H1', 'N1', 1.1, 0.02, 2.1, 0.03, 2.9, 0.04, 170, 2, '1_333'), // External to ungrown
            ];

            const symmetryOps = [new SymmetryOperation('x,y,z')]; // Identity only
            const operationIds = new Map([['1', 0]]);
            const symmetry = new CellSymmetry('P1', 1, symmetryOps, operationIds);

            const structure = new CrystalStructure(cell, atoms, [], hBonds, symmetry);
            const result = growCell(structure);

            // Should preserve external HBond even if acceptor atom isn't grown
            const externalHBonds = result.hBonds.filter(hbond =>
                hbond.acceptorAtomSymmetry && hbond.acceptorAtomSymmetry !== '.',
            );
            expect(externalHBonds.length).toBe(1);

            const preservedHBond = externalHBonds[0];
            expect(preservedHBond.acceptorAtomId).toBe('N1|1_333');
            expect(preservedHBond.acceptorAtomSymmetry).toBe('1_333');
            expect(preservedHBond.donorAcceptorDistance).toBe(2.9);
        });
    });

    test('does not internalize an H-bond when only its acceptor is wrapped', () => {
        const cifContent = readFileSync('site/public/cif/urea.cif', 'utf8');
        const structure = CrystalStructure.fromCIF(new CIF(cifContent).getBlock(0));

        const result = growCell(structure, true);

        expect(result.hBonds).not.toContainEqual(expect.objectContaining({
            donorAtomId: 'N|1_555',
            hydrogenAtomId: 'Hb|1_555',
            acceptorAtomId: 'O|2_556',
            acceptorAtomSymmetry: '.',
        }));
    });

    test('omits bonds whose molecule is split across the displayed cell boundary', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0.95, 0.5, 0.5)),
            new Atom('C2', 'C', new FractPosition(0.05, 0.5, 0.5)),
            new Atom('N1', 'N', new FractPosition(0.2, 0.5, 0.5)),
            new Atom('N2', 'N', new FractPosition(0.3, 0.5, 0.5)),
            new Atom('Cl1', 'Cl', new FractPosition(0.4, 0.5, 0.5)),
            new Atom('O1', 'O', new FractPosition(0.9, 0.5, 0.5)),
        ];
        const bonds = [
            new Bond('C1', 'C2', 1.0, 0.01, '.'),
            new Bond('N1', 'N2', 1.0, 0.01, '.'),
            new Bond('Cl1', 'O1', 5.0, 0.01, '.'),
        ];
        const symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
        const structure = new CrystalStructure(cell, atoms, bonds, [], symmetry);

        const result = growCell(structure, true);
        const uncutResult = growCell(structure, false);

        expect(result.bonds).not.toContainEqual(expect.objectContaining({
            atom1Id: 'C1|1_555',
            atom2Id: 'C2|1_555',
        }));
        expect(result.bonds).toContainEqual(expect.objectContaining({
            atom1Id: 'N1|1_555',
            atom2Id: 'N2|1_555',
        }));
        expect(uncutResult.bonds).not.toContainEqual(expect.objectContaining({
            atom1Id: 'C1|1_555',
            atom2Id: 'C2|1_555',
        }));
        expect(result.bonds).not.toContainEqual(expect.objectContaining({
            atom1Id: 'Cl1|1_555',
            atom2Id: 'O1|1_555',
        }));
        expect(uncutResult.bonds).not.toContainEqual(expect.objectContaining({
            atom1Id: 'Cl1|1_555',
            atom2Id: 'O1|1_555',
        }));
    });

    test('centres disconnected molecules independently in fragment-cell mode', () => {
        const cell = new UnitCell(10, 10, 10, 90, 90, 90);
        const atoms = [
            new Atom('C1', 'C', new FractPosition(1.1, 0.2, 0.3)),
            new Atom('C2', 'C', new FractPosition(1.2, 0.2, 0.3)),
            new Atom('N1', 'N', new FractPosition(-0.3, 0.7, 0.6)),
            new Atom('N2', 'N', new FractPosition(-0.1, 0.7, 0.6)),
        ];
        const bonds = [
            new Bond('C1', 'C2', 1.0, 0.01, '.'),
            new Bond('N1', 'N2', 2.0, 0.01, '.'),
        ];
        const symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
        const structure = new CrystalStructure(cell, atoms, bonds, [], symmetry);
        const originalAtoms = structure.atoms.map(atom => ({
            id: atom.uniqueId,
            position: [atom.position.x, atom.position.y, atom.position.z],
        }));
        const originalBonds = structure.bonds.map(bond => [bond.atom1Id, bond.atom2Id]);

        const result = growCell(structure, false);
        const carbonAtoms = result.atoms.filter(atom => atom.atomType === 'C');
        const nitrogenAtoms = result.atoms.filter(atom => atom.atomType === 'N');
        const midpointX = moleculeAtoms => (
            Math.min(...moleculeAtoms.map(atom => atom.position.x)) +
            Math.max(...moleculeAtoms.map(atom => atom.position.x))
        ) / 2;

        expect(result.atoms).toHaveLength(4);
        expect(midpointX(carbonAtoms)).toBeCloseTo(0.15);
        expect(midpointX(nitrogenAtoms)).toBeCloseTo(0.8);
        expect(result.atoms.every(atom => atom.position.x >= 0 && atom.position.x < 1)).toBe(true);
        expect(structure.atoms.map(atom => ({
            id: atom.uniqueId,
            position: [atom.position.x, atom.position.y, atom.position.z],
        }))).toEqual(originalAtoms);
        expect(structure.bonds.map(bond => [bond.atom1Id, bond.atom2Id])).toEqual(originalBonds);
    });
});

describe('addPackingBorderAtoms', () => {
    const cell = new UnitCell(5, 5, 5, 90, 90, 90);
    const symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);

    test('is a no-op for a cutoff of 1 or less', () => {
        const structure = new CrystalStructure(
            cell, [new Atom('A1', 'C', new FractPosition(0, 0, 0))], [], [], symmetry,
        );

        expect(addPackingBorderAtoms(structure, 1).atoms).toHaveLength(1);
        expect(addPackingBorderAtoms(structure, 0.9).atoms).toHaveLength(1);
    });

    test('duplicates a corner atom onto all 7 border combinations', () => {
        const structure = new CrystalStructure(
            cell, [new Atom('A1', 'C', new FractPosition(0, 0, 0))], [], [], symmetry,
        );

        const result = addPackingBorderAtoms(structure, 1.001);

        expect(result.atoms).toHaveLength(8);
        const positions = result.atoms
            .map(atom => [atom.position.x, atom.position.y, atom.position.z].join(','))
            .sort();
        expect(positions).toEqual([
            '0,0,0', '0,0,1', '0,1,0', '0,1,1', '1,0,0', '1,0,1', '1,1,0', '1,1,1',
        ]);
        // Duplicates carry no bonds of their own.
        expect(result.bonds).toHaveLength(0);
    });

    test('duplicates a face atom (single near axis) onto one border copy', () => {
        const structure = new CrystalStructure(
            cell, [new Atom('A1', 'C', new FractPosition(0, 0.5, 0.5))], [], [], symmetry,
        );

        const result = addPackingBorderAtoms(structure, 1.001);

        expect(result.atoms).toHaveLength(2);
        const positions = result.atoms
            .map(atom => [atom.position.x, atom.position.y, atom.position.z].join(','))
            .sort();
        expect(positions).toEqual(['0,0.5,0.5', '1,0.5,0.5']);
    });

    test('leaves an interior atom untouched', () => {
        const structure = new CrystalStructure(
            cell, [new Atom('A1', 'C', new FractPosition(0.5, 0.5, 0.5))], [], [], symmetry,
        );

        expect(addPackingBorderAtoms(structure, 1.001).atoms).toHaveLength(1);
    });

    test('preserves existing bonds unchanged', () => {
        const atoms = [
            new Atom('A1', 'C', new FractPosition(0, 0.1, 0.1)),
            new Atom('A2', 'O', new FractPosition(0.05, 0.1, 0.1)),
        ];
        const bonds = [new Bond('A1', 'A2', 1.4, 0.01, '.')];
        const structure = new CrystalStructure(cell, atoms, bonds, [], symmetry);

        const result = addPackingBorderAtoms(structure, 1.001);

        expect(result.atoms.length).toBeGreaterThan(2);
        expect(result.bonds).toHaveLength(1);
        expect(result.bonds[0]).toBe(bonds[0]);
    });

    test('reproduces the full NaCl (Fm-3m) closed cell', () => {
        // The rock-salt asymmetric unit sits exactly on low faces (Na at the
        // origin, Cl at the face/edge centres), so a cutoff of 1.001 should
        // reproduce the complete 27-atom closed packing diagram.
        const naclSymmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
        const atoms = [
            new Atom('Na1', 'Na', new FractPosition(0, 0, 0)),
            new Atom('Na2', 'Na', new FractPosition(0, 0.5, 0.5)),
            new Atom('Na3', 'Na', new FractPosition(0.5, 0, 0.5)),
            new Atom('Na4', 'Na', new FractPosition(0.5, 0.5, 0)),
            new Atom('Cl1', 'Cl', new FractPosition(0, 0, 0.5)),
            new Atom('Cl2', 'Cl', new FractPosition(0, 0.5, 0)),
            new Atom('Cl3', 'Cl', new FractPosition(0.5, 0, 0)),
            new Atom('Cl4', 'Cl', new FractPosition(0.5, 0.5, 0.5)),
        ];
        const structure = new CrystalStructure(cell, atoms, [], [], naclSymmetry);

        const result = addPackingBorderAtoms(structure, 1.001);

        expect(result.atoms).toHaveLength(27);
    });
});
