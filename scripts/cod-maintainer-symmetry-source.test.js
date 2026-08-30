import { CIF } from '../src/lib/read-cif/base.js';
import { assessSymmetryDeclaration } from '../integration-tests/consolidate-cod-maintainer-report.mjs';

/**
 * Parses a minimal CIF fragment and assesses its symmetry provenance.
 * @param {string} cifText - CIF data items after the data-block header
 * @returns {object} Symmetry declaration assessment
 */
function assess(cifText) {
    return assessSymmetryDeclaration(new CIF(`data_test\n${cifText}`).getBlock(0));
}

describe('COD report symmetry provenance', () => {
    test('recognizes explicitly enumerated operations', () => {
        const result = assess(`
loop_
_space_group_symop_id
_space_group_symop_operation_xyz
1 x,y,z
`);

        expect(result.status).toBe('explicit_operations');
    });

    test('accepts a Hall symbol as an unambiguous reconstructed setting', () => {
        const result = assess(`
_space_group_IT_number 14
_space_group_name_Hall '-P 2ac'
`);

        expect(result.status).toBe('reconstructed_unambiguous_setting');
        expect(result.entry.universal_h_m).toBe('P 1 1 21/a');
    });

    test('accepts an unambiguous full H-M setting', () => {
        const result = assess(`
_space_group_IT_number 14
_space_group_name_H-M_full 'P 1 21/c 1'
`);

        expect(result.status).toBe('reconstructed_unambiguous_setting');
        expect(result.entry.universal_h_m).toBe('P 1 21/c 1');
    });

    test('keeps number-only and origin-ambiguous declarations conservative', () => {
        expect(assess('_space_group_IT_number 14').status)
            .toBe('reconstructed_ambiguous_setting');
        expect(assess('_space_group_name_H-M_full \'P n n n\'').status)
            .toBe('reconstructed_ambiguous_setting');
    });
});
