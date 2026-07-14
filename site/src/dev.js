import { CrystalStructure, CIF } from '../../src';
import { growFragment } from '../../src/lib/structure/structure-modifiers//growing/grow-fragment.js';
import { growCell } from '../../src/lib/structure/structure-modifiers/growing/grow-cell.js';

/**
 * Grows a fragment structure from CIF text and measures execution time
 * @param {string} cifText - The CIF text content
 * @returns {Promise<{output: object, executionTime: number}>} The grown structure and execution time
 */
async function growFragmentStructure(cifText) {
    const cif = new CIF(cifText);
    const structure = CrystalStructure.fromCIF(cif.getBlock(0));
    
    const startTime = performance.now();
    const { grownStructure: output } = growFragment(structure);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    //console.log(`Run ${runCount}: ${name} took ${executionTime.toFixed(2)} milliseconds`);
    
    return { output, executionTime };
}

/**
 * Grows a cell structure from CIF text and measures execution time
 * @param {string} cifText - The CIF text content
 * @returns {Promise<{output: object, executionTime: number}>} The grown structure and execution time
 */
async function growCellStructure(cifText) {
    const cif = new CIF(cifText);
    const structure = CrystalStructure.fromCIF(cif.getBlock(0));
    
    const startTime = performance.now();
    const output = growCell(structure);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    //console.log(`Run ${runCount}: ${name} took ${executionTime.toFixed(2)} milliseconds`);
    
    return { output, executionTime };
}

/**
 * Grows a cell fragment structure from CIF text and measures execution time
 * @param {string} cifText - The CIF text content
 * @returns {Promise<{output: object, executionTime: number}>} The grown structure and execution time
 */
async function growCellFragmentStructure(cifText) {
    const cif = new CIF(cifText);
    const structure = CrystalStructure.fromCIF(cif.getBlock(0));
    
    const startTime = performance.now();
    const { grownStructure: fStructure, specialPositionAtoms: spAtoms } = growFragment(structure);
    const output = growCell(fStructure, false, spAtoms);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    //console.log(`Run ${runCount}: ${name} took ${executionTime.toFixed(2)} milliseconds`);
    
    return { output, executionTime };
}

/**
 * Calculates statistical measures for timing data
 * @param {number[]} timings - Array of execution times in milliseconds
 * @returns {object} Statistics object containing mean, stdDev, min, max, median, and runs
 */
function calculateStatistics(timings) {
    const sum = timings.reduce((acc, time) => acc + time, 0);
    const mean = sum / timings.length;
    
    // Calculate standard deviation
    const squaredDifferences = timings.map(time => Math.pow(time - mean, 2));
    const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate min, max, median
    const sortedTimings = [...timings].sort((a, b) => a - b);
    const min = sortedTimings[0];
    const max = sortedTimings[sortedTimings.length - 1];
    
    let median;
    if (sortedTimings.length % 2 === 0) {
        median = (sortedTimings[sortedTimings.length/2 - 1] + sortedTimings[sortedTimings.length/2]) / 2;
    } else {
        median = sortedTimings[Math.floor(sortedTimings.length/2)];
    }
    
    return {
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        median: median.toFixed(2),
        runs: timings.length,
    };
}

/**
 * Processes multiple crystal structures with statistical analysis for all growth methods
 * @returns {Promise<object>} Promise that resolves to results object containing stats for all structures and methods
 */
