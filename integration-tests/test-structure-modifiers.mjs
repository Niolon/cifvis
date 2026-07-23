import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    CIF, CrystalStructure, tryToFixCifBlock,
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/index.nobrowser.js';
import { filterKnownBad } from './lib/known-bad-cifs.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const logsDir = join(scriptDir, 'logs');
const chunkLogsDir = join(logsDir, 'modifiers-chunked');

/**
 * Generates the log filenames for a specific range of processed files. Used both for
 * a full (unranged) run, writing directly to the top-level log files, and for a single
 * chunk of a parallel run - see run-modifiers-tests-parallel.sh, which fans out several
 * of these processes concurrently, each covering a disjoint file range, then merges
 * their per-chunk outputs into the same top-level files aggregate-modifier-stats.mjs
 * produces.
 * @param {number} [startIndex] - The starting index of the file range (omit for a full run).
 * @param {number} [endIndex] - The ending index of the file range (omit for a full run).
 * @returns {object} Paths to the log, error, modifier, verbose, summary, and stats files.
 */
export function getLogFilenames(startIndex, endIndex) {
    if (startIndex === undefined && endIndex === undefined) {
        return {
            logFile: join(logsDir, 'modifier-test-results.log'),
            errorLogFile: join(logsDir, 'modifier-test-errors.log'),
            modifierLogFile: join(logsDir, 'modifier-test-modifiers.log'),
            verboseLogFile: join(logsDir, 'modifier-test-verbose.log'),
            summaryFile: join(logsDir, 'modifier-test-summary.log'),
            statsFile: join(logsDir, 'modifier-test-stats.json'),
        };
    }
    const rangeStr = `${startIndex}-${endIndex}`;
    return {
        logFile: join(chunkLogsDir, `modifier-test-results-${rangeStr}.log`),
        errorLogFile: join(chunkLogsDir, `modifier-test-errors-${rangeStr}.log`),
        modifierLogFile: join(chunkLogsDir, `modifier-test-modifiers-${rangeStr}.log`),
        verboseLogFile: join(chunkLogsDir, `modifier-test-verbose-${rangeStr}.log`),
        summaryFile: join(chunkLogsDir, `modifier-test-summary-${rangeStr}.log`),
        statsFile: join(chunkLogsDir, `modifier-test-stats-${rangeStr}.json`),
    };
}

let config = {
    ...getLogFilenames(),
    batchSize: 1000,
    interimReportFrequency: 5000, // Report every 1000 structures
};

const stats = {
    totalFiles: 0,
    successfulCIF: 0,
    successfulStructure: 0,
    errors: {
        CIF: 0,
        CrystalStructure: {
            total: 0,
            unitCellParameterMissing: 0,
            noValidAtoms: 0,
            placeholderCoordinates: 0, 
            uAniProblems: {
                total: 0,
                uAniTableMissing: 0,
                uAniAtomMissingInTable: 0,
            },
            bondProblems: {
                total: 0,
                missingBondAtom: 0,
                invalidBondSymmetry: 0,
                missingHBondAtom: 0,
                invalidHBondSymmetry: 0,
            },
            otherAndLogged: 0,
        },
        CrystalStructureFixed: {
            total: 0,
            unitCellParameterMissing: 0,
            uAniProblems: {
                total: 0,
                uAniTableMissing: 0,
                uAniAtomMissingInTable: 0,
            },
            bondProblems: {
                total: 0,
                missingBondAtom: 0,
                invalidBondSymmetry: 0,
                missingHBondAtom: 0,
                invalidHBondSymmetry: 0,
            },
            otherAndLogged: 0,
        },
        symmetry: 0,
        modifier: 0,
        connectivity: 0,
    },
};

const originalWarn = console.warn;
let suppressedWarnings = [];
console.warn = (...args) => {
    suppressedWarnings.push(args.join(' '));
};

const originalError = console.error;
let capturedErrors = [];
console.error = (...args) => {
    capturedErrors.push(args.join(' '));
};

/**
 * Writes a summary text to the specified file.
 * @param {string} summaryText - The summary text to be written to the file.
 * @param {string} filePath - The path to the file where the summary will be written.
 */
function writeSummaryToFile(summaryText, filePath) {
    try {
        appendFileSync(filePath, summaryText + '\n');
    } catch (error) {
        console.error(`Failed to write summary to ${filePath}:`, error);
    }
}

