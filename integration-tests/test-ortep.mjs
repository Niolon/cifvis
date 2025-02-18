import { readFileSync, appendFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const logsDir = join(scriptDir, 'logs');

// Configuration
const config = {
    logFile: join(logsDir, 'ortep-test-results.log'),
    errorLogFile: join(logsDir, 'ortep-test-errors.log'),
    summaryFile: join(logsDir, 'ortep-test-summary.log'),
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

// Check objects for NaN values and count by type
function checkForNaN(object3D) {
    const nanCounts = {
        position: 0,
        rotation: 0,
        scale: 0,
        matrix: 0,
    };

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
 * Test ORTEP generation for a single CIF file
 */
async function testCIFFile(filePath) {
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
        appendFileSync(config.errorLogFile, `${errorLog}\n\n`);
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
        writeSummary(true);
    }
}

/**
 * Process a batch of files
 */
async function processBatch(files, startIndex) {
    const endIndex = Math.min(startIndex + config.batchSize, files.length);
    const batchFiles = files.slice(startIndex, endIndex);
    
    for (const file of batchFiles) {
        await testCIFFile(file);
        
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
 * Find all CIF files in directory recursively
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
function writeSummary(isInterim = false) {
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
    
    //if (!isInterim) {
    appendFileSync(config.summaryFile, summary);
    //}
    console.log(summary);
}

/**
 * Main execution function
 */
async function main() {
    const startTime = Date.now();
    const targetDir = process.argv[2] || './cod';
    const resolvedPath = resolve(targetDir);
    
    console.log(`Starting ORTEP testing in directory: ${resolvedPath}`);

    try {
        ['summaryFile', 'errorLogFile'].forEach(file => {
            try {
                writeFileSync(config[file], '');
            } catch (error) {
                console.error(`Failed to clear ${file}:`, error);
            }
        });

        const files = await findCIFFiles(resolvedPath);
        console.log(`Found ${files.length} CIF files`);
        
        let processedIndex = 0;
        while (processedIndex < files.length) {
            processedIndex = await processBatch(files, processedIndex);
            console.log(`Processed ${processedIndex}/${files.length} files...`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`Testing completed in ${duration} seconds`);
        writeSummary(false);

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}