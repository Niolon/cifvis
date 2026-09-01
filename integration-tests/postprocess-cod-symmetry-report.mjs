#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc */
import {
    existsSync, readFileSync, writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CIF, CrystalStructure, tryToFixCifBlock,
} from '../src/core.js';
import { BondsFactory } from '../src/lib/structure/bonds.js';
import {
    decodePositionCode, encodePositionCode, normalizeSiteSymmetry,
} from '../src/lib/structure/position-code.js';

const GEOMETRY_CATEGORY = 'Bond length disagrees with the coordinates and symmetry code in the same file';
const TOLERANCE = 0.05;
const SEARCH_RANGE = 2;

/**
 * Parses RFC 4180-style CSV, including escaped quotes and newlines inside quoted fields.
 * The report writer quotes every field, but accepting unquoted fields makes validation
 * useful for externally edited copies too.
 * @param {string} text - CSV input
 * @returns {string[][]} Parsed records
 */
export function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let afterQuote = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    field += '"';
                    index++;
                } else {
                    quoted = false;
                    afterQuote = true;
                }
            } else {
                field += character;
            }
            continue;
        }

        if (afterQuote && character !== ',' && character !== '\n' && character !== '\r') {
            throw new Error(`Unexpected character after closing quote at offset ${index}`);
        }
        if (character === '"') {
            if (field.length > 0 || afterQuote) {
                throw new Error(`Unexpected quote at offset ${index}`);
            }
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
            afterQuote = false;
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && text[index + 1] === '\n') {
                index++; 
            }
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            afterQuote = false;
        } else {
            field += character;
        }
    }
    if (quoted) {
        throw new Error('Unclosed quoted CSV field'); 
    }
    if (field.length > 0 || row.length > 0 || afterQuote) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function escapeCSV(value) {
    // Keep the post-processed file physically one record per line for easy inspection.
    const singleLine = String(value ?? '').replace(/\r?\n/g, ' ');
    return `"${singleLine.replace(/"/g, '""')}"`;
}

function reportRows(csvPath) {
    const records = parseCSV(readFileSync(csvPath, 'utf8'));
    if (records.length === 0) {
        throw new Error(`Empty CSV: ${csvPath}`); 
    }
    const header = records[0];
    const expected = ['category', 'cod_id', 'file_path', 'detail'];
    if (header.length !== expected.length || header.some((value, i) => value !== expected[i])) {
        throw new Error(`Unexpected CSV header: ${header.join(', ')}`);
    }
    const malformed = records.slice(1).findIndex(row => row.length !== header.length);
    if (malformed !== -1) {
        throw new Error(`CSV record ${malformed + 2} has ${records[malformed + 1].length} fields; expected 4`);
    }
    return records.slice(1).map(row => Object.fromEntries(header.map((name, i) => [name, row[i]])));
}

function column(loop, names, count, fallback = null) {
    try {
        return loop.get(names);
    } catch {
        return Array(count).fill(fallback);
    }
}

function numberOrNull(value) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
}

function bondRows(block) {
    const loop = block.get('_geom_bond', false);
    if (!loop) {
        return []; 
    }
    const label1 = loop.get(['_geom_bond.atom_site_label_1', '_geom_bond_atom_site_label_1']);
    const count = label1.length;
    const label2 = loop.get(['_geom_bond.atom_site_label_2', '_geom_bond_atom_site_label_2']);
    const distance = column(loop, ['_geom_bond.distance', '_geom_bond_distance'], count);
    const symmetry1Names = ['_geom_bond.site_symmetry_1', '_geom_bond_site_symmetry_1'];
    const symmetry2Names = ['_geom_bond.site_symmetry_2', '_geom_bond_site_symmetry_2'];
    const headers = new Set(loop.getHeaders().map(header => header.toLowerCase()));
    const hasSymmetry1Column = symmetry1Names.some(name => headers.has(name.toLowerCase()));
    const hasSymmetry2Column = symmetry2Names.some(name => headers.has(name.toLowerCase()));
    const symmetry1 = column(loop, symmetry1Names, count, null);
    const symmetry2 = column(loop, symmetry2Names, count, null);
    return label1.map((first, index) => ({
        index,
        label1: String(first),
        label2: String(label2[index]),
        distance: numberOrNull(distance[index]),
        symmetry1: symmetry1[index],
        symmetry2: symmetry2[index],
        hasSymmetry1Column,
        hasSymmetry2Column,
    }));
}

