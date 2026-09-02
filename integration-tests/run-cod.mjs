#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_COD_SAMPLE_SEED,
    DEFAULT_COD_SAMPLE_SIZE,
    resolveCodInput,
    selectCodFiles,
} from './lib/cod-input.mjs';
import { buildKnownBadCifs } from './lib/known-bad-cifs.mjs';

const repositoryRoot = resolve(process.cwd());
const defaultOutputDirectory = join(repositoryRoot, 'integration-tests', 'logs');

/**
 * Parses the supported `test:cod` command line.
 * @param {string[]} argv - Arguments after `run-cod.mjs`
 * @param {Record<string,string|undefined>} [environment] - Environment providing COD_DIR
 * @returns {{target:string|null,full:boolean,sampleSize:number,seed:number,
 *   only:'both'|'modifiers'|'ortep',outputDirectory:string,pullProblems:boolean}}
 *   Validated command options
 */
export function parseCodArgs(argv, environment = process.env) {
    const options = {
        target: null,
        full: false,
        sampleSize: DEFAULT_COD_SAMPLE_SIZE,
        seed: DEFAULT_COD_SAMPLE_SEED,
        only: 'both',
        outputDirectory: defaultOutputDirectory,
        pullProblems: false,
    };
    let sampleProvided = false;

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--full') {
            options.full = true;
        } else if (argument === '--pull-problems') {
            options.pullProblems = true;
        } else if (['--sample', '--seed', '--only', '--out'].includes(argument)) {
            const value = argv[++index];
            if (!value || value.startsWith('--')) {
                throw new Error(`${argument} requires a value`);
            }
            if (argument === '--sample') {
                options.sampleSize = positiveInteger(value, '--sample');
                sampleProvided = true;
            } else if (argument === '--seed') {
                options.seed = integer(value, '--seed');
            } else if (argument === '--only') {
                if (!['modifiers', 'ortep'].includes(value)) {
                    throw new Error('--only must be "modifiers" or "ortep"');
                }
                options.only = value;
            } else {
                options.outputDirectory = resolve(value);
            }
        } else if (argument.startsWith('--')) {
            throw new Error(`Unknown option: ${argument}`);
        } else if (options.target) {
            throw new Error(`Unexpected second input: ${argument}`);
        } else {
            options.target = resolve(argument);
        }
    }

    if (options.full && sampleProvided) {
        throw new Error('--full and --sample cannot be used together');
    }
    options.target ||= environment.COD_DIR ? resolve(environment.COD_DIR) : null;
    if (!options.target && !options.pullProblems) {
        throw new Error(
            'No COD input supplied. Use `npm run test:cod -- /path/to/cod` '
            + 'or set COD_DIR=/path/to/cod.',
        );
    }
    return options;
}

/**
 * Resolves, filters, and selects the exact files shared by both COD stages.
 * @param {ReturnType<typeof parseCodArgs>} options - Parsed CLI options
 * @returns {{manifestPath:string,metadataPath:string,metadata:object}} Prepared run
 */
