#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone benchmark analysis */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] ?? 'benchmark/density-optimization-cod.csv');

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                value += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                value += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(value);
            value = '';
        } else if (character === '\n') {
            row.push(value);
            rows.push(row);
            row = [];
            value = '';
        } else if (character !== '\r') {
            value += character;
        }
    }
    if (value || row.length) {
        row.push(value);
        rows.push(row);
    }
    const [header, ...records] = rows;
    return records.filter(record => record.length === header.length).map(record =>
        Object.fromEntries(header.map((column, index) => [column, record[index]])));
}

function number(row, key) {
    const value = Number(row[key]);
    return Number.isFinite(value) ? value : null;
}

function median(values) {
    const sorted = values.filter(Number.isFinite).sort((first, second) => first - second);
    if (sorted.length === 0) {
        return null;
    }
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values, fraction) {
    const sorted = values.filter(Number.isFinite).sort((first, second) => first - second);
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function correlation(rows, first, second) {
    const pairs = rows.map(row => [first(row), second(row)]).filter(pair =>
        pair.every(Number.isFinite));
    const means = [0, 1].map(axis => pairs.reduce((sum, pair) => sum + pair[axis], 0) / pairs.length);
    const covariance = pairs.reduce((sum, pair) =>
        sum + (pair[0] - means[0]) * (pair[1] - means[1]), 0);
    const variances = [0, 1].map(axis => pairs.reduce((sum, pair) =>
        sum + (pair[axis] - means[axis]) ** 2, 0));
    return covariance / Math.sqrt(variances[0] * variances[1]);
}

function counts(rows, key) {
    return Object.fromEntries([...rows.reduce((result, row) => {
        result.set(row[key], (result.get(row[key]) ?? 0) + 1);
        return result;
    }, new Map())].sort((first, second) => second[1] - first[1]));
}

function dimensions(row, key) {
    return row[key].split('x').map(Number);
}

function radixSum(length) {
    return 2 * Math.log2(length);
}

function mixedRadixSum(length) {
    let remaining = length;
    let sum = 0;
    for (const factor of [2, 3, 5]) {
        while (remaining % factor === 0) {
            sum += factor;
            remaining /= factor;
        }
    }
    return remaining === 1 ? sum : Infinity;
}

function realTransformCost(usedDimensions, factorCost) {
    const [nx, ny, nz] = usedDimensions;
    const halfSize = (Math.floor(nx / 2) + 1) * ny * nz;
    const volume = nx * ny * nz;
    return halfSize * (factorCost(ny) + factorCost(nz)) + volume * factorCost(nx);
}

function fftCostRatio(row) {
    return realTransformCost(dimensions(row, 'optimizedDimensions'), mixedRadixSum) /
        realTransformCost(dimensions(row, 'legacyDimensions'), radixSum);
}

function evaluateFftSelector(rows, threshold) {
    const selected = rows.map(row => fftCostRatio(row) <= threshold ? 'mixedReal' : 'radixReal');
    const actual = rows.map(row => number(row, 'mixedRealMs') <= number(row, 'radixRealMs')
        ? 'mixedReal'
        : 'radixReal');
    const confusion = {};
    selected.forEach((selection, index) => {
        const key = `${actual[index]}→${selection}`;
        confusion[key] = (confusion[key] ?? 0) + 1;
    });
    const regrets = rows.map((row, index) => {
        const mixed = number(row, 'mixedRealMs');
        const radix = number(row, 'radixRealMs');
        return (selected[index] === 'mixedReal' ? mixed : radix) / Math.min(mixed, radix);
    });
    return {
        predictor: 'mixed-real-cost / radix-real-cost',
        threshold,
        correct: selected.filter((selection, index) => selection === actual[index]).length,
        accuracy: selected.filter((selection, index) => selection === actual[index]).length /
            rows.length,
        confusion,
        selectedModes: Object.fromEntries(['mixedReal', 'radixReal'].map(mode => [
            mode,
            selected.filter(value => value === mode).length,
        ])),
        medianSelectedRegret: median(regrets),
        p90SelectedRegret: quantile(regrets, 0.9),
    };
}

function fitFftSelector(rows) {
    const candidates = rows.map(row => fftCostRatio(row)).sort((first, second) => first - second);
    return candidates.map(threshold => evaluateFftSelector(rows, threshold)).reduce(
        (best, candidate) => !best || candidate.correct > best.correct || (
            candidate.correct === best.correct &&
            candidate.medianSelectedRegret < best.medianSelectedRegret
        ) ? candidate : best,
        null,
    );
}

function summarize(rows) {
    const ratios = (numerator, denominator) => rows.map(row =>
        number(row, numerator) / number(row, denominator));
    return {
        count: rows.length,
        medianAtoms: median(rows.map(row => number(row, 'asymmetricUnitAtoms'))),
        medianSymmetryOperations: median(rows.map(row => number(row, 'symmetryOperationCount'))),
        medianCellVolume: median(rows.map(row => number(row, 'cellVolume'))),
        medianGridPoints: median(rows.map(row => number(row, 'optimizedGridPoints'))),
        fftModeWinners: counts(rows, 'bestFftMode'),
        medianMixedRealSpeedupVsRadixComplex: median(ratios('radixComplexMs', 'mixedRealMs')),
        medianMixedGridSpeedupVsRadixReal: median(ratios('radixRealMs', 'mixedRealMs')),
        medianHermitianSpeedupMixedGrid: median(ratios('mixedComplexMs', 'mixedRealMs')),
        medianHermitianSpeedupRadixGrid: median(ratios('radixComplexMs', 'radixRealMs')),
        medianMemoryReduction: median(ratios('radixComplexBytes', 'mixedRealBytes')),
    };
}

const records = parseCsv(readFileSync(path, 'utf8'));
const successful = records.filter(row => row.success === 'true');
const gridPoints = successful.map(row => number(row, 'optimizedGridPoints'));
const sizeLimits = [0.25, 0.5, 0.75].map(fraction => quantile(gridPoints, fraction));
const sizeGroup = row => {
    const points = number(row, 'optimizedGridPoints');
    if (points <= sizeLimits[0]) {
        return 'small';
    }
    if (points <= sizeLimits[1]) {
        return 'medium';
    }
    if (points <= sizeLimits[2]) {
        return 'large';
    }
    return 'very-large';
};
const symmetryGroup = row => {
    const count = number(row, 'symmetryOperationCount');
    if (count === 1) {
        return '1';
    }
    if (count <= 4) {
        return '2-4';
    }
    if (count <= 8) {
        return '5-8';
    }
    if (count <= 16) {
        return '9-16';
    }
    return '17+';
};
const groupBy = classifier => Object.fromEntries([...successful.reduce((groups, row) => {
    const key = classifier(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    return groups;
}, new Map())].map(([key, rows]) => [key, summarize(rows)]));
const surfaceRows = successful.filter(row => row.bestSurfaceMode);
const realWinner = row => number(row, 'mixedRealMs') <= number(row, 'radixRealMs')
    ? 'mixedReal'
    : 'radixReal';
const fftRealByWinner = Object.fromEntries(['mixedReal', 'radixReal'].map(mode => {
    const rows = successful.filter(row => realWinner(row) === mode);
    return [mode, {
        count: rows.length,
        medianAtoms: median(rows.map(row => number(row, 'asymmetricUnitAtoms'))),
        medianSymmetryOperations: median(rows.map(row => number(row, 'symmetryOperationCount'))),
        medianCellVolume: median(rows.map(row => number(row, 'cellVolume'))),
        medianGridPoints: median(rows.map(row => number(row, 'optimizedGridPoints'))),
        medianGridVolumeRatio: median(rows.map(row =>
            number(row, 'legacyGridPoints') / number(row, 'optimizedGridPoints'))),
        medianPredictedCostRatio: median(rows.map(fftCostRatio)),
        medianWinnerAdvantage: median(rows.map(row => {
            const mixed = number(row, 'mixedRealMs');
            const radix = number(row, 'radixRealMs');
            return Math.max(mixed, radix) / Math.min(mixed, radix);
        })),
    }];
}));
const surfaceSummary = surfaceRows.length === 0 ? null : {
    count: surfaceRows.length,
    winners: counts(surfaceRows, 'bestSurfaceMode'),
    medianRegionExpansionSpeedup: median(surfaceRows.map(row =>
        number(row, 'legacyCellSurfaceMs') / number(row, 'regionExpandCellMs'))),
    medianPatchExpansionSpeedup: median(surfaceRows.map(row =>
        number(row, 'legacyCellSurfaceMs') / number(row, 'cachedExpandCellMs'))),
    bySize: Object.fromEntries(['small', 'medium', 'large', 'very-large'].map(group => {
        const rows = surfaceRows.filter(row => sizeGroup(row) === group);
        return [group, { count: rows.length, winners: counts(rows, 'bestSurfaceMode') }];
    })),
    bySymmetry: Object.fromEntries(['1', '2-4', '5-8', '9-16', '17+'].map(group => {
        const rows = surfaceRows.filter(row => symmetryGroup(row) === group);
        return [group, { count: rows.length, winners: counts(rows, 'bestSurfaceMode') }];
    })),
    byWinner: Object.fromEntries(['direct-legacy', 'region-cache', 'patch-cache'].map(mode => {
        const rows = surfaceRows.filter(row => row.bestSurfaceMode === mode);
        return [mode, {
            count: rows.length,
            medianAtoms: median(rows.map(row => number(row, 'asymmetricUnitAtoms'))),
            medianSymmetryOperations: median(rows.map(row => number(row, 'symmetryOperationCount'))),
            medianCellVolume: median(rows.map(row => number(row, 'cellVolume'))),
            medianGridPoints: median(rows.map(row => number(row, 'optimizedGridPoints'))),
            medianRegionExpansionCacheHits: median(rows.map(row =>
                number(row, 'regionExpandCacheHits'))),
            medianPatchExpansionCacheHits: median(rows.map(row =>
                number(row, 'expandedCacheHitCells'))),
            medianPatchExpansionCacheMisses: median(rows.map(row =>
                number(row, 'expandedCacheMissCells'))),
            medianRegionExpansionMs: median(rows.map(row => number(row, 'regionExpandCellMs'))),
            medianPatchExpansionMs: median(rows.map(row => number(row, 'cachedExpandCellMs'))),
        }];
    })),
};

console.log(JSON.stringify({
    input: path,
    requested: records.length,
    successful: successful.length,
    failures: records.length - successful.length,
    sizeQuartileGridPointLimits: sizeLimits,
    overall: summarize(successful),
    bySize: groupBy(sizeGroup),
    bySymmetryOperations: groupBy(symmetryGroup),
    fftRealByWinner,
    fftAutoSelector: fitFftSelector(successful),
    fftCandidateSelectors: [0.25, 0.27, 0.3].map(threshold =>
        evaluateFftSelector(successful, threshold)),
    correlations: {
        logGridPointsVsMixedRealSpeedup: correlation(
            successful,
            row => Math.log(number(row, 'optimizedGridPoints')),
            row => number(row, 'radixComplexMs') / number(row, 'mixedRealMs'),
        ),
        logCellVolumeVsMixedRealSpeedup: correlation(
            successful,
            row => Math.log(number(row, 'cellVolume')),
            row => number(row, 'radixComplexMs') / number(row, 'mixedRealMs'),
        ),
        logAtomCountVsMixedRealSpeedup: correlation(
            successful,
            row => Math.log(number(row, 'asymmetricUnitAtoms')),
            row => number(row, 'radixComplexMs') / number(row, 'mixedRealMs'),
        ),
        symmetryOperationsVsMixedRealSpeedup: correlation(
            successful,
            row => number(row, 'symmetryOperationCount'),
            row => number(row, 'radixComplexMs') / number(row, 'mixedRealMs'),
        ),
        gridVolumeRatioVsMixedGridSpeedup: correlation(
            successful,
            row => number(row, 'legacyGridPoints') / number(row, 'optimizedGridPoints'),
            row => number(row, 'radixRealMs') / number(row, 'mixedRealMs'),
        ),
        predictedCostRatioVsMeasuredCostRatio: correlation(
            successful,
            row => fftCostRatio(row),
            row => number(row, 'mixedRealMs') / number(row, 'radixRealMs'),
        ),
    },
    surface: surfaceSummary,
}, null, 2));
