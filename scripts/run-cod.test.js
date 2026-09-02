/**
 * @vi-environment node
 */

import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import {
    parseCodArgs,
    prepareCodRun,
    runCod,
} from '../integration-tests/run-cod.mjs';
import {
    resolveCodInput,
    selectCodFiles,
} from '../integration-tests/lib/cod-input.mjs';

/** @returns {string} New isolated test directory. */
function temporaryDirectory() {
    return mkdtempSync(join(tmpdir(), 'cifvis-cod-test-'));
}

/**
 * @param {string} directory - Parent directory
 * @param {string} name - CIF filename
 * @param {string} [padding] - Content used to vary file size
 * @returns {string} Written CIF path
 */
function writeCif(directory, name, padding = '') {
    const path = join(directory, name);
    writeFileSync(path, `data_${name}\n${padding}`);
    return path;
}

describe('COD command interface', () => {
    test('uses deterministic defaults and COD_DIR fallback', () => {
        const options = parseCodArgs([], { COD_DIR: '/tmp/example-cod' });
        expect(options).toMatchObject({
            target: '/tmp/example-cod',
            full: false,
            sampleSize: 1000,
            seed: 20260902,
            only: 'both',
            pullProblems: false,
        });
    });

    test('validates missing inputs and incompatible options', () => {
        expect(() => parseCodArgs([], {})).toThrow('No COD input supplied');
        expect(() => parseCodArgs(['/tmp/cod', '--full', '--sample', '10']))
            .toThrow('--full and --sample cannot be used together');
        expect(() => parseCodArgs(['/tmp/cod', '--only', 'density']))
            .toThrow('--only must be "modifiers" or "ortep"');
        expect(() => parseCodArgs(['/tmp/cod', '--sample', '0']))
            .toThrow('--sample must be a positive integer');
    });

    test('resolves CIF, directory, and relative manifest inputs', () => {
        const directory = temporaryDirectory();
        const first = writeCif(directory, 'first.cif');
        const nested = join(directory, 'nested');
        mkdirSync(nested);
        const second = writeCif(nested, 'second.cif');
        const manifest = join(directory, 'files.txt');
        writeFileSync(manifest, '# exact cases\nfirst.cif\nnested/second.cif\n');

        expect(resolveCodInput(first).files.map(file => file.path)).toEqual([first]);
        expect(resolveCodInput(directory).files.map(file => file.path)).toEqual([first, second]);
        expect(resolveCodInput(manifest).files.map(file => file.path)).toEqual([first, second]);
    });

    test('selects a stable size-stratified sample', () => {
        const files = Array.from({ length: 40 }, (_, index) => ({
            path: `/cod/${index}.cif`,
            sizeBytes: index + 1,
        }));
        const first = selectCodFiles(files, { sampleSize: 8, seed: 20260902 });
        const repeated = selectCodFiles(files, { sampleSize: 8, seed: 20260902 });
        const anotherSeed = selectCodFiles(files, { sampleSize: 8, seed: 7 });
        expect(repeated).toEqual(first);
        expect(anotherSeed).not.toEqual(first);
        expect(first).toHaveLength(8);
        expect(selectCodFiles(files, { full: true })).toEqual(files);
    });

    test('writes one reproducible manifest and run metadata file', () => {
        const directory = temporaryDirectory();
        for (let index = 0; index < 12; index++) {
            writeCif(directory, `${index}.cif`, 'x'.repeat(index));
        }
        const outputDirectory = join(directory, 'results');
        const options = parseCodArgs([
            directory, '--sample', '5', '--seed', '17', '--out', outputDirectory,
        ]);
        const prepared = prepareCodRun(options);
        const manifest = readFileSync(prepared.manifestPath, 'utf8').trim().split('\n');
        const metadata = JSON.parse(readFileSync(prepared.metadataPath, 'utf8'));

        expect(manifest).toHaveLength(5);
        expect(metadata.selection).toMatchObject({
            mode: 'sample',
            sampleSize: 5,
            seed: 17,
            selectedCount: 5,
        });
        expect(metadata.input).toMatchObject({
            kind: 'directory',
            populationSize: 12,
            excludedKnownBad: 0,
        });
    });

    test('rebuilds and applies COD manual-check exclusions before sampling', () => {
        const directory = temporaryDirectory();
        const good = writeCif(directory, '1000001.cif');
        writeCif(directory, '1000002.cif');
        const manualChecks = join(directory, 'manual-checks');
        mkdirSync(manualChecks);
        writeFileSync(
            join(manualChecks, 'duplicates.lst'),
            'Known duplicate: 1000002.cif\n',
        );
        const outputDirectory = join(directory, 'results');
        const prepared = prepareCodRun(parseCodArgs([directory, '--out', outputDirectory]));
        const manifest = readFileSync(prepared.manifestPath, 'utf8').trim().split('\n');

        expect(manifest).toEqual([good]);
        expect(prepared.metadata.input).toMatchObject({
            populationSize: 2,
            eligibleCount: 1,
            excludedKnownBad: 1,
        });
        expect(readFileSync(join(outputDirectory, 'known-bad-cifs.txt'), 'utf8'))
            .toContain('1000002.cif');
    });

    test('collects problems from an existing output without starting a run', async () => {
        const outputDirectory = temporaryDirectory();
        const options = parseCodArgs(['--pull-problems', '--out', outputDirectory], {});
        const calls = [];
        const execute = async (command, args) => calls.push([command, args]);

        const result = await runCod(options, { execute });

        expect(result.status).toBe('problems-collected');
        expect(calls).toEqual([[
            'bash',
            ['integration-tests/collect-problem-structures.sh', outputDirectory],
        ]]);
    });

    test('marks accounting failures as fatal while findings remain report data', async () => {
        const directory = temporaryDirectory();
        const cif = writeCif(directory, 'one.cif');
        const outputDirectory = join(directory, 'results');
        const options = parseCodArgs([cif, '--only', 'modifiers', '--out', outputDirectory]);
        const execute = async (_command, args) => {
            if (args[0].endsWith('run-modifiers-tests-parallel.sh')) {
                writeFileSync(join(outputDirectory, 'modifier-test-stats.json'), JSON.stringify({
                    totalFiles: 1,
                    successfulStructure: 0,
                    errors: {
                        CIF: 0,
                        CrystalStructureFixed: { total: 0 },
                        modifier: 4,
                        connectivity: 2,
                    },
                    timing: { slowFiles: 1 },
                    bondConsistency: { soundBasis: { runsWithInconsistentBonds: 3 } },
                }));
                writeFileSync(join(outputDirectory, 'modifier-test-summary.log'), 'summary');
            }
        };

        await expect(runCod(options, { execute })).rejects.toThrow('Modifier accounting mismatch');
        const metadata = JSON.parse(readFileSync(join(outputDirectory, 'cod-run.json'), 'utf8'));
        expect(metadata.status).toBe('failed');
    });

    test('rejects a stage that exits without its required artifacts', async () => {
        const directory = temporaryDirectory();
        const cif = writeCif(directory, 'one.cif');
        const outputDirectory = join(directory, 'results');
        const options = parseCodArgs([cif, '--only', 'ortep', '--out', outputDirectory]);

        await expect(runCod(options, { execute: async () => {} }))
            .rejects.toThrow('ORTEP stage did not produce');
        const metadata = JSON.parse(readFileSync(join(outputDirectory, 'cod-run.json'), 'utf8'));
        expect(metadata).toMatchObject({
            status: 'failed',
            stages: { ortep: { status: 'failed' } },
        });
    });

    test('keeps per-structure findings report-only', async () => {
        const directory = temporaryDirectory();
        const cif = writeCif(directory, 'one.cif');
        const outputDirectory = join(directory, 'results');
        const options = parseCodArgs([cif, '--only', 'modifiers', '--out', outputDirectory]);
        const execute = async (_command, args) => {
            if (args[0].endsWith('run-modifiers-tests-parallel.sh')) {
                writeFileSync(join(outputDirectory, 'modifier-test-stats.json'), JSON.stringify({
                    totalFiles: 1,
                    successfulStructure: 1,
                    errors: {
                        CIF: 0,
                        CrystalStructureFixed: { total: 0 },
                        modifier: 4,
                        connectivity: 2,
                    },
                    timing: { slowFiles: 1 },
                    bondConsistency: { soundBasis: { runsWithInconsistentBonds: 3 } },
                }));
                writeFileSync(join(outputDirectory, 'modifier-test-summary.log'), 'summary');
            } else if (args[0].endsWith('generate-cod-report.mjs')) {
                writeFileSync(join(outputDirectory, 'cod-data-quality-report.md'), 'report');
                writeFileSync(join(outputDirectory, 'cod-data-quality-report.csv'), 'report');
                writeFileSync(join(outputDirectory, 'cod-maintainer-issues.json'), '{}');
            }
        };

        const metadata = await runCod(options, { execute });
        expect(metadata.status).toBe('completed');
        expect(metadata.stages.modifiers).toMatchObject({
            modifierFindings: 4,
            connectivityFindings: 2,
            bondConsistencyFindings: 3,
        });
    });

    test('runs both existing engines and problem collection on one CIF', () => {
        const outputDirectory = temporaryDirectory();
        const cif = resolve('docs/public/cif/urea.cif');
        const result = spawnSync(process.execPath, [
            'integration-tests/run-cod.mjs', cif,
            '--out', outputDirectory,
            '--pull-problems',
        ], {
            cwd: resolve('.'),
            encoding: 'utf8',
            timeout: 60000,
        });
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
        const metadata = JSON.parse(readFileSync(join(outputDirectory, 'cod-run.json'), 'utf8'));
        expect(metadata.status).toBe('completed');
        expect(metadata.stages.modifiers.processed).toBe(1);
        expect(metadata.stages.ortep.processed).toBe(1);
        expect(existsSync(join(outputDirectory, 'modifier-test-summary.log'))).toBe(true);
        expect(existsSync(join(outputDirectory, 'final-ortep-summary.log'))).toBe(true);
        expect(existsSync(join(outputDirectory, 'cod-data-quality-report.md'))).toBe(true);
        expect(existsSync(join(outputDirectory, 'problem_cifs'))).toBe(true);
    }, 70000);
});