/**
 * Generates a summary of the testing process with statistics. Pure function of `stats`
 * so aggregate-modifier-stats.mjs can reuse it to format a merged multi-chunk summary
 * identically to a single-process run's.
 * @param {typeof stats} statsToReport - The statistics object to format.
 * @param {boolean} [isInterim] - Whether this is an interim or final summary.
 * @returns {string} The formatted summary text with statistics.
 */
export function generateSummary(statsToReport, isInterim = false) {
    const stats = statsToReport;
    const header = isInterim ? 'Interim CIF Testing Summary' : 'Final CIF Testing Summary';
    
    // Calculate percentage of unhandled structure errors
    const totalStructureErrors = stats.errors.CrystalStructure.total;
    const unhandledPercentage = totalStructureErrors === 0 ? '0.0' : (
        (stats.errors.CrystalStructure.otherAndLogged / totalStructureErrors) * 100
    ).toFixed(1);
    
    // Validate that our counts add up
    // Initial structure errors can be recovered by tryToFixCifBlock. Only errors that
    // persist after that attempt are terminal and belong in the file accounting total.
    const totalAccountedFor = stats.successfulStructure + stats.errors.CIF +
        stats.errors.CrystalStructureFixed.total;
    const accountingDiscrepancy = stats.totalFiles - totalAccountedFor;
    
    const summaryText = `
${header}
${'='.repeat(header.length)}
Total files processed: ${stats.totalFiles}
Successful CIF parsing: ${stats.successfulCIF} (${((stats.successfulCIF/stats.totalFiles)*100).toFixed(1)}%)
Successful structures: ${stats.successfulStructure} (${((stats.successfulStructure/stats.totalFiles)*100).toFixed(1)}%)
Modifier combination errors: ${stats.errors.modifier}

Accounting Validation:
Total files processed: ${stats.totalFiles}
Total accounted for: ${totalAccountedFor}
Discrepancy: ${accountingDiscrepancy}

Error Breakdown:
- CIF parsing errors: ${stats.errors.CIF}
- Structure creation errors: ${stats.errors.CrystalStructure.total}
  • Missing unit cell parameters: ${stats.errors.CrystalStructure.unitCellParameterMissing}
  • No valid atoms: ${stats.errors.CrystalStructure.noValidAtoms}
  • Placeholder coordinates only: ${stats.errors.CrystalStructure.placeholderCoordinates}
  • Anisotropic displacement problems: ${stats.errors.CrystalStructure.uAniProblems.total}
    - Missing Uani tables: ${stats.errors.CrystalStructure.uAniProblems.uAniTableMissing}
    - Missing atoms in Uani tables: ${stats.errors.CrystalStructure.uAniProblems.uAniAtomMissingInTable}
  • Bond problems: ${stats.errors.CrystalStructure.bondProblems.total}
    - Missing bond atoms: ${stats.errors.CrystalStructure.bondProblems.missingBondAtom}
    - Invalid bond symmetry: ${stats.errors.CrystalStructure.bondProblems.invalidBondSymmetry}
    - Missing H-bond atoms: ${stats.errors.CrystalStructure.bondProblems.missingHBondAtom}
    - Invalid H-bond symmetry: ${stats.errors.CrystalStructure.bondProblems.invalidHBondSymmetry}
  • Other errors (logged): ${stats.errors.CrystalStructure.otherAndLogged} (${unhandledPercentage}% of structure errors)
- Structure creation errors persisting after fix: ${stats.errors.CrystalStructureFixed.total}
  • Missing unit cell parameters: ${stats.errors.CrystalStructureFixed.unitCellParameterMissing}
  • Anisotropic displacement problems: ${stats.errors.CrystalStructureFixed.uAniProblems.total}
    - Missing Uani tables: ${stats.errors.CrystalStructureFixed.uAniProblems.uAniTableMissing}
    - Missing atoms in Uani tables: ${stats.errors.CrystalStructureFixed.uAniProblems.uAniAtomMissingInTable}
  • Bond problems: ${stats.errors.CrystalStructureFixed.bondProblems.total}
    - Missing bond atoms: ${stats.errors.CrystalStructureFixed.bondProblems.missingBondAtom}
    - Invalid bond symmetry: ${stats.errors.CrystalStructureFixed.bondProblems.invalidBondSymmetry}
    - Missing H-bond atoms: ${stats.errors.CrystalStructureFixed.bondProblems.missingHBondAtom}
    - Invalid H-bond symmetry: ${stats.errors.CrystalStructureFixed.bondProblems.invalidHBondSymmetry}
  • Other errors (logged): ${stats.errors.CrystalStructureFixed.otherAndLogged}
- Symmetry errors: ${stats.errors.symmetry}
- Connectivity errors (e.g. max iterations reached): ${stats.errors.connectivity}`;

    return summaryText;
}

