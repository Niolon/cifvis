import { readFileSync, appendFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { CIF, CrystalStructure, ORTEP3JsStructure } from './src/index.nobrowser.js';

// Configuration
const config = {
    logFile: 'cif-test-results.log',
    errorLogFile: 'cif-test-errors.log',
    summaryFile: 'cif-test-summary.log',
    batchSize: 50,  // Process files in batches to manage memory
    gcThreshold: 1000,  // Force garbage collection every N files
};

// Statistics tracking
const stats = {
    totalFiles: 0,
    successfulCIF: 0,
    successfulStructure: 0,
    successfulORTEP: 0,
    errors: {
        CIF: 0,
        CrystalStructure: 0,
        ORTEP: 0,
        symmetry: 0,
    },
};

// Capture and suppress console warnings
const originalWarn = console.warn;
let suppressedWarnings = [];
console.warn = (...args) => {
    suppressedWarnings.push(args.join(' '));
};

/**
 * Write to log file with timestamp
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
 * Test processing of a single CIF file
 */
async function testCIFFile(filePath) {
    stats.totalFiles++;
    const fileContent = readFileSync(filePath, 'utf8');
    suppressedWarnings = []; // Clear warnings for this file
    
    const results = {
        path: filePath,
        success: {
            CIF: false,
            structure: false,
            ORTEP: false,
        },
        errors: [],
        warnings: [],
    };

    let cif = null, structure = null, ortep = null;

    try {
        // Test CIF parsing
        cif = new CIF(fileContent);
        const block = cif.getBlock(0);
        if (!block || !block.dataBlockName) {
            throw new Error('Empty or invalid CIF block');
        }
        results.success.CIF = true;
        stats.successfulCIF++;

        try {
            // Test CrystalStructure creation
            structure = CrystalStructure.fromCIF(block);
            if (!structure || !structure.atoms || structure.atoms.length === 0) {
                throw new Error('Empty or invalid crystal structure');
            }
            
            // Check for symmetry issues
            if (!structure.symmetry) {
                stats.errors.symmetry++;
                results.errors.push('Symmetry Error: No symmetry operations');
                throw new Error('Incomplete symmetry information');
            }  else if (structure.symmetry.spaceGroupNumber === 0) {
                stats.errors.symmetry++;
                results.errors.push('Symmetry Error: No Space Group Number');
                throw new Error('Incomplete symmetry information');
            } else if (structure.symmetry.spaceGroupName === 'Unknown') {
                stats.errors.symmetry++;
                results.errors.push('Symmetry Error: No Space Group Name');
                throw new Error('Incomplete symmetry information');
            }

            results.success.structure = true;
            stats.successfulStructure++;

            try {
                // Test ORTEP structure creation
                ortep = new ORTEP3JsStructure(structure);
                const group = ortep.getGroup();
                if (!group || group.children.length === 0) {
                    throw new Error('Empty or invalid ORTEP structure');
                }
                results.success.ORTEP = true;
                stats.successfulORTEP++;
            } catch (error) {
                results.errors.push(`ORTEP Error: ${error.message}`);
                stats.errors.ORTEP++;
            }
        } catch (error) {
            results.errors.push(`Structure Error: ${error.message}`);
            stats.errors.CrystalStructure++;
        }
    } catch (error) {
        results.errors.push(`CIF Error: ${error.message}`);
        stats.errors.CIF++;
    } finally {
        // Cleanup
        if (ortep) {
            try {
                ortep.dispose();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        // Clear references to help garbage collection
        cif = null;
        structure = null;
        ortep = null;
    }

    // Log results
    if (results.success.ORTEP) {
        logMessage(`✓ Success: ${filePath}`);
    } else {
        let errorLog = `Failed: ${filePath}\n${results.errors.join('\n')}`;
        if (suppressedWarnings.length > 0) {
            errorLog += '\nWarnings:\n' + suppressedWarnings.join('\n');
        }
        logMessage(errorLog, config.errorLogFile);
    }

    return results;
}

/**
 * Process a batch of files
 */
async function processBatch(files, startIndex) {
    const endIndex = Math.min(startIndex + config.batchSize, files.length);
    const batchFiles = files.slice(startIndex, endIndex);
    
    for (const file of batchFiles) {
        await testCIFFile(file);
        
        // Force garbage collection if available and threshold reached
        if (global.gc && stats.totalFiles % config.gcThreshold === 0) {
            global.gc();
        }
    }
    
    return endIndex;
}

/**
 * Recursively find all .cif files in directory
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
 * Write summary statistics
 */
function writeSummary() {
    const summary = `
CIF Testing Summary
==================
Total files processed: ${stats.totalFiles}
Successful CIF parsing: ${stats.successfulCIF} (${((stats.successfulCIF/stats.totalFiles)*100).toFixed(1)}%)
Successful structures: ${stats.successfulStructure} (${((stats.successfulStructure/stats.totalFiles)*100).toFixed(1)}%)
Successful ORTEP: ${stats.successfulORTEP} (${((stats.successfulORTEP/stats.totalFiles)*100).toFixed(1)}%)

Errors:
- CIF parsing: ${stats.errors.CIF}
- Structure creation: ${stats.errors.CrystalStructure}
- ORTEP creation: ${stats.errors.ORTEP}
- Symmetry issues: ${stats.errors.symmetry}
`;
    
    logMessage(summary, config.summaryFile);
    console.log(summary);
}

/**
 * Main execution function
 */
async function main() {
    const startTime = Date.now();
    
    // Get directory from command line or use default
    const targetDir = process.argv[2] || './cod';
    const resolvedPath = resolve(targetDir);
    
    console.log(`Starting CIF testing in directory: ${resolvedPath}`);
    logMessage(`Starting CIF testing in directory: ${resolvedPath}`);

    try {
        // Clear log files
        ['logFile', 'errorLogFile', 'summaryFile'].forEach(file => {
            try {
                writeFileSync(config[file], '');
            } catch (error) {
                console.error(`Failed to clear ${file}:`, error);
            }
        });

        // Find all CIF files
        const files = await findCIFFiles(resolvedPath);
        console.log(`Found ${files.length} CIF files`);
        
        // Process files in batches with progress indicator
        let processedIndex = 0;
        while (processedIndex < files.length) {
            processedIndex = await processBatch(files, processedIndex);
            console.log(`Processed ${processedIndex}/${files.length} files...`);
            
            // Optional: Add a small delay between batches to allow other processes
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Write summary
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        logMessage(`Testing completed in ${duration} seconds`);
        writeSummary();

    //} catch (error) {
    //    console.error('Fatal error:', error);
    //    logMessage(`Fatal error: ${error.message}`, config.errorLogFile);
    } finally {
        // Restore original console.warn
        console.warn = originalWarn;
    }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}