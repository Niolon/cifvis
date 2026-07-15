// Shared list of COD entries flagged as problematic in COD's own
// manual-checks/checks logs (duplicates, unrecognised spacegroups,
// non-numeric data values). Deliberately does NOT include files cifvis's own
// integration tests have failed on - discovering those is the whole point of
// this test suite, and pre-filtering them would hide the failures instead of
// reporting them. Both the COD-wide integration tests here and external
// tooling (e.g. the browser-based cifvis/JSMol comparison) read from the
// same generated list so COD data-quality problems are identified once, not
// rediscovered by every consumer.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(scriptDir, '..', 'logs', 'known-bad-cifs.txt');

// COD mirrors conventionally keep these under <codDir>/manual-checks/. Not
// every mirror ships them (e.g. a partial or differently-assembled COD
// checkout), so callers should expect an empty set rather than a crash when
// they're absent.
const MANUAL_CHECK_LOG_NAMES = [
    'duplicates.lst',
    'data-problems.txt',
    'non-numeric-values.lst',
    'all-cifs-with-unrecognised-spacegroups.log',
    'cifs-with-unrecognised-spacegroups-without-symops.log',
];

/**
 * @param {string} codDir - Root of the COD mirror (the directory containing the digit subdirs)
 * @returns {string[]} Absolute paths to the manual-checks logs under `codDir`
 */
function manualCheckLogPaths(codDir) {
    return MANUAL_CHECK_LOG_NAMES.map(name => join(codDir, 'manual-checks', name));
}

/**
 * Extracts every `<digits>.cif` filename mentioned in a text file. Returns
 * an empty array if the file doesn't exist, so a COD mirror without
 * manual-checks logs just yields no exclusions instead of failing.
 * @param {string} path - Path to a log file
 * @returns {string[]} Matched filenames (e.g. "1000006.cif")
 */
function extractCifFilenames(path) {
    if (!existsSync(path)) {
        return [];
    }
    const text = readFileSync(path, 'utf8');
    return [...text.matchAll(/\b(\d{6,9})\.cif\b/g)].map(m => `${m[1]}.cif`);
}

/**
 * Rebuilds the known-bad-cifs cache from COD's manual-checks logs.
 * @param {string} [codDir] - Root of the COD mirror; defaults to the COD_DIR
 *  env var, falling back to /home/niklas/cod/cif
 * @returns {Set<string>} Filenames (e.g. "1000006.cif") considered known-bad
 */
export function buildKnownBadCifs(codDir = process.env.COD_DIR || '/home/niklas/cod/cif') {
    const excluded = new Set();
    for (const logPath of manualCheckLogPaths(codDir)) {
        for (const filename of extractCifFilenames(logPath)) {
            excluded.add(filename);
        }
    }
    writeFileSync(CACHE_FILE, [...excluded].sort().join('\n') + '\n');
    return excluded;
}

/**
 * Loads the known-bad-cifs list, rebuilding the cache if it doesn't exist
 * yet. Pass `forceRebuild: true` to pick up manual-checks logs that have
 * changed since the cache was last built.
 * @param {object} [options] - Options
 * @param {boolean} [options.forceRebuild] - Rebuild from source logs even if a cache file exists
 * @param {string} [options.codDir] - Forwarded to buildKnownBadCifs when rebuilding
 * @returns {Set<string>} Filenames (e.g. "1000006.cif") considered known-bad
 */
export function loadKnownBadCifs({ forceRebuild = false, codDir } = {}) {
    if (!forceRebuild && existsSync(CACHE_FILE)) {
        return new Set(readFileSync(CACHE_FILE, 'utf8').trim().split('\n').filter(Boolean));
    }
    return buildKnownBadCifs(codDir);
}

/**
 * @param {string[]} filePaths - Absolute or relative CIF file paths
 * @param {object} [options] - Options forwarded to loadKnownBadCifs
 * @returns {string[]} `filePaths` with known-bad entries removed
 */
export function filterKnownBad(filePaths, options) {
    const knownBad = loadKnownBadCifs(options);
    return filePaths.filter(p => !knownBad.has(p.split('/').pop()));
}
