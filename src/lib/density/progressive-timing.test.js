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

    test('keeps cheap work single and divides longer work into 100–200 ms increments', () => {
        expect(recommendProgressiveSchedule(180)).toEqual({
            fractions: [1],
            stepCount: 1,
            estimatedStepMs: 180,
        });
        expect(recommendProgressiveSchedule(450)).toEqual({
            fractions: [0.693, 0.874, 1],
            stepCount: 3,
            estimatedStepMs: 150,
        });
        const long = recommendProgressiveSchedule(1930);
        expect(long.stepCount).toBe(13);
        expect(long.estimatedStepMs).toBeGreaterThanOrEqual(100);
        expect(long.estimatedStepMs).toBeLessThanOrEqual(200);
        expect(long.fractions.at(-1)).toBe(1);
    });
});
