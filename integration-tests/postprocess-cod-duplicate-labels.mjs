#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CIF, tryToFixCifBlock } from '../src/core.js';
import { parseCSV } from './postprocess-cod-symmetry-report.mjs';

const DUPLICATE_CATEGORY_PREFIX = 'Duplicate _atom_site_label';

function escapeCSV(value) {
    const singleLine = String(value ?? '').replace(/\r?\n/g, ' ');
    return `"${singleLine.replace(/"/g, '""')}"`;
}

function optionalColumn(loop, names, count) {
    try {
        return loop.get(names);
    } catch {
        return Array(count).fill(null);
    }
}

function atomSiteSnapshot(block) {
    const loop = block.get('_atom_site');
    const labels = loop.get(['_atom_site.label', '_atom_site_label']).map(String);
    const count = labels.length;
    const fields = {
        type_symbol: optionalColumn(loop, ['_atom_site.type_symbol', '_atom_site_type_symbol'], count),
        fract_x: optionalColumn(loop, ['_atom_site.fract_x', '_atom_site_fract_x'], count),
        fract_y: optionalColumn(loop, ['_atom_site.fract_y', '_atom_site_fract_y'], count),
        fract_z: optionalColumn(loop, ['_atom_site.fract_z', '_atom_site_fract_z'], count),
        occupancy: optionalColumn(loop, ['_atom_site.occupancy', '_atom_site_occupancy'], count),
        disorder_assembly: optionalColumn(
            loop, ['_atom_site.disorder_assembly', '_atom_site_disorder_assembly'], count,
        ),
        disorder_group: optionalColumn(
            loop, ['_atom_site.disorder_group', '_atom_site_disorder_group'], count,
        ),
    };
    return { labels, fields };
}

function duplicateGroups(snapshot) {
    const indices = new Map();
    snapshot.labels.forEach((label, index) => {
        if (!indices.has(label)) {
            indices.set(label, []);
        }
        indices.get(label).push(index);
    });
    return [...indices.entries()].filter(([, rows]) => rows.length > 1).map(([label, rows]) => {
        const sites = rows.map(index => Object.fromEntries(
            Object.entries(snapshot.fields).map(([name, values]) => [name, values[index]]),
        ));
        const coordinateKeys = new Set(sites.map(site =>
            JSON.stringify([site.fract_x, site.fract_y, site.fract_z])));
        const rowKeys = new Set(sites.map(site => JSON.stringify(site)));
        return {
            label,
            row_indices_zero_based: rows,
            row_numbers_one_based: rows.map(index => index + 1),
            occurrence_count: rows.length,
            distinct_coordinate_count: coordinateKeys.size,
            distinct_site_record_count: rowKeys.size,
            sites,
        };
    });
}

function validateReportCSV(path) {
    const rows = parseCSV(readFileSync(path, 'utf8'));
    const header = rows.shift();
    const expected = ['category', 'cod_id', 'file_path', 'detail'];
    if (!header || header.length !== expected.length
        || header.some((value, index) => value !== expected[index])) {
        throw new Error(`Unexpected report header in ${path}`);
    }
    if (rows.some(row => row.length !== header.length)) {
        throw new Error(`Malformed CSV record in ${path}`);
    }
    return rows.map(row => Object.fromEntries(header.map((name, index) => [name, row[index]])));
}

function sameLabels(first, second) {
    return first.length === second.length && first.every((label, index) => label === second[index]);
}

function runQuietly(callback) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    try {
        console.log = () => {};
        console.warn = () => {};
        return callback();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

export function analyzeDuplicateFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const rawBlock = new CIF(text).getBlock(0);
    const raw = atomSiteSnapshot(rawBlock);
    const rawGroups = duplicateGroups(raw);

    const fixedBlock = new CIF(text).getBlock(0);
    const beforeFix = atomSiteSnapshot(fixedBlock);
    runQuietly(() => tryToFixCifBlock(fixedBlock, true, true, true));
    const afterFix = atomSiteSnapshot(fixedBlock);
    const fixedGroups = duplicateGroups(afterFix);
    const fixerChangedLabels = !sameLabels(beforeFix.labels, afterFix.labels);

    let classification;
    if (rawGroups.length > 0) {
        classification = 'duplicate_present_in_source_cif';
    } else if (fixedGroups.length > 0) {
        classification = 'duplicate_introduced_by_cifvis_fixer';
    } else {
        classification = 'reported_duplicate_not_reproduced';
    }
    return {
        classification,
        fixer_changed_atom_site_labels: fixerChangedLabels,
        raw_atom_count: raw.labels.length,
        raw_duplicate_groups: rawGroups,
        fixed_duplicate_groups: fixedGroups,
    };
}

