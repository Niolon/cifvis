#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CIF } from '../src/index.nobrowser.js';
import {
    lookupSpaceGroup, lookupSpaceGroupCandidates,
} from '../src/lib/structure/space-group-lookup.js';
import { parseCSV } from './postprocess-cod-symmetry-report.mjs';

const MANUAL_REVIEW_CODES = new Map([
    ['structure_error', 'Unclassified cifvis failure; not established as a COD data error.'],
    ['no_valid_atoms', 'May be a non-structural or unsupported entry; requires manual review.'],
    ['unrecognised_element_label', 'May be an intentional generic site label; requires manual review.'],
    ['bond_geometry_unclassified', 'The original geometry finding was not reproduced.'],
]);

function readCSV(path) {
    const records = parseCSV(readFileSync(path, 'utf8'));
    const header = records.shift();
    if (!header) {
        throw new Error(`Empty CSV: ${path}`);
    }
    const malformed = records.findIndex(row => row.length !== header.length);
    if (malformed !== -1) {
        throw new Error(`CSV record ${malformed + 2} in ${path} has the wrong field count`);
    }
    return records.map(row => Object.fromEntries(header.map((name, index) => [name, row[index]])));
}

function escapeCSV(value) {
    const singleLine = String(value ?? '').replace(/\r?\n/g, ' ');
    return `"${singleLine.replace(/"/g, '""')}"`;
}

function hasExplicitSymmetryOperations(block) {
    const direct = block.get([
        '_space_group_symop.operation_xyz',
        '_space_group_symop_operation_xyz',
        '_symmetry_equiv.pos_as_xyz',
        '_symmetry_equiv_pos_as_xyz',
    ], false);
    if (direct && typeof direct === 'string') {
        return true;
    }
    for (const loopName of ['_space_group_symop', '_symmetry_equiv']) {
        const loop = block.get(loopName, false);
        if (!loop) {
            continue;
        }
        const operationHeader = loop.getHeaders().find(header => {
            const normalized = header.toLowerCase();
            return normalized === '_space_group_symop.operation_xyz'
                || normalized === '_space_group_symop_operation_xyz'
                || normalized === '_symmetry_equiv.pos_as_xyz'
                || normalized === '_symmetry_equiv_pos_as_xyz';
        });
        if (operationHeader) {
            return loop.get(operationHeader, []).length > 0;
        }
    }
    return false;
}

function firstBlockValue(block, names) {
    const value = block.get(names, false);
    return value === false ? null : value;
}

function uniqueOperationSet(candidates, number) {
    const numberText = String(number ?? '').trim();
    const parsedNumber = /^\d+$/u.test(numberText) ? Number(numberText) : null;
    const matching = parsedNumber === null
        ? candidates
        : candidates.filter(entry => entry.number === parsedNumber);
    return matching.length > 0
        && new Set(matching.map(entry => entry.operations.join(';'))).size === 1;
}

export function assessSymmetryDeclaration(block) {
    if (hasExplicitSymmetryOperations(block)) {
        return { status: 'explicit_operations', entry: null };
    }
    const number = firstBlockValue(block, [
        '_space_group.it_number', '_space_group.IT_number',
        '_space_group_it_number', '_space_group_IT_number',
        '_symmetry.int_tables_number', '_symmetry_Int_Tables_number',
    ]);
    const name = firstBlockValue(block, [
        '_space_group.name_h-m_alt', '_symmetry_space_group_name_H-M',
        '_space_group_name_H-M_alt',
    ]);
    const fullName = firstBlockValue(block, [
        '_space_group.name_H-M_full', '_space_group_name_H-M_full',
    ]);
    const hall = firstBlockValue(block, [
        '_space_group.name_Hall', '_space_group_name_Hall',
        '_symmetry_space_group_name_Hall',
    ]);
    const entry = lookupSpaceGroup({ number, name, fullName, hall });
    const unambiguous = (hall && uniqueOperationSet(lookupSpaceGroupCandidates(hall), number))
        || (fullName && uniqueOperationSet(lookupSpaceGroupCandidates(fullName), number));
    return {
        status: unambiguous
            ? 'reconstructed_unambiguous_setting'
            : 'reconstructed_ambiguous_setting',
        entry,
        declarations: { number, name, full_name: fullName, hall },
    };
}

