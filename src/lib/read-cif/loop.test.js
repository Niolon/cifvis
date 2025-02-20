import { CifBlock, CIF } from './base.js';
import { CifLoop, resolveConflictingLoops } from './loop.js';

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
function createTestLoop(headers) {
    return new CifLoop(['loop_', ...headers, 'dummy 1'], true);
}
