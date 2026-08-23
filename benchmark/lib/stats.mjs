// Shared numeric/CSV helpers used across the benchmark/*.mjs scripts, so
// percentile reporting and CSV escaping stay consistent between speed.mjs,
// analysis/mode-matrix.mjs, analysis/density-pipeline-cod.mjs, and
// analysis/density-summary.mjs.

/**
 * @param {number[]} values - Numeric samples
 * @param {number} p - Percentile in [0,1]
 * @returns {number} The value at that percentile
 */
export function percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];
}

/**
 * @param {number[]} values - Numeric samples
 * @returns {number} Median value
 */
export function median(values) {
    return percentile(values, 0.5);
}

/**
 * Prints a p50/p90/p95/p99 breakdown for a named metric to the console.
 * @param {string} label - Metric name to print above the breakdown
 * @param {number[]} values - Numeric samples (ms, counts, etc.)
 */
export function printPercentiles(label, values) {
    console.log(`\n${label}:`);
    if (values.length === 0) {
        console.log('  (no successful samples)');
        return;
    }
    for (const p of [0.5, 0.9, 0.95, 0.99]) {
        console.log(`  p${p * 100}: ${percentile(values, p).toFixed(1)}`);
    }
}

/**
 * @param {string|number|boolean|null|undefined} value - Raw CSV field value
 * @returns {string} CSV-safe representation
 */
export function csvField(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
