import { readFileSync, appendFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const logsDir = join(scriptDir, 'logs', 'ortep-chunked');

/**
 * Generates the log filenames for a specific range of processed files
 * @param {number} startIndex - The starting index of the file range
 * @param {number} endIndex - The ending index of the file range
 * @returns {object} Object containing paths to the log, error log, and summary files
 */
function getLogFilenames(startIndex, endIndex) {
    const rangeStr = `${startIndex}-${endIndex}`;
    return {
        logFile: join(logsDir, `ortep-test-results-${rangeStr}.log`),
        errorLogFile: join(logsDir, `ortep-test-errors-${rangeStr}.log`),
        summaryFile: join(logsDir, `ortep-test-summary-${rangeStr}.log`),
    };
}

// Configuration
const config = {
    batchSize: 25,
    gcThreshold: 100,
    summaryInterval: 1000,
};

// Statistics tracking
const stats = {
    totalFiles: 0,
    successfulORTEP: 0,
    errors: {
        structure: 0,
        ORTEP: 0,
        NaN: 0,
    },
};

/**
 * Checks a THREE.js object and its children for NaN values in transformations 
 * @param {object} object3D - The THREE.js object to check
 * @returns {object} Counts of NaN values by property type (position, rotation, scale, matrix)
 */
function checkForNaN(object3D) {
    const nanCounts = {
        position: 0,
        rotation: 0,
        scale: 0,
        matrix: 0,
    };

    /**
     * Recursively checks an object and its children for NaN values
     * @param {object} obj - The object to check
     */
    function checkObject(obj) {
        const position = obj.position;
        const rotation = obj.rotation;
        const scale = obj.scale;
        const matrix = obj.matrix.elements;

        if ([position.x, position.y, position.z].some(isNaN)) {
            nanCounts.position++;
        }
        if ([rotation.x, rotation.y, rotation.z].some(isNaN)) {
            nanCounts.rotation++;
        }
        if ([scale.x, scale.y, scale.z].some(isNaN)) {
            nanCounts.scale++;
        }
        if (matrix.some(isNaN)) {
            nanCounts.matrix++;
        }

        for (const child of obj.children) {
            checkObject(child);
        }
    }

    checkObject(object3D);
    return nanCounts;
}

/**
 * Tests ORTEP visualization generation for a single CIF file
 * @param {string} filePath - Path to the CIF file to test
 * @param {object} logFiles - Object containing paths to log files
 * @returns {Promise<void>}
 */
async function testCIFFile(filePath, logFiles) {
    stats.totalFiles++;
    const fileContent = readFileSync(filePath, 'utf8');
    let ortep = null;
    let structure;
    
    try {
        const cif = new CIF(fileContent);
        const block = cif.getBlock(0);
        structure = CrystalStructure.fromCIF(block);
    } catch {
        stats.errors.structure++;
        return;
    }

    try {
        // Test ORTEP structure creation
        ortep = new ORTEP3JsStructure(structure);
        const group = ortep.getGroup();

        // Basic validation
        if (!group || group.children.length === 0) {
            throw new Error('Empty or invalid ORTEP structure');
        }

        // Check for NaN values in transformations
        const nanCounts = checkForNaN(group);
        const totalNaNs = Object.values(nanCounts).reduce((a, b) => a + b, 0);
        
        if (totalNaNs > 0) {
            stats.errors.NaN++;
            const nanDetails = Object.entries(nanCounts)
                .filter(([_, count]) => count > 0)
                .map(([prop, count]) => `${prop}: ${count}`)
                .join(', ');
            throw new Error(`NaN values detected: ${nanDetails}`);
        }

        stats.successfulORTEP++;

    } catch (error) {
        stats.errors.ORTEP++;
        // Log detailed error information
        const errorLog = `Failed ORTEP generation for ${filePath}\nError: ${error.message}`;
        appendFileSync(logFiles.errorLogFile, `${errorLog}\n\n`);
    } finally {
        if (ortep) {
            try {
                ortep.dispose();
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    // Print summary every 1000 structures
    if (stats.totalFiles % config.summaryInterval === 0) {
        writeSummary(true, logFiles);
    }
}

/**
 * Processes a batch of CIF files for ORTEP testing 
 * @param {string[]} files - Array of file paths to process
 * @param {number} startIndex - Starting index in the files array
 * @param {object} logFiles - Object containing paths to log files
 * @returns {Promise<number>} The next index after the processed batch
 */
async function processBatch(files, startIndex, logFiles) {
    const endIndex = Math.min(startIndex + config.batchSize, files.length);
    const batchFiles = files.slice(startIndex, endIndex);
    
    for (const file of batchFiles) {
        await testCIFFile(file, logFiles);
        
        if (global.gc && stats.totalFiles % config.gcThreshold === 0) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return endIndex;
}

/**
 * Recursively finds all CIF files in a directory and its subdirectories
 * @param {string} dir - Directory to search for CIF files
 * @returns {Promise<string[]>} Array of paths to CIF files
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
    return files.flat().sort();
}

/**
 * Writes a summary of the test results to the summary log file
 * @param {boolean} isInterim - Whether this is an interim summary (true) or final summary (false)
 * @param {object} logFiles - Object containing paths to log files
 */
function writeSummary(isInterim = false, logFiles) {
    const summary = `
${isInterim ? 'Interim ' : ''}ORTEP Testing Summary
${isInterim ? '='.repeat(23) : '='.repeat(15)}
Total files processed: ${stats.totalFiles}
Successful ORTEP generation: ${stats.successfulORTEP} (${((stats.successfulORTEP/stats.totalFiles)*100).toFixed(1)}%)

Errors:
- Structure errors: ${stats.errors.structure}
- ORTEP creation errors: ${stats.errors.ORTEP}
- Structures with NaN values: ${stats.errors.NaN}
`;
    
    if (!isInterim) {
        appendFileSync(logFiles.summaryFile, summary);
    }
    console.log(summary);
}

/**
 * Main execution function that orchestrates the ORTEP testing process
 * @returns {Promise<void>}
 */
async function main() {
    const startTime = Date.now();
    
    // Parse command line arguments
    const targetDir = process.argv[2] || './cod';
    const startIndex = parseInt(process.argv[3]) || 0;
    const endIndex = parseInt(process.argv[4]) || Infinity;
    
    const resolvedPath = resolve(targetDir);
    const logFiles = getLogFilenames(startIndex, endIndex);
    
    console.log(`Starting ORTEP testing in directory: ${resolvedPath}`);
    console.log(`Processing files from index ${startIndex} to ${endIndex}`);

    try {
        // Clear log files
        Object.values(logFiles).forEach(file => {
            try {
                writeFileSync(file, '');
            } catch (error) {
                console.error(`Failed to clear ${file}:`, error);
            }
        });

        // Find and sort all CIF files
        let files = await findCIFFiles(resolvedPath);
        console.log(`Found ${files.length} CIF files total`);
        
        // Slice to requested range
        files = files.slice(startIndex, endIndex);
        console.log(`Processing ${files.length} files in requested range`);
        
        let processedIndex = 0;
        while (processedIndex < files.length) {
            processedIndex = await processBatch(files, processedIndex, logFiles);
            console.log(`Processed ${processedIndex}/${files.length} files...`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`Testing completed in ${duration} seconds`);
        writeSummary(false, logFiles);

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}