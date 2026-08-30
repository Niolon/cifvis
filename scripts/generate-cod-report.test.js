import {
    buildReport, conciseMaintainerDetail, formatMaintainerJSON,
} from '../integration-tests/generate-cod-report.mjs';

describe('COD maintainer issue export', () => {
    it('removes validator context but keeps the offending atom labels', () => {
        const detail = `There were errors in the bond or H-bond creation
Unknown atom label(s). Known labels are C1, C2, H2, O1
Non-existent atoms in bond: C2 - H9, non-existent atom(s): H9`;

        const concise = conciseMaintainerDetail(detail);

        expect(concise).not.toContain('Known labels');
        expect(concise).toContain('C2 - H9');
        expect(concise).toContain('H9');
    });

    it('groups findings by COD id and collapses matching pre/post-fix entries', () => {
        const detail = 'Duplicate atom site labels: C1';
        const entries = [
            {
                kind: 'Structure Error', filePath: '/cod/1/23/45/1234567.cif',
                detail, persistsAfterFix: false,
            },
            {
                kind: 'Structure Error', filePath: '/cod/1/23/45/1234567.cif',
                detail, persistsAfterFix: true,
            },
            {
                kind: 'Structure Error', filePath: '/cod/2/34/56/2345678.cif',
                detail: 'Unit cell parameter entries missing in CIF: _cell_length_c',
                persistsAfterFix: true,
            },
            {
                kind: 'Structure Error', filePath: '/cod/3/45/67/3456789.cif',
                detail: 'Structure has only placeholder coordinates',
                persistsAfterFix: true,
            },
        ];

        const output = JSON.parse(formatMaintainerJSON(buildReport(entries), 531487));

        expect(output.schema_version).toBe(1);
        expect(output.source.files_processed).toBe(531487);
        expect(output.summary.structure_count).toBe(3);
        expect(output.summary.issue_count).toBe(3);
        expect(output.summary.by_issue_code.placeholder_atom_coordinates).toBe(1);
        expect(output.structures[0]).toEqual({
            cod_id: '1234567',
            issues: [{
                code: 'duplicate_atom_site_label',
                message: detail,
                persists_after_auto_fix: true,
            }],
        });
    });
});
