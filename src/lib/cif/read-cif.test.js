import { CIF, CifBlock, CifLoop, parseValue, parseMultiLineString, resolveConflictingLoops } from './read-cif.js';

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
 
    test('parses quoted strings', () => {
        expect(parseValue('\'text\'')).toEqual({ value: 'text', su: NaN });
        expect(parseValue('"text"')).toEqual({ value: 'text', su: NaN });
    });

    test('handles unquoted strings with a number in a bracket', () => {
        expect(parseValue('H1')).toEqual({ value: 'H1', su: NaN });
        expect(parseValue('H(1)')).toEqual({ value: 'H(1)', su: NaN });
        expect(parseValue('H1(3)')).toEqual({ value: 'H1(3)', su: NaN});
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
    });
});

describe('resolveConflictingLoops', () => {
    // Helper function to create test loops
    function createTestLoop(headers) {
        const loop = new CifLoop([
            'loop_',
            ...headers,
            'dummy_data 1',
        ], true);
        return loop;
    }

    test('resolves conflict between standard and extended loops', () => {
        const standardLoop = createTestLoop([
            '_atom_site_label',
            '_atom_site_type_symbol',
        ]);
        const extendedLoop = createTestLoop([
            '_atom_site_oxford_label',
            '_atom_site_oxford_type',
        ]);

        const [resolved1, resolved2] = resolveConflictingLoops(standardLoop, extendedLoop);
        
        expect(resolved1.getName()).toBe('_atom_site');
        expect(resolved2.getName()).toBe('_atom_site_oxford');
    });

    test('handles reversed order of standard and extended loops', () => {
        const extendedLoop = createTestLoop([
            '_atom_site_oxford_label',
            '_atom_site_oxford_type',
        ]);
        const standardLoop = createTestLoop([
            '_atom_site_label',
            '_atom_site_type_symbol',
        ]);

        const [resolved1, resolved2] = resolveConflictingLoops(extendedLoop, standardLoop);
        
        expect(resolved1.getName()).toBe('_atom_site_oxford');
        expect(resolved2.getName()).toBe('_atom_site');
    });

    test('resolves conflict between differently prefixed loops', () => {
        const loop1 = createTestLoop([
            '_custom_data_value',
            '_custom_data_error',
        ]);
        const loop2 = createTestLoop([
            '_custom_data_special_value',
            '_custom_data_special_error',
        ]);

        const [resolved1, resolved2] = resolveConflictingLoops(loop1, loop2);
        
        expect(resolved1.getName()).toBe('_custom_data');
        expect(resolved2.getName()).toBe('_custom_data_special');
    });

    test('throws error when loops have same prefix length', () => {
        const loop1 = createTestLoop([
            '_measurement_temp',
            '_measurement_pressure',
        ]);
        const loop2 = createTestLoop([
            '_measurement_data',
            '_measurement_error',
        ]);

        expect(() => resolveConflictingLoops(loop1, loop2))
            .toThrow('Non-resolvable conflict, where _measurement seems to be the root name of multiple loops');
    });

    test('preserves original data after name resolution', () => {
        const standardLoop = createTestLoop([
            '_atom_site_label',
            '_atom_site_type_symbol',
        ]);
        const extendedLoop = createTestLoop([
            '_atom_site_oxford_label',
            '_atom_site_oxford_type',
        ]);

        const originalHeaders1 = standardLoop.getHeaders();
        const originalHeaders2 = extendedLoop.getHeaders();

        const [resolved1, resolved2] = resolveConflictingLoops(standardLoop, extendedLoop);
        
        expect(resolved1.getHeaders()).toEqual(originalHeaders1);
        expect(resolved2.getHeaders()).toEqual(originalHeaders2);
    });

    test('handles single column loops', () => {
        const loop1 = createTestLoop(['_data_special']);
        const loop2 = createTestLoop(['_data_special_value']);

        const [resolved1, resolved2] = resolveConflictingLoops(loop1, loop2);
        
        expect(resolved1.getName()).toBe('_data_special');
        expect(resolved2.getName()).toBe('_data_special_value');
    });
});

