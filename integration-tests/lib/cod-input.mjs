import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import {
    seededRandom,
    stratifiedSizeSample,
    walkCifFiles,
} from '../../benchmark/lib/cod-sample.mjs';

export const DEFAULT_COD_SAMPLE_SIZE = 1000;
export const DEFAULT_COD_SAMPLE_SEED = 20260902;

/**
 * Resolves a CIF, directory, or newline-delimited file manifest.
 * Relative manifest entries are resolved from the manifest's directory.
 * @param {string} target - Input CIF, directory, or manifest path
 * @returns {{kind:'cif'|'directory'|'manifest', target:string,
 *   files:Array<{path:string,sizeBytes:number}>}} Resolved input
 */
export function resolveCodInput(target) {
    const absoluteTarget = resolve(target);
    if (!existsSync(absoluteTarget)) {
        throw new Error(`COD input does not exist: ${absoluteTarget}`);
    }

    const targetStat = statSync(absoluteTarget);
    if (targetStat.isDirectory()) {
        return {
            kind: 'directory',
            target: absoluteTarget,
            files: [...walkCifFiles(absoluteTarget)]
                .sort((first, second) => first.path.localeCompare(second.path)),
        };
    }

    if (extname(absoluteTarget).toLowerCase() === '.cif') {
        return {
            kind: 'cif',
            target: absoluteTarget,
            files: [{ path: absoluteTarget, sizeBytes: targetStat.size }],
        };
    }

    const baseDirectory = dirname(absoluteTarget);
    const files = readFileSync(absoluteTarget, 'utf8').split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('\t')[0])
        .map(filePath => resolve(baseDirectory, filePath))
        .map(filePath => {
            if (!existsSync(filePath) || !statSync(filePath).isFile()) {
                throw new Error(`CIF listed in ${absoluteTarget} does not exist: ${filePath}`);
            }
            if (extname(filePath).toLowerCase() !== '.cif') {
                throw new Error(`Manifest entry is not a CIF file: ${filePath}`);
            }
            return { path: filePath, sizeBytes: statSync(filePath).size };
        });

    return { kind: 'manifest', target: absoluteTarget, files };
}

/**
 * Selects a deterministic file-size-stratified subset.
 * @param {Array<{path:string,sizeBytes:number}>} files - Eligible population
 * @param {object} [options] - Selection options
 * @param {boolean} [options.full] - Select the complete population
 * @param {number} [options.sampleSize] - Requested sample size
 * @param {number} [options.seed] - Deterministic random seed
 * @returns {Array<{path:string,sizeBytes:number}>} Selected files
 */
export function selectCodFiles(files, {
    full = false,
    sampleSize = DEFAULT_COD_SAMPLE_SIZE,
    seed = DEFAULT_COD_SAMPLE_SEED,
} = {}) {
    if (full || files.length <= sampleSize) {
        return [...files];
    }
    return stratifiedSizeSample(files, sampleSize, seededRandom(seed)).files
        .map(({ path, sizeBytes }) => ({ path, sizeBytes }));
}
