import { parseValue, parseMultiLineString } from './helpers.js';

describe('Parse Value Tests', () => {
    test('parses decimal with SU', () => {
        expect(parseValue('123.456(7)', true)).toEqual({ value: 123.456, su: 0.007 });
        expect(parseValue('-123.456(7)', true)).toEqual({ value: -123.456, su: 0.007 });
        expect(parseValue('.5223(5)', true)).toEqual({ value: 0.5223, su: 0.0005 });
    });

    test('parses integer with SU', () => {
        expect(parseValue('123(7)', true)).toEqual({ value: 123, su: 7 });
        expect(parseValue('-123(7)', true)).toEqual({ value: -123, su: 7 });
    });

    test('parses regular numbers', () => {
        expect(parseValue('123.456')).toEqual({ value: 123.456, su: NaN });
        expect(parseValue('123')).toEqual({ value: 123, su: NaN });
    });

    test('parses scientific notation with uncertainty', () => {
        expect(parseValue('1.23E4(5)', true)).toEqual({ value: 12300, su: 500 });
        expect(parseValue('1.23e4(5)', true)).toEqual({ value: 12300, su: 500 });
        expect(parseValue('1.23E-4(2)', true)).toEqual({ value: 0.000123, su: 0.000002 });
        expect(parseValue('-1.23e-4(2)', true)).toEqual({ value: -0.000123, su: 0.000002 });
        expect(parseValue('1E1(5)', true)).toEqual({ value: 10, su: 50 });
        expect(parseValue('1.0E1(5)', true)).toEqual({ value: 10, su: 5 });
    });

    test('parses scientific notation without uncertainty', () => {
        expect(parseValue('1.23E4')).toEqual({ value: 12300, su: NaN });
        expect(parseValue('1.23e4')).toEqual({ value: 12300, su: NaN });
        expect(parseValue('1.23E-4')).toEqual({ value: 0.000123, su: NaN });
        expect(parseValue('-1.23e-4')).toEqual({ value: -0.000123, su: NaN });
        expect(parseValue('1E1')).toEqual({ value: 10, su: NaN });
        expect(parseValue('1.0E1')).toEqual({ value: 10, su: NaN });
    });

    test('parses quoted strings', () => {
        expect(parseValue('\'text\'')).toEqual({ value: 'text', su: NaN });
        expect(parseValue('"text"')).toEqual({ value: 'text', su: NaN });
    });

    test('handles unquoted strings with a number in a bracket', () => {
        expect(parseValue('H1')).toEqual({ value: 'H1', su: NaN });
        expect(parseValue('H(1)')).toEqual({ value: 'H(1)', su: NaN });
        expect(parseValue('H1(3)')).toEqual({ value: 'H1(3)', su: NaN });
    });

    test('respects splitSU flag', () => {
        expect(parseValue('123.456(7)', false)).toEqual({ value: '123.456(7)', su: NaN });
    });

    test('handles embedded quotes not followed by whitespace', () => {
        expect(parseValue('a dog\'s life')).toEqual({ value: 'a dog\'s life', su: NaN });
        expect(parseValue('C1\'')).toEqual({ value: 'C1\'', su: NaN });
    });

    test('handles properly quoted strings', () => {
        expect(parseValue('\'simple quoted\'')).toEqual({ value: 'simple quoted', su: NaN });
        expect(parseValue('"double quoted"')).toEqual({ value: 'double quoted', su: NaN });
    });

    test('preserves embedded quotes in unquoted strings', () => {
        expect(parseValue('don\'t')).toEqual({ value: 'don\'t', su: NaN });
        expect(parseValue('say"cheese"now')).toEqual({ value: 'say"cheese"now', su: NaN });
    });

    test('handles escaped characters', () => {
        expect(parseValue('escaped\\;character')).toEqual({ value: 'escaped;character', su: NaN });
        expect(parseValue('"escaped\\;character"')).toEqual({ value: 'escaped;character', su: NaN });
    });
});
describe('Parse MultiLine String Tests', () => {
    test('parses basic multiline string', () => {
        const lines = [';', 'line1', 'line2', ';'];
        expect(parseMultiLineString(lines, 0)).toEqual({
            value: 'line1\nline2',
            endIndex: 3,
        });
    });

    test('handles empty multiline string', () => {
        const lines = [';', ';'];
        expect(parseMultiLineString(lines, 0)).toEqual({
            value: '',
            endIndex: 1,
        });
    });
});