/**
 * Logs a message with timestamp to the specified log file.
 * @param {string} message - The message to be logged.
 * @param {string} [filePath] - The path to the log file.
 */
function logMessage(message, filePath = config.logFile) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        appendFileSync(filePath, logEntry);
    } catch (error) {
        console.error(`Failed to write to log file ${filePath}:`, error);
    }
}

/**
 * Categorizes and records a structure error into appropriate statistics.
 * @param {string} errorMessage - The error message from the structure creation.
 * @param {boolean} fixed - Whether this error occurred in the fixed structure.
 * @param {boolean} [verbose] - Whether to log this error to the verbose log.
 */
function handleStructureError(errorMessage, fixed, verbose=false) {
    let crystalStructureErrors;
    if (fixed) {
        crystalStructureErrors = stats.errors.CrystalStructureFixed;
    } else {
        crystalStructureErrors = stats.errors.CrystalStructure;
    }
    let errorHandled = false;
    if (errorMessage.includes('Unit cell parameter entries missing in CIF')) {
        crystalStructureErrors.total++;
        crystalStructureErrors.unitCellParameterMissing++;
        errorHandled = true;
    }
    if (errorMessage === 'The cif file contains no valid atoms.') {
        crystalStructureErrors.total++;
        crystalStructureErrors.noValidAtoms++;
        errorHandled = true;
    }
    if (errorMessage.includes(', but no atom_site_aniso loop was found')) {
        crystalStructureErrors.total++;
        crystalStructureErrors.uAniProblems.total++;
        crystalStructureErrors.uAniProblems.uAniTableMissing++;
        errorHandled = true;
    }
    if (errorMessage.includes('but was not found in atom_site_aniso.label')) {
        crystalStructureErrors.total++;
        crystalStructureErrors.uAniProblems.total++;
        crystalStructureErrors.uAniProblems.uAniAtomMissingInTable++;
        errorHandled = true;
    }
    if (errorMessage.includes('There were errors in the bond or H-bond creation')) {
        crystalStructureErrors.total++;
        crystalStructureErrors.bondProblems.total++;
        errorHandled = true;
        if (errorMessage.includes('Non-existent atoms in bond')) {
            crystalStructureErrors.bondProblems.missingBondAtom++;
        }
        if (errorMessage.includes('Invalid symmetry in bond')) {
            crystalStructureErrors.bondProblems.invalidBondSymmetry++;
        }
        if (errorMessage.includes('Non-existent atoms in H-bond')) {
            crystalStructureErrors.bondProblems.missingHBondAtom++;
        }
        if (errorMessage.includes('Invalid symmetry in H-bond')) {
            crystalStructureErrors.bondProblems.invalidHBondSymmetry++;
        }
    }
    if (!errorHandled) {
        crystalStructureErrors.total++;
        crystalStructureErrors.otherAndLogged++;
        logMessage(errorMessage, config.errorLogFile);
    } else if (verbose) {
        logMessage(errorMessage, config.verboseLogFile);
    }
}

/**
 * Tests a CIF file by parsing it and applying various structure modifiers.
 * @param {string} filePath - The path to the CIF file to test.
 * @returns {object} Results object containing success flags, error information, and modifier errors.
 */
