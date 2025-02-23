import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
    CIF, CrystalStructure, tryToFixCifBlock,
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/index.nobrowser.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const logsDir = join(scriptDir, 'logs');

const config = {
    logFile: join(logsDir, 'modifier-test-results.log'),
    errorLogFile: join(logsDir, 'modifier-test-errors.log'),
    modifierLogFile: join(logsDir, 'modifier-test-modifiers.log'),
    verboseLogFile: join(logsDir, 'modifier-test-verbose.log'),
    summaryFile: join(logsDir, 'modifier-test-summary.log'),
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
    },
};

const originalWarn = console.warn;
let suppressedWarnings = [];
console.warn = (...args) => {
    suppressedWarnings.push(args.join(' '));
};

function writeSummaryToFile(summaryText, filePath) {
    try {
        appendFileSync(filePath, summaryText + '\n');
    } catch (error) {
        console.error(`Failed to write summary to ${filePath}:`, error);
    }
}

function generateSummary(isInterim = false) {
    const header = isInterim ? 'Interim CIF Testing Summary' : 'Final CIF Testing Summary';
    
    // Calculate percentage of unhandled structure errors
    const totalStructureErrors = stats.errors.CrystalStructure.total;
    const unhandledPercentage = (
        (stats.errors.CrystalStructure.otherAndLogged / totalStructureErrors) * 100
    ).toFixed(1);
    
    // Validate that our counts add up
    const totalAccountedFor = stats.successfulStructure + stats.errors.CIF + stats.errors.CrystalStructure.total;
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
- Symmetry errors: ${stats.errors.symmetry}`;

    return summaryText;
}

function logMessage(message, filePath = config.logFile) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        appendFileSync(filePath, logEntry);
    } catch (error) {
        console.error(`Failed to write to log file ${filePath}:`, error);
    }
}

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

async function testCIFFile(filePath) {
    stats.totalFiles++;
    const fileContent = readFileSync(filePath, 'utf8');
    suppressedWarnings = [];
    
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
                    handleStructureError(`Structure Error in Fixed structure${filePath}: ${error2.message}`, true, true);
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
                for (const disorderMode of applicableModes.disorder) {
                    for (const symmetryMode of applicableModes.symmetry) {
                        try {
                            let structure = baseStructure;
                            modifiers.hydrogen.mode = hydrogenMode;
                            modifiers.disorder.mode = disorderMode;
                            modifiers.symmetry.mode = symmetryMode;
                         
                            structure = modifiers.hydrogen.apply(baseStructure);
                            structure = modifiers.disorder.apply(structure); 
                            structure = modifiers.symmetry.apply(structure);
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

    // Check if we should generate an interim report
    if (stats.totalFiles % config.interimReportFrequency === 0) {
        const interimSummary = generateSummary(true);
        console.log(interimSummary);
        ///writeSummaryToFile(interimSummary, config.logFile);
    }

    return results;
}

async function processBatch(files, startIndex) {
    const endIndex = Math.min(startIndex + config.batchSize, files.length);
    const batchFiles = files.slice(startIndex, endIndex);
    
    for (const file of batchFiles) {
        await testCIFFile(file);
    }
    
    return endIndex;
}

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

async function main() {
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir);
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

        const files = await findCIFFiles(resolvedPath);
        console.log(`Found ${files.length} CIF files`);
        logMessage(`Found ${files.length} CIF files`);
        
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
        const finalSummary = generateSummary(false);
        console.log(finalSummary);
        writeSummaryToFile(finalSummary, config.summaryFile);

    } finally {
        console.warn = originalWarn;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}