import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    CIF, CrystalStructure, tryToFixCifBlock,
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/index.nobrowser.js';
import { repairBondGeometry } from '../src/lib/structure/structure-modifiers/bond-geometry.js';
import { filterKnownBad } from './lib/known-bad-cifs.mjs';
import {
    checkCifBasis, checkGrownBonds, formatBondConsistencyReport,
} from './lib/bond-consistency.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const logsDir = resolve(process.env.CIFVIS_INTEGRATION_LOG_DIR || join(scriptDir, 'logs'));
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
            bondConsistencyLogFile: join(logsDir, 'modifier-test-bond-consistency.log'),
            slowFileLogFile: join(logsDir, 'modifier-test-slow-files.log'),
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
        bondConsistencyLogFile: join(
            chunkLogsDir, `modifier-test-bond-consistency-${rangeStr}.log`,
        ),
        slowFileLogFile: join(chunkLogsDir, `modifier-test-slow-files-${rangeStr}.log`),
    };
}

/** A file taking longer than this is worth naming individually in the log. */
const SLOW_FILE_MS = 1000;
/** A single modifier combination taking longer than this is reported with the file. */
const SLOW_MODE_MS = 500;

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
            duplicateAtomLabels: 0,
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
            duplicateAtomLabels: 0,
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
    // Processing cost per file. Only sums and counts live here: chunk stats are merged
    // by adding matching numeric leaves, so a maximum or a top-N list would aggregate
    // into nonsense. Buckets give the shape of the tail and survive the merge; the
    // individual offenders go to the slow-file log.
    timing: {
        filesTimed: 0,
        totalMs: 0,
        slowFiles: 0,
        filesOver5s: 0,
        filesOver30s: 0,
        slowMsTotal: 0,
    },
    // Geometric self-consistency of the bonds that growth produces. Split by whether
    // the source CIF was already inconsistent, because the symmetry orbit of one wrong
    // input bond is a whole set of wrong output bonds: without the split, a handful of
    // bad depositions dominate the totals and hide real regressions.
    bondConsistency: {
        structuresChecked: 0,
        structuresWithUnsoundBasis: 0,
        unsoundBasisBonds: 0,
        grownStructuresChecked: 0,
        // Findings on structures whose own CIF verifies - these are ours.
        soundBasis: {
            runsWithInconsistentBonds: 0,
            inconsistentBonds: 0,
            danglingBonds: 0,
            repeatedAtomIds: 0,
        },
        // Findings on structures that already disagree with themselves - expected.
        unsoundBasis: {
            runsWithInconsistentBonds: 0,
            inconsistentBonds: 0,
            danglingBonds: 0,
            repeatedAtomIds: 0,
        },
        // Outcome of reconciling an unsound file before growing it.
        repairs: {
            recoded: 0,
            lengthCorrected: 0,
            dropped: 0,
            structuresWithDroppedBonds: 0,
        },
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

    // Tolerate stats files written before bond consistency was tracked, so an older
    // chunk cannot break aggregation.
    const bondConsistency = {
        structuresChecked: 0,
        structuresWithUnsoundBasis: 0,
        unsoundBasisBonds: 0,
        grownStructuresChecked: 0,
        soundBasis: {},
        unsoundBasis: {},
        repairs: {},
        ...(stats.bondConsistency ?? {}),
    };
    const timing = {
        filesTimed: 0, totalMs: 0, slowFiles: 0, filesOver5s: 0, filesOver30s: 0, slowMsTotal: 0,
        ...(stats.timing ?? {}),
    };
    const meanMs = timing.filesTimed === 0 ? 0 : timing.totalMs / timing.filesTimed;
    const tailShare = timing.totalMs === 0
        ? '0.0'
        : ((timing.slowMsTotal / timing.totalMs) * 100).toFixed(1);

    const unsoundBasisPercentage = bondConsistency.structuresChecked === 0
        ? '0.0'
        : ((bondConsistency.structuresWithUnsoundBasis / bondConsistency.structuresChecked)
            * 100).toFixed(1);
    
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
  • Duplicate atom site labels: ${stats.errors.CrystalStructure.duplicateAtomLabels ?? 0}
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
- Connectivity errors (e.g. max iterations reached): ${stats.errors.connectivity}

PROCESSING TIME
---------------
Individually slow files are named in modifier-test-slow-files.log, each with the
modifier combinations that took the longest, so the tail can be profiled directly.

- Files timed: ${timing.filesTimed}, total ${(timing.totalMs / 60000).toFixed(1)} min\
 (mean ${meanMs.toFixed(0)} ms)
- Files over 1 s: ${timing.slowFiles}, over 5 s: ${timing.filesOver5s},\
 over 30 s: ${timing.filesOver30s}
- Share of total time spent in files over 1 s: ${tailShare}%

BOND CONSISTENCY
----------------
Every grown bond must span the distance it is labelled with, and name two atoms that
were actually materialised. Results are split by whether the source CIF verifies
against its own coordinates, since growth replicates an unsound input faithfully.

- Structures checked: ${bondConsistency.structuresChecked}
- Structures whose own CIF is inconsistent: ${bondConsistency.structuresWithUnsoundBasis}\
 (${unsoundBasisPercentage}%), covering ${bondConsistency.unsoundBasisBonds} bonds
- Grown structures checked: ${bondConsistency.grownStructuresChecked}

• From sound CIFs - these indicate a defect in cifvis:
  - Runs with findings: ${bondConsistency.soundBasis.runsWithInconsistentBonds}
  - Bonds drawn at the wrong length: ${bondConsistency.soundBasis.inconsistentBonds}
  - Bonds naming a missing atom: ${bondConsistency.soundBasis.danglingBonds}
  - Repeated atom IDs: ${bondConsistency.soundBasis.repeatedAtomIds}
• From already-inconsistent CIFs - expected, bad input reproduced:
  - Runs with findings: ${bondConsistency.unsoundBasis.runsWithInconsistentBonds}
  - Bonds drawn at the wrong length: ${bondConsistency.unsoundBasis.inconsistentBonds}
  - Bonds naming a missing atom: ${bondConsistency.unsoundBasis.danglingBonds}
  - Repeated atom IDs: ${bondConsistency.unsoundBasis.repeatedAtomIds}

Unsound files are reconciled before growth, by re-deriving each contradictory bond's
site-symmetry code from the distance the file publishes:
  - Site-symmetry codes corrected: ${bondConsistency.repairs.recoded}
  - Lengths corrected from coordinates (no image matched): ${bondConsistency.repairs.lengthCorrected}
  - Bonds dropped as irreconcilable: ${bondConsistency.repairs.dropped}\
 (in ${bondConsistency.repairs.structuresWithDroppedBonds} structures)`;

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
    if (errorMessage.includes('Duplicate atom site labels')) {
        crystalStructureErrors.total++;
        crystalStructureErrors.duplicateAtomLabels++;
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
 * Verifies that one grown structure is geometrically self-consistent and records the
 * outcome against the already-established verdict on the source CIF.
 *
 * Findings are counted separately for sound and unsound input. Only the sound-basis
 * counters indicate a defect in cifvis; the unsound-basis ones track how much bad
 * input the corpus contains, which is otherwise indistinguishable in the totals.
 * @param {object} grownStructure - Structure returned by the symmetry grower.
 * @param {object} basisCheck - Result of checkCifBasis for the source CIF.
 * @param {string} filePath - CIF being tested, for the log.
 * @param {object} modes - Active `{hydrogenMode, disorderMode, symmetryMode}`.
 */
function checkBondConsistency(grownStructure, basisCheck, filePath, modes) {
    const grown = checkGrownBonds(grownStructure);
    stats.bondConsistency.grownStructuresChecked++;

    const findings = grown.inconsistent.length + grown.dangling.length + grown.idCollisions;
    if (findings === 0) {
        return;
    }

    const basisIsUnsound = basisCheck.mismatched.length > 0;
    const bucket = basisIsUnsound
        ? stats.bondConsistency.unsoundBasis
        : stats.bondConsistency.soundBasis;
    bucket.runsWithInconsistentBonds++;
    bucket.inconsistentBonds += grown.inconsistent.length;
    bucket.danglingBonds += grown.dangling.length;
    bucket.repeatedAtomIds += grown.idCollisions;

    // Growth faithfully replicating an unsound CIF is already accounted for by the
    // Structure Error raised for that file, and one bad input bond expands into its
    // whole symmetry orbit - logging every one of those would bury the findings that
    // are actually cifvis's fault. Only those get an entry here.
    if (!basisIsUnsound) {
        logMessage(
            formatBondConsistencyReport({ filePath, modes, grown, basis: basisCheck }),
            config.bondConsistencyLogFile,
        );
    }
}

/**
 * Records how long one file took, and names it in the slow-file log when it stands out.
 *
 * A run's cost is dominated by a small tail of structures rather than by the bulk, so
 * knowing which files those are - and which modifier combination inside them is the
 * expensive one - is what makes the tail actionable rather than merely slow.
 * @param {string} filePath - The CIF that was processed.
 * @param {number} elapsedMs - Wall time spent on it.
 * @param {string[]} slowModes - Descriptions of individually slow modifier combinations.
 */
function recordFileTiming(filePath, elapsedMs, slowModes) {
    stats.timing.filesTimed++;
    stats.timing.totalMs += Math.round(elapsedMs);
    if (elapsedMs < SLOW_FILE_MS) {
        return;
    }
    stats.timing.slowFiles++;
    stats.timing.slowMsTotal += Math.round(elapsedMs);
    if (elapsedMs >= 5000) {
        stats.timing.filesOver5s++;
    }
    if (elapsedMs >= 30000) {
        stats.timing.filesOver30s++;
    }
    const detail = slowModes.length > 0
        ? '\n' + slowModes.map(entry => `    ${entry}`).join('\n')
        : '';
    logMessage(`${(elapsedMs / 1000).toFixed(1)}s ${filePath}${detail}`, config.slowFileLogFile);
}

/**
 * Tests a CIF file by parsing it and applying various structure modifiers.
 * @param {string} filePath - The path to the CIF file to test.
 * @returns {object} Results object containing success flags, error information, and modifier errors.
 */
async function testCIFFile(filePath) {
    stats.totalFiles++;
    const fileStartedAt = performance.now();
    const slowModes = [];
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
                        logMessage(
                            `Structure Error in Fixed structure ${filePath}: `
                            + 'Structure has only placeholder coordinates',
                            config.errorLogFile,
                        );
                        results.errors.push('Structure has only placeholder coordinates');
                        return results;
                    }
                    // Otherwise count as no valid atoms error
                    stats.errors.CrystalStructure.total++;
                    stats.errors.CrystalStructureFixed.total++;
                    stats.errors.CrystalStructure.noValidAtoms++;
                    logMessage(
                        `Structure Error in Fixed structure ${filePath}: ${error.message}`,
                        config.errorLogFile,
                    );
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

            // Established once per file, before any growth, so every mode combination
            // below is judged against the same verdict on the input. Runs before the
            // applicable modes are derived, since repairing the bonds can change which
            // growth modes the structure supports.
            const basisCheck = checkCifBasis(baseStructure);
            stats.bondConsistency.structuresChecked++;
            if (basisCheck.mismatched.length > 0) {
                stats.bondConsistency.structuresWithUnsoundBasis++;
                stats.bondConsistency.unsoundBasisBonds += basisCheck.mismatched.length;
                // A depositor-side defect, not a cifvis one: report it as a Structure
                // Error so generate-cod-report.mjs picks it up as a COD data-quality
                // category. The maintainer log below stays reserved for findings cifvis
                // itself introduced.
                logMessage(
                    `Structure Error in ${filePath}: Bond lengths inconsistent with the`
                    + ` file's own coordinates: ${basisCheck.mismatched.length} of`
                    + ` ${basisCheck.checked} bonds\n`
                    + basisCheck.mismatched.slice(0, 5).map(entry => `    ${entry}`).join('\n'),
                    config.errorLogFile,
                );

                // Warned about above; now reconcile so the rest of the run exercises
                // growth on a coherent model instead of re-deriving the same fault in
                // every mode combination.
                const repair = repairBondGeometry(baseStructure);
                baseStructure = repair.structure;
                stats.bondConsistency.repairs.recoded += repair.repairs.recoded;
                stats.bondConsistency.repairs.lengthCorrected += repair.repairs.lengthCorrected;
                stats.bondConsistency.repairs.dropped += repair.repairs.dropped;
                if (repair.repairs.dropped > 0) {
                    stats.bondConsistency.repairs.structuresWithDroppedBonds++;
                }
                logMessage(
                    `Bond geometry repaired in ${filePath}: ${repair.repairs.recoded} site-symmetry`
                    + ` codes corrected, ${repair.repairs.lengthCorrected} lengths corrected,`
                    + ` ${repair.repairs.dropped} dropped\n`
                    + repair.repairs.details.slice(0, 3).map(entry => `    ${entry}`).join('\n'),
                    config.bondConsistencyLogFile,
                );
            }

            // Derived after any repair, since reconciling the bonds can change which
            // growth modes the structure supports.
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
                            const modeStartedAt = performance.now();
                            const grownStructure = modifiers.symmetry.apply(filteredStructure);
                            const modeMs = performance.now() - modeStartedAt;
                            if (modeMs >= SLOW_MODE_MS) {
                                slowModes.push(
                                    `${modeMs.toFixed(0)}ms H=${hydrogenMode}, D=${disorderMode}, `
                                    + `S=${symmetryMode} -> ${grownStructure.atoms.length} atoms, `
                                    + `${grownStructure.bonds.length} bonds`,
                                );
                            }
                            checkBondConsistency(
                                grownStructure, basisCheck, filePath,
                                { hydrogenMode, disorderMode, symmetryMode },
                            );
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

    recordFileTiming(filePath, performance.now() - fileStartedAt, slowModes);

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
