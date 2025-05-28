import { beforeEach, describe, test, expect } from 'vitest';
import { MockStructure } from '../base.test.js';
import { 
    minimalGrowthSet, 
    getFragmentLimits, 
    getSymmetryCentre, 
    growCell, 
} from './grow-cell.js';
import { CellSymmetry, SymmetryOperation } from '../../cell-symmetry.js';
import { UnitCell, CrystalStructure, Atom } from '../../crystal.js';
import { FractPosition } from '../../position.js';
import { Bond } from '../../bonds.js';

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
            expect(result).toEqual(new Set(['1', '2', '3']));
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
            const limits = { minX: 0.1, maxX: 0.9, minY: 0.2, maxY: 0.8, minZ: 0.3, maxZ: 0.7 };
            const identityOp = symmetry.symmetryOperations[0]; // x,y,z
            
            const centre = getSymmetryCentre(limits, identityOp);
            expect(centre.x).toBeCloseTo(0.5); // (0.1 + 0.9) / 2
            expect(centre.y).toBeCloseTo(0.5); // (0.2 + 0.8) / 2
            expect(centre.z).toBeCloseTo(0.5); // (0.3 + 0.7) / 2
        });

        test('calculates center for c-glide plane', () => {
            const limits = { minX: 0.1, maxX: 0.9, minY: 0.2, maxY: 0.8, minZ: 0.3, maxZ: 0.7 };
            const inversionOp = symmetry.symmetryOperations[1]; // x,-y,z+1/2
            
            const centre = getSymmetryCentre(limits, inversionOp);
            // Should apply the transformation to the center point
            expect(centre.x).toBeCloseTo(0.5); // 0.5
            expect(centre.y).toBeCloseTo(-0.5);  // -0.5
            expect(centre.z).toBeCloseTo(1); // 0.5 + 0.5
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

            expect(result.atoms.length).toEqual(2);
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
