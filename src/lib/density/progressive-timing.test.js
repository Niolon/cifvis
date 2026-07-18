import { describe, expect, test } from 'vitest';
import {
    densityPipelinePredictors,
    estimateDensityPipelineTimings,
    recommendProgressiveSchedule,
} from './progressive-timing.js';

describe('density progressive timing heuristic', () => {
    test('builds predictors from atom, reflection, grid, and mesh counts', () => {
        expect(densityPipelinePredictors({
            reflectionCount: 100,
            unitCellAtoms: 20,
            scatteringModelCount: 3,
            gridPoints: 4096,
            coefficientCount: 600,
            surfaceResolution: 64,
            marchingCubesPassCount: 2,
        })).toEqual({
            fcalc: 2300,
            density: 53848,
            surface: 524288,
        });
    });

    test('scales estimated durations inversely with measured processor speed', () => {
        const metrics = {
            reflectionCount: 100,
            unitCellAtoms: 20,
            scatteringModelCount: 3,
            gridPoints: 4096,
            coefficientCount: 600,
            surfaceResolution: 64,
            marchingCubesPassCount: 2,
        };
        const work = {
            fcalcWorkPerUnit: 10,
            densityWorkPerUnit: 2,
            surfaceWorkPerUnit: 20,
        };
        const first = estimateDensityPipelineTimings(metrics, work, 100000);
        const faster = estimateDensityPipelineTimings(metrics, work, 200000);

        expect(faster.totalMs).toBeCloseTo(first.totalMs / 2);
        expect(first.totalMs).toBeCloseTo(first.fcalcMs + first.densityMs + first.surfaceMs);
    });

    test('supports richer fitted log-linear component models', () => {
        const result = estimateDensityPipelineTimings({
            reflectionCount: 100,
            unitCellAtoms: 20,
            scatteringModelCount: 3,
            gridPoints: 4096,
            coefficientCount: 600,
            surfaceResolution: 64,
            marchingCubesPassCount: 2,
            asymmetricUnitAtoms: 5,
        }, {
            logLinear: {
                fcalc: {
                    features: ['reflectionCount'],
                    coefficients: [Math.log(1000), 1],
                },
                density: {
                    features: ['gridPoints'],
                    coefficients: [Math.log(10), 1],
                },
                surface: {
                    features: ['surfaceResolution'],
                    coefficients: [Math.log(100), 2],
                },
            },
        }, 100000);

        expect(result.fcalcMs).toBeCloseTo(1);
        expect(result.densityMs).toBeCloseTo(0.4096);
        expect(result.surfaceMs).toBeCloseTo(4.096);
    });

    test('rejects a missing feature required by a fitted model', () => {
        expect(() => estimateDensityPipelineTimings({}, {
            logLinear: {
                fcalc: { features: ['reflectionCount'], coefficients: [0, 1] },
            },
        }, 100000)).toThrow('Missing positive reflectionCount metric');
    });

    test('keeps cheap work single and bounds sequential preview overhead', () => {
        expect(recommendProgressiveSchedule(180)).toEqual({
            fractions: [1],
            stepCount: 1,
            previewCount: 0,
            estimatedPreviewMs: [],
            estimatedExtraWorkMs: 0,
            estimatedSequentialMs: 180,
            progressSignalIntervalMs: 150,
        });
        expect(recommendProgressiveSchedule(450)).toEqual({
            fractions: [0.693, 1],
            stepCount: 2,
            previewCount: 1,
            estimatedPreviewMs: [150],
            estimatedExtraWorkMs: 150,
            estimatedSequentialMs: 600,
            progressSignalIntervalMs: 150,
        });
        const long = recommendProgressiveSchedule(10000);
        expect(long.stepCount).toBe(6);
        expect(long.previewCount).toBe(5);
        expect(long.estimatedPreviewMs).toEqual([100, 125, 150, 175, 200]);
        expect(long.estimatedExtraWorkMs).toBe(750);
        expect(long.estimatedSequentialMs).toBe(10750);
        expect(long.fractions.at(-1)).toBe(1);
    });
});
