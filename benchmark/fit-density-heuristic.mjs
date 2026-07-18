#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- benchmark-local fitting helpers */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    estimateDensityPipelineTimings,
    recommendProgressiveSchedule,
} from '../src/lib/density/progressive-timing.js';

const COMPONENTS = {
    fcalc: {
        duration: 'fcalcMs',
        features: ['reflectionCount', 'unitCellAtoms', 'scatteringModelCount'],
    },
    density: {
        duration: 'densityMs',
        features: ['gridPoints', 'coefficientCount'],
    },
    surface: {
        duration: 'surfaceWallMs',
        features: [
            'surfaceResolution',
            'marchingCubesPassCount',
            'symmetryOperationCount',
            'asymmetricUnitAtoms',
            'unitCellAtoms',
            'cellVolume',
        ],
    },
};

const DERIVED_COLUMNS = [
    'estimatedFcalcMs',
    'estimatedDensityMs',
    'estimatedSurfaceMs',
    'estimatedTotalMs',
    'recommendedStepCount',
    'recommendedStepMs',
    'recommendedPreviewCount',
    'recommendedPreviewMs',
    'recommendedExtraWorkMs',
    'recommendedSequentialMs',
    'recommendedProgressSignalMs',
    'recommendedProgressiveSteps',
];

function parseArguments(argv) {
    const options = {
        csv: 'benchmark/density-pipeline-cod.csv',
        model: 'benchmark/density-pipeline-heuristic.json',
    };
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (!argument.startsWith('--')) {
            throw new Error(`Unexpected argument: ${argument}`);
        }
        const key = argument.slice(2);
        if (!Object.hasOwn(options, key)) {
            throw new Error(`Unknown option: ${argument}`);
        }
        options[key] = argv[++index];
    }
    return options;
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n') {
            row.push(field.replace(/\r$/, ''));
            if (row.some(value => value !== '')) {
                rows.push(row);
            }
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (quoted) {
        throw new Error('Unterminated quoted field in calibration CSV');
    }
    if (field || row.length) {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
    }
    const [header, ...values] = rows;
    return {
        header,
        records: values.map(fields => Object.fromEntries(
            header.map((name, index) => [name, fields[index] ?? '']),
        )),
    };
}

function csvValue(value) {
    const string = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function writeCsv(path, header, records) {
    const lines = [header.join(',')];
    for (const record of records) {
        lines.push(header.map(column => csvValue(record[column])).join(','));
    }
    writeFileSync(path, `${lines.join('\n')}\n`);
}

function numericRecord(record) {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => {
        const number = Number(value);
        return [key, value !== '' && Number.isFinite(number) ? number : value];
    }));
}

function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

function solveLinearSystem(matrix, values) {
    const size = values.length;
    const augmented = matrix.map((row, index) => [...row, values[index]]);
    for (let pivot = 0; pivot < size; pivot++) {
        let selected = pivot;
        for (let row = pivot + 1; row < size; row++) {
            if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[selected][pivot])) {
                selected = row;
            }
        }
        [augmented[pivot], augmented[selected]] = [augmented[selected], augmented[pivot]];
        const divisor = augmented[pivot][pivot];
        if (Math.abs(divisor) < 1e-12) {
            throw new Error('Singular timing-model regression');
        }
        for (let column = pivot; column <= size; column++) {
            augmented[pivot][column] /= divisor;
        }
        for (let row = 0; row < size; row++) {
            if (row === pivot) {
                continue;
            }
            const factor = augmented[row][pivot];
            for (let column = pivot; column <= size; column++) {
                augmented[row][column] -= factor * augmented[pivot][column];
            }
        }
    }
    return augmented.map(row => row[size]);
}

function weightedRegression(rows, weights) {
    const width = rows[0].x.length;
    const matrix = Array.from({ length: width }, () => Array(width).fill(0));
    const values = Array(width).fill(0);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const { x, y } = rows[rowIndex];
        const weight = weights[rowIndex];
        for (let first = 0; first < width; first++) {
            values[first] += weight * x[first] * y;
            for (let second = 0; second < width; second++) {
                matrix[first][second] += weight * x[first] * x[second];
            }
        }
    }
    for (let index = 1; index < width; index++) {
        matrix[index][index] += 1e-8;
    }
    return solveLinearSystem(matrix, values);
}

function fitRobustLogModel(records, definition) {
    const rows = records.map(record => ({
        x: [1, ...definition.features.map(feature =>
            Math.log(Math.max(Number(record[feature]), 1e-12)))],
        y: Math.log(Number(record[definition.duration]) * Number(record.processorSpeed)),
    }));
    let weights = rows.map(() => 1);
    let coefficients = weightedRegression(rows, weights);
    for (let iteration = 0; iteration < 8; iteration++) {
        const residuals = rows.map(({ x, y }) =>
            y - x.reduce((sum, value, index) => sum + value * coefficients[index], 0));
        const centre = median(residuals);
        const scale = Math.max(
            1.4826 * median(residuals.map(residual => Math.abs(residual - centre))),
            1e-6,
        );
        const cutoff = 1.345 * scale;
        weights = residuals.map(residual =>
            Math.min(1, cutoff / Math.max(Math.abs(residual - centre), 1e-12)));
        coefficients = weightedRegression(rows, weights);
    }
    return {
        features: definition.features,
        coefficients,
        target: `log(${definition.duration} * processorSpeed)`,
        fit: 'Huber IRLS in log space',
    };
}