export function prepareCodRun(options) {
    mkdirSync(options.outputDirectory, { recursive: true });
    const input = resolveCodInput(options.target);
    const populationSize = input.files.length;
    let eligibleFiles = input.files;
    let excludedKnownBad = 0;
    const knownBadCache = join(options.outputDirectory, 'known-bad-cifs.txt');

    if (input.kind === 'directory') {
        const knownBad = buildKnownBadCifs(input.target, { cacheFile: knownBadCache });
        eligibleFiles = input.files.filter(file => !knownBad.has(basename(file.path)));
        excludedKnownBad = populationSize - eligibleFiles.length;
    }

    const selectedFiles = input.kind === 'directory'
        ? selectCodFiles(eligibleFiles, options)
        : eligibleFiles;
    if (selectedFiles.length === 0) {
        throw new Error(`No eligible CIF files found in ${input.target}`);
    }

    const manifestPath = join(options.outputDirectory, 'cod-manifest.txt');
    writeFileSync(manifestPath, `${selectedFiles.map(file => file.path).join('\n')}\n`);
    const metadataPath = join(options.outputDirectory, 'cod-run.json');
    const metadata = {
        version: 1,
        status: 'prepared',
        startedAt: new Date().toISOString(),
        completedAt: null,
        gitRevision: gitRevision(),
        input: {
            target: input.target,
            kind: input.kind,
            populationSize,
            excludedKnownBad,
            eligibleCount: eligibleFiles.length,
        },
        selection: {
            mode: input.kind === 'directory' ? (options.full ? 'full' : 'sample') : 'exact',
            sampleSize: input.kind === 'directory' && !options.full ? options.sampleSize : null,
            seed: input.kind === 'directory' && !options.full ? options.seed : null,
            selectedCount: selectedFiles.length,
            skippedCount: populationSize - selectedFiles.length,
            paths: selectedFiles.map(file => file.path),
            manifest: manifestPath,
        },
        stages: {
            modifiers: { status: options.only === 'ortep' ? 'not-requested' : 'pending' },
            ortep: { status: options.only === 'modifiers' ? 'not-requested' : 'pending' },
        },
        outputDirectory: options.outputDirectory,
    };
    writeMetadata(metadataPath, metadata);
    return { manifestPath, metadataPath, metadata };
}

/**
 * Runs the requested COD stages and validates their accounting artifacts.
 * Per-structure findings are reported but deliberately do not reject the run.
 * @param {ReturnType<typeof parseCodArgs>} options - Parsed CLI options
 * @param {object} [dependencies] - Injectable process runner for tests
 * @param {(command:string,args:string[],options:object)=>Promise<void>} [dependencies.execute]
 *   Child-process implementation
 * @returns {Promise<object>} Completed run metadata
 */
export async function runCod(options, { execute = executeCommand } = {}) {
    if (!options.target) {
        await pullProblemCifs(options.outputDirectory, execute);
        const problemCifs = join(options.outputDirectory, 'problem_cifs');
        console.log(`Problem CIFs: ${problemCifs}`);
        return { status: 'problems-collected', outputDirectory: options.outputDirectory, problemCifs };
    }

    const prepared = prepareCodRun(options);
    const { manifestPath, metadataPath, metadata } = prepared;
    const childOptions = {
        cwd: repositoryRoot,
        env: {
            ...process.env,
            CIFVIS_INTEGRATION_LOG_DIR: options.outputDirectory,
            CIFVIS_KNOWN_BAD_CACHE_FILE: join(options.outputDirectory, 'known-bad-cifs.txt'),
        },
    };

    try {
        metadata.status = 'running';
        writeMetadata(metadataPath, metadata);

        if (options.only !== 'ortep') {
            metadata.stages.modifiers.status = 'running';
            writeMetadata(metadataPath, metadata);
            clearArtifacts([
                join(options.outputDirectory, 'modifier-test-stats.json'),
                join(options.outputDirectory, 'modifier-test-summary.log'),
                join(options.outputDirectory, 'modifier-test-errors.log'),
                join(options.outputDirectory, 'modifier-test-bond-consistency.log'),
            ]);
            await execute('bash', ['integration-tests/run-modifiers-tests-parallel.sh', manifestPath], childOptions);
            metadata.stages.modifiers = validateModifierResults(
                options.outputDirectory,
                metadata.selection.selectedCount,
            );
            writeMetadata(metadataPath, metadata);
        }

        if (options.only !== 'modifiers') {
            metadata.stages.ortep.status = 'running';
            writeMetadata(metadataPath, metadata);
            clearArtifacts([
                join(options.outputDirectory, 'final-ortep-summary.log'),
                join(options.outputDirectory, 'final-ortep-errors.log'),
            ]);
            await execute('bash', ['integration-tests/run-ortep-tests-chunked.sh', manifestPath], childOptions);
            metadata.stages.ortep = validateOrtepResults(
                options.outputDirectory,
                metadata.selection.selectedCount,
            );
            writeMetadata(metadataPath, metadata);
        }

        if (options.pullProblems) {
            await pullProblemCifs(options.outputDirectory, execute, childOptions);
            metadata.problemCifs = join(options.outputDirectory, 'problem_cifs');
        }

        metadata.status = 'completed';
        metadata.completedAt = new Date().toISOString();
        writeMetadata(metadataPath, metadata);
        printSummary(metadata);
        return metadata;
    } catch (error) {
        for (const stage of Object.values(metadata.stages)) {
            if (stage.status === 'running') {
                stage.status = 'failed';
                stage.error = error instanceof Error ? error.message : String(error);
            }
        }
        metadata.status = 'failed';
        metadata.completedAt = new Date().toISOString();
        metadata.error = error instanceof Error ? error.message : String(error);
        writeMetadata(metadataPath, metadata);
        throw error;
    }
}

