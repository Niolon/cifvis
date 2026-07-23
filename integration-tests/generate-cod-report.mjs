import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const logsDir = join(scriptDir, 'logs');

/**
 * Categorizes a "Structure Error" message body into a human-readable, COD-actionable
 * label (or several - a single message can report more than one bond/H-bond problem
 * at once). Mirrors the classification test-structure-modifiers.mjs's
 * handleStructureError() uses for its live stats counters, kept as an independent
 * copy here (rather than importing it) so this report generator can run safely
 * against log output from a test run that's still in progress.
 * @param {string} message - The error message body (without the "Structure Error in <path>: " prefix)
 * @returns {string[]} One or more category labels this message falls under
 */
function classifyStructureError(message) {
    if (message.includes('Unit cell parameter entries missing in CIF')) {
        return ['Missing unit cell parameters'];
    }
    if (message === 'The cif file contains no valid atoms.') {
        return ['No valid atoms'];
    }
    if (message.includes(', but no atom_site_aniso loop was found')) {
        return ['Anisotropic ADP: atom_site_aniso loop missing'];
    }
    if (message.includes('but was not found in atom_site_aniso.label')) {
        return ['Anisotropic ADP: atom missing from atom_site_aniso table'];
    }
    if (message.includes('Could not infer element type from atom label')) {
        return ['Atom label does not indicate a recognisable element'];
    }
    if (message === 'Empty atom label') {
        return ['Empty atom label'];
    }
    if (message.includes('There were errors in the bond or H-bond creation')) {
        const labels = [];
        if (message.includes('Non-existent atoms in bond')) {
            labels.push('Bond references a non-existent atom');
        }
        if (message.includes('Invalid symmetry in bond')) {
            labels.push('Bond has an invalid/unparseable symmetry code');
        }
        if (message.includes('Non-existent atoms in H-bond')) {
            labels.push('H-bond references a non-existent atom');
        }
        if (message.includes('Invalid symmetry in H-bond')) {
            labels.push('H-bond has an invalid/unparseable symmetry code');
        }
        return labels.length > 0 ? labels : ['Bond/H-bond creation error (unspecified)'];
    }
    return ['Other/unclassified structure error'];
}

/**
 * Parses test-structure-modifiers.mjs's error log into structured entries, joining the
 * two-line "Modifier Error" entries (mode combination + "Error: <message>" on the next
 * line) into one logical entry.
 * @param {string} logPath - Path to modifier-test-errors.log (or a per-chunk equivalent)
 * @returns {Array<{timestamp: string, kind: string, persistsAfterFix: boolean, filePath: string,
 *  detail: string}>} Parsed entries
 */
function parseErrorLog(logPath) {
    const rawLines = readFileSync(logPath, 'utf8').split('\n');
    const raw = [];
    for (const line of rawLines) {
        if (line.startsWith('[')) {
            const m = line.match(/^\[([^\]]+)\] (.*)$/);
            if (m) {
                raw.push({ timestamp: m[1], text: m[2] });
            }
        } else if (line.trim() && raw.length > 0) {
            raw[raw.length - 1].text += '\n' + line;
        }
    }

    const entries = [];
    // "Structure Error" has an extra "Fixed structure " marker before the path when the
    // problem persisted past the auto-fix attempt (e.g. "Structure Error in Fixed
    // structure /path/1.cif: msg" vs. "Structure Error in /path/1.cif: msg") - captured
    // separately rather than folded into the kind alternation, since it sits *between*
    // "in" and the path, not after the kind.
    const errorKinds = 'CIF Error|CifParsing Error|Structure Error|Connectivity Error|Modifier Error';
    const pattern = new RegExp(`^(${errorKinds}) in (Fixed structure )?(.+?): ([\\s\\S]*)$`);
    for (const { timestamp, text } of raw) {
        const m = text.match(pattern);
        if (!m) {
            continue;
        }
        const [, kind, fixedMarker, filePath, detail] = m;
        entries.push({ timestamp, kind, persistsAfterFix: Boolean(fixedMarker), filePath, detail });
    }
    return entries;
}

