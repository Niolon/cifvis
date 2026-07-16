import { readFileSync } from 'fs';
import { describe, expect, test } from 'vitest';
import { CIF, splitCif2Blocks } from './base.js';
import { tokenizeCif2 } from './tokenizer.js';
import { CrystalStructure } from '../structure/crystal.js';

const CIF2 = '#\\#CIF_2.0\n';

describe('CIF2 parsing', () => {
    test('detects version 2 from the magic code', () => {
        const cif = new CIF(`${CIF2}data_x\n_a 1`);
        expect(cif.version).toBe(2);
        expect(cif.getBlock(0).version).toBe(2);
    });

    test('a file without the magic code stays on the CIF1 path', () => {
        const cif = new CIF('data_x\n_a 1');
        expect(cif.version).toBe(1);
    });

    test('CIF1 treats brackets and braces as ordinary value characters', () => {
        // Regression guard: the CIF2 structural characters must stay literal on the CIF1 path.
        const block = new CIF('data_x\n_bracket_end a[42]\n_brace_begin {foo}bar').getBlock(0);
        expect(block.get('_bracket_end')).toBe('a[42]');
        expect(block.get('_brace_begin')).toBe('{foo}bar');
    });

    describe('scalar values', () => {
        const block = new CIF(`${CIF2}data_scalars
_num 1.25
_su 0.0625(2)
_unquoted hello
_sq 'single'
_dq "double"
_special ?`).getBlock(0);

        test('parses numbers, strings and standard uncertainties', () => {
            expect(block.get('_num')).toBe(1.25);
            expect(block.get('_su')).toBe(0.0625);
            expect(block.get('_su_su')).toBeCloseTo(0.0002);
            expect(block.get('_unquoted')).toBe('hello');
            expect(block.get('_sq')).toBe('single');
            expect(block.get('_dq')).toBe('double');
            expect(block.get('_special')).toBe('?');
        });
    });

    describe('list and table values', () => {
        const block = new CIF(`${CIF2}data_containers
_list [1 2 3]
_nested [1 [2 3] {'k':4}]
_table {'a':1 'b':'x'}`).getBlock(0);

        test('exposes a list as an Array via get()', () => {
            expect(block.get('_list')).toEqual([1, 2, 3]);
        });

        test('exposes nested structures', () => {
            const nested = block.get('_nested');
            expect(nested[1]).toEqual([2, 3]);
            expect(nested[2].get('k')).toBe(4);
        });

        test('exposes a table as a Map via get()', () => {
            const table = block.get('_table');
            expect(table).toBeInstanceOf(Map);
            expect(table.get('a')).toBe(1);
            expect(table.get('b')).toBe('x');
        });
    });

    describe('triple-quoted values', () => {
        const block = new CIF(`${CIF2}data_triple
_simple '''simple'''
_multi """line 1
line 2"""
_embedded '''"""embedded"""'''`).getBlock(0);

        test('parses single-line and multi-line triple-quoted strings', () => {
            expect(block.get('_simple')).toBe('simple');
            expect(block.get('_multi')).toBe('line 1\nline 2');
            expect(block.get('_embedded')).toBe('"""embedded"""');
        });
    });

    describe('loops', () => {
        test('parses a simple loop with a standard uncertainty column', () => {
            const block = new CIF(`${CIF2}data_loop
loop_
_id
_val
1 12.5(2)
2 8.0(1)`).getBlock(0);
            block.parse();
            const loop = Object.values(block.data).find(v => v && typeof v.getHeaders === 'function');
            expect(loop.get('_id')).toEqual([1, 2]);
            expect(loop.get('_val')).toEqual([12.5, 8.0]);
            expect(loop.get('_val_su')).toEqual([0.2, 0.1]);
        });

        test('supports list and table cells inside a loop', () => {
            const block = new CIF(`${CIF2}data_loop
loop_
_label
_coords
_meta
a [0.0 0.5 0.5] {'occ':1.0}
b [0.25 0.25 0.25] {'occ':0.5}`).getBlock(0);
            block.parse();
            const loop = Object.values(block.data).find(v => v && typeof v.getHeaders === 'function');
            expect(loop.get('_label')).toEqual(['a', 'b']);
            expect(loop.get('_coords')).toEqual([[0.0, 0.5, 0.5], [0.25, 0.25, 0.25]]);
            const meta = loop.get('_meta');
            expect(meta[0]).toBeInstanceOf(Map);
            expect(meta[0].get('occ')).toBe(1.0);
            expect(meta[1].get('occ')).toBe(0.5);
        });
    });

    describe('block splitting', () => {
        test('splits multiple data blocks', () => {
            const cif = new CIF(`${CIF2}data_one
_a 1

data_two
_a 2`);
            expect(cif.getBlockNames()).toEqual(['one', 'two']);
            expect(cif.getBlock(0).get('_a')).toBe(1);
            expect(cif.getBlockByName('two').get('_a')).toBe(2);
        });

        test('does not split on data_-looking text inside a value', () => {
            const cif = new CIF(`${CIF2}data_one
_note '''
data_not_a_block
'''
_a 1

data_two
_a 2`);
            expect(cif.getBlockNames()).toEqual(['one', 'two']);
            expect(cif.getBlock(0).get('_note')).toContain('data_not_a_block');
        });

        test('does not split on data_-looking text inside a list', () => {
            const tokens = tokenizeCif2(`${CIF2}data_one
_list [ "data_two" ]`);
            expect(splitCif2Blocks(tokens)).toHaveLength(1);
        });
    });

    describe('end-to-end structure parsing', () => {
        const block = new CIF(
            readFileSync('src/lib/read-cif/test-data/cif2_structure.cif', 'utf8'),
        ).getBlock(0);

        test('builds a CrystalStructure from a CIF2 block', () => {
            const structure = CrystalStructure.fromCIF(block);
            expect(structure.atoms.map(a => a.label)).toEqual(['Na1', 'Cl1']);
            expect(structure.atoms.map(a => a.atomType)).toEqual(['Na', 'Cl']);
            expect(structure.symmetry.symmetryOperations).toHaveLength(4);
        });

        test('parses cell parameters with standard uncertainties', () => {
            expect(block.get('_cell_length_a')).toBe(5.6402);
            expect(block.get('_cell_length_a_su')).toBeCloseTo(0.0003);
        });
    });

    describe('save frames are skipped', () => {
        test('a save frame does not break data-block parsing', () => {
            const block = new CIF(`${CIF2}data_x
_before 1
save_frame
_inside 99
save_
_after 2`).getBlock(0);
            expect(block.get('_before')).toBe(1);
            expect(block.get('_after')).toBe(2);
            expect(block.get('_inside', 'missing')).toBe('missing');
        });
    });
});