/**
 * CLI entry point.
 * @param {string[]} [argv] - CLI arguments
 * @param {Record<string,string|undefined>} [environment] - Process environment
 * @returns {Promise<void>}
 */
export async function main(argv = process.argv.slice(2), environment = process.env) {
    const options = parseCodArgs(argv, environment);
    await runCod(options);
}

/**
 * @param {string} value - CLI value
 * @param {string} option - Option name for errors
 * @returns {number} Parsed positive integer
 */
function positiveInteger(value, option) {
    const parsed = integer(value, option);
    if (parsed <= 0) {
        throw new Error(`${option} must be a positive integer`);
    }
    return parsed;
}

/**
 * @param {string} value - CLI value
 * @param {string} option - Option name for errors
 * @returns {number} Parsed integer
 */
function integer(value, option) {
    if (!/^-?\d+$/.test(value)) {
        throw new Error(`${option} must be an integer`);
    }
    return Number.parseInt(value, 10);
}

/** @returns {string|null} Current Git revision when available. */
function gitRevision() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

/**
 * @param {string} path - Metadata destination
 * @param {object} metadata - Serializable run metadata
 */
function writeMetadata(path, metadata) {
    writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

/**
 * @param {string} outputDirectory - Run artifact directory
 * @param {number} selectedCount - Expected processed count
 * @returns {object} Normalized modifier-stage summary
 */
function validateModifierResults(outputDirectory, selectedCount) {
    const statsPath = join(outputDirectory, 'modifier-test-stats.json');
    requireArtifacts('Modifier stage', [
        statsPath,
        join(outputDirectory, 'modifier-test-summary.log'),
        join(outputDirectory, 'modifier-test-errors.log'),
        join(outputDirectory, 'modifier-test-bond-consistency.log'),
    ]);
    const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
    if (stats.totalFiles !== selectedCount) {
        throw new Error(`Modifier accounting mismatch: selected ${selectedCount}, processed ${stats.totalFiles}`);
    }
    const accounted = stats.successfulStructure + stats.errors.CIF
        + stats.errors.CrystalStructureFixed.total;
    if (accounted !== stats.totalFiles) {
        throw new Error(`Modifier accounting mismatch: processed ${stats.totalFiles}, accounted ${accounted}`);
    }
    return {
        status: 'completed',
        processed: stats.totalFiles,
        cifFailures: stats.errors.CIF,
        structureFailures: stats.errors.CrystalStructureFixed.total,
        modifierFindings: stats.errors.modifier,
        connectivityFindings: stats.errors.connectivity,
        bondConsistencyFindings: stats.bondConsistency?.soundBasis?.runsWithInconsistentBonds ?? 0,
        slowFiles: stats.timing?.slowFiles ?? 0,
        summary: join(outputDirectory, 'modifier-test-summary.log'),
    };
}

/**
 * @param {string} outputDirectory - Run artifact directory
 * @param {number} selectedCount - Expected processed count
 * @returns {object} Normalized ORTEP-stage summary
 */
function validateOrtepResults(outputDirectory, selectedCount) {
    const summaryPath = join(outputDirectory, 'final-ortep-summary.log');
    requireArtifacts('ORTEP stage', [
        summaryPath,
        join(outputDirectory, 'final-ortep-errors.log'),
    ]);
    const summary = readFileSync(summaryPath, 'utf8');
    const value = label => Number.parseInt(summary.match(new RegExp(`${label}: (\\d+)`))?.[1] ?? '', 10);
    const processed = value('Total files processed');
    if (processed !== selectedCount) {
        throw new Error(`ORTEP accounting mismatch: selected ${selectedCount}, processed ${processed}`);
    }
    const structureFailures = value('Structure errors');
    const ortepFindings = value('ORTEP creation errors');
    const nanFindings = value('Structures with NaN values');
    if ([structureFailures, ortepFindings, nanFindings].some(Number.isNaN)) {
        throw new Error(`Malformed ORTEP summary: ${summaryPath}`);
    }
    return {
        status: 'completed',
        processed,
        structureFailures,
        ortepFindings,
        nanFindings,
        summary: summaryPath,
        errors: join(outputDirectory, 'final-ortep-errors.log'),
    };
}

/** @param {string[]} paths - Exact stale artifacts to remove before a stage. */
function clearArtifacts(paths) {
    for (const path of paths) {
        rmSync(path, { force: true });
    }
}

/**
 * @param {string} producer - Artifact producer named in errors
 * @param {string[]} paths - Required file paths
 */
function requireArtifacts(producer, paths) {
    const missing = paths.filter(path => !existsSync(path));
    if (missing.length > 0) {
        throw new Error(`${producer} did not produce ${missing.join(', ')}`);
    }
}

/**
 * @param {string} outputDirectory - Run artifact directory
 * @param {(command:string,args:string[],options:object)=>Promise<void>} execute - Process runner
 * @param {object} [childOptions] - Child process options
 * @returns {Promise<void>}
 */
async function pullProblemCifs(outputDirectory, execute, childOptions = {}) {
    await execute(
        'bash',
        ['integration-tests/collect-problem-structures.sh', outputDirectory],
        { cwd: repositoryRoot, env: process.env, ...childOptions },
    );
}

/**
 * @param {string} command - Executable name
 * @param {string[]} args - Executable arguments
 * @param {object} options - Child process options
 * @returns {Promise<void>}
 */
function executeCommand(command, args, options) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, { ...options, stdio: 'inherit' });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            if (code === 0) {
                resolvePromise();
            } else {
                const failure = signal ? `with signal ${signal}` : `with exit code ${code}`;
                reject(new Error(
                    `${command} ${args.join(' ')} failed ${failure}`,
                ));
            }
        });
    });
}