/**
 * @param {string} filePath - Absolute path to a .cif file
 * @returns {string} The COD entry ID (filename without extension)
 */
function codIdFor(filePath) {
    return basename(filePath, '.cif');
}

/**
 * Builds the report: a category -> list of {codId, filePath, detail} map, split into
 * COD-actionable data-quality issues and a separate informational section for cases
 * that aren't COD data problems at all (extended/periodic framework structures, where
 * cifvis's fragment-growth feature simply doesn't apply - not something COD should fix).
 * @param {Array<{timestamp: string, kind: string, filePath: string, detail: string}>} entries - Parsed log entries
 * @returns {{actionable: Map<string, object[]>, informational: Map<string, object[]>, cifvisInternal: object[]}}
 *  Categorized report data
 */
function buildReport(entries) {
    const actionable = new Map();
    const informational = new Map();
    const cifvisInternal = [];

    const addTo = (map, category, item) => {
        if (!map.has(category)) {
            map.set(category, []);
        }
        map.get(category).push(item);
    };

    for (const entry of entries) {
        const codId = codIdFor(entry.filePath);

        if (entry.kind === 'CIF Error') {
            addTo(actionable, 'CIF cannot be parsed at all', {
                codId, filePath: entry.filePath, detail: entry.detail,
            });
            continue;
        }

        if (entry.kind === 'CifParsing Error') {
            cifvisInternal.push({ codId, filePath: entry.filePath, detail: entry.detail });
            continue;
        }

        if (entry.kind === 'Connectivity Error') {
            // Legacy path; createConnectivity throws directly now, so this should stay empty.
            addTo(actionable, 'Connectivity error (legacy path)', {
                codId, filePath: entry.filePath, detail: entry.detail,
            });
            continue;
        }

        if (entry.kind === 'Structure Error') {
            for (const label of classifyStructureError(entry.detail)) {
                addTo(actionable, entry.persistsAfterFix ? `${label} (persists after auto-fix)` : label, {
                    codId, filePath: entry.filePath, detail: entry.detail,
                });
            }
            continue;
        }

        if (entry.kind === 'Modifier Error') {
            const [modeLine, ...rest] = entry.detail.split('\n');
            const message = rest.join('\n').replace(/^Error: /, '');
            if (message.includes('createConnectivity exceeded the iteration limit')) {
                addTo(informational, 'Extended/periodic framework structure (fragment growth not applicable)', {
                    codId, filePath: entry.filePath, detail: modeLine,
                });
            } else {
                addTo(actionable, 'Structure modifier failed to apply', {
                    codId, filePath: entry.filePath, detail: `${modeLine} -- ${message}`,
                });
            }
        }
    }

    return { actionable, informational, cifvisInternal };
}

/**
 * @param {object[]} items - Items for one category
 * @returns {number} Count of distinct COD entries among the items
 */
function uniqueCodIds(items) {
    return new Set(items.map(item => item.codId)).size;
}

/**
 * @param {Map<string, object[]>} categories - Category -> items map, largest-first by item count
 * @returns {Array<[string, object[]]>} Sorted entries
 */
function sortedByCount(categories) {
    return [...categories.entries()].sort((a, b) => b[1].length - a[1].length);
}

const EXAMPLES_PER_CATEGORY = 15;
const MAX_DETAIL_LENGTH = 300;

/**
 * Strips the exhaustive "here is every atom label in the file" dump that
 * BondsFactory's validators prepend to bond/H-bond errors, keeping just the specific
 * violation lines (e.g. "Non-existent atoms in bond: ..."). That atom dump is only
 * needed by the validator itself for a Levenshtein-style typo suggestion, not by a
 * report reader trying to see what's actually wrong. Only used for the Markdown
 * display - the CSV keeps the original, untrimmed message.
 * @param {string} message - Raw error detail
 * @returns {string} Cleaned, single-line, length-capped detail for display
 */
