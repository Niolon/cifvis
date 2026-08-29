import { atomLabelParts, formatAtomLabel, formatValueEsd, roundToDecimals } from './formatting.js';

describe('formatAtomLabel', () => {
    test('optionally renders every label digit as a Unicode subscript', () => {
        expect(formatAtomLabel('C1')).toBe('C1');
        expect(formatAtomLabel('C12A', true)).toBe('C₁₂A');
        expect(formatAtomLabel('Fe3_2', true)).toBe('Fe₃_₂');
        expect(formatAtomLabel('batch 12', true)).toBe('batch 12');
    });

    test('separates the complete non-element identifier for rich typography', () => {
        expect(atomLabelParts('Si1B', true)).toEqual({ element: 'Si', nonElement: '1B' });
        expect(atomLabelParts('Si1B')).toEqual({ element: 'Si1B', nonElement: '' });
    });

    test('removes one enclosing parenthesis pair only while subscripting', () => {
        expect(atomLabelParts('Si(1B)', true)).toEqual({ element: 'Si', nonElement: '1B' });
        expect(atomLabelParts('Si(1B)')).toEqual({ element: 'Si(1B)', nonElement: '' });
        expect(atomLabelParts('Si(1)B', true)).toEqual({ element: 'Si', nonElement: '(1)B' });
        expect(formatAtomLabel('C(12)', true)).toBe('C₁₂');
        expect(formatAtomLabel('C(12)')).toBe('C(12)');
    });
});

describe('roundToDecimals', () => {
    test('rounds to specified positive decimal places', () => {
        expect(roundToDecimals(123.4567, 2)).toBe(123.46);
        expect(roundToDecimals(123.4567, 1)).toBe(123.5);
        expect(roundToDecimals(123.4567, 0)).toBe(123);
    });

    test('handles negative decimal places', () => {
        expect(roundToDecimals(123.4567, -1)).toBe(120);
        expect(roundToDecimals(123.4567, -2)).toBe(100);
        expect(roundToDecimals(1234.567, -1)).toBe(1230);
    });

    test('handles zero', () => {
        expect(roundToDecimals(0, 2)).toBe(0);
        expect(roundToDecimals(0, 0)).toBe(0);
        expect(roundToDecimals(0, -2)).toBe(0);
    });

    test('handles negative numbers', () => {
        expect(roundToDecimals(-123.4567, 2)).toBe(-123.46);
        expect(roundToDecimals(-123.4567, 1)).toBe(-123.5);
        expect(roundToDecimals(-123.4567, -1)).toBe(-120);
    });

    test('rounds edge cases correctly', () => {
        expect(roundToDecimals(5.5, 0)).toBe(6);    // Round up
        expect(roundToDecimals(-5.5, 0)).toBe(-5);  // Round down for negative
        expect(roundToDecimals(0.0001, 3)).toBe(0);  // Very small number
        expect(roundToDecimals(999999.9, -2)).toBe(1000000);  // Large number rounding
    });
});

describe('formatValueEsd', () => {
    test('formats basic value with standard uncertainty', () => {
        expect(formatValueEsd(123.456, 0.007)).toBe('123.456(7)');
        expect(formatValueEsd(123.456, 0.07)).toBe('123.46(7)');
        expect(formatValueEsd(123.456, 0.7)).toBe('123.5(7)');
    });

    test('handles values with ESDs less than 2 in scientific notation', () => {
        expect(formatValueEsd(1.23456, 0.015)).toBe('1.235(15)');
        expect(formatValueEsd(1.23456, 0.0015)).toBe('1.2346(15)');
    });

    test('handles negative values', () => {
        expect(formatValueEsd(-123.456, 0.007)).toBe('-123.456(7)');
        expect(formatValueEsd(-123.456, 0.07)).toBe('-123.46(7)');
    });

    test('handles zero value', () => {
        expect(formatValueEsd(0, 0.007)).toBe('0.000(7)');
        expect(formatValueEsd(0, 0.07)).toBe('0.00(7)');
    });

    test('handles invalid ESDs', () => {
        expect(formatValueEsd(123.456, NaN)).toBe('123.4560');
    });

    test('handles custom noEsdDecimals for invalid ESDs', () => {
        expect(formatValueEsd(123.456, NaN, 2)).toBe('123.46');
        expect(formatValueEsd(123.456, null, 1)).toBe('123.5');
    });

    test('handles very small ESDs', () => {
        expect(formatValueEsd(1.23456, 0.0001)).toBe('1.23456(10)');
        expect(formatValueEsd(1.23456, 0.00001)).toBe('1.234560(10)');
    });

    test('handles very large ESDs', () => {
        expect(formatValueEsd(123.456, 10)).toBe('123(10)');
        expect(formatValueEsd(123.456, 100)).toBe('120(100)');
    });

    test('handles edge cases of value and ESD combinations', () => {
        expect(formatValueEsd(0.0001, 0.0001)).toBe('0.00010(10)');
        expect(formatValueEsd(9999.99999, 0.001)).toBe('10000.0000(10)');
    });
});