async function testCIFFile(filePath) {
    stats.totalFiles++;
    const fileContent = readFileSync(filePath, 'utf8');
    suppressedWarnings = [];
    capturedErrors = [];
    
    const results = {
        path: filePath,
        success: { CIF: false, structure: false },
        errors: [],
        modifierErrors: [],
    };

    try {
        const cif = new CIF(fileContent);
        const block = cif.getBlock(0);
        if (!block || !block.dataBlockName) {
            throw new Error('Empty or invalid CIF block'); 
        }
        
        results.success.CIF = true;
        stats.successfulCIF++;

        try {
            let baseStructure;
            try {
                baseStructure = CrystalStructure.fromCIF(block);
            } catch (error) {
                if (error.message === 'The cif file contains no valid atoms.') {
                    // Check if this is due to placeholder coordinates
                    const atomSite = block.get('_atom_site', false);
                    if (atomSite && atomSite.get(['_atom_site.fract_x', '_atom_site_fract_x'])
                        .every(val => val === '?')) {
                        stats.errors.CrystalStructure.total++;
                        stats.errors.CrystalStructureFixed.total++;
                        stats.errors.CrystalStructure.placeholderCoordinates++;
                        results.errors.push('Structure has only placeholder coordinates');
                        return results;
                    }
                    // Otherwise count as no valid atoms error
                    stats.errors.CrystalStructure.total++;
                    stats.errors.CrystalStructureFixed.total++;
                    stats.errors.CrystalStructure.noValidAtoms++;
                    results.errors.push(`Structure Error: ${error.message}`);
                    return results;
                }
                handleStructureError(`Structure Error in ${filePath}: ${error.message}`, false, false);
                results.errors.push(`Structure Error in unfixed Structure: ${error.message}`);
                try {
                    tryToFixCifBlock(block, true, true, true);
                    baseStructure = CrystalStructure.fromCIF(block);
                } catch (error2) {
                    handleStructureError(
                        `Structure Error in Fixed structure ${filePath}: ${error2.message}`,
                        true,
                        true,
                    );
                    results.errors.push(`Structure Error in fixed Structure: ${error2.message}`);
                    return results;
                }
            }

            // Test all modifier combinations
            const modifiers = {
                hydrogen: new HydrogenFilter(),
                disorder: new DisorderFilter(),
                symmetry: new SymmetryGrower(),
            };

            const applicableModes = {
                hydrogen: modifiers.hydrogen.getApplicableModes(baseStructure),
                disorder: modifiers.disorder.getApplicableModes(baseStructure),
                symmetry: modifiers.symmetry.getApplicableModes(baseStructure),
            };

            // Try each combination
            for (const hydrogenMode of applicableModes.hydrogen) {
                modifiers.hydrogen.mode = hydrogenMode;
                let hydrogenStructure;
                let hydrogenError;
                try {
                    hydrogenStructure = modifiers.hydrogen.apply(baseStructure);
                } catch (error) {
                    hydrogenError = error;
                }

                for (const disorderMode of applicableModes.disorder) {
                    modifiers.disorder.mode = disorderMode;
                    let filteredStructure;
                    let filterError = hydrogenError;
                    if (!filterError) {
                        try {
                            filteredStructure = modifiers.disorder.apply(hydrogenStructure);
                        } catch (error) {
                            filterError = error;
                        }
                    }

                    for (const symmetryMode of applicableModes.symmetry) {
                        try {
                            if (filterError) {
                                throw filterError;
                            }
                            modifiers.symmetry.mode = symmetryMode;
                            modifiers.symmetry.apply(filteredStructure);
                        } catch (error) {
                            logMessage(
                                `Modifier Error in ${filePath}:`
                                +` H=${hydrogenMode}, D=${disorderMode}, S=${symmetryMode}\n`
                                + `Error: ${error.message}`, config.errorLogFile,
                            );
                            stats.errors.modifier++;
                            results.modifierErrors.push({
                                modes: { hydrogenMode, disorderMode, symmetryMode },
                                error: error.message,
                            });
                        }
                    }
                }
            }

            results.success.structure = true;
            stats.successfulStructure++;

        } catch (error) {
            if (error.message === 'The cif file contains no valid atoms.') {
                const atomSite = block.get('_atom_site', false);
                if (atomSite && atomSite.get(['_atom_site.fract_x', '_atom_site_fract_x'])
                    .every(val => val === '?')) {
                    return results;
                }
            }
            logMessage(`CifParsing Error in ${filePath}: ${error.message}`, config.errorLogFile);
            results.errors.push(`Structure Error: ${error.message}`);
            stats.errors.CrystalStructure.total++;
        }
    } catch (error) {
        logMessage(`CIF Error in ${filePath}: ${error.message}`, config.errorLogFile);
        results.errors.push(`CIF Error: ${error.message}`);
        stats.errors.CIF++;
    }

    if (results.modifierErrors.length > 0) {
        const errorLog = `${filePath} modifier errors:\n` +
            results.modifierErrors.map(err =>
                `Modes: H=${err.modes.hydrogenMode}, D=${err.modes.disorderMode}, ` +
                `S=${err.modes.symmetryMode}\nError: ${err.error}`,
            ).join('\n---\n');
        logMessage(errorLog, config.modifierLogFile);
    }

    if (capturedErrors.length > 0) {
        stats.errors.connectivity += capturedErrors.length;
        capturedErrors.forEach(errMsg => {
            logMessage(`Connectivity Error in ${filePath}: ${errMsg}`, config.errorLogFile);
        });
    }

    // Check if we should generate an interim report
    if (stats.totalFiles % config.interimReportFrequency === 0) {
        const interimSummary = generateSummary(stats, true);
        console.log(interimSummary);
        ///writeSummaryToFile(interimSummary, config.logFile);
    }

    return results;
}

