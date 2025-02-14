import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
    CIF, CrystalStructure,
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/index.nobrowser.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const logsDir = join(scriptDir, 'logs');

const config = {
    logFile: join(logsDir, 'modifier-test-results.log'),
    errorLogFile: join(logsDir, 'modifier-test-errors.log'),
    modifierLogFile: join(logsDir, 'modifier-test-modifiers.log'),
    summaryFile: join(logsDir, 'modifier-test-summary.log'),
    batchSize: 100,
};

const stats = {
    totalFiles: 0,
    successfulCIF: 0,
    successfulStructure: 0,
    modifierErrors: 0,
    errors: {
        CIF: 0,
        CrystalStructure: 0,
        symmetry: 0,
    },
};

const originalWarn = console.warn;
let suppressedWarnings = [];
console.warn = (...args) => {
    suppressedWarnings.push(args.join(' '));
};

function logMessage(message, filePath = config.logFile) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    try {
        appendFileSync(filePath, logEntry);
    } catch (error) {
        console.error(`Failed to write to log file ${filePath}:`, error);
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
                    const atomSite = block.get('_atom_site', false);
                    if (atomSite && atomSite.get(['_atom_site.fract_x', '_atom_site_fract_x'])
                        .every(val => val === '?')) {
                        return results;
                    }
                }
                logMessage(`Structure Error in ${filePath}: ${error.message}`, config.errorLogFile);
                results.errors.push(`Structure Error: ${error.message}`);
                stats.errors.CrystalStructure++;
                return results;
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
                            stats.modifierErrors++;
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
            stats.errors.CrystalStructure++;
        }
    } catch (error) {
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

    if (results.errors.length > 0) {
        logMessage(`Failed: ${filePath}\n${results.errors.join('\n')}`, config.errorLogFile);
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

function writeSummary() {
    const summary = `
CIF Testing Summary
==================
Total files processed: ${stats.totalFiles}
Successful CIF parsing: ${stats.successfulCIF} (${((stats.successfulCIF/stats.totalFiles)*100).toFixed(1)}%)
Successful structures: ${stats.successfulStructure} (${((stats.successfulStructure/stats.totalFiles)*100).toFixed(1)}%)
Modifier combination errors: ${stats.modifierErrors}

Errors:
- CIF parsing: ${stats.errors.CIF}
- Structure creation: ${stats.errors.CrystalStructure}
- Symmetry issues: ${stats.errors.symmetry}
`;
    
    logMessage(summary, config.summaryFile);
    console.log(summary);
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
        ['logFile', 'errorLogFile', 'summaryFile', 'modifierLogFile'].forEach(file => {
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
        writeSummary();

    } finally {
        console.warn = originalWarn;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}