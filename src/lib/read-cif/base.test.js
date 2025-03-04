import { expect, test } from 'vitest';
import { CIF, CifBlock } from './base.js';

describe('CIF Parser', () => {
    describe('CIF class', () => {
        test('parses multiple data blocks', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
      
            const blocks = cif.getAllBlocks();
            expect(blocks).toHaveLength(2);
            expect(blocks[0].dataBlockName).toBe('block1');
            expect(blocks[1].dataBlockName).toBe('block2');
        });

        test('handles empty input', () => {
            const cif = new CIF('');
            const blocks = cif.getAllBlocks();
            expect(blocks).toEqual([]);
        });

        test('gets single block by index by lazy evaluation', () => {
            const cif = new CIF(`
data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 5.4312(3)`);

            expect(cif.blocks).toEqual([null, null]);
            // zero is default access
            const block = cif.getBlock();
            expect(block.dataBlockName).toBe('block1');
            expect(block.get('_cell_length_a')).toBe(5.4309);
            expect(cif.blocks[0]).not.toBeNull();
            expect(cif.blocks[1]).toBeNull();

            // second access is the already evaluated block
            const block2 = cif.getBlock(0);
            expect(block2.dataBlockName).toBe('block1');
            expect(block2.get('_cell_length_a')).toBe(5.4309);
        });

        test('handles data_ entry in multiline string and test lazy evaluation', () => {
            const cif = new CIF(`data_test1
loop_
_note
;
first
data_test4
note
data_test5
more text
;
data_test2
_other value
_second_multiline
;Direct
continuation after 
;
_third_multiline
;
data_new
_some_nonsense test
;
_fourth_multiline
;;
Some test
;
`);
            expect(cif.blocks).toEqual([null, null]);
            const blocks = cif.getAllBlocks();
            expect(blocks).toHaveLength(2);
            expect(blocks[0].get('_note').get('_note')).toEqual(['first\ndata_test4\nnote\ndata_test5\nmore text']);
            expect(blocks[1].get('_other')).toBe('value');
            expect(cif.blocks).not.toEqual([null, null]);

            // second access is the already evaluated block
            const blocks2 = cif.getAllBlocks();
            expect(blocks2).toHaveLength(2);
            expect(blocks2[0].get('_note').get('_note')).toEqual(['first\ndata_test4\nnote\ndata_test5\nmore text']);
            expect(blocks2[1].get('_other')).toBe('value');
            expect(blocks2[1].get('_second_multiline')).toBe('Direct\ncontinuation after ');
            expect(blocks2[1].get('_third_multiline')).toBe('data_new\n_some_nonsense test');
            expect(blocks2[1].get('_fourth_multiline')).toBe(';\nSome test');

        });

        test('gets block names correctly', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
            
            const blockNames = cif.getBlockNames();
            expect(blockNames).toEqual(['block1', 'block2']);
        });
        
        test('gets block by name without data_ prefix', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
            
            const block1 = cif.getBlockByName('block1');
            expect(block1.dataBlockName).toBe('block1');
            expect(block1.get('_cell_length_a')).toBe(5.4309);
            
            const block2 = cif.getBlockByName('block2');
            expect(block2.dataBlockName).toBe('block2');
            expect(block2.get('_cell_length_a')).toBe(3.2468);
        });
        
        test('gets block by name with data_ prefix', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
            
            const block = cif.getBlockByName('block1');
            expect(block.dataBlockName).toBe('block1');
            expect(block.get('_cell_length_a')).toBe(5.4309);
        });
        
        test('throws error for non-existent block name', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)`);
            
            expect(() => cif.getBlockByName('nonexistent')).toThrow(
                "Block with name 'nonexistent' not found. Available blocks: block1"
            );
        });
        
        test('handles complex block names with dots and hyphens', () => {
            const cif = new CIF(`data_complex-name.123
_cell_length_a 5.4309(5)

data_complex.name-456
_cell_length_a 3.2468(3)`);
            
            const blockNames = cif.getBlockNames();
            expect(blockNames).toContain('complex-name.123');
            expect(blockNames).toContain('complex.name-456');
            
            const block1 = cif.getBlockByName('complex-name.123');
            expect(block1.dataBlockName).toBe('complex-name.123');
            expect(block1.get('_cell_length_a')).toBe(5.4309);
        });
        
        test('extracts block names lazily', () => {
            const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
            
            // Add a spy to detect if the method is called
            const spy = vi.spyOn(cif, '_extractBlockNames');
            
            // First access should call _extractBlockNames
            const names = cif.getBlockNames();
            expect(spy).toHaveBeenCalledTimes(1);
            expect(names).toEqual(['block1', 'block2']);
            
            // Second access should use cached result
            const names2 = cif.getBlockNames();
            expect(spy).toHaveBeenCalledTimes(2); // Still only called once
            expect(names2).toEqual(['block1', 'block2']);
            
            // getBlockByName should use the same cache
            cif.getBlockByName('block1');
            expect(spy).toHaveBeenCalledTimes(3); // Still only called once
            
            spy.mockRestore();
        });
    });

    describe('CifBlock class', () => {
        test('parses standard uncertainty values', () => {
            const block = new CifBlock(`test
_cell_length_a 123.456(7)
_cell_length_b -123.456(7)
_cell_length_c 123(7)`);
      
            expect(block.get('_cell_length_a')).toBe(123.456);
            expect(block.get('_cell_length_a_su')).toBe(0.007);
            expect(block.get('_cell_length_b')).toBe(-123.456);
            expect(block.get('_cell_length_b_su')).toBe(0.007);
            expect(block.get('_cell_length_c')).toBe(123);
            expect(block.get('_cell_length_c_su')).toBe(7);
        });

        test('parses quoted strings', () => {
            const block = new CifBlock(`test
