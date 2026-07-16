import { describe, expect, test } from 'vitest';
import { tokenizeCif2 } from './tokenizer.js';
import { parseCif2Value, skipCif2Value } from './cif2-values.js';

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

describe('skipCif2Value', () => {
    const skipEnd = str => skipCif2Value(tokenizeCif2(str), 0);

    test('skips a bare value, returning the next token index', () => {
        const tokens = tokenizeCif2('42 99');
        expect(skipCif2Value(tokens, 0)).toBe(1);
    });

    test('skips a list, returning the index after its closing bracket', () => {
        const tokens = tokenizeCif2('[1 2 3] 99');
        const end = skipCif2Value(tokens, 0);
        expect(tokens[end].value).toBe('99');
    });

    test('skips nested lists and tables without misreading depth', () => {
        expect(skipEnd('[1 [2 3] {\'k\':4}]')).toBe(tokenizeCif2('[1 [2 3] {\'k\':4}]').length);
    });

    test('throws on an unterminated list', () => {
        expect(() => skipEnd('[1 2')).toThrow(/Unterminated CIF2 list/);
    });

    test('throws on an unterminated table', () => {
        expect(() => skipEnd('{\'a\':1')).toThrow(/Unterminated CIF2 table/);
    });

    test('rejects mismatched container nesting (list opened, table closed)', () => {
        // Regression: a flat depth counter that treats listClose/tableClose
        // interchangeably would accept this as balanced (depth 1 -> 0)
        // instead of detecting the mismatch.
        expect(() => skipEnd('[1 2}')).toThrow(/Mismatched CIF2 container/);
    });

    test('rejects mismatched container nesting (table opened, list closed)', () => {
        expect(() => skipEnd('{\'a\':1]')).toThrow(/Mismatched CIF2 container/);
    });

    test('rejects mismatched nesting inside a valid outer container', () => {
        // The outer list is well-formed; the inner table is closed with `]`
        // instead of `}`.
        expect(() => skipEnd('[1 {\'k\':2] 3]')).toThrow(/Mismatched CIF2 container/);
    });

    test('agrees with parseCif2Value on where a well-formed value ends', () => {
        const tokens = tokenizeCif2('[1 [2 3] {\'k\':4}] 99');
        const skipped = skipCif2Value(tokens, 0);
        const parsed = parseCif2Value(tokens, 0, true).nextPos;
        expect(skipped).toBe(parsed);
    });
});
