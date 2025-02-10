import { CIF, CifBlock, parseValue, parseMultiLineString } from './read-cif.js';

describe('Parse Value Tests', () => {
    test('parses decimal with SU', () => {
        expect(parseValue('123.456(7)', true)).toEqual({ value: 123.456, su: 0.007 });
        expect(parseValue('-123.456(7)', true)).toEqual({ value: -123.456, su: 0.007 });
    });
 
    test('parses integer with SU', () => {
        expect(parseValue('123(7)', true)).toEqual({ value: 123, su: 7 });
        expect(parseValue('-123(7)', true)).toEqual({ value: -123, su: 7 });
    });
 
    test('parses regular numbers', () => {
        expect(parseValue('123.456')).toEqual({ value: 123.456, su: NaN });
        expect(parseValue('123')).toEqual({ value: 123, su: NaN });
    });
 
    test('parses quoted strings', () => {
        expect(parseValue('\'text\'')).toEqual({ value: 'text', su: NaN });
        expect(parseValue('"text"')).toEqual({ value: 'text', su: NaN });
    });
 
    test('respects splitSU flag', () => {
        expect(parseValue('123.456(7)', false)).toEqual({ value: '123.456(7)', su: NaN });
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
data_test2
note
data_test3
more text
;
data_test2
_other value`);
            expect(cif.blocks).toEqual([null, null]);
            const blocks = cif.getAllBlocks();
            expect(blocks).toHaveLength(2);
            expect(blocks[0].get('_note').get('_note')).toEqual(['first\ndata_test2\nnote\ndata_test3\nmore text']);
            expect(blocks[1].get('_other')).toBe('value');
            expect(cif.blocks).not.toEqual([null, null]);

            // second access is the already evaluated block
            const blocks2 = cif.getAllBlocks();
            expect(blocks2).toHaveLength(2);
            expect(blocks2[0].get('_note').get('_note')).toEqual(['first\ndata_test2\nnote\ndata_test3\nmore text']);
            expect(blocks2[1].get('_other')).toBe('value');
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
            expect(() => block.get('_valid_entry')).toThrow('Could not parse line 2: Something is wrong here');
        });
    });
});

describe('Loop Tests', () => {
    test('parses basic loop', () => {
        const block = new CifBlock(`test
loop_
_atom_site_label
_atom_site_type
C1 C
O1 O`);
   
        const loop = block.get('_atom_site');
        expect(loop.getHeaders()).toEqual(['_atom_site_label', '_atom_site_type']);
        expect(loop.get('_atom_site_label')).toEqual(['C1', 'O1']);
        expect(loop.get('_atom_site_type')).toEqual(['C', 'O']);
        expect(loop.getHeaders()).toEqual(['_atom_site_label', '_atom_site_type']);

    });

    test('parses multiline strings in loops', () => {
        const block = new CifBlock(`test
loop_
_atom_note
;
first
note
;
;
second
note
;`);
   
        const loop = block.get('_atom_note');
        expect(loop.get('_atom_note')).toEqual(['first\nnote', 'second\nnote']);
    });

    test('handles standard uncertainties in loop', () => {
        const block = new CifBlock(`test
loop_
_cell_length_a
_cell_angle_alpha
5.4309(5) 90.000(12)
5.4310(8) 90.000(15)`);
   
        const loop = block.get('_cell');
        expect(loop.get('_cell_length_a')).toEqual([5.4309, 5.4310]);
        expect(loop.get('_cell_length_a_su')).toEqual([0.0005, 0.0008]);
        expect(loop.get('_cell_angle_alpha')).toEqual([90.000, 90.000]);
        expect(loop.get('_cell_angle_alpha_su')).toEqual([0.012, 0.015]);
    });

    test('handles mixed quoted and unquoted values', () => {
        const block = new CifBlock(`test
loop_
_test_name
_test_type
'Complex 1' C
"Complex 2" 'C H'`);
   
        const loop = block.get('_test');
        expect(loop.get('_test_name')).toEqual(['Complex 1', 'Complex 2']);
        expect(loop.get('_test_type')).toEqual(['C', 'C H']);
    });

    test('handles empty and whitespace lines', () => {
        const block = new CifBlock(`test
loop_
_value

1

2
 
3`);
   
        const loop = block.get('_value');
        expect(loop.get('_value')).toEqual([1, 2, 3]);
    });

    test('handles comments in loop data', () => {
        const block = new CifBlock(`test
loop_
_value # column header
1 # first value
2 # second value`);
   
        const loop = block.get('_value');
        expect(loop.get('_value')).toEqual([1, 2]);
    });

    test('handles loop ending at next loop', () => {
        const block = new CifBlock(`test
loop_
_first
1
2
loop_
_second
somevalue
`);
   
        const loop = block.get('_first');
        expect(loop.get('_first')).toEqual([1, 2]);
        const loop2 = block.get('_second');
        expect(loop2.get('_second')).toEqual(['somevalue']);
    });

    test('finds common prefix correctly', () => {
        const block = new CifBlock(`test
loop_
_site.label
_site.type
_site.symmetry
data 1 2`);
   
        const loop = block.get('_site');
        expect(loop.getName()).toBe('_site');
   
    });
    test('parses loop with splitSU=false', () => {
        const block = new CifBlock(`test
loop_
_length
123.456(7)`, false);
        const loop = block.get('_length');
        expect(loop.get('_length')).toEqual(['123.456(7)']);
    });

    test('throw error with non-matching number of entries', () => {
        const block = new CifBlock(`some_test
loop_
_key_first
_key_second
oneentry`);
        expect(
            () => block.get('_key').get('_key_first'),
        ).toThrow('Loop _key: Cannot distribute 1 values evenly into 2 columns');
    });
    test('empty loop throws error', () => {
        const block = new CifBlock(`blockname
loop_
_some_header
_some_additional_header`);
        expect(() => block.get('_some').get('_some_header')).toThrow('Loop _some has no data values.');
    });
    test('get handles multiple key options', () => {
        const block = new CifBlock(`test
loop_
_atom_site_label
_atom_site_type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(loop.get(['_atom_site.label', '_atom_site_label'])).toEqual(['C1']);
    });

    test('get returns default value when keys not found', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(loop.get('_nonexistent', 'default')).toBe('default');
    });

    test('get throws error when keys not found and no default', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(() => loop.get('_nonexistent')).toThrow('None of the keys');
    });

    test('getIndex retrieves specific value', () => {
        const block = new CifBlock(`test
loop_
_atom_site_label
_atom_site_type
C1 C
O1 O`);
  
        const loop = block.get('_atom_site');
        expect(loop.getIndex('_atom_site_label', 1)).toBe('O1');
    });

    test('getIndex handles multiple key options', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(loop.getIndex(['_atom_site.label', '_atom_site_label'], 0)).toBe('C1');
    });

    test('getIndex returns default for non-existent keys', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(loop.getIndex('_nonexistent', 0, 'default')).toBe('default');
    });

    test('getIndex throws for out of bounds index', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(() => loop.getIndex('_atom_site.label', 1)).toThrow('Tried to look up value of index 1');
    });

    test('getIndex throws for non-existent keys without default', () => {
        const block = new CifBlock(`test
loop_
_atom_site.label
_atom_site.type
C1 C`);
  
        const loop = block.get('_atom_site');
        expect(() => loop.getIndex('_nonexistent', 0)).toThrow('None of the keys');
    });
});