function atomIndex(structure) {
    const output = new Map();
    for (const atom of structure.atoms) {
        if (!output.has(atom.label)) {
            output.set(atom.label, []); 
        }
        output.get(atom.label).push(atom);
    }
    return output;
}

function identityCode(structure) {
    return `${structure.symmetry.identitySymOpId ?? '1'}_555`;
}

function normalizedCode(value, structure) {
    const normalized = normalizeSiteSymmetry(value, structure.symmetry.operationIds);
    return normalized === '.' ? identityCode(structure) : normalized;
}

function toCartesianFactory(cell) {
    const matrix = cell.fractToCartMatrix.toArray();
    return fract => [
        matrix[0][0] * fract[0] + matrix[0][1] * fract[1] + matrix[0][2] * fract[2],
        matrix[1][0] * fract[0] + matrix[1][1] * fract[1] + matrix[1][2] * fract[2],
        matrix[2][0] * fract[0] + matrix[2][1] * fract[1] + matrix[2][2] * fract[2],
    ];
}

function distance(first, second) {
    return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

function place(structure, atomsByLabel, label, code) {
    const atoms = atomsByLabel.get(label);
    if (!atoms) {
        return []; 
    }
    let decoded;
    try {
        decoded = decodePositionCode(code);
    } catch {
        return [];
    }
    const operationIndex = structure.symmetry.operationIds.get(decoded.id);
    if (operationIndex === undefined) {
        return []; 
    }
    const operation = structure.symmetry.symmetryOperations[operationIndex];
    return atoms.map(atom => {
        const image = operation.applyToPoint([atom.position.x, atom.position.y, atom.position.z]);
        return image.map((value, axis) => value + decoded.translation[axis]);
    });
}

function closestSpan(structure, atomsByLabel, firstLabel, firstCode, secondLabel, secondCode) {
    const first = place(structure, atomsByLabel, firstLabel, firstCode);
    const second = place(structure, atomsByLabel, secondLabel, secondCode);
    if (first.length === 0 || second.length === 0) {
        return null; 
    }
    const toCartesian = toCartesianFactory(structure.cell);
    let closest = Infinity;
    for (const firstPosition of first) {
        for (const secondPosition of second) {
            closest = Math.min(closest, distance(toCartesian(firstPosition), toCartesian(secondPosition)));
        }
    }
    return closest;
}

function findSecondImage(structure, atomsByLabel, row, firstCode) {
    if (row.distance === null) {
        return null; 
    }
    const firstPositions = place(structure, atomsByLabel, row.label1, firstCode);
    const targets = atomsByLabel.get(row.label2);
    if (firstPositions.length === 0 || !targets) {
        return null; 
    }
    const toCartesian = toCartesianFactory(structure.cell);
    let best = null;
    for (const [operationId, operationIndex] of structure.symmetry.operationIds) {
        const operation = structure.symmetry.symmetryOperations[operationIndex];
        for (const target of targets) {
            const image = operation.applyToPoint([target.position.x, target.position.y, target.position.z]);
            for (let x = -SEARCH_RANGE; x <= SEARCH_RANGE; x++) {
                for (let y = -SEARCH_RANGE; y <= SEARCH_RANGE; y++) {
                    for (let z = -SEARCH_RANGE; z <= SEARCH_RANGE; z++) {
                        const candidate = toCartesian([image[0] + x, image[1] + y, image[2] + z]);
                        for (const firstPosition of firstPositions) {
                            const span = distance(toCartesian(firstPosition), candidate);
                            const delta = Math.abs(span - row.distance);
                            const magnitude = Math.abs(x) + Math.abs(y) + Math.abs(z);
                            if (delta <= TOLERANCE && (!best || delta < best.delta
                                || (delta === best.delta && magnitude < best.magnitude))) {
                                best = {
                                    code: encodePositionCode(operationId, [x, y, z]),
                                    span,
                                    delta,
                                    magnitude,
                                };
                            }
                        }
                    }
                }
            }
        }
    }
    return best;
}

function isMissing(value, hasColumn) {
    if (!hasColumn || value === null || value === undefined) {
        return true; 
    }
    const text = String(value).trim();
    return text === '' || text === '.' || text === '?';
}

function parsedSpan(structure, atomsByLabel, bond) {
    const [label1, code1 = identityCode(structure)] = bond.atom1Id.split('|');
    const [label2, code2 = identityCode(structure)] = bond.atom2Id.split('|');
    return closestSpan(structure, atomsByLabel, label1, code1, label2, code2);
}

function relativeCode(structure, firstCode, secondCode) {
    const inverse = structure.symmetry.invertPositionCode(firstCode);
    return structure.symmetry.combineSymmetryCodes(inverse, secondCode);
}

/**
 * Reclassifies every mismatched bond in one reported CIF using its raw loop columns.
 * @param {string} filePath - Original COD CIF path
 * @returns {{findings: object[], autoFixed: boolean}} Classified bonds and fixer status
 */
export function classifyGeometryFile(filePath) {
    const cifText = readFileSync(filePath, 'utf8');
    const originalBlock = new CIF(cifText).getBlock(0);
    const originalRows = bondRows(originalBlock);
    const block = new CIF(cifText).getBlock(0);
    let structure;
    let autoFixed = false;
    try {
        structure = CrystalStructure.fromCIF(block);
    } catch {
        tryToFixCifBlock(block, true, true, true);
        structure = CrystalStructure.fromCIF(block);
        autoFixed = true;
    }
    const effectiveRows = bondRows(block);
    const atomLabels = new Set(structure.atoms.map(atom => atom.label));
    const includedRows = effectiveRows.filter(row =>
        BondsFactory.isValidBondPair(row.label1, row.label2, atomLabels));
    const atomsByLabel = atomIndex(structure);
    const findings = [];

    for (let index = 0; index < structure.bonds.length; index++) {
        const bond = structure.bonds[index];
        const row = includedRows[index];
        if (!row || row.distance === null) {
            continue; 
        }
        const constructedSpan = parsedSpan(structure, atomsByLabel, bond);
        if (constructedSpan === null || Math.abs(constructedSpan - row.distance) <= TOLERANCE) {
            continue; 
        }

        const original = originalRows[row.index] || row;
        const firstCode = normalizedCode(row.symmetry1, structure);
        const secondCode = normalizedCode(row.symmetry2, structure);
        const recordedSpan = closestSpan(
            structure, atomsByLabel, row.label1, firstCode, row.label2, secondCode,
        );
        const recordedMatches = recordedSpan !== null
            && Math.abs(recordedSpan - row.distance) <= TOLERANCE;
        const alternative = findSecondImage(structure, atomsByLabel, row, firstCode);
        let code;
        let reason;
        if (recordedMatches) {
            code = 'cifvis_bond_construction_error';
            reason = 'The recorded endpoint pair reproduces the published distance, but cifvis construction does not.';
        } else if (isMissing(original.symmetry2, original.hasSymmetry2Column)
            && alternative && alternative.code !== identityCode(structure)) {
            code = 'bond_missing_symmetry';
            reason = original.hasSymmetry2Column
                ? 'Endpoint 2 is recorded as identity/unknown, but a non-identity image reproduces the distance.'
                : 'The symmetry_2 column is absent, but a non-identity image reproduces the distance.';
        } else if (alternative) {
            code = 'bond_wrong_symmetry';
            reason = 'The recorded endpoint symmetry is inconsistent; another image reproduces the distance.';
        } else {
            code = 'bond_distance_or_coordinates_mismatch';
            reason = `No endpoint-2 image within ${SEARCH_RANGE} cells reproduces the published distance.`;
        }

        const suggestedAbsolute = alternative?.code ?? null;
        let suggestedRelative = null;
        if (suggestedAbsolute) {
            try {
                suggestedRelative = relativeCode(structure, firstCode, suggestedAbsolute);
            } catch {
                suggestedRelative = null;
            }
        }
        findings.push({
            code,
            bond_index: row.index,
            atom_1: row.label1,
            atom_2: row.label2,
            symmetry_1_recorded: original.symmetry1 ?? null,
            symmetry_2_recorded: original.symmetry2 ?? null,
            symmetry_2_column_present: original.hasSymmetry2Column,
            symmetry_2_suggested_absolute: suggestedAbsolute,
            symmetry_2_suggested_relative_to_site_1: suggestedRelative,
            distance_published: row.distance,
            distance_from_recorded_pair: recordedSpan,
            distance_from_constructed_pair: constructedSpan,
            distance_from_suggested_pair: alternative?.span ?? null,
            reason,
        });
    }
    return { findings, autoFixed };
}

function compactFinding(finding) {
    const recorded = finding.symmetry_2_recorded ?? '(missing)';
    const suggested = finding.symmetry_2_suggested_absolute ?? '(none found)';
    const span = finding.distance_from_recorded_pair === null
        ? 'unresolved' : finding.distance_from_recorded_pair.toFixed(3);
    return `${finding.atom_1}-${finding.atom_2}: symmetry_2 ${recorded} -> ${suggested}; `
        + `recorded distance ${span} Å, published ${finding.distance_published} Å`;
}

function recalculateSummary(document) {
    const byIssueCode = {};
    let issueCount = 0;
    for (const structure of document.structures) {
        for (const issue of structure.issues) {
            issueCount++;
            byIssueCode[issue.code] = (byIssueCode[issue.code] || 0) + 1;
        }
    }
    document.summary = {
        structure_count: document.structures.length,
        issue_count: issueCount,
        by_issue_code: Object.fromEntries(Object.entries(byIssueCode).sort()),
    };
}

function parseArgs(argv) {
    const integrationDir = resolve(argv[0] || '.');
    return {
        integrationDir,
        csvPath: resolve(argv[1] || join(integrationDir, 'cod-data-quality-report.csv')),
        jsonPath: resolve(argv[2] || join(integrationDir, 'cod-maintainer-issues.json')),
    };
}

export function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    if (!existsSync(options.csvPath) || !existsSync(options.jsonPath)) {
        throw new Error(`Expected report CSV and JSON in ${options.integrationDir}`);
    }
    const rows = reportRows(options.csvPath);
    const geometryRows = rows.filter(row => row.category === GEOMETRY_CATEGORY);
    const uniqueFiles = [...new Map(geometryRows.map(row => [row.file_path, row])).values()];
    const maintainer = JSON.parse(readFileSync(options.jsonPath, 'utf8'));
    const byCodId = new Map();
    const failures = [];

    for (const [index, row] of uniqueFiles.entries()) {
        try {
            const result = classifyGeometryFile(row.file_path);
            byCodId.set(row.cod_id, result.findings);
        } catch (error) {
            failures.push({ cod_id: row.cod_id, file_path: row.file_path, error: error.message });
        }
        if ((index + 1) % 100 === 0) {
            console.log(`Classified ${index + 1}/${uniqueFiles.length} structures...`);
        }
    }

    const internal = [];
    for (const structure of maintainer.structures) {
        const modifierIssues = structure.issues.filter(
            issue => issue.code === 'structure_modifier_error',
        );
        internal.push(...modifierIssues.map(issue => ({
            cod_id: structure.cod_id,
            ...issue,
        })));
        structure.issues = structure.issues.filter(
            issue => issue.code !== 'structure_modifier_error',
        );
        const hadGeometryIssue = structure.issues.some(issue => issue.code === 'bond_geometry_mismatch');
        structure.issues = structure.issues.filter(issue => issue.code !== 'bond_geometry_mismatch');
        if (!hadGeometryIssue) {
            continue; 
        }
        const findings = byCodId.get(structure.cod_id) || [];
        const grouped = Map.groupBy(findings, finding => finding.code);
        for (const [code, group] of grouped) {
            const issue = {
                code,
                message: `${group.length} bond${group.length === 1 ? '' : 's'}: `
                    + group.slice(0, 5).map(compactFinding).join('; ')
                    + (group.length > 5 ? `; +${group.length - 5} more in classification CSV` : ''),
                persists_after_auto_fix: true,
            };
            if (code === 'cifvis_bond_construction_error') {
                internal.push({ cod_id: structure.cod_id, ...issue });
            } else {
                structure.issues.push(issue);
            }
        }
        if (findings.length === 0) {
            structure.issues.push({
                code: 'bond_geometry_unclassified',
                message: 'The reported mismatch could not be reproduced during post-processing.',
                persists_after_auto_fix: true,
            });
        }
        structure.issues.sort((a, b) => a.code.localeCompare(b.code));
    }
    maintainer.structures = maintainer.structures.filter(structure => structure.issues.length > 0);
    maintainer.schema_version = 2;
    maintainer.generated_at = new Date().toISOString();
    maintainer.postprocessing = {
        input_csv: basename(options.csvPath),
        geometry_structures_requested: uniqueFiles.length,
        geometry_structures_failed: failures.length,
        tolerance_angstrom: TOLERANCE,
        search_range_cells: SEARCH_RANGE,
        note: 'H-bond geometry is not classified because the integration run did not perform '
            + 'an H-bond distance-consistency check.',
    };
    recalculateSummary(maintainer);

    const allFindings = [...byCodId.entries()].flatMap(([codId, findings]) =>
        findings.map(finding => ({ cod_id: codId, ...finding })));
    const csvHeader = [
        'cod_id', 'code', 'bond_index', 'atom_1', 'atom_2',
        'symmetry_1_recorded', 'symmetry_2_recorded', 'symmetry_2_column_present',
        'symmetry_2_suggested_absolute', 'symmetry_2_suggested_relative_to_site_1',
        'distance_published', 'distance_from_recorded_pair',
        'distance_from_constructed_pair', 'distance_from_suggested_pair', 'reason',
    ];
    const classifiedCsv = [csvHeader.map(escapeCSV).join(',')];
    for (const finding of allFindings) {
        classifiedCsv.push(csvHeader.map(name => escapeCSV(finding[name])).join(','));
    }

    const classifiedJsonPath = join(options.integrationDir, 'cod-maintainer-issues-classified.json');
    const classifiedCsvPath = join(options.integrationDir, 'cod-bond-symmetry-classification.csv');
    const auditPath = join(options.integrationDir, 'cod-bond-symmetry-classification-audit.json');
    writeFileSync(classifiedJsonPath, `${JSON.stringify(maintainer, null, 2)}\n`);
    writeFileSync(classifiedCsvPath, `${classifiedCsv.join('\n')}\n`);
    writeFileSync(auditPath, `${JSON.stringify({
        source_csv: options.csvPath,
        parsed_records: rows.length,
        expected_field_count: 4,
        geometry_structures: uniqueFiles.length,
        classified_bonds: allFindings.length,
        by_code: Object.fromEntries([...Map.groupBy(allFindings, finding => finding.code)]
            .map(([code, findings]) => [code, findings.length]).sort()),
        failures,
        cifvis_internal: internal,
    }, null, 2)}\n`);
    console.log(`Validated ${rows.length} CSV records with four fields each.`);
    console.log(`Wrote ${classifiedJsonPath}`);
    console.log(`Wrote ${classifiedCsvPath}`);
    console.log(`Wrote ${auditPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