function geometrySymmetryCodes(block) {
    const codes = [];
    for (const loopName of ['_geom_bond', '_geom_hbond']) {
        const loop = block.get(loopName, false);
        if (!loop || typeof loop === 'string') {
            continue;
        }
        for (const header of loop.getHeaders()) {
            if (!/site_symmetry_[12dha]$/iu.test(header)) {
                continue;
            }
            codes.push(...loop.get(header, []).map(String));
        }
    }
    return [...new Set(codes.filter(code => !['', '.', '?'].includes(code.trim())))];
}

function assessImplicitSymmetryReferences(filePath, message) {
    const block = new CIF(readFileSync(filePath, 'utf8')).getBlock(0);
    const declaration = assessSymmetryDeclaration(block);
    if (declaration.status === 'explicit_operations') {
        return { status: 'explicit_operations' };
    }
    const { entry } = declaration;
    const positionCodes = [...message.matchAll(/invalid symmetry operation:\s*([^,\s]+)/giu)]
        .map(match => match[1]);
    const rawPositionCodes = geometrySymmetryCodes(block);
    const ids = [...new Set(rawPositionCodes.map(code => code.split('_')[0]))];
    const numericIds = ids.map(id => Number(id));
    const malformedCodes = positionCodes.filter(code =>
        !/^[^_\s]+_(?:\d{3}|\[-?\d+,-?\d+,-?\d+\])$/u.test(code));
    const idsOutsideGroup = entry ? ids.filter((id, index) =>
        !Number.isInteger(numericIds[index]) || numericIds[index] < 1
        || numericIds[index] > entry.operations.length) : [];

    if (malformedCodes.length > 0 || idsOutsideGroup.length > 0) {
        return {
            status: 'invalid_against_iucr_id_rules_or_declared_group',
            symmetry_source: declaration.status,
            declared_group: entry?.symbol_cif || declaration.declarations.full_name
                || declaration.declarations.name || declaration.declarations.hall || null,
            operation_count: entry?.operations.length ?? null,
            referenced_ids: ids,
            malformed_codes: malformedCodes,
            ids_outside_group: idsOutsideGroup,
        };
    }
    return {
        status: entry && ids.length > 0
            ? 'plausible_implicit_international_tables_sequence'
            : 'implicit_sequence_not_assessable',
        symmetry_source: declaration.status,
        declared_group: entry?.symbol_cif || declaration.declarations.full_name
            || declaration.declarations.name || declaration.declarations.hall || null,
        operation_count: entry?.operations.length ?? null,
        referenced_ids: ids,
        note: 'IUCr defines identity as ID 1 and IDs as references to the operation loop, but '
            + 'does not define a universal operation order when that loop is absent.',
    };
}

function groupByCodId(rows) {
    return Map.groupBy(rows, row => row.cod_id);
}

function convertBondEvidence(row) {
    const numericFields = [
        'bond_index', 'distance_published', 'distance_from_recorded_pair',
        'distance_from_constructed_pair', 'distance_from_suggested_pair',
    ];
    const output = { ...row };
    for (const field of numericFields) {
        output[field] = row[field] === '' ? null : Number(row[field]);
    }
    output.symmetry_2_column_present = row.symmetry_2_column_present === 'true';
    return output;
}

function convertDuplicateEvidence(row) {
    return {
        cod_id: row.cod_id,
        label: row.label,
        occurrence_count: Number(row.occurrence_count),
        row_numbers_one_based: row.row_numbers_one_based.split(';').map(Number),
        distinct_coordinate_count: Number(row.distinct_coordinate_count),
        distinct_site_record_count: Number(row.distinct_site_record_count),
        sites: JSON.parse(row.sites),
        fixer_changed_atom_site_labels: row.fixer_changed_atom_site_labels === 'true',
    };
}

function recalculateSummary(structures) {
    const byIssueCode = {};
    let issueCount = 0;
    let evidenceRecordCount = 0;
    for (const structure of structures) {
        for (const issue of structure.issues) {
            issueCount++;
            evidenceRecordCount += issue.evidence?.length || 0;
            byIssueCode[issue.code] = (byIssueCode[issue.code] || 0) + 1;
        }
    }
    return {
        structure_count: structures.length,
        issue_count: issueCount,
        evidence_record_count: evidenceRecordCount,
        by_issue_code: Object.fromEntries(Object.entries(byIssueCode).sort()),
    };
}

