import { describe, expect, test } from 'vitest';
import { tokenizeCif2 } from './tokenizer.js';
import { parseCif2Value } from './cif2-values.js';

// Tokenizes a bare CIF2 value and assembles it, returning the value only.
const value = str => parseCif2Value(tokenizeCif2(str), 0, true).value;

describe('parseCif2Value', () => {
    test('parses an unquoted number', () => {
        expect(value('42')).toBe(42);
    });

    test('splits standard uncertainties on unquoted numbers', () => {
        const result = parseCif2Value(tokenizeCif2('0.0625(2)'), 0, true);
        expect(result.value).toBe(0.0625);
        expect(result.su).toBeCloseTo(0.0002);
    });

    test('keeps quoted numeric-looking values as strings', () => {
        expect(value('\'1.0\'')).toBe('1.0');
    });

    test('keeps special values as strings', () => {
        expect(value('?')).toBe('?');
        expect(value('.')).toBe('.');
    });

    test('parses a list into an Array', () => {
        expect(value('[1 2 3]')).toEqual([1, 2, 3]);
    });

    test('parses an empty list into an empty Array', () => {
        expect(value('[]')).toEqual([]);
    });

    test('parses a table into a Map with ordered keys', () => {
        const table = value('{\'a\':1 \'b\':\'x\'}');
        expect(table).toBeInstanceOf(Map);
        expect([...table.entries()]).toEqual([['a', 1], ['b', 'x']]);
    });

    test('parses an empty table into an empty Map', () => {
        expect(value('{}')).toEqual(new Map());
    });

    test('supports nested lists and tables', () => {
        const result = value('[1 [2 3] {\'k\':4}]');
        expect(result[0]).toBe(1);
        expect(result[1]).toEqual([2, 3]);
        expect(result[2]).toBeInstanceOf(Map);
        expect(result[2].get('k')).toBe(4);
    });

    test('supports a table whose value is a list', () => {
        const table = value('{\'a\':10 \'c\':[11 12]}');
        expect(table.get('c')).toEqual([11, 12]);
    });

    test('throws on an unterminated list', () => {
        expect(() => value('[1 2')).toThrow(/Unterminated CIF2 list/);
    });

    test('throws when a table entry is missing its colon', () => {
        // '"a" 1' -> quoted value with no following colon inside a table
        const tokens = tokenizeCif2('{"a" 1}');
        expect(() => parseCif2Value(tokens, 0, true)).toThrow(/missing its colon/);
    });
});