async function processStructuresWithStatistics() {
    const baseUrl = import.meta.env.BASE_URL;
    const structures = [
        'ED_para_Ag_3.cif',
        'urea.cif',
        'CaF2.cif',
        'sucrose.cif',
    ];
    
    const numExecutions = 20;
    const allResults = {};
    
    // Process each structure
    for (const structureName of structures) {
        console.log(`\n=== Starting tests for ${structureName} ===`);

        // Fetch structure data once
        const response = await fetch(`${baseUrl}cif/${structureName}`);
        const cifText = await response.text();
        
        try {
            // Run multiple executions for growFragmentStructure
            let fragmentStructure;
            const fragmentTimings = [];
            for (let i = 1; i <= numExecutions; i++) {
                const { output, executionTime } = await growFragmentStructure(cifText);
                fragmentStructure = output;
                fragmentTimings.push(executionTime);
            }
            const fragmentStructureInfo = `N(Atoms): ${fragmentStructure.atoms.length}; ` +
                `N(Bonds): ${fragmentStructure.bonds.length}; N(HBonds): ${fragmentStructure.hBonds.length}`;
            
            // Run multiple executions for growCellStructure  
            let cellStructure;
            const cellTimings = [];
            for (let i = 1; i <= numExecutions; i++) {
                const { output, executionTime } = await growCellStructure(cifText);
                cellStructure = output;
                cellTimings.push(executionTime);
            }
            const cellStructureInfo = `N(Atoms): ${cellStructure.atoms.length}; ` +
                `N(Bonds): ${cellStructure.bonds.length}; N(HBonds): ${cellStructure.hBonds.length}`;
            
            // Run multiple executions for growCellFragmentStructure
            let cellFragmentStructure;
            const cellFragmentTimings = [];
            for (let i = 1; i <= numExecutions; i++) {
                const { output, executionTime } = await growCellFragmentStructure(cifText);
                cellFragmentStructure = output;
                cellFragmentTimings.push(executionTime);
            }
            const cellFragmentStructureInfo = `N(Atoms): ${cellFragmentStructure.atoms.length}; ` +
                `N(Bonds): ${cellFragmentStructure.bonds.length}; N(HBonds): ${cellFragmentStructure.hBonds.length}`;
            
            // Calculate statistics for all methods
            const fragmentStats = calculateStatistics(fragmentTimings);
            const cellStats = calculateStatistics(cellTimings);
            const cellFragmentStats = calculateStatistics(cellFragmentTimings);
            
            allResults[structureName] = { 
                fragment: { timings: fragmentTimings, stats: fragmentStats, structureInfo: fragmentStructureInfo },
                cell: { timings: cellTimings, stats: cellStats, structureInfo: cellStructureInfo },
                cellFragment: { 
                    timings: cellFragmentTimings, 
                    stats: cellFragmentStats, 
                    structureInfo: cellFragmentStructureInfo,
                },
            };
            
        } catch (error) {
            console.error(`Error processing ${structureName}:`, error);
        }
    }
    
    // Print summary of all results
    console.log('\n=== SUMMARY OF ALL RESULTS ===');
    for (const structureName in allResults) {
        const { fragment, cell, cellFragment } = allResults[structureName];
        
        console.log(`\n${structureName}:`);
        console.log('  Fragment Growth:');
        console.log(`    Mean=${fragment.stats.mean}ms, StdDev=${fragment.stats.stdDev}ms, ` +
                    `Min=${fragment.stats.min}ms, Max=${fragment.stats.max}ms, Median=${fragment.stats.median}ms`);
        console.log(`    ${fragment.structureInfo}`);
        
        console.log('  Cell Growth:');
        console.log(`    Mean=${cell.stats.mean}ms, StdDev=${cell.stats.stdDev}ms, ` +
                    `Min=${cell.stats.min}ms, Max=${cell.stats.max}ms, Median=${cell.stats.median}ms`);
        console.log(`    ${cell.structureInfo}`);
        
        console.log('  Cell Fragment Growth:');
        console.log(`    Mean=${cellFragment.stats.mean}ms, StdDev=${cellFragment.stats.stdDev}ms, ` +
                    `Min=${cellFragment.stats.min}ms, Max=${cellFragment.stats.max}ms, ` +
                    `Median=${cellFragment.stats.median}ms`);
        console.log(`    ${cellFragment.structureInfo}`);
    }
    
    return allResults;
}

// Start processing
processStructuresWithStatistics()
    .then(_results => {
        //console.log("All processing complete!");
        // You could do additional analysis on 'results' here if needed
    })
    .catch(error => {
        console.error('Error in main process:', error);
    });