describe('Loop Tests', () => {
    describe('Basic Parsing', () => {
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
2 # second value
3#
`);
            const loop = block.get('_value');
            expect(loop.get('_value')).toEqual([1, 2, '3#']);
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

        test('empty loop throws error', () => {
            const block = new CifBlock(`blockname
loop_
_some_header
_some_additional_header`);
            expect(() => block.get('_some').get('_some_header')).toThrow('Loop _some has no data values.');
        });

        test('parse more complicated value distribution', () => {
            const block = new CifBlock(`test
loop_
_geom_hbond_atom_site_label_D
_geom_hbond_atom_site_label_H
_geom_hbond_atom_site_label_A
_geom_hbond_site_symmetry_D
_geom_hbond_site_symmetry_H
_geom_hbond_distance_DH
_geom_hbond_distance_HA
_geom_hbond_distance_DA
_geom_hbond_angle_DHA
_geom_hbond_publ_flag
N2 H2 O2 '1 655' '1 655' .92 2.126(3) 3.044(5) 175.61 yes
O2 H O1 '1 655' '1 655' .892 2.053(5) 2.733(5) 132.14 yes
`);
            const hBond = block.get('_geom_hbond');
            expect(hBond.get('_geom_hbond_atom_site_label_D')).toEqual(['N2', 'O2']);
            expect(hBond.get('_geom_hbond_site_symmetry_D')).toEqual(['1 655', '1 655']);
            expect(hBond.get('_geom_hbond_distance_HA')).toEqual([2.126, 2.053]);
            expect(hBond.get('_geom_hbond_distance_HA_su')).toEqual([0.003, 0.005]);
            expect(hBond.get('_geom_hbond_angle_DHA')).toEqual([175.61, 132.14]);
            expect(hBond.get('_geom_hbond_publ_flag')).toEqual(['yes', 'yes']);
        });
    });

    // Data Types and Special Values
    describe('Data Types and Special Values', () => {
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

        test('handles embedded quotes in loop values', () => {
            const cifText = `test
loop_
_atom_label
_atom_note
C1' 'a dog's life'
N7' "isn't this fun"`;

            const block = new CifBlock(cifText);
            const loop = block.get('_atom');
            // eslint-disable-next-line quotes
            expect(loop.get('_atom_label')).toEqual(["C1'", "N7'"]);
            // eslint-disable-next-line quotes
            expect(loop.get('_atom_note')).toEqual(["a dog's life", "isn't this fun"]);
        });

        test('handles mixed quoted and unquoted values', () => {
            const cifText = `test
loop_
_some_id
_some_label
_some_note
1 C1' simple
2 O1 'quoted value'
3 N1' "double quoted"`;

            const block = new CifBlock(cifText);
            const loop = block.get('_some');
            expect(loop.get('_some_id')).toEqual([1, 2, 3]);
            expect(loop.get('_some_label')).toEqual(['C1\'', 'O1', 'N1\'']);
            expect(loop.get('_some_note')).toEqual(['simple', 'quoted value', 'double quoted']);
        });

        test('preserves whitespace in quoted strings', () => {
            const cifText = `test
loop_
_some_id
_some_note
1 'spaced    out'
2 "  leading space"
3 'trailing space  '`;

            const block = new CifBlock(cifText);
            const loop = block.get('_some');
            expect(loop.get('_some_note')).toEqual([
                'spaced    out',
                '  leading space',
                'trailing space  ',
            ]);
        });

        test('handles empty quoted strings', () => {
            const cifText = `test
loop_
_some_id
_some_note
1 ''
2 ""
3 'value'`;

            const block = new CifBlock(cifText);
            const loop = block.get('_some');
            expect(loop.get('_some_note')).toEqual(['', '', 'value']);
        });
    });

    // Loop Name Resolution
    describe('Loop Name Resolution', () => {
        test('finds standard loop names', () => {
            const loop = createTestLoop([
                '_atom_site_example_label',
                '_atom_site_example_type',
                '_atom_site_example_pos',
                '_atom_other_property',
            ]);
            expect(loop.findCommonStart()).toBe('_atom_site');
            expect(loop.findCommonStart(false)).toBe('_atom_site_example');
        });

        test('finds dot notation prefix', () => {
            const loop = createTestLoop([
                '_atom_site.label',
                '_atom_site.type',
                '_atom_site_special',
            ]);
            expect(loop.findCommonStart(false)).toBe('_atom_site');
        });

        test('finds underscore segments when no dot prefix matches', () => {
            const loop = createTestLoop([
                '_measure.temp',
                '_measure_time',
                '_measure_special.reading',
            ]);
            expect(loop.findCommonStart(false)).toBe('_measure');
        });

        test('requires majority match for prefixes', () => {
            const loop = createTestLoop([
                '_site_atom_x',
                '_site_cartn_atom_y', 
                '_different_x',
                '_another_y'
            ]);
            expect(loop.findCommonStart(false)).toBe('_site');
        });

        test('handles single header', () => {
            const loop = createTestLoop(['_single_value']);
            expect(loop.findCommonStart(false)).toBe('_single_value');
        });

        test('prioritizes correct symmetry loop name', () => {
            const symmetryData = `test
loop_
_space_group_symop_site_id
_space_group_symop_operation_xyz
1 x,y,z
2 -x,-y,z`;
        
            const block = new CifBlock(symmetryData);
            expect(block.get('_space_group_symop').getName()).toBe('_space_group_symop');

            const mixedSymmetryData = `test
loop_
_space_group_symop_site_id
_symmetry_equiv_pos_as_xyz
1 x,y,z
2 -x,-y,z`;
        
            const block2 = new CifBlock(mixedSymmetryData);
            expect(block2.get('_space_group_symop').getName()).toBe('_space_group_symop');
        });

        test('handles atom_site_aniso case correctly', () => {
            const atomSiteAnisoData = `data_test
loop_
_atom_site_aniso_label
_atom_site_aniso_U_11
_atom_site_aniso_U_22
C1 0.01 0.02
O1 0.02 0.03`;
        
            const cif = new CIF(atomSiteAnisoData);
            const block = cif.getBlock();
            expect(block.get('_atom_site_aniso').getName())
                .toBe('_atom_site_aniso');
        });
    });

    // Data Access
    describe('Data Access', () => {
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

    // Error Handling
    describe('Error/ Special case Handling', () => {
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

        test('parses loop with splitSU=false', () => {
            // [Existing splitSU test]
        });
    });
});

function createTestLoop(headers) {
    return new CifLoop(['loop_', ...headers, 'dummy 1'], true);
}