_string1 "Hello"
_string2 'World'`);
      
            expect(block.get('_string1')).toBe('Hello');
            expect(block.get('_string2')).toBe('World');
        });

        test('handles comments', () => {
            const block = new CifBlock(`data_test
_cell_length_a 5.4309(5) # inline comment
# full line comment
_cell_length_b 5.4309(5)`);
      
            expect(block.get('_cell_length_a')).toBe(5.4309);
            expect(block.get('_cell_length_b')).toBe(5.4309);
        });

        test('preserves # in quoted strings', () => {
            const block = new CifBlock(`data_test
_note1 "text with # inside" # comment`);
      
            expect(block.get('_note1')).toBe('text with # inside');
        });

        test('handles values on next line', () => {
            const block = new CifBlock(`data_test
_diffrn_measurement_device   
 'XtaLAB Synergy-S'
_diffrn_measurement_method   
 'phi and omega scans'
_chemical_formula_sum
 'C10 H16 N2 O4'
_cell_length_a
 12.345(6)`);
      
            expect(block.get('_diffrn_measurement_device')).toBe('XtaLAB Synergy-S');
            expect(block.get('_diffrn_measurement_method')).toBe('phi and omega scans');
            expect(block.get('_chemical_formula_sum')).toBe('C10 H16 N2 O4');
            expect(block.get('_cell_length_a')).toBe(12.345);
            expect(block.get('_cell_length_a_su')).toBe(0.006);
        });

        test('handles multiline block entry', () => {
            const block = new CifBlock(`test
_some_multiline_entry
;
normal formatting
entry
;
_another_multiline_entry
;more sloppy
entry
;`);
            expect(block.get('_some_multiline_entry')).toBe('normal formatting\nentry');
            expect(block.get('_another_multiline_entry')).toBe('more sloppy\nentry');
        });

        test('handles both multiline string formats', () => {
            const block = new CifBlock(`test
_proper_multiline
;
line1
line2
;
_compact_multiline
;text content
more content
;
_chemical_formula_sum
;Al1.15 Ba0.04 Cr0.01 Fe0.25 H2 K0.89 Mg1.57 Mn0.4 Na0.1 O12 Si2.92 Ti0.07
    Zn0.54
;
_exptl_absorpt_process_details
; Higashi, T. (1995). Program for 
 Absorption Correction.
 Rigaku Corporation, Tokyo, Japan.
;`);
        
            expect(block.get('_proper_multiline')).toBe('line1\nline2');
            expect(block.get('_compact_multiline')).toBe('text content\nmore content');
            expect(block.get('_chemical_formula_sum')).toBe(
                'Al1.15 Ba0.04 Cr0.01 Fe0.25 H2 K0.89 Mg1.57 Mn0.4 Na0.1 O12 Si2.92 Ti0.07\n    Zn0.54',
            );
            expect(block.get('_exptl_absorpt_process_details')).toBe(
                ' Higashi, T. (1995). Program for \n Absorption Correction.\n Rigaku Corporation, Tokyo, Japan.',
            );

        });

        test('handles a " ;" as content of a multiline string', () => {
            const block = new CifBlock(`test
_chemical_formula_weight         123.45
_chemical_name_systematic
;
 ;
;
_space_group_IT_number           23
`);
            expect(block.get('_chemical_formula_weight')).toBe(123.45);
            expect(block.get('_chemical_name_systematic')).toBe(' ;');
            expect(block.get('_space_group_IT_number')).toBe(23);
        });

        test('handles embedded quotes according to spec', () => {
            const block = new CifBlock(`test
_text1 'a dog's life'
_text2 'a dog's'
_text3 'a dog's  tail'
_text4 "don't stop"
_text5 "don't"
_text6 a'quoted'text
_text7 O'Brian's`);
            
            // eslint-disable-next-line quotes
            expect(block.get('_text1')).toBe("a dog's life");
            // eslint-disable-next-line quotes
            expect(block.get('_text2')).toBe("a dog's");
            // eslint-disable-next-line quotes
            expect(block.get('_text3')).toBe("a dog's  tail");  // Should stop at space after quote
            // eslint-disable-next-line quotes
            expect(block.get('_text4')).toBe("don't stop");    // Should stop at space after quote
            // eslint-disable-next-line quotes
            expect(block.get('_text5')).toBe("don't");
            // eslint-disable-next-line quotes
            expect(block.get('_text6')).toBe("a'quoted'text");
            // eslint-disable-next-line quotes
            expect(block.get('_text7')).toBe("O'Brian's");
        });

        test('parses block with splitSU=false', () => {
            const cif = new CIF(`data_test
_cell_length_a 123.456(7)`, false);
            const block = cif.getBlock(0);
            expect(block.get('_cell_length_a')).toBe('123.456(7)');
        });

        test('throw error with invalid line', () => {
            const block = new CifBlock(`blockname
_valid_entry 123

Something is wrong here
`);
            expect(() => block.get('_valid_entry')).toThrow('Could not parse line 3: Something is wrong here');
        });

        test('correct use of the defaultValue parameter', () => {
            const block = new CifBlock(`blockname
_valid_key 123
`);
            expect(block.get('_valid_key', 456)).toBe(123);
            expect(block.get(['_invalid_key', '_valid_key'], 456)).toBe(123);
            expect(block.get('_invalid_key', 456)).toBe(456);
            expect(() => block.get('_invalid_key')).toThrow('None of the keys [_invalid_key] found in CIF block');
        });
    });
});