function cleanDetailForDisplay(message) {
    const cleaned = message
        .replace(/Unknown atom label\(s\)\. Known labels are[\s\S]*?(?=Non-existent|Invalid|$)/g, '')
        .replace(/Unknown symmetry ID\(s\) or String format\.[\s\S]*?(?=Non-existent|Invalid|$)/g, '')
        .replace(/^There were errors in the bond or H-bond creation\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length > MAX_DETAIL_LENGTH
        ? `${cleaned.slice(0, MAX_DETAIL_LENGTH)}... (truncated, see CSV for full detail)`
        : cleaned;
}

/**
 * @param {{actionable: Map, informational: Map, cifvisInternal: object[]}} report - Report data from buildReport()
 * @param {number} totalFilesProcessed - Total files the underlying test run covered, for context
 * @param {object} [stats] - Aggregated stats.json, for the auto-fixed-away note (omit if unavailable)
 * @returns {string} Markdown report text
 */
function formatMarkdown(report, totalFilesProcessed, stats) {
    const { actionable, informational, cifvisInternal } = report;
    const lines = [];
    const totalActionable = [...actionable.values()].reduce((sum, items) => sum + items.length, 0);
    const totalActionableCodIds = uniqueCodIds([...actionable.values()].flat());

    lines.push('# COD Data Quality Report (via cifvis integration test suite)');
    lines.push('');
    lines.push(`Generated from a run covering ${totalFilesProcessed.toLocaleString()} COD entries.`);
    lines.push(
        `${totalActionable.toLocaleString()} issue occurrences across ${totalActionableCodIds.toLocaleString()} `
        + 'distinct entries below look like genuine problems in the underlying CIF data '
        + '(missing/invalid data referenced by the file itself), not limitations of the '
        + 'viewing software. A separate informational section lists entries where no issue '
        + 'is being reported to you - see the note there.',
    );
    lines.push('');
    lines.push('Full itemized data: `cod-data-quality-report.csv` (all entries, not just the examples below).');
    lines.push('');

    if (stats) {
        const preFix = stats.errors.CrystalStructure;
        const postFix = stats.errors.CrystalStructureFixed;
        const autoFixed = preFix.total - postFix.total;
        lines.push(
            `Of ${preFix.total.toLocaleString()} structure-creation problems detected on first parse, `
            + `${autoFixed.toLocaleString()} were successfully auto-corrected by cifvis's CIF-fixer and are `
            + '**not** itemized below (no per-entry detail is logged for those since cifvis already handles '
            + `them transparently). The ${postFix.total.toLocaleString()} that persisted after the fix attempt `
            + 'are the ones itemized in the categories below, plus unclassified/CIF-parse failures.',
        );
        lines.push('');
    }

    lines.push('## Summary');
    lines.push('');
    lines.push('| Category | Occurrences | Distinct COD entries |');
    lines.push('|---|---|---|');
    for (const [category, items] of sortedByCount(actionable)) {
        lines.push(`| ${category} | ${items.length} | ${uniqueCodIds(items)} |`);
    }
    lines.push('');

    for (const [category, items] of sortedByCount(actionable)) {
        lines.push(`## ${category}`);
        lines.push('');
        lines.push(`${items.length} occurrence(s) across ${uniqueCodIds(items)} distinct COD entries.`);
        lines.push('');
        lines.push('| COD ID | Detail |');
        lines.push('|---|---|');
        const seen = new Set();
        let shown = 0;
        for (const item of items) {
            if (seen.has(item.codId)) {
                continue;
            }
            seen.add(item.codId);
            const detail = cleanDetailForDisplay(item.detail).replace(/\|/g, '\\|');
            lines.push(`| ${item.codId} | ${detail} |`);
            shown++;
            if (shown >= EXAMPLES_PER_CATEGORY) {
                break;
            }
        }
        if (uniqueCodIds(items) > EXAMPLES_PER_CATEGORY) {
            lines.push(`| ... | +${uniqueCodIds(items) - EXAMPLES_PER_CATEGORY} more, see CSV |`);
        }
        lines.push('');
    }

    if (informational.size > 0) {
        lines.push('## Informational (not a COD data issue)');
        lines.push('');
        for (const [category, items] of sortedByCount(informational)) {
            lines.push(`### ${category}`);
            lines.push('');
            lines.push(
                `${uniqueCodIds(items)} distinct COD entries. These are correctly-represented `
                + 'extended structures (e.g. zeolite, MOF, or perovskite frameworks) that are '
                + 'covalently infinite in 3D - there is no finite molecular fragment to grow, '
                + 'so cifvis reports this rather than silently showing an incomplete structure. '
                + 'No action needed on the COD data.',
            );
            lines.push('');
            const ids = [...new Set(items.map(item => item.codId))].slice(0, EXAMPLES_PER_CATEGORY);
            lines.push(`Example entries: ${ids.join(', ')}${uniqueCodIds(items) > ids.length ? ', ...' : ''}`);
            lines.push('');
        }
    }

    if (cifvisInternal.length > 0) {
        lines.push('## For cifvis maintainers (not part of the COD report)');
        lines.push('');
        lines.push(
            `${cifvisInternal.length} entries raised an error outside the normal structure-validation `
            + 'path and need triage on the cifvis side before it\'s clear whether they indicate a COD '
            + 'data problem at all.',
        );
        lines.push('');
        lines.push('| COD ID | Detail |');
        lines.push('|---|---|');
        for (const item of cifvisInternal.slice(0, EXAMPLES_PER_CATEGORY)) {
            lines.push(`| ${item.codId} | ${cleanDetailForDisplay(item.detail).replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * @param {{actionable: Map, informational: Map}} report - Report data from buildReport()
 * @returns {string} CSV text with every itemized entry (actionable categories only)
 */
function formatCSV(report) {
    const escape = value => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [['category', 'cod_id', 'file_path', 'detail'].map(escape).join(',')];
    for (const [category, items] of sortedByCount(report.actionable)) {
        for (const item of items) {
            rows.push([category, item.codId, item.filePath, item.detail].map(escape).join(','));
        }
    }
    return rows.join('\n');
}

/**
 * Reads the aggregated (or per-chunk) error and verbose logs, classifies every entry,
 * and writes cod-data-quality-report.md and .csv alongside them.
 *
 * Both logs are needed: test-structure-modifiers.mjs only writes a classified structure
 * error (missing unit cell, bond problems, etc.) as text when it *persists after* the
 * auto-fix attempt - and even then, to the verbose log, not the error log. A classified
 * error that gets successfully auto-fixed is never itemized as text anywhere, only
 * counted in stats.json; the "pre-fix (auto-fixed away)" note in the report accounts for
 * that gap instead of silently under-reporting.
 */
function main() {
    const errorLogPath = process.argv[2] || join(logsDir, 'modifier-test-errors.log');
    const verboseLogPath = process.argv[3] || join(logsDir, 'modifier-test-verbose.log');
    const statsPath = join(logsDir, 'modifier-test-stats.json');

    if (!existsSync(errorLogPath)) {
        console.error(`No error log found at ${errorLogPath}`);
        process.exit(1);
    }

    const entries = [
        ...parseErrorLog(errorLogPath),
        ...(existsSync(verboseLogPath) ? parseErrorLog(verboseLogPath) : []),
    ];
    const report = buildReport(entries);

    let totalFilesProcessed = 'unknown (stats.json not found)';
    let stats = null;
    if (existsSync(statsPath)) {
        stats = JSON.parse(readFileSync(statsPath, 'utf8'));
        totalFilesProcessed = stats.totalFiles;
    }

    const markdown = formatMarkdown(report, totalFilesProcessed, stats);
    const csv = formatCSV(report);

    writeFileSync(join(logsDir, 'cod-data-quality-report.md'), markdown);
    writeFileSync(join(logsDir, 'cod-data-quality-report.csv'), csv);

    console.log(`Parsed ${entries.length} log entries.`);
    console.log(`Wrote ${join(logsDir, 'cod-data-quality-report.md')}`);
    console.log(`Wrote ${join(logsDir, 'cod-data-quality-report.csv')}`);
}

main();
