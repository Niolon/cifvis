import { beforeEach, describe, test, expect } from 'vitest';
import { MockStructure } from '../base.test.js';
import { 
    minimalGrowthSet, 
    getFragmentLimits, 
    getSymmetryCentre, 
    getGrownSymmetriesofGroup,
    centreSymmetryString,
    growCell, 
} from './grow-cell.js';
import { CellSymmetry, SymmetryOperation } from '../../cell-symmetry.js';
import { UnitCell, CrystalStructure, Atom } from '../../crystal.js';
import { FractPosition } from '../../position.js';
import { Bond } from '../../bonds.js';
import { create, all } from 'mathjs';
const math = create(all, {});

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
            const startCentre = math.matrix([0.1, 0.2, 0.3]);
            const identityOp = symmetry.symmetryOperations[0]; // x,y,z
            
            const centre = getSymmetryCentre(startCentre, identityOp);
            const centreArray = centre.toArray();
            expect(centreArray.length).toBe(3);
            expect(centreArray[0]).toBeCloseTo(0.1);
            expect(centreArray[1]).toBeCloseTo(0.2);
            expect(centreArray[2]).toBeCloseTo(0.3);
        });

        test('calculates center for c-glide plane', () => {
            const startCentre = math.matrix([0.1, 0.2, 0.3]);
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

        test('extracts symmetry operations from atom labels with @ syntax', () => {
            // Atoms with symmetry labels in format: originalLabel@symOpId_translationCode
            group.atoms = [
                new Atom('C1@2_555', 'C', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('O1@3_666', 'O', new FractPosition(0.2, 0.2, 0.2)),
                new Atom('N1@4_555', 'N', new FractPosition(0.3, 0.3, 0.3)),
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);
            
            expect(result).toEqual(expect.arrayContaining(['2', '3', '4']));
            expect(result).toHaveLength(3);
        });

        test('handles mixed labeled and unlabeled atoms', () => {
            // Mix of original atoms and symmetry-generated atoms
            group.atoms = [
                new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),        // Original
                new Atom('O1@2_555', 'O', new FractPosition(0.2, 0.2, 0.2)),  // Symmetry-generated
                new Atom('N1', 'N', new FractPosition(0.3, 0.3, 0.3)),        // Original
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);
            
            expect(result).toEqual(expect.arrayContaining(['1', '2']));
            expect(result).toHaveLength(2);
        });

        test('extracts unique symmetry operations from duplicate labels', () => {
            // Multiple atoms with same symmetry operation
            group.atoms = [
                new Atom('C1@2_555', 'C', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('O1@2_666', 'O', new FractPosition(0.2, 0.2, 0.2)),  // Same symOp, different translation
                new Atom('N1@2_555', 'N', new FractPosition(0.3, 0.3, 0.3)),  // Same symOp + translation
            ];

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);
            
            expect(result).toEqual(['2']); // Should contain only unique symmetry operation
            expect(result).toHaveLength(1);
        });

        test('processes special position map entries', () => {
            // Special position map contains atom labels that map to atoms in this group
            specialPositionMap.set('C1@2_555', 'C1');  // C1@2_555 is a special position of C1
            specialPositionMap.set('O1@3_666', 'O1');  // O1@3_666 is a special position of O1
            specialPositionMap.set('N1@4_777', 'X1');  // N1@4_777 maps to X1 (not in this group)

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);
            
            // Should include symmetries from special positions that map to atoms in this group
            // 1 from group atoms, 2,3 from special positions
            expect(result).toEqual(expect.arrayContaining(['1', '2', '3'])); 
            expect(result).not.toContain('4'); // N1@4_777 maps to X1 which is not in this group
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
                new Atom('C1@2_555', 'C', new FractPosition(0.1, 0.1, 0.1)),
            ];
            const emptySpecialPositionMap = new Map();

            const result = getGrownSymmetriesofGroup(group, { symmetry }, emptySpecialPositionMap);
            
            expect(result).toEqual(['2']);
            expect(result).toHaveLength(1);
        });

        test('combines symmetries from both atom labels and special position map', () => {
            // Group has atoms with some symmetry operations
            group.atoms = [
                new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),        // Identity
                new Atom('O1', 'O', new FractPosition(0.8, 0.8, 0.8)),  // Identity
                new Atom('O1@2_555', 'O', new FractPosition(0.2, 0.2, 0.2)),  // Symmetry 2
            ];

            // Special position map adds more symmetries for atoms in this group
            specialPositionMap.set('C1@3_555', 'C1');  // Adds symmetry 3
            specialPositionMap.set('O1@4_666', 'O1');  // Adds symmetry 4
            specialPositionMap.set('X1@2_555', 'Y1');  // Maps to atom not in group - should be ignored

            const result = getGrownSymmetriesofGroup(group, { symmetry }, specialPositionMap);
            
            expect(result).toEqual(expect.arrayContaining(['1', '2', '3', '4']));
            expect(result).toHaveLength(4);
        });

        test('maintains unique symmetries across all sources', () => {
            // Overlapping symmetries from atom labels and special position map
            group.atoms = [
                new Atom('C1@2_555', 'C', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('O1@3_666', 'O', new FractPosition(0.2, 0.2, 0.2)),
            ];

            // Special position map has overlapping symmetries
            specialPositionMap.set('C1@2_777', 'C1');  // Same symmetry 2 as atom label
            specialPositionMap.set('O1@3_555', 'O1@3_666');  // Same symmetry 3 as atom label
            specialPositionMap.set('N1@4_555', 'C1@2_555');  // New symmetry 4

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
            const symmetryAtoms = result.atoms.filter(atom => atom.label.includes('@'));
            expect(symmetryAtoms.length).toBeGreaterThan(0);
            
            console.log('Original atoms:', mockStructure.atoms.length);
            console.log('Result atoms:', result.atoms.length);
            console.log('Original bonds:', mockStructure.bonds.length);
            console.log('Result bonds:', result.bonds.length);
            console.log('Sample atom labels:', result.atoms.slice(0, 10).map(a => a.label));
        });
    });

    describe('fragment cutting', () => {
        test('respects cutFragments parameter', () => {
            const mockStructure = MockStructure.createDefault({ 
                hasMultipleSymmetry: true, 
            }).build();

            const resultWithCutting = growCell(mockStructure, true);
            const resultWithoutCutting = growCell(mockStructure, false);
            
            // Without cutting should potentially have more atoms
            expect(resultWithoutCutting.atoms.length).toBeGreaterThanOrEqual(resultWithCutting.atoms.length);
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

            expect(result.atoms.length).toEqual(3);
            expect(result.atoms[0].label).toBe('C1');
            expect(result.atoms[1].label).toBe('O1');
            
        });
    });

    describe('performance and edge cases', () => {
        test('handles structure with many symmetry operations', () => {
            // Test with a structure that has more complex symmetry
            const mockStructure = MockStructure.createDefault({ 
                hasMultipleSymmetry: true,
                hasHydrogens: true, 
            }).build();

            const startTime = Date.now();
            const result = growCell(mockStructure);
            const endTime = Date.now();
            
            expect(result).toBeDefined();
            expect(result.atoms.length).toBeGreaterThan(0);
            console.log(`Growth took ${endTime - startTime}ms`);
            console.log('Complex structure result:');
            console.log('Atoms:', result.atoms.length);
            console.log('Bonds:', result.bonds.length);
            console.log('H-bonds:', result.hBonds.length);
        });
    });
});