/** @param {object} metadata - Completed COD run metadata. */
function printSummary(metadata) {
    console.log('\nCOD correctness run complete');
    console.log(`  Population: ${metadata.input.populationSize}`);
    console.log(`  Selected: ${metadata.selection.selectedCount}`);
    console.log(`  Skipped: ${metadata.selection.skippedCount}`);
    console.log(`  Excluded known-bad: ${metadata.input.excludedKnownBad}`);
    if (metadata.stages.modifiers.status === 'completed') {
        const stage = metadata.stages.modifiers;
        console.log(`  Modifier files processed: ${stage.processed}`);
        console.log(`  Modifier findings: ${stage.modifierFindings}`);
        console.log(`  Connectivity findings: ${stage.connectivityFindings}`);
        console.log(`  Bond consistency findings: ${stage.bondConsistencyFindings}`);
        console.log(`  Slow cases: ${stage.slowFiles}`);
        console.log(`  Modifier summary: ${stage.summary}`);
    }
    if (metadata.stages.ortep.status === 'completed') {
        const stage = metadata.stages.ortep;
        console.log(`  ORTEP files processed: ${stage.processed}`);
        console.log(`  ORTEP findings: ${stage.ortepFindings}`);
        console.log(`  NaN findings: ${stage.nanFindings}`);
        console.log(`  ORTEP summary: ${stage.summary}`);
    }
    if (metadata.problemCifs) {
        console.log(`  Problem CIFs: ${metadata.problemCifs}`);
    }
    console.log(`  Run metadata: ${join(metadata.outputDirectory, 'cod-run.json')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