function metricsFor(record) {
    return {
        reflectionCount: Number(record.reflectionCount),
        unitCellAtoms: Number(record.unitCellAtoms),
        scatteringModelCount: Number(record.scatteringModelCount),
        gridPoints: Number(record.gridPoints),
        coefficientCount: Number(record.coefficientCount),
        surfaceResolution: Number(record.surfaceResolution),
        marchingCubesPassCount: Number(record.marchingCubesPassCount),
        symmetryOperationCount: Number(record.symmetryOperationCount),
        asymmetricUnitAtoms: Number(record.asymmetricUnitAtoms),
        cellVolume: Number(record.cellVolume),
    };
}

function evaluate(records, model) {
    const errors = { fcalc: [], density: [], surface: [], total: [] };
    for (const record of records) {
        const estimate = estimateDensityPipelineTimings(
            metricsFor(record), model, Number(record.processorSpeed),
        );
        const actual = {
            fcalc: Number(record.fcalcMs),
            density: Number(record.densityMs),
            surface: Number(record.surfaceWallMs),
            total: Number(record.fcalcMs) + Number(record.densityMs) +
                Number(record.surfaceWallMs),
        };
        const predicted = {
            fcalc: estimate.fcalcMs,
            density: estimate.densityMs,
            surface: estimate.surfaceMs,
            total: estimate.totalMs,
        };
        for (const name of Object.keys(errors)) {
            errors[name].push(Math.abs(predicted[name] - actual[name]) / actual[name]);
        }
    }
    return Object.fromEntries(Object.entries(errors).map(([name, values]) => [name, {
        medianAbsolutePercentageError: median(values) * 100,
        meanAbsolutePercentageError:
            values.reduce((sum, value) => sum + value, 0) / values.length * 100,
        p90AbsolutePercentageError: percentile(values, 0.9) * 100,
    }]));
}

function fitModels(records) {
    return {
        logLinear: Object.fromEntries(Object.entries(COMPONENTS).map(([name, definition]) =>
            [name, fitRobustLogModel(records, definition)])),
    };
}

function isSuccessful(record) {
    return record.success === 'true' && Object.values(COMPONENTS).every(definition =>
        Number(record[definition.duration]) > 0 && definition.features.every(feature =>
            Number(record[feature]) > 0)) && Number(record.processorSpeed) > 0;
}

function applyEstimates(records, model) {
    for (const record of records.filter(isSuccessful)) {
        const estimate = estimateDensityPipelineTimings(
            metricsFor(record), model, Number(record.processorSpeed),
        );
        record.estimatedFcalcMs = estimate.fcalcMs;
        record.estimatedDensityMs = estimate.densityMs;
        record.estimatedSurfaceMs = estimate.surfaceMs;
        record.estimatedTotalMs = estimate.totalMs;
        const schedule = recommendProgressiveSchedule(estimate.totalMs);
        record.recommendedStepCount = schedule.stepCount;
        record.recommendedPreviewCount = schedule.previewCount;
        record.recommendedPreviewMs = schedule.estimatedPreviewMs.join(';');
        record.recommendedExtraWorkMs = schedule.estimatedExtraWorkMs;
        record.recommendedSequentialMs = schedule.estimatedSequentialMs;
        record.recommendedProgressSignalMs = schedule.progressSignalIntervalMs;
        record.recommendedProgressiveSteps = schedule.fractions.join(';');
    }
}

export function refitDensityHeuristic(options, printResult = false) {
    const csvPath = resolve(options.csv);
    const modelPath = resolve(options.model);
    const { header, records } = parseCsv(readFileSync(csvPath, 'utf8'));
    const successful = records.filter(isSuccessful).map(numericRecord);
    if (successful.length < 20) {
        throw new Error('At least 20 successful observations are required to fit timing models');
    }
    const training = successful.filter(record => Number(record.sampleIndex) % 5 !== 0);
    const validation = successful.filter(record => Number(record.sampleIndex) % 5 === 0);
    const existing = JSON.parse(readFileSync(modelPath, 'utf8'));
    const fittedTrainingModel = fitModels(training);
    const validationMetrics = {
        observationCount: validation.length,
        split: 'sampleIndex modulo 5 equals zero',
        legacy: evaluate(validation, {
            fcalcWorkPerUnit: existing.workPerUnit.fcalcWorkPerUnit,
            densityWorkPerUnit: existing.workPerUnit.densityWorkPerUnit,
            surfaceWorkPerUnit: existing.workPerUnit.surfaceWorkPerUnit,
        }),
        logLinear: evaluate(validation, fittedTrainingModel),
    };
    const finalModel = fitModels(successful);
    const updatedModel = {
        ...existing,
        generatedAt: new Date().toISOString(),
        estimatorVersion: 2,
        workPerUnit: {
            ...existing.workPerUnit,
            ...finalModel,
        },
        validation: validationMetrics,
        progressiveTimingWindowMs: [100, 200],
        minimumPreviewTotalMs: 300,
        maximumPreviewBudgetMs: 750,
        maximumPreviewSteps: 5,
        maximumPreviewOverheadFraction: 0.5,
        progressiveFractionModel: '(estimated preview redraw ms / final estimated ms)^(1/3)',
        progressSignalIntervalMs: 150,
    };
    applyEstimates(records, updatedModel.workPerUnit);
    const outputHeader = [
        ...header.filter(column => !DERIVED_COLUMNS.includes(column)),
        ...DERIVED_COLUMNS.filter(column => column !== 'recommendedStepMs'),
    ];
    writeCsv(csvPath, outputHeader, records);
    writeFileSync(modelPath, `${JSON.stringify(updatedModel, null, 2)}\n`);
    const result = {
        csv: csvPath,
        model: modelPath,
        observations: successful.length,
        training: training.length,
        validation: validation.length,
        validationMetrics,
        coefficients: finalModel.logLinear,
    };
    if (printResult) {
        console.log(JSON.stringify(result, null, 2));
    }
    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    refitDensityHeuristic(parseArguments(process.argv.slice(2)), true);
}
