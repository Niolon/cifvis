import { describe, expect, test } from 'vitest';
import { tokenizeCif2 } from './tokenizer.js';

// Reduces the token stream to compact [type, value] pairs for concise assertions.
const compact = tokens => tokens.map(t => (t.value !== undefined ? [t.type, t.value] : [t.type]));

describe('tokenizeCif2', () => {
    test('recognizes data headers, tags and plain values', () => {
        expect(compact(tokenizeCif2('data_block\n_tag value'))).toEqual([
            ['data', 'block'],
            ['tag', '_tag'],
            ['value', 'value'],
        ]);
    });

    test('preserves the original case of data block codes', () => {
        expect(tokenizeCif2('data_MixedCase')[0]).toMatchObject({ type: 'data', value: 'MixedCase' });
    });

    test('recognizes loop_ case-insensitively', () => {
        expect(tokenizeCif2('LOOP_')[0]).toMatchObject({ type: 'loop' });
    });

    test('skips comments, including the CIF2 magic code', () => {
        expect(compact(tokenizeCif2('#\\#CIF_2.0\n# a comment\n_tag v # trailing'))).toEqual([
            ['tag', '_tag'],
            ['value', 'v'],
        ]);
    });

    test('reads single- and double-quoted strings without the delimiters', () => {
        expect(compact(tokenizeCif2('_a \'sq\' _b "dq"'))).toEqual([
            ['tag', '_a'],
            ['value', 'sq'],
            ['tag', '_b'],
            ['value', 'dq'],
        ]);
        expect(tokenizeCif2('_a \'sq\'')[1].quoted).toBe(true);
    });

    describe('triple-quoted strings', () => {
        test('empty triple-quoted strings', () => {
            expect(compact(tokenizeCif2('_a \'\'\'\'\'\' _b """"""'))).toEqual([
                ['tag', '_a'],
                ['value', ''],
                ['tag', '_b'],
                ['value', ''],
            ]);
        });

        test('leading delimiters belong to the content', () => {
            // ''''tricky''' -> content 'tricky
            expect(tokenizeCif2('_a \'\'\'\'tricky\'\'\'')[1]).toMatchObject({ value: '\'tricky' });
            // """""tricky""" -> content ""tricky
            expect(tokenizeCif2('_a """""tricky"""')[1]).toMatchObject({ value: '""tricky' });
        });

        test('a triple-quoted string may contain the other delimiter run', () => {
            expect(tokenizeCif2('_a \'\'\'"""embedded"""\'\'\'')[1]).toMatchObject({ value: '"""embedded"""' });
        });

        test('a triple-quoted string may span lines and contain reserved text', () => {
            const tokens = tokenizeCif2('_a """\n_not_a_name\n;embedded\n;\n"""');
            expect(tokens).toHaveLength(2);
            expect(tokens[1]).toMatchObject({ type: 'value', value: '\n_not_a_name\n;embedded\n;\n' });
        });
    });

    describe('lists', () => {
        test('brackets are structural even without surrounding whitespace', () => {
            expect(compact(tokenizeCif2('_a [.]'))).toEqual([
                ['tag', '_a'],
                ['listOpen'],
                ['value', '.'],
                ['listClose'],
            ]);
        });

        test('empty and spaced lists', () => {
            expect(compact(tokenizeCif2('_a [] _b [ ]'))).toEqual([
                ['tag', '_a'], ['listOpen'], ['listClose'],
                ['tag', '_b'], ['listOpen'], ['listClose'],
            ]);
        });

        test('a quoted string inside a list may contain brackets', () => {
            expect(compact(tokenizeCif2('_a ["[ not a list ]"]'))).toEqual([
                ['tag', '_a'],
                ['listOpen'],
                ['value', '[ not a list ]'],
                ['listClose'],
            ]);
        });

        test('data_-looking text inside a list quoted string is not a data token', () => {
            const types = tokenizeCif2('_a [ "data_x" ]').map(t => t.type);
            expect(types).not.toContain('data');
        });

        test('nested lists', () => {
            expect(compact(tokenizeCif2('_a [1 [2 3]]'))).toEqual([
                ['tag', '_a'],
                ['listOpen'],
                ['value', '1'],
                ['listOpen'],
                ['value', '2'],
                ['value', '3'],
                ['listClose'],
                ['listClose'],
            ]);
        });
    });

    describe('tables', () => {
        test('a quoted key immediately followed by a colon emits a colon token', () => {
            expect(compact(tokenizeCif2('_a {\'k\':1}'))).toEqual([
                ['tag', '_a'],
                ['tableOpen'],
                ['value', 'k'],
                ['colon'],
                ['value', '1'],
                ['tableClose'],
            ]);
        });

        test('whitespace is allowed between the colon and the value', () => {
            expect(compact(tokenizeCif2('_a {\'k\': 1}'))).toEqual([
                ['tag', '_a'],
                ['tableOpen'],
                ['value', 'k'],
                ['colon'],
                ['value', '1'],
                ['tableClose'],
            ]);
        });

        test('empty keys and empty tables', () => {
            expect(compact(tokenizeCif2('_a {\'\':0}'))).toEqual([
                ['tag', '_a'],
                ['tableOpen'],
                ['value', ''],
                ['colon'],
                ['value', '0'],
                ['tableClose'],
            ]);
        });
    });

    describe('text fields', () => {
        test('a semicolon text field at line start', () => {
            const tokens = tokenizeCif2('_a\n;text\n;');
            expect(tokens[1]).toMatchObject({ type: 'value', value: 'text', quoted: true });
        });

        test('multi-line text fields keep interior newlines', () => {
            expect(tokenizeCif2('_a\n;line 1\nline 2\n;')[1].value).toBe('line 1\nline 2');
        });

        test('content after the closing semicolon stays on the stream', () => {
            // Text field value "v2" closes on "; 1.0", leaving "1.0" as the next value.
            const tokens = tokenizeCif2('2\n;v2\n; 1.0');
            expect(compact(tokens)).toEqual([
                ['value', '2'],
                ['value', 'v2'],
                ['value', '1.0'],
            ]);
        });

        test('a semicolon mid-line is an ordinary character, not a text field', () => {
            expect(tokenizeCif2('_a b;c')[1]).toMatchObject({ type: 'value', value: 'b;c' });
        });
    });

    describe('reserved words', () => {
        test('save frame open and close', () => {
            expect(compact(tokenizeCif2('save_frame\nsave_'))).toEqual([
                ['save', 'frame'],
                ['saveEnd'],
            ]);
        });
    });
});
