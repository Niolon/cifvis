#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [csvArg, sampleArg, outputArg] = process.argv.slice(2);
if (!csvArg || !sampleArg || !outputArg) {
    throw new Error('usage: summarize-jsmol-comparison.mjs RESULTS.csv SAMPLE.txt OUTPUT.json');
}

/**
 * Parse RFC 4180-style CSV, including quoted commas, quotes, and newlines.
 * @param {string} text - CSV source
 * @returns {string[][]} Parsed records
 */
function parseCsv(text) {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            record.push(field);
            field = '';
        } else if (character === '\n') {
            record.push(field.replace(/\r$/, ''));
            records.push(record);
            record = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (quoted) {
        throw new Error('unterminated quoted CSV field');
    }
    if (field || record.length) {
        record.push(field.replace(/\r$/, ''));
        records.push(record);
    }
    return records;
}

/**
 * @param {number[]} values - Observations in milliseconds.
 * @returns {object} Summary statistics
 */
function summarize(values) {
    if (!values.length) {
        return { n: 0 };
    }
    const sorted = [...values].sort((left, right) => left - right);
    const percentile = fraction => sorted[Math.min(
        sorted.length - 1, Math.floor(sorted.length * fraction),
    )];
    return {
        n: sorted.length,
        mean_ms: values.reduce((sum, value) => sum + value, 0) / values.length,
        p50_ms: percentile(0.5),
        p90_ms: percentile(0.9),
        p95_ms: percentile(0.95),
        p99_ms: percentile(0.99),
        p99_9_ms: percentile(0.999),
        max_ms: sorted.at(-1),
    };
}

const records = parseCsv(readFileSync(resolve(csvArg), 'utf8'));
if (records.length < 1) {
    throw new Error('results CSV is empty');
}
const header = records.shift();
const rows = records.filter(record => record.some(Boolean)).map(record =>
    Object.fromEntries(header.map((name, index) => [name, record[index] ?? ''])));
const sampleFiles = readFileSync(resolve(sampleArg), 'utf8').trim().split('\n')
    .filter(Boolean).map(line => line.split('\t')[0]);
const libraries = ['CifVis', 'JSMol'];
const methods = (process.env.JSMOL_LOADING_METHODS || 'disk,preloaded').split(',')
    .map(method => method.trim()).filter(Boolean);
const present = new Set(rows.map(row => `${row.library}|${row.filename}|${row.loading_method}`));

const timings = {};
for (const library of libraries) {
    timings[library] = {};
    for (const method of methods) {
        timings[library][method] = summarize(
            rows.filter(row =>
                row.library === library && row.loading_method === method && !row.error &&
                Number.isFinite(Number(row.render_time_ms)))
                .map(row => Number(row.render_time_ms)),
        );
    }
}

const missing = [];
for (const filename of sampleFiles) {
    for (const library of libraries) {
        for (const method of methods) {
            const key = `${library}|${filename}|${method}`;
            if (!present.has(key)) {
                missing.push({ library, filename, loading_method: method });
            }
        }
    }
}
const errors = rows.filter(row => row.error).map(row => ({
    library: row.library,
    filename: row.filename,
    loading_method: row.loading_method,
    error: row.error,
}));
const ratios = {};
for (const method of methods) {
    ratios[method] = {};
    for (const percentile of ['p50_ms', 'p90_ms', 'p95_ms', 'p99_ms', 'p99_9_ms']) {
        ratios[method][percentile] =
            timings.JSMol[method][percentile] / timings.CifVis[method][percentile];
    }
}

const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sample_size: sampleFiles.length,
    expected_tasks: sampleFiles.length * libraries.length * methods.length,
    recorded_rows: rows.length,
    timings,
    jsmol_to_cifvis_ratios: ratios,
    clean_errors: errors,
    missing_tasks: missing,
};
writeFileSync(resolve(outputArg), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
    output: resolve(outputArg),
    sample_size: report.sample_size,
    expected_tasks: report.expected_tasks,
    recorded_rows: report.recorded_rows,
    clean_errors: errors.length,
    missing_tasks: missing.length,
    ratios,
}, null, 2));
