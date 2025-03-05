import { CifBlock, CIF } from './base.js';
import {
    CifLoop, resolveLoopNamingConflict, isLoop, resolveNonLoopConflict,
    resolveByTokenLength, resolveByCommonStart,
} from './loop.js';

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
                '_another_y',
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
            const block = new CifBlock(`test
loop_
_cell_length_a
_cell_angle_alpha
5.4309(5) 90.000(12)
5.4310(8) 90.000(15)`,
            false);

            const loop = block.get('_cell');
            expect(loop.get('_cell_length_a')).toEqual(['5.4309(5)', '5.4310(8)']);
            expect(loop.get('_cell_angle_alpha')).toEqual(['90.000(12)', '90.000(15)']);
        });
    });
});

/**
 *
 * @param headers
 */
function createTestLoop(headers) {
    return CifLoop.fromLines(['loop_', ...headers, 'dummy 1'], true);
}

describe('Loop Conflict Resolution', () => {
    // Helper function to create test loops
    /**
     *
     * @param headers
     */
    function createTestLoop(headers) {
        return CifLoop.fromLines([
            'loop_',
            ...headers,
            // Create dummy data entries for each header
            ...headers.map(() => 'dummy_data'),
        ], true);
    }

    // Valid non-loop entries are only primitives: numbers or strings
    const validNonLoopValues = [
        5,              // integer
        -10,           // negative integer
        3.14,          // float
        -2.718,        // negative float
        'test',        // string
        '123.456(7)',  // string with uncertainty
    ];

    describe('isLoop', () => {
        test('identifies valid loops', () => {
            const loop = createTestLoop(['_test_header']);
            expect(() => loop.get('_test_header')).not.toThrow();
            expect(isLoop(loop)).toBe(true);
        });

        test('identifies non-loop entries', () => {
            validNonLoopValues.forEach(value => {
                expect(isLoop(value)).toBe(false);
            });
        });
    });

    describe('resolveNonLoopConflict', () => {
        test('suggests names for loop vs number value conflict', () => {
            const loop = createTestLoop(['_test_value_data', '_test_value_number']);
            const value = 5.432;
            
            const newNames = resolveNonLoopConflict(loop, value, '_test_value');
            expect(newNames[0]).toBe('_test_value_data');
            expect(newNames[1]).toBe('_test_value');

            const newNamesRev = resolveNonLoopConflict(value, loop, '_test_value');
            expect(newNamesRev[0]).toBe('_test_value');
            expect(newNamesRev[1]).toBe('_test_value_data');
        });
    });

    describe('resolveByCommonStart', () => {
        test('suggests names for different length prefixes', () => {
            const loop1 = createTestLoop(['_atom_site_label', '_atom_site_fract_x']);
            const loop2 = createTestLoop(['_atom_site_custom_loop1', '_atom_site_custom_loop2']);
            
            const newNames = resolveByCommonStart(loop1, loop2);
            expect(newNames[0]).toBe('_atom_site');
            expect(newNames[1]).toBe('_atom_site_custom');
        });
    });

    describe('resolveByTokenLength', () => {
        test('suggests names based on token length', () => {
            const loop1 = createTestLoop(['_data_value']);
            const loop2 = createTestLoop(['_data_special_value']);
            
            const newNames = resolveByTokenLength(loop1, loop2, '_data');
            expect(newNames[0]).toBe('_data');
            expect(newNames[1]).toBe('_data_special');
        });
    });

    describe('resolveLoopNamingConflict integration', () => {
        test('updates loop names and returns result', () => {
            const loop1 = createTestLoop(['_atom_site_label']);
            const loop2 = createTestLoop(['_atom_site_aniso_label']);

            const result = resolveLoopNamingConflict(loop1, loop2, '_atom_site');
            
            // Check loop names were updated
            expect(loop1.name).toBe(result.newNames[0]);
            expect(loop2.name).toBe(result.newNames[1]);
            
            // Check entries array matches
            expect(result.newEntries).toEqual([loop1, loop2]);
        });

        test('handles non-loop entry correctly', () => {
            const loop = createTestLoop(['_test_data']);
            const value = 5.432;

            const result = resolveLoopNamingConflict(loop, value, '_test');
                        
            expect(loop.name).toBe(result.newNames[0]);
            
            // Check value wasn't modified
            expect(result.newEntries[0]).toBe(loop);
            expect(result.newEntries[1]).toBe(value);
        });

        test('preserves data after name updates', () => {
            const loop1 = createTestLoop(['_measurement_temp']);
            const loop2 = createTestLoop(['_measurement_data']);

            const originalData1 = loop1.get('_measurement_temp');
            const originalData2 = loop2.get('_measurement_data');

            const _result = resolveLoopNamingConflict(loop1, loop2, '_measurement');
            
            // Check that data access still works after name update
            expect(() => loop1.get('_measurement_temp')).not.toThrow();
            expect(() => loop2.get('_measurement_data')).not.toThrow();
            expect(loop1.get('_measurement_temp')).toEqual(originalData1);
            expect(loop2.get('_measurement_data')).toEqual(originalData2);
        });
    });
});