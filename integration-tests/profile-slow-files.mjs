// Finds which individual CIF file(s) within a given global file-index range are
// responsible for that range being slow in test-structure-modifiers.mjs. Reuses the
// exact same file discovery/filtering/ordering so a given [start,end) targets the same
// files the real run processed, then times CIF parsing, structure creation, and every
// individual Hydrogen x Disorder x Symmetry modifier combination, printing anything
// slow as soon as it happens (not just at the end) so this is useful to watch live.
import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import {
    CIF, CrystalStructure, tryToFixCifBlock,
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/index.nobrowser.js';
import { filterKnownBad } from './lib/known-bad-cifs.mjs';

const SLOW_THRESHOLD_MS = 1000;

/**
 * @param {string} dir - Directory to search recursively
 * @returns {Promise<string[]>} All .cif file paths under dir
 */
async function findCIFFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            return findCIFFiles(fullPath);
        } else if (entry.name.toLowerCase().endsWith('.cif')) {
            return [fullPath];
        }
        return [];
    }));
    return files.flat();
}

/**
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration
 */
function formatMs(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Times a single CIF file through the same pipeline test-structure-modifiers.mjs uses,
 * logging any phase that exceeds SLOW_THRESHOLD_MS as soon as it's measured.
 * @param {string} filePath - CIF file to test
 * @param {number} globalIndex - This file's index in the full sorted file list, for context
 * @returns {{filePath: string, totalMs: number, phases: Array<{label: string, ms: number}>}} Timing summary
 */
function profileFile(filePath, globalIndex) {
    const phases = [];
    const fileStart = performance.now();
    const time = (label, fn) => {
        const t0 = performance.now();
        let result;
        let threw = null;
        try {
            result = fn();
        } catch (error) {
            threw = error;
        }
        const ms = performance.now() - t0;
        phases.push({ label, ms });
        if (ms > SLOW_THRESHOLD_MS) {
            console.log(
                `  [${globalIndex}] SLOW ${formatMs(ms)} - ${label} (${filePath})`
                + (threw ? ` -- threw: ${threw.message.slice(0, 120)}` : ''),
            );
        }
        if (threw) {
            throw threw;
        }
        return result;
    };

    try {
        const fileContent = time('read file', () => readFileSync(filePath, 'utf8'));
        const cif = time('parse CIF', () => new CIF(fileContent));
        const block = cif.getBlock(0);
        if (!block || !block.dataBlockName) {
            return { filePath, totalMs: performance.now() - fileStart, phases };
        }

        let baseStructure;
        try {
            baseStructure = time('CrystalStructure.fromCIF', () => CrystalStructure.fromCIF(block));
        } catch {
            try {
                time('tryToFixCifBlock', () => tryToFixCifBlock(block, true, true, true));
                baseStructure = time('CrystalStructure.fromCIF (fixed)', () => CrystalStructure.fromCIF(block));
            } catch {
                return { filePath, totalMs: performance.now() - fileStart, phases };
            }
        }

        const modifiers = {
            hydrogen: new HydrogenFilter(),
            disorder: new DisorderFilter(),
            symmetry: new SymmetryGrower(),
        };
        const applicableModes = {
            hydrogen: time('hydrogen.getApplicableModes', () => modifiers.hydrogen.getApplicableModes(baseStructure)),
            disorder: time('disorder.getApplicableModes', () => modifiers.disorder.getApplicableModes(baseStructure)),
            symmetry: time('symmetry.getApplicableModes', () => modifiers.symmetry.getApplicableModes(baseStructure)),
        };

        for (const hydrogenMode of applicableModes.hydrogen) {
            modifiers.hydrogen.mode = hydrogenMode;
            let hydrogenStructure;
            let hydrogenError;
            try {
                hydrogenStructure = time(
                    `hydrogen.apply(${hydrogenMode})`,
                    () => modifiers.hydrogen.apply(baseStructure),
                );
            } catch (error) {
                hydrogenError = error;
            }

            for (const disorderMode of applicableModes.disorder) {
                modifiers.disorder.mode = disorderMode;
                let filteredStructure;
                let filterError = hydrogenError;
                if (!filterError) {
                    try {
                        filteredStructure = time(
                            `disorder.apply(${disorderMode})`,
                            () => modifiers.disorder.apply(hydrogenStructure),
                        );
                    } catch (error) {
                        filterError = error;
                    }
                }

                for (const symmetryMode of applicableModes.symmetry) {
                    if (filterError) {
                        continue;
                    }
                    modifiers.symmetry.mode = symmetryMode;
                    try {
                        time(
                            `symmetry.apply(H=${hydrogenMode},D=${disorderMode},S=${symmetryMode})`,
                            () => modifiers.symmetry.apply(filteredStructure),
                        );
                    } catch {
                        // Errors are expected (e.g. framework structures) - only timing matters here.
                    }
                }
            }
        }
    } catch {
        // Parsing/structure failures are out of scope for this timing profile.
    }

    return { filePath, totalMs: performance.now() - fileStart, phases };
}

/**
 * Profiles files at [startIndex, endIndex) of the same sorted, known-bad-filtered file
 * list test-structure-modifiers.mjs uses, printing slow phases live and a final
 * slowest-files summary.
 */
async function main() {
    const codDir = process.argv[2] || './cod';
    const startIndex = parseInt(process.argv[3]) || 0;
    const endIndex = parseInt(process.argv[4]) || startIndex + 1000;

    const resolvedPath = resolve(codDir);
    console.log(`Finding CIF files in ${resolvedPath}...`);
    let files = await findCIFFiles(resolvedPath);
    files = filterKnownBad(files);
    files = files.slice(startIndex, endIndex);
    console.log(`Profiling ${files.length} files, global index ${startIndex}-${endIndex}\n`);

    const results = [];
    for (let i = 0; i < files.length; i++) {
        const result = profileFile(files[i], startIndex + i);
        results.push(result);
        if ((i + 1) % 100 === 0) {
            console.log(`... ${i + 1}/${files.length} done`);
        }
    }

    results.sort((a, b) => b.totalMs - a.totalMs);
    console.log('\n=== Slowest files ===');
    for (const r of results.slice(0, 20)) {
        console.log(`${formatMs(r.totalMs)}  ${r.filePath}`);
        const slowPhases = r.phases.filter(p => p.ms > SLOW_THRESHOLD_MS).sort((a, b) => b.ms - a.ms);
        for (const p of slowPhases.slice(0, 5)) {
            console.log(`    ${formatMs(p.ms)}  ${p.label}`);
        }
    }
}

main().catch(console.error);