export function main(argv = process.argv.slice(2)) {
    const integrationDir = resolve(argv[0] || '.');
    const reportPath = resolve(argv[1] || join(integrationDir, 'cod-data-quality-report.csv'));
    const reportRows = validateReportCSV(reportPath);
    const duplicateRows = reportRows.filter(row =>
        row.category.startsWith(DUPLICATE_CATEGORY_PREFIX));
    const files = [...new Map(duplicateRows.map(row => [row.file_path, row])).values()];
    const structures = [];
    const failures = [];

    for (const [index, row] of files.entries()) {
        try {
            structures.push({
                cod_id: row.cod_id,
                file_path: row.file_path,
                ...analyzeDuplicateFile(row.file_path),
            });
        } catch (error) {
            failures.push({ cod_id: row.cod_id, file_path: row.file_path, error: error.message });
        }
        if ((index + 1) % 250 === 0) {
            console.log(`Checked ${index + 1}/${files.length} duplicate-label structures...`);
        }
    }

    const classificationCounts = Object.fromEntries(
        [...Map.groupBy(structures, structure => structure.classification)]
            .map(([classification, entries]) => [classification, entries.length]).sort(),
    );
    const groups = structures.flatMap(structure => structure.raw_duplicate_groups.map(group => ({
        cod_id: structure.cod_id,
        file_path: structure.file_path,
        classification: structure.classification,
        fixer_changed_atom_site_labels: structure.fixer_changed_atom_site_labels,
        ...group,
    })));
    const audit = {
        source_csv: reportPath,
        parsed_report_records: reportRows.length,
        reported_duplicate_structures: files.length,
        analyzed_structures: structures.length,
        classification_counts: classificationCounts,
        fixer_changed_atom_site_labels: structures.filter(
            structure => structure.fixer_changed_atom_site_labels,
        ).length,
        duplicate_label_groups: groups.length,
        groups_with_conflicting_coordinates: groups.filter(
            group => group.distinct_coordinate_count > 1,
        ).length,
        groups_with_identical_coordinates: groups.filter(
            group => group.distinct_coordinate_count === 1,
        ).length,
        groups_with_conflicting_site_records: groups.filter(
            group => group.distinct_site_record_count > 1,
        ).length,
        groups_with_identical_site_records: groups.filter(
            group => group.distinct_site_record_count === 1,
        ).length,
        failures,
    };

    const headers = [
        'cod_id', 'classification', 'label', 'occurrence_count', 'row_numbers_one_based',
        'distinct_coordinate_count', 'distinct_site_record_count', 'sites',
        'fixer_changed_atom_site_labels', 'file_path',
    ];
    const csv = [headers.map(escapeCSV).join(',')];
    for (const group of groups) {
        const row = {
            ...group,
            row_numbers_one_based: group.row_numbers_one_based.join(';'),
            sites: JSON.stringify(group.sites),
        };
        csv.push(headers.map(header => escapeCSV(row[header])).join(','));
    }

    const jsonPath = join(integrationDir, 'cod-duplicate-atom-label-analysis.json');
    const csvPath = join(integrationDir, 'cod-duplicate-atom-label-analysis.csv');
    const auditPath = join(integrationDir, 'cod-duplicate-atom-label-analysis-audit.json');
    writeFileSync(jsonPath, `${JSON.stringify({
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source: { report: basename(reportPath) },
        summary: audit,
        structures,
    }, null, 2)}\n`);
    writeFileSync(csvPath, `${csv.join('\n')}\n`);
    writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
    console.log(`Checked ${structures.length} structures; ${failures.length} failed analysis.`);
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${csvPath}`);
    console.log(`Wrote ${auditPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
