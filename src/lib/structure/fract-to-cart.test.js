import { create, all } from 'mathjs';
import { 
    calculateFractToCartMatrix, 
    adpToMatrix, 
    matrixToAdp, 
    uCifToUCart 
} from './fract-to-cart.js';

const math = create(all);

describe('calculateFractToCartMatrix', () => {
    test('calculates matrix for cubic cell', () => {
        const cellParams = {
            a: 10,
            b: 10,
            c: 10,
            alpha: 90,
            beta: 90,
            gamma: 90
        };
        
        const result = calculateFractToCartMatrix(cellParams);
        const expectedMatrix = math.matrix([
            [10, 0, 0],
            [0, 10, 0],
            [0, 0, 10]
        ]);
        
        expect(math.max(math.abs(math.subtract(result, expectedMatrix)))).toBeLessThan(1e-10);
    });

    test('calculates matrix for orthorhombic cell', () => {
        const cellParams = {
            a: 5,
            b: 10,
            c: 15,
            alpha: 90,
            beta: 90,
            gamma: 90
        };
        
        const result = calculateFractToCartMatrix(cellParams);
        const expectedMatrix = math.matrix([
            [5, 0, 0],
            [0, 10, 0],
            [0, 0, 15]
        ]);
        
        expect(math.max(math.abs(math.subtract(result, expectedMatrix)))).toBeLessThan(1e-10);
    });

    test('calculates matrix for monoclinic cell', () => {
        const cellParams = {
            a: 5,
            b: 10,
            c: 15,
            alpha: 90,
            beta: 100,
            gamma: 90
        };
        
        const result = calculateFractToCartMatrix(cellParams);
        // Values verified against published crystallographic software
        const expectedMatrix = math.matrix([
            [5, 0, -2.604723],
            [0, 10, 0],
            [0, 0, 14.772116]
        ]);
        
        expect(math.max(math.abs(math.subtract(result, expectedMatrix)))).toBeLessThan(1e-6);
    });

    test('calculates matrix for triclinic cell', () => {
        const cellParams = {
            a: 5,
            b: 6,
            c: 7,
            alpha: 85,
            beta: 95,
            gamma: 105
        };
        
        const result = calculateFractToCartMatrix(cellParams);
        // Values verified against published crystallographic software
        expect(result.get([0, 0])).toBeCloseTo(5, 6);
        expect(result.get([0, 1])).toBeCloseTo(-1.5529, 4);
        expect(result.get([1, 1])).toBeCloseTo(5.7956, 4);
    });
});

describe('adpToMatrix and matrixToAdp', () => {
    test('converts ADPs to matrix and back', () => {
        const adps = [1, 2, 3, 0.1, 0.2, 0.3];
        const matrix = adpToMatrix(adps);
        const result = matrixToAdp(matrix);
        
        expect(result).toHaveLength(6);
        result.forEach((value, index) => {
            expect(value).toBeCloseTo(adps[index], 10);
        });
    });

    test('maintains matrix symmetry', () => {
        const adps = [1, 2, 3, 0.1, 0.2, 0.3];
        const matrix = adpToMatrix(adps);
        
        // Check symmetry: M[i,j] should equal M[j,i]
        expect(matrix.get([0, 1])).toBe(matrix.get([1, 0]));
        expect(matrix.get([0, 2])).toBe(matrix.get([2, 0]));
        expect(matrix.get([1, 2])).toBe(matrix.get([2, 1]));
    });
});

describe('uCifToUCart', () => {
    test('preserves ADPs for orthogonal systems', () => {
        // Test for cubic system
        const cubicMatrix = math.matrix([
            [10, 0, 0],
            [0, 10, 0],
            [0, 0, 10]
        ]);
        
        const adps = [0.01, 0.02, 0.03, 0.001, 0.002, 0.003];
        const cubicResult = uCifToUCart(cubicMatrix, adps);
        
        // For orthogonal systems, Ucif should equal Ucart
        adps.forEach((value, index) => {
            expect(cubicResult[index]).toBeCloseTo(value, 6);
        });

        // Test for orthorhombic system
        const orthoMatrix = math.matrix([
            [5, 0, 0],
            [0, 8, 0],
            [0, 0, 12]
        ]);
        
        const orthoResult = uCifToUCart(orthoMatrix, adps);
        
        // Should also preserve values for orthorhombic
        adps.forEach((value, index) => {
            expect(orthoResult[index]).toBeCloseTo(value, 6);
        });
    });

    test('handles non-orthogonal transformation', () => {
        const fractToCartMatrix = math.matrix([
            [5, 0, -2.607837],
            [0, 10, 0],
            [0, 0, 14.781476]
        ]);
        
        const adps = [0.01, 0.02, 0.03, 0.001, 0.002, 0.003];
        const result = uCifToUCart(fractToCartMatrix, adps);
        const target = [0.01053, 0.02, 0.03, 0.00049, -0.00326, 0.003];

        result.forEach((value, index) => {
            expect(value).toBeCloseTo(target[index], 5);
        });
        
    });
});