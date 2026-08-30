import {
    mkdtempSync, rmSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCSV } from '../integration-tests/postprocess-cod-symmetry-report.mjs';
import { analyzeDuplicateFile } from '../integration-tests/postprocess-cod-duplicate-labels.mjs';

describe('COD symmetry report CSV parser', () => {
    test('parses quoted multiline fields and escaped quotes', () => {
        const csv = '"category","cod_id","file_path","detail"\r\n'
            + '"bond","123","/cod/123.cif","first line\nsecond, line with ""quote"""\r\n';

        expect(parseCSV(csv)).toEqual([
            ['category', 'cod_id', 'file_path', 'detail'],
            ['bond', '123', '/cod/123.cif', 'first line\nsecond, line with "quote"'],
        ]);
    });

    test('rejects malformed quoted fields', () => {
        expect(() => parseCSV('"a","unclosed')).toThrow('Unclosed quoted CSV field');
        expect(() => parseCSV('"a"unexpected,"b"')).toThrow(
            'Unexpected character after closing quote',
        );
    });
});

describe('COD duplicate-label post-processing', () => {
    test('proves a duplicate is present before the fixer and unchanged by it', () => {
        const directory = mkdtempSync(join(tmpdir(), 'cifvis-duplicate-label-'));
        const path = join(directory, '1234567.cif');
        writeFileSync(path, `data_test
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0.1 0.2 0.3
C1 C 0.4 0.5 0.6
`);

        try {
            const result = analyzeDuplicateFile(path);

            expect(result.classification).toBe('duplicate_present_in_source_cif');
            expect(result.fixer_changed_atom_site_labels).toBe(false);
            expect(result.raw_duplicate_groups).toHaveLength(1);
            expect(result.raw_duplicate_groups[0]).toMatchObject({
                label: 'C1',
                occurrence_count: 2,
                distinct_coordinate_count: 2,
            });
        } finally {
            rmSync(directory, { recursive: true });
        }
    });
});
