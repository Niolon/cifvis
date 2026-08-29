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

function maximum(values) {
    const finite = values.filter(Number.isFinite);
    return finite.length === 0 ? null : Math.max(...finite);
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
    const hybridCost = length => Number.isInteger(Math.log2(length))
        ? radixSum(length)
        : mixedRadixSum(length);
    return realTransformCost(dimensions(row, 'optimizedDimensions'), hybridCost) /
        realTransformCost(dimensions(row, 'legacyDimensions'), radixSum);
}

function smoothHybridTime(row) {
    return number(row, 'smoothHybridMs') ?? number(row, 'mixedRealMs');
}

function evaluateFftSelector(rows, threshold) {
    const selected = rows.map(row => fftCostRatio(row) <= threshold ? 'smoothHybrid' : 'radixReal');
    const actual = rows.map(row => smoothHybridTime(row) <= number(row, 'radixRealMs')
        ? 'smoothHybrid'
        : 'radixReal');
    const confusion = {};
    selected.forEach((selection, index) => {
        const key = `${actual[index]}→${selection}`;
        confusion[key] = (confusion[key] ?? 0) + 1;
    });
    const regrets = rows.map((row, index) => {
        const mixed = smoothHybridTime(row);
        const radix = number(row, 'radixRealMs');
        return (selected[index] === 'smoothHybrid' ? mixed : radix) / Math.min(mixed, radix);
    });
    return {
        predictor: 'smooth-hybrid-cost / radix-real-cost',
        threshold,
        correct: selected.filter((selection, index) => selection === actual[index]).length,
        accuracy: selected.filter((selection, index) => selection === actual[index]).length /
            rows.length,
        confusion,
        selectedModes: Object.fromEntries(['smoothHybrid', 'radixReal'].map(mode => [
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

function crossValidateFftSelector(rows, foldCount = 5) {
    const folds = [];
    for (let fold = 0; fold < foldCount; fold++) {
        const training = rows.filter((_, index) => index % foldCount !== fold);
        const testing = rows.filter((_, index) => index % foldCount === fold);
        const fitted = fitFftSelector(training);
        const evaluated = evaluateFftSelector(testing, fitted.threshold);
        folds.push({
            fold,
            trainingCount: training.length,
            testingCount: testing.length,
            threshold: fitted.threshold,
            accuracy: evaluated.accuracy,
            correct: evaluated.correct,
            p90SelectedRegret: evaluated.p90SelectedRegret,
        });
    }
    return {
        folds,
        medianThreshold: median(folds.map(fold => fold.threshold)),
        accuracy: folds.reduce((sum, fold) => sum + fold.correct, 0) / rows.length,
        medianFoldP90Regret: median(folds.map(fold => fold.p90SelectedRegret)),
    };
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
        medianHybridSpeedupVsAllMixed: median(ratios('mixedRealMs', 'smoothHybridMs')),
        medianHybridSpeedupVsRadixReal: median(ratios('radixRealMs', 'smoothHybridMs')),
        medianMemoryReduction: median(ratios('radixComplexBytes', 'mixedRealBytes')),
        medianHybridMemoryReductionVsRadixReal: median(
            ratios('radixRealBytes', 'smoothHybridBytes'),
        ),
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
const realWinner = row => smoothHybridTime(row) <= number(row, 'radixRealMs')
    ? 'smoothHybrid'
    : 'radixReal';
const fftRealByWinner = Object.fromEntries(['smoothHybrid', 'radixReal'].map(mode => {
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
            const mixed = smoothHybridTime(row);
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
const hybridAxisDiagnostics = {
    kernelPatterns: counts(successful.map(row => ({
        pattern: [0, 1, 2].map(axis => row[`smoothHybridAxis${axis}Kernel`]).join('/'),
    })), 'pattern'),
    byAxis: Object.fromEntries([0, 1, 2].map(axis => [axis, {
        kernels: counts(successful.map(row => ({
            kernel: row[`smoothHybridAxis${axis}Kernel`],
        })), 'kernel'),
        medianLength: median(successful.map(row => number(row, `smoothHybridAxis${axis}Length`))),
        medianLineCount: median(successful.map(row =>
            number(row, `smoothHybridAxis${axis}LineCount`))),
        medianKernelMs: median(successful.map(row =>
            number(row, `smoothHybridAxis${axis}KernelMs`))),
    }])),
    planCacheMisses: successful.reduce((sum, row) => sum + [0, 1, 2].filter(axis =>
        row[`smoothHybridAxis${axis}PlanCacheHit`] === 'false').length, 0),
    medianPlanSetupMs: median(successful.map(row => number(row, 'smoothHybridPlanSetupMs'))),
    hybridVsAllMixed: {
        hybridWins: successful.filter(row =>
            smoothHybridTime(row) < number(row, 'mixedRealMs')).length,
        allMixedWins: successful.filter(row =>
            smoothHybridTime(row) >= number(row, 'mixedRealMs')).length,
        medianSpeedupAllCases: median(successful.map(row =>
            number(row, 'mixedRealMs') / smoothHybridTime(row))),
        casesWithRadix2Axis: successful.filter(row => [0, 1, 2].some(axis =>
            row[`smoothHybridAxis${axis}Kernel`] === 'radix-2')).length,
        medianSpeedupWithRadix2Axis: median(successful.filter(row => [0, 1, 2].some(axis =>
            row[`smoothHybridAxis${axis}Kernel`] === 'radix-2')).map(row =>
            number(row, 'mixedRealMs') / smoothHybridTime(row))),
    },
};
const complexWinners = successful.map(row => {
    const complex = Math.min(number(row, 'radixComplexMs'), number(row, 'mixedComplexMs'));
    const real = Math.min(
        number(row, 'radixRealMs'),
        number(row, 'mixedRealMs'),
        smoothHybridTime(row),
    );
    return {
        codId: row.codId,
        dimensions: row.optimizedDimensions,
        complexMs: complex,
        realMs: real,
        advantageMs: real - complex,
    };
}).filter(result => result.advantageMs > 0);

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
    fftAutoSelectorCrossValidation: crossValidateFftSelector(successful),
    fftCandidateSelectors: [0.25, 0.27, 0.3].map(threshold =>
        evaluateFftSelector(successful, threshold)),
    hybridAxisDiagnostics,
    validation: {
        maximumHybridVsAllMixedDifference: maximum(successful.map(row =>
            number(row, 'mapMaximumDifference'))),
        maximumDifferenceVsDirectSummation: maximum(successful.map(row =>
            number(row, 'mapMaximumDirectDifference'))),
        maximumRmsDifference: maximum(successful.map(row => number(row, 'mapRmsDifference'))),
        complexWinnerCount: complexWinners.length,
        complexWinnerMedianAdvantageMs: median(complexWinners.map(result => result.advantageMs)),
        complexWinnerMaximumAdvantageMs: maximum(complexWinners.map(result => result.advantageMs)),
        complexWinnersWithinTwoMs: complexWinners.filter(result => result.advantageMs <= 2).length,
        complexWinners,
    },
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
        gridVolumeRatioVsHybridGridSpeedup: correlation(
            successful,
            row => number(row, 'legacyGridPoints') / number(row, 'optimizedGridPoints'),
            row => number(row, 'radixRealMs') / smoothHybridTime(row),
        ),
        predictedCostRatioVsMeasuredCostRatio: correlation(
            successful,
            row => fftCostRatio(row),
            row => smoothHybridTime(row) / number(row, 'radixRealMs'),
        ),
    },
    surface: surfaceSummary,
}, null, 2));