export function main(argv = process.argv.slice(2)) {
    const integrationDir = resolve(argv[0] || '.');
    const maintainerPath = join(integrationDir, 'cod-maintainer-issues-classified.json');
    const reportCsvPath = join(integrationDir, 'cod-data-quality-report.csv');
    const bondCsvPath = join(integrationDir, 'cod-bond-symmetry-classification.csv');
    const duplicateCsvPath = join(integrationDir, 'cod-duplicate-atom-label-analysis.csv');
    const priorAuditPath = join(integrationDir, 'cod-bond-symmetry-classification-audit.json');
    const maintainer = JSON.parse(readFileSync(maintainerPath, 'utf8'));
    const reportRows = readCSV(reportCsvPath);
    const bondEvidence = groupByCodId(readCSV(bondCsvPath).map(convertBondEvidence));
    const duplicateEvidence = groupByCodId(readCSV(duplicateCsvPath).map(convertDuplicateEvidence));
    const priorAudit = JSON.parse(readFileSync(priorAuditPath, 'utf8'));
    const pathByCodId = new Map(reportRows.map(row => [row.cod_id, row.file_path]));
    const symmetryDeclarationCache = new Map();
    const excluded = [];
    const structures = [];

    const symmetryDeclaration = (codId, filePath) => {
        if (!symmetryDeclarationCache.has(codId)) {
            const block = new CIF(readFileSync(filePath, 'utf8')).getBlock(0);
            symmetryDeclarationCache.set(codId, assessSymmetryDeclaration(block));
        }
        return symmetryDeclarationCache.get(codId);
    };

    for (const sourceStructure of maintainer.structures) {
        const filePath = pathByCodId.get(sourceStructure.cod_id) || null;
        const structure = { cod_id: sourceStructure.cod_id, file_path: filePath, issues: [] };
        for (const sourceIssue of sourceStructure.issues) {
            let exclusionReason = MANUAL_REVIEW_CODES.get(sourceIssue.code) || null;
            const declaration = filePath
                ? symmetryDeclaration(sourceStructure.cod_id, filePath)
                : null;
            if (sourceIssue.code === 'cell_symmetry_mismatch' && declaration
                && declaration.status === 'reconstructed_ambiguous_setting') {
                exclusionReason = 'Mismatch depends on a reconstructed space-group setting that '
                    + 'is not uniquely established by a Hall or full Hermann–Mauguin declaration.';
            }
            if ((sourceIssue.code === 'bond_invalid_symmetry'
                || sourceIssue.code === 'hbond_invalid_symmetry') && filePath
                && declaration.status !== 'explicit_operations') {
                const assessment = assessImplicitSymmetryReferences(filePath, sourceIssue.message);
                if (assessment.status !== 'invalid_against_iucr_id_rules_or_declared_group') {
                    exclusionReason = 'Reference uses a plausible but undeclared operation sequence; '
                        + 'cifvis failed to recognise the full Hermann–Mauguin/Hall declaration.';
                }
                sourceIssue.implicit_symmetry_assessment = assessment;
            }
            if (exclusionReason) {
                excluded.push({
                    cod_id: sourceStructure.cod_id,
                    file_path: filePath,
                    issue: sourceIssue,
                    reason: exclusionReason,
                });
                continue;
            }

            const issue = { ...sourceIssue };
            if (declaration) {
                issue.symmetry_source = declaration.status;
                if (declaration.entry) {
                    issue.resolved_space_group = {
                        number: declaration.entry.number,
                        symbol: declaration.entry.universal_h_m,
                        hall: declaration.entry.hall_symbol,
                        setting: declaration.entry.setting,
                    };
                }
            }
            if (sourceIssue.implicit_symmetry_assessment?.status
                === 'invalid_against_iucr_id_rules_or_declared_group') {
                issue.verification = 'The referenced operation ID is negative, malformed, or exceeds '
                    + 'the number of operations in the declared space group.';
            }
            if (sourceIssue.code === 'duplicate_atom_site_label') {
                issue.evidence = duplicateEvidence.get(sourceStructure.cod_id) || [];
                issue.verification = 'Duplicate labels are present in the source atom-site loop; '
                    + 'the cifvis fixer did not change that loop.';
            } else if (sourceIssue.code === 'bond_missing_symmetry'
                || sourceIssue.code === 'bond_wrong_symmetry'
                || sourceIssue.code === 'bond_distance_or_coordinates_mismatch') {
                issue.evidence = (bondEvidence.get(sourceStructure.cod_id) || [])
                    .filter(row => row.code === sourceIssue.code);
            }
            structure.issues.push(issue);
        }
        if (structure.issues.length > 0) {
            structures.push(structure);
        }
    }

    const consolidated = {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        audience: 'COD maintainers',
        source: {
            files_processed: maintainer.source.files_processed,
            report: 'cod-data-quality-report.csv',
        },
        methodology: {
            bond_geometry: 'Each inconsistent bond was rechecked against every symmetry image '
                + 'within two unit cells and classified as missing symmetry, wrong symmetry, or '
                + 'a distance/coordinate disagreement.',
            duplicate_labels: 'Atom-site labels were compared before and after the cifvis fixer; '
                + 'only source-CIF duplicates are included.',
            conservative_filter: 'Unclassified cifvis errors, unsupported/non-structural entries, '
                + 'and conclusions depending on an ambiguous reconstructed setting are excluded. '
                + 'Hall or unambiguous full H-M declarations establish a usable operation set.',
            hbond_geometry_limit: 'H-bond distance consistency was not tested in this campaign; '
                + 'only direct missing-atom and malformed/unknown-symmetry findings are included.',
        },
        summary: recalculateSummary(structures),
        structures,
    };

    const csvHeaders = [
        'cod_id', 'file_path', 'issue_code', 'message', 'persists_after_auto_fix',
        'symmetry_source', 'resolved_space_group_json', 'evidence_type', 'evidence_json',
    ];
    const csv = [csvHeaders.map(escapeCSV).join(',')];
    for (const structure of structures) {
        for (const issue of structure.issues) {
            const evidence = issue.evidence?.length > 0 ? issue.evidence : [null];
            for (const item of evidence) {
                const row = {
                    cod_id: structure.cod_id,
                    file_path: structure.file_path,
                    issue_code: issue.code,
                    message: issue.message,
                    persists_after_auto_fix: issue.persists_after_auto_fix,
                    symmetry_source: issue.symmetry_source || '',
                    resolved_space_group_json: issue.resolved_space_group
                        ? JSON.stringify(issue.resolved_space_group)
                        : '',
                    evidence_type: item
                        ? (issue.code === 'duplicate_atom_site_label' ? 'duplicate_label_group' : 'bond')
                        : 'structure_issue',
                    evidence_json: item ? JSON.stringify(item) : '',
                };
                csv.push(csvHeaders.map(header => escapeCSV(row[header])).join(','));
            }
        }
    }

    const exclusionCounts = Object.fromEntries(
        [...Map.groupBy(excluded, item => item.issue.code)]
            .map(([code, entries]) => [code, entries.length]).sort(),
    );
    const audit = {
        included: consolidated.summary,
        included_by_symmetry_source: Object.fromEntries(
            [...Map.groupBy(
                structures.flatMap(structure => structure.issues),
                issue => issue.symmetry_source || 'not_applicable',
            )].map(([source, issues]) => [source, issues.length]).sort(),
        ),
        excluded_from_cod_handoff: {
            issue_count: excluded.length,
            structure_count: new Set(excluded.map(item => item.cod_id)).size,
            by_issue_code: exclusionCounts,
            items: excluded,
        },
        known_cifvis_internal: {
            issue_count: priorAudit.cifvis_internal.length,
            items: priorAudit.cifvis_internal,
        },
        input_validation: {
            report_csv_records: reportRows.length,
            bond_evidence_records: [...bondEvidence.values()].flat().length,
            duplicate_evidence_records: [...duplicateEvidence.values()].flat().length,
        },
    };

    const jsonPath = join(integrationDir, 'cod-maintainer-consolidated.json');
    const csvPath = join(integrationDir, 'cod-maintainer-consolidated.csv');
    const auditPath = join(integrationDir, 'cod-maintainer-consolidated-audit.json');
    writeFileSync(jsonPath, `${JSON.stringify(consolidated, null, 2)}\n`);
    writeFileSync(csvPath, `${csv.join('\n')}\n`);
    writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
    console.log(`Included ${consolidated.summary.issue_count} issues in `
        + `${consolidated.summary.structure_count} structures.`);
    console.log(`Excluded ${excluded.length} uncertain/internal issues for audit.`);
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${csvPath}`);
    console.log(`Wrote ${auditPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