/**
 * Processes a batch of CIF files from the given array.
 * @param {Array<string>} files - Array of file paths to process.
 * @param {number} startIndex - The starting index in the array.
 * @returns {number} The index after the last processed file.
 */
async function processBatch(files, startIndex) {
    const endIndex = Math.min(startIndex + config.batchSize, files.length);
    const batchFiles = files.slice(startIndex, endIndex);
    
    for (const file of batchFiles) {
        await testCIFFile(file);
    }
    
    return endIndex;
}

/**
 * Recursively finds all CIF files in a directory and its subdirectories.
 * @param {string} dir - The directory to search in.
 * @returns {Promise<Array<string>>} Promise resolving to an array of CIF file paths.
 */
async function findCIFFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
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
 * Main function that executes the testing process.
 * Finds all CIF files in the specified directory, processes them in batches,
 * and generates summary statistics.
 *
 * With only a target directory given, processes every file and writes the
 * top-level logs. With a start/end index pair also given (used by
 * run-modifiers-tests-parallel.sh to fan work out across several concurrent
 * processes), processes only that slice of the file list and writes to
 * per-chunk log files instead, including a JSON stats dump that
 * aggregate-modifier-stats.mjs later merges back into the top-level logs.
 */
async function main() {
    const startIndex = process.argv[3] === undefined ? undefined : parseInt(process.argv[3]);
    const endIndex = process.argv[4] === undefined ? undefined : parseInt(process.argv[4]);
    const isChunk = startIndex !== undefined;
    config = { ...config, ...getLogFilenames(startIndex, endIndex) };

    if (!existsSync(logsDir)) {
        mkdirSync(logsDir);
    }
    if (isChunk && !existsSync(chunkLogsDir)) {
        mkdirSync(chunkLogsDir);
    }

    const startTime = Date.now();
    const targetDir = process.argv[2] || './cod';
    const resolvedPath = resolve(targetDir);

    console.log(`Starting CIF testing in directory: ${resolvedPath}`);
    logMessage(`Starting CIF testing in directory: ${resolvedPath}`);

    try {
        // Clear log files
        ['logFile', 'errorLogFile', 'summaryFile', 'modifierLogFile', 'verboseLogFile'].forEach(file => {
            try {
                writeFileSync(config[file], '');
            } catch (error) {
                console.error(`Failed to clear ${file}:`, error);
            }
        });

        let files = await findCIFFiles(resolvedPath);
        console.log(`Found ${files.length} CIF files`);
        logMessage(`Found ${files.length} CIF files`);

        const beforeExclusion = files.length;
        files = filterKnownBad(files);
        console.log(`Skipping ${beforeExclusion - files.length} known-bad files, ${files.length} remaining`);
        logMessage(`Skipping ${beforeExclusion - files.length} known-bad files, ${files.length} remaining`);

        if (isChunk) {
            files = files.slice(startIndex, endIndex);
            console.log(`Processing ${files.length} files in requested range ${startIndex}-${endIndex}`);
            logMessage(`Processing ${files.length} files in requested range ${startIndex}-${endIndex}`);
        }

        let processedIndex = 0;
        while (processedIndex < files.length) {
            processedIndex = await processBatch(files, processedIndex);
            console.log(`Processed ${processedIndex}/${files.length} files...`);
            logMessage(`Processed ${processedIndex}/${files.length} files...`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        logMessage(`Testing completed in ${duration} seconds`);

        // Write final summary
        const finalSummary = generateSummary(stats, false);
        console.log(finalSummary);
        writeSummaryToFile(finalSummary, config.summaryFile);
        writeFileSync(config.statsFile, JSON.stringify(stats, null, 2));

    } finally {
        console.warn = originalWarn;
        console.error = originalError;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
