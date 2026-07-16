// Profiles the CIF -> CrystalStructure -> ORTEP3JsStructure pipeline against
// a random sample of real COD structures to find where time goes.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';

const COD_DIR = process.argv[3] || '/home/niklas/cod/cif';
const SAMPLE_SIZE = parseInt(process.argv[4] || '300', 10);

/**
 * Picks a random sample of CIF file paths from the COD directory.
 * @returns {string[]} sampled file paths
 */
function sampleFiles() {
    const raw = execSync(
        `find "${COD_DIR}" -maxdepth 4 -name "*.cif" | shuf -n ${SAMPLE_SIZE}`,
        { maxBuffer: 1024 * 1024 * 50 },
    ).toString().trim();
    return raw.split('\n').filter(Boolean);
}

/**
 * Current high-resolution timestamp in milliseconds.
 * @returns {number} timestamp in milliseconds
 */
function now() {
    return performance.now();
}

const stageTotals = { read: [], parse: [], structure: [], ortep: [], total: [] };
const results = [];
let failures = 0;

const files = sampleFiles();
console.log(`Sampled ${files.length} CIF files from ${COD_DIR}`);

for (const filePath of files) {
    let t0, t1, t2, t3, t4;
    let atomCount = -1;
    try {
        t0 = now();
        const text = readFileSync(filePath, 'utf8');
        t1 = now();

        const cif = new CIF(text);
        const block = cif.getBlock(0);
        t2 = now();

        const structure = CrystalStructure.fromCIF(block);
        atomCount = structure.atoms.length;
        t3 = now();

        // eslint-disable-next-line no-unused-vars
        const ortep = new ORTEP3JsStructure(structure);
        t4 = now();

        const rec = {
            file: filePath,
            atomCount,
            read: t1 - t0,
            parse: t2 - t1,
            structure: t3 - t2,
            ortep: t4 - t3,
            total: t4 - t0,
        };
        results.push(rec);
        stageTotals.read.push(rec.read);
        stageTotals.parse.push(rec.parse);
        stageTotals.structure.push(rec.structure);
        stageTotals.ortep.push(rec.ortep);
        stageTotals.total.push(rec.total);
    } catch {
        failures++;
    }
}

/**
 * Computes mean/p50/p90/p99/max summary statistics for a list of numbers.
 * @param {number[]} arr - values to summarize
 * @returns {{mean: number, p50: number, p90: number, p99: number, max: number}} summary stats
 */
function stats(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return {
        mean: sum / sorted.length,
        p50: pct(0.5),
        p90: pct(0.9),
        p99: pct(0.99),
        max: sorted[sorted.length - 1],
    };
}

console.log(`\nSuccessful: ${results.length}, failed: ${failures}\n`);
console.log('Stage        mean(ms)   p50(ms)   p90(ms)   p99(ms)   max(ms)');
for (const stage of ['read', 'parse', 'structure', 'ortep', 'total']) {
    const s = stats(stageTotals[stage]);
    console.log(
        `${stage.padEnd(12)} ${s.mean.toFixed(2).padStart(8)}  ${s.p50.toFixed(2).padStart(8)}  ` +
        `${s.p90.toFixed(2).padStart(8)}  ${s.p99.toFixed(2).padStart(8)}  ${s.max.toFixed(2).padStart(8)}`,
    );
}

// Correlate total time with atom count (rough linear regression slope)
const withAtoms = results.filter(r => r.atomCount > 0);
const n = withAtoms.length;
const sumX = withAtoms.reduce((a, r) => a + r.atomCount, 0);
const sumY = withAtoms.reduce((a, r) => a + r.total, 0);
const sumXY = withAtoms.reduce((a, r) => a + r.atomCount * r.total, 0);
const sumX2 = withAtoms.reduce((a, r) => a + r.atomCount * r.atomCount, 0);
const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
const intercept = (sumY - slope * sumX) / n;
console.log(`\nTotal time vs atom count: ~${slope.toFixed(4)} ms/atom + ${intercept.toFixed(2)} ms fixed overhead`);

// Top 15 slowest total
const slowest = [...results].sort((a, b) => b.total - a.total).slice(0, 15);
console.log('\nSlowest structures:');
for (const r of slowest) {
    console.log(
        `  ${r.total.toFixed(1).padStart(8)}ms  atoms=${String(r.atomCount).padStart(5)}  ` +
        `read=${r.read.toFixed(1)} parse=${r.parse.toFixed(1)} struct=${r.structure.toFixed(1)} ` +
        `ortep=${r.ortep.toFixed(1)}  ${r.file}`,
    );
}

// how many exceed 200ms budget
const over200 = results.filter(r => r.total > 200).length;
console.log(`\n${over200}/${results.length} (${(100 * over200 / results.length).toFixed(1)}%) exceeded 200ms total`);
