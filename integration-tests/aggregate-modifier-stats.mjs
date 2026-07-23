import { readFileSync, appendFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSummary, getLogFilenames } from './test-structure-modifiers.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const chunkLogsDir = join(scriptDir, 'logs', 'modifiers-chunked');

/**
 * Recursively adds matching numeric leaves of two stats objects. Generic on purpose:
 * the stats shape is deeply nested and changes over time, and hardcoding every field
 * here would silently drop newly added counters instead of aggregating them.
 * @param {object} target - Accumulator, mutated in place.
 * @param {object} source - Values to add into the accumulator.
 * @returns {object} The mutated accumulator, for chaining.
 */
function mergeSum(target, source) {
    for (const [key, value] of Object.entries(source)) {
        if (typeof value === 'number') {
            target[key] = (target[key] || 0) + value;
        } else if (value && typeof value === 'object') {
            target[key] = mergeSum(target[key] || {}, value);
        }
    }
    return target;
}

/**
 * Finds every per-chunk stats JSON file written by concurrent test-structure-modifiers.mjs
 * runs, sums them into one stats object, and writes the merged summary/logs to the same
 * top-level paths a single unchunked run would use.
 */
function main() {
    const statsFiles = readdirSync(chunkLogsDir)
        .filter(name => name.startsWith('modifier-test-stats-') && name.endsWith('.json'))
        .sort();

    if (statsFiles.length === 0) {
        console.error(`No chunk stats files found in ${chunkLogsDir}`);
        process.exit(1);
    }

    console.log(`Aggregating ${statsFiles.length} chunk(s)...`);

    const ranges = statsFiles.map(name => name.match(/-(\d+)-(\d+)\.json$/).slice(1, 3).map(Number));

    const mergedStats = statsFiles.reduce((acc, name) => {
        const chunkStats = JSON.parse(readFileSync(join(chunkLogsDir, name), 'utf8'));
        return mergeSum(acc, chunkStats);
    }, {});

    const topLevel = getLogFilenames();
    const logKeys = Object.keys(topLevel).filter(key => key !== 'summaryFile' && key !== 'statsFile');

    // Concatenate every chunk's detail logs into the same top-level files a single
    // unchunked run would produce, so downstream tooling (e.g. collect-problem-structures.sh)
    // keeps working unchanged.
    logKeys.forEach(key => writeFileSync(topLevel[key], ''));
    for (const [startIndex, endIndex] of ranges) {
        const chunkFiles = getLogFilenames(startIndex, endIndex);
        for (const key of logKeys) {
            try {
                const content = readFileSync(chunkFiles[key], 'utf8');
                if (content.length > 0) {
                    appendFileSync(topLevel[key], content);
                }
            } catch {
                // A chunk may not have written every log (e.g. no modifier errors at all).
            }
        }
    }

    writeFileSync(topLevel.statsFile, JSON.stringify(mergedStats, null, 2));

    const summary = generateSummary(mergedStats, false);
    console.log(summary);
    writeFileSync(topLevel.summaryFile, summary + '\n');
}

main();
