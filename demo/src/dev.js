import { CrystalStructure, CIF } from '../../src';
import { growSymmetry } from '../../src/lib/structure/structure-modifiers//growing/grow-fragment.js';
import { growCell } from '../../src/lib/structure/structure-modifiers/growing/grow-cell.js';

/**
 *
 * @param cifText
 * @param name
 * @param runCount
 */
async function growFragmentStructure(cifText, name, runCount) {
    const cif = new CIF(cifText);
    const structure = CrystalStructure.fromCIF(cif.getBlock(0));
    
    const startTime = performance.now();
    const output = growSymmetry(structure);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    //console.log(`Run ${runCount}: ${name} took ${executionTime.toFixed(2)} milliseconds`);
    
    return { output, executionTime };
}

/**
 *
 * @param cifText
 * @param name
 * @param runCount
 */
async function growCellStructure(cifText, name, runCount) {
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
 *
 * @param cifText
 * @param name
 * @param runCount
 */
async function growCellFragmentStructure(cifText, name, runCount) {
    const cif = new CIF(cifText);
    const structure = CrystalStructure.fromCIF(cif.getBlock(0));
    
    const startTime = performance.now();
    const fStructure = growSymmetry(structure);
    const output = growCell(fStructure);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    //console.log(`Run ${runCount}: ${name} took ${executionTime.toFixed(2)} milliseconds`);
    
    return { output, executionTime };
}

/**
 *
 * @param timings
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
 *
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
        //console.log(`\n=== Starting tests for ${structureName} ===`);

        // Fetch structure data once
        const response = await fetch(`${baseUrl}cif/${structureName}`);
        const cifText = await response.text();
        
        try {
            // Run multiple executions
            let structure;
            const timings = [];
            for (let i = 1; i <= numExecutions; i++) {
                const { output, executionTime } = await growFragmentStructure(cifText, structureName, i);
                structure = output;
                timings.push(executionTime);
            }
            const structureInfo = `N(Atoms): ${structure.atoms.length}; N(Bonds): ${structure.bonds.length}; N(HBonds): ${structure.hBonds.length}`;
            
            // Calculate and display statistics
            const stats = calculateStatistics(timings);
            //console.log(`\nStatistics for ${structureName} (${numExecutions} runs):`);
            //console.log(`Mean: ${stats.mean} ms`);
            //console.log(`Standard Deviation: ${stats.stdDev} ms`);
            //console.log(`Min: ${stats.min} ms`);
            //console.log(`Max: ${stats.max} ms`);
            //console.log(`Median: ${stats.median} ms`);
            
            allResults[structureName] = { timings, stats, structureInfo };
            
        } catch (error) {
            console.error(`Error processing ${structureName}:`, error);
        }

        console.log(await growCellStructure(cifText, structureName, 0));
        console.log(await growCellFragmentStructure(cifText, structureName, 0));
    }
    
    // Print summary of all results
    console.log('\n=== SUMMARY OF ALL RESULTS ===');
    for (const structureName in allResults) {
        const { stats, structureInfo } = allResults[structureName];
        console.log(`${structureName}: Mean=${stats.mean}ms, StdDev=${stats.stdDev}ms, Min=${stats.min}ms, Max=${stats.max}ms, Median=${stats.median}ms`);
        console.log(structureInfo);
    }
    
    return allResults;
}

// Start processing
processStructuresWithStatistics()
    .then(results => {
        //console.log("All processing complete!");
        // You could do additional analysis on 'results' here if needed
    })
    .catch(error => {
        console.error('Error in main process:', error);
    });