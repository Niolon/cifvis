// Shared COD sampling helpers, used by analysis/density-pipeline-cod.mjs,
// analysis/mode-matrix.mjs, and analysis/regression-recheck.mjs so the three
// benchmark tracks draw from the population the same way instead of each
// re-implementing its own stratification.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { CIF } from '../../src/lib/read-cif/base.js';
import { tryToFixCifBlock } from '../../src/lib/fix-cif/base.js';
import { Atom, CrystalStructure, UnitCell } from '../../src/lib/structure/crystal.js';
import { CellSymmetry } from '../../src/lib/structure/cell-symmetry.js';

/**
 * Deterministic LCG PRNG, matching analysis/density-pipeline-cod.mjs's original
 * generator so existing seeds/results stay reproducible.
 * @param {number} seed - Integer seed
 * @returns {() => number} Generator returning floats in [0, 1)
 */
export function seededRandom(seed) {
    let state = Math.trunc(seed) >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
}

/**
 * Recursively walks a COD checkout directory, skipping COD's own
 * non-structure-data subdirectories (dictionaries, logs, checks, etc.).
 * @param {string} directory - Root directory to walk
 * @yields {{path: string, sizeBytes: number}} Every .cif file found
 */
export function *walkCifFiles(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (['dictionaries', 'logs', 'external-logs', 'manual-checks', 'checks', 'bin', 'doc']
            .includes(entry.name)) {
            continue;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            yield *walkCifFiles(path);
        } else if (extname(entry.name).toLowerCase() === '.cif') {
            yield { path, sizeBytes: statSync(path).size };
        }
    }
}

/**
 * Draws one random file per equal-count file-size stratum - cheap,
 * reproducible coverage across the whole size distribution.
 * @param {Iterable<{path: string, sizeBytes: number}>} files - Candidate files
 * @param {number} sampleSize - Number of strata/files to draw
 * @param {() => number} random - Uniform [0,1) generator
 * @returns {{files: Array<{path: string, sizeBytes: number, sizeQuantile: number}>,
 *   populationSize: number, fileSizeRangeBytes: [number, number]}} Sampled files and metadata
 */
export function stratifiedSizeSample(files, sampleSize, random) {
    const sorted = [...files].sort((first, second) =>
        first.sizeBytes - second.sizeBytes || first.path.localeCompare(second.path));
    const selectedCount = Math.min(sampleSize, sorted.length);
    const selected = [];
    for (let stratum = 0; stratum < selectedCount; stratum++) {
        const start = Math.floor(stratum * sorted.length / selectedCount);
        const end = Math.max(start + 1, Math.floor((stratum + 1) * sorted.length / selectedCount));
        const selectedIndex = start + Math.floor(random() * (end - start));
        selected.push({
            ...sorted[selectedIndex],
            sizeQuantile: (selectedIndex + 0.5) / sorted.length,
        });
    }
    for (let index = selected.length - 1; index > 0; index--) {
        const replacement = Math.floor(random() * (index + 1));
        [selected[index], selected[replacement]] = [selected[replacement], selected[index]];
    }
    return {
        files: selected,
        populationSize: sorted.length,
        fileSizeRangeBytes: sorted.length > 0
            ? [sorted[0].sizeBytes, sorted.at(-1).sizeBytes]
            : [0, 0],
    };
}

/**
 * Resolves a CLI target (single .cif, a file-list, or a directory) into a
 * stratified-by-size sample, matching analysis/density-pipeline-cod.mjs's original
 * resolution rules.
 * @param {string} target - .cif file, newline-delimited file-list, or directory
 * @param {number} sampleSize - Number of files to draw
 * @param {() => number} random - Uniform [0,1) generator
 * @returns {ReturnType<typeof stratifiedSizeSample>} Sampled files and metadata
 */
export function sampledFiles(target, sampleSize, random) {
    const path = resolve(target);
    if (!existsSync(path)) {
        throw new Error(`COD path does not exist: ${path}`);
    }
    if (statSync(path).isFile()) {
        if (extname(path).toLowerCase() === '.cif') {
            return stratifiedSizeSample([{ path, sizeBytes: statSync(path).size }], 1, random);
        }
        const listed = readFileSync(path, 'utf8').split(/\r?\n/).map(line => line.trim())
            .filter(line => line && !line.startsWith('#')).map(line => resolve(line))
            .map(file => ({ path: file, sizeBytes: statSync(file).size }));
        return stratifiedSizeSample(listed, sampleSize, random);
    }
    return stratifiedSizeSample(walkCifFiles(path), sampleSize, random);
}

/**
 * Recursively walks a COD hkl-mirror directory for .hkl reflection files
 * (same bucketed layout as the cif mirror: `<d1>/<d2><d3>/<id>.hkl`).
 * @param {string} directory - Root directory to walk
 * @yields {{path: string, sizeBytes: number}} Every .hkl file found
 */
export function *walkHklFiles(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            yield *walkHklFiles(path);
        } else if (extname(entry.name).toLowerCase() === '.hkl') {
            yield { path, sizeBytes: statSync(path).size };
        }
    }
}

/**
 * Builds a stratified-by-hkl-size sample restricted to COD ids that have
 * both a structure .cif (under cifDir) and a real reflection .hkl (under
 * hklDir) - i.e. the population usable for real-data (non-synthetic)
 * difference-density benchmarking. The two mirrors share the same bucketed
 * path layout, differing only in root and extension, so pairing is a
 * straight string swap plus an existence check.
 * @param {string} cifDir - Root of the COD cif/ mirror
 * @param {string} hklDir - Root of the COD hkl/ mirror
 * @param {number} sampleSize - Number of paired files to draw
 * @param {() => number} random - Uniform [0,1) generator
 * @returns {{files: Array<{path: string, hklPath: string, sizeBytes: number, sizeQuantile: number}>,
 *   populationSize: number, fileSizeRangeBytes: [number, number], candidatePopulationSize: number}}
 *   Sampled paired files and metadata (candidatePopulationSize is the .hkl count before cif-pairing)
 */
export function realDataSample(cifDir, hklDir, sampleSize, random) {
    const cifRoot = resolve(cifDir);
    const hklRoot = resolve(hklDir);
    let candidateCount = 0;
    const paired = [];
    for (const hklFile of walkHklFiles(hklRoot)) {
        candidateCount++;
        const cifPath = join(cifRoot, `${relativeSansExtension(hklRoot, hklFile.path)}.cif`);
        if (existsSync(cifPath)) {
            paired.push({ path: cifPath, hklPath: hklFile.path, sizeBytes: hklFile.sizeBytes });
        }
    }
    const sampled = stratifiedSizeSample(paired, sampleSize, random);
    return { ...sampled, candidatePopulationSize: candidateCount };
}

/**
 * @param {string} root - Directory the path is relative to
 * @param {string} path - Absolute path under root, with any extension
 * @returns {string} Path relative to root, with its extension stripped
 */
function relativeSansExtension(root, path) {
    const rel = path.slice(root.length + 1);
    return rel.slice(0, rel.length - extname(rel).length);
}

/**
 * Builds a CrystalStructure from an already-parsed CIF block, falling back
 * through the same repair chain the live viewer uses: try as-is, then
 * tryToFixCifBlock, then a manual atom_site.label-only reconstruction
 * (dropping unparsable "dummy atom" entries) as a last resort for badly
 * malformed real-world entries. Split from readCodStructure so callers that
 * need to time CIF-text-parsing and structure-building separately (e.g.
 * analysis/stage-profile.mjs) don't have to parse the same text twice.
 * @param {import('../../src/lib/read-cif/base.js').CifBlock} block - Already-parsed CIF block
 * @returns {CrystalStructure} The structure built from it
 */
export function buildCodStructure(block) {
    try {
        return CrystalStructure.fromCIF(block);
    } catch (originalError) {
        try {
            tryToFixCifBlock(block);
            return CrystalStructure.fromCIF(block);
        } catch (fixedError) {
            try {
                const atomSite = block.get('_atom_site');
                const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
                const atoms = labels.map((_, index) => {
                    try {
                        return Atom.fromCIF(block, index);
                    } catch (error) {
                        if (error.message.includes('Dummy atom')) {
                            return null;
                        }
                        throw error;
                    }
                }).filter(Boolean);
                return new CrystalStructure(
                    UnitCell.fromCIF(block),
                    atoms,
                    [],
                    [],
                    CellSymmetry.fromCIF(block),
                );
            } catch {
                throw fixedError.message ? fixedError : originalError;
            }
        }
    }
}

/**
 * Parses a COD CIF into a CrystalStructure - see buildCodStructure for the
 * repair-chain details.
 * @param {string} cifText - Raw CIF text
 * @returns {{block: import('../../src/lib/read-cif/base.js').CifBlock, structure: CrystalStructure}}
 *   The parsed block and the structure built from it
 */
export function readCodStructure(cifText) {
    const block = new CIF(cifText).getBlock(0);
    return { block, structure: buildCodStructure(block) };
}

/**
 * True if cifvis can build a structure with at least one atom from this
 * file. Filters out the atom-less bibliographic/cell-stub COD records that
 * are known to make other tooling (e.g. JSMol) hang instead of failing
 * fast - see analysis/build-switch-demo-sample.mjs for the original
 * finding.
 * @param {string} path - Absolute path to a .cif file
 * @returns {boolean} Whether the file parses to a non-empty structure
 */
export function isValidStructure(path) {
    try {
        const structure = CrystalStructure.fromCIF(new CIF(readFileSync(path, 'utf8')).getBlock(0));
        return structure.atoms.length > 0;
    } catch {
        return false;
    }
}
