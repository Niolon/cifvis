/**
 * Converts cheap structure/grid/mesh counts into the three calibration predictors.
 * @param {object} metrics - Counts known before expensive pipeline stages start.
 * @returns {{fcalc:number, density:number, surface:number}} Linear predictor units.
 */
export function densityPipelinePredictors(metrics) {
    const reflectionCount = Math.max(0, Number(metrics.reflectionCount) || 0);
    const unitCellAtoms = Math.max(0, Number(metrics.unitCellAtoms) || 0);
    const scatteringModelCount = Math.max(0, Number(metrics.scatteringModelCount) || 0);
    const gridPoints = Math.max(1, Number(metrics.gridPoints) || 1);
    const coefficientCount = Math.max(0, Number(metrics.coefficientCount) || 0);
    const surfaceResolution = Math.max(1, Number(metrics.surfaceResolution) || 1);
    const marchingCubesPassCount = Math.max(
        1,
        Number(metrics.marchingCubesPassCount) || 1,
    );
    return {
        fcalc: reflectionCount * (unitCellAtoms + scatteringModelCount),
        density: gridPoints * (Math.log2(gridPoints) + 1) + coefficientCount,
        surface: surfaceResolution ** 3 * marchingCubesPassCount,
    };
}

/**
 * Estimates pipeline durations from processor-independent fitted work coefficients.
 * @param {object} metrics - Input to {@link densityPipelinePredictors}.
 * @param {object} workPerUnit - Fitted fcalc/density/surface work per predictor unit.
 * @param {number} processorSpeed - Current processor exercise iterations per millisecond.
 * @returns {object} Component estimates, total estimate, and raw predictors.
 */
export function estimateDensityPipelineTimings(metrics, workPerUnit, processorSpeed) {
    if (!(Number.isFinite(processorSpeed) && processorSpeed > 0)) {
        throw new Error('Processor speed must be a positive finite number');
    }
    const predictors = densityPipelinePredictors(metrics);
    const component = name => {
        const coefficient = Number(workPerUnit?.[`${name}WorkPerUnit`]);
        if (!(Number.isFinite(coefficient) && coefficient >= 0)) {
            throw new Error(`Missing non-negative ${name} work coefficient`);
        }
        return coefficient * predictors[name] / processorSpeed;
    };
    const fcalcMs = component('fcalc');
    const densityMs = component('density');
    const surfaceMs = component('surface');
    return {
        predictors,
        fcalcMs,
        densityMs,
        surfaceMs,
        totalMs: fcalcMs + densityMs + surfaceMs,
    };
}

/**
 * Divides estimated reusable cubic work into user-visible 100–200 ms increments.
 * Fractions are linear resolution/reciprocal-shell radii, so cumulative work is
 * approximated by fraction cubed. A cheap calculation remains a single final step.
 * @param {number} totalMs - Estimated complete pipeline duration.
 * @param {object} [options] - Timing window and cubic scaling exponent.
 * @returns {{fractions:number[],stepCount:number,estimatedStepMs:number}} Recommended schedule.
 */
export function recommendProgressiveSchedule(totalMs, options = {}) {
    const minimumStepMs = Number(options.minimumStepMs ?? 100);
    const maximumStepMs = Number(options.maximumStepMs ?? 200);
    const exponent = Number(options.exponent ?? 3);
    if (!(Number.isFinite(totalMs) && totalMs >= 0)) {
        throw new Error('Estimated pipeline duration must be a non-negative finite number');
    }
    if (!(minimumStepMs > 0 && maximumStepMs >= minimumStepMs)) {
        throw new Error('Progressive timing window must satisfy 0 < minimum <= maximum');
    }
    if (!(Number.isFinite(exponent) && exponent > 0)) {
        throw new Error('Progressive work exponent must be a positive finite number');
    }
    if (totalMs <= maximumStepMs) {
        return { fractions: [1], stepCount: 1, estimatedStepMs: totalMs };
    }
    const targetStepMs = (minimumStepMs + maximumStepMs) / 2;
    const minimumCount = Math.ceil(totalMs / maximumStepMs);
    const maximumCount = Math.max(minimumCount, Math.floor(totalMs / minimumStepMs));
    const stepCount = Math.min(
        maximumCount,
        Math.max(minimumCount, Math.round(totalMs / targetStepMs)),
    );
    const fractions = Array.from({ length: stepCount }, (_, index) =>
        Math.round(((index + 1) / stepCount) ** (1 / exponent) * 1000) / 1000);
    return { fractions, stepCount, estimatedStepMs: totalMs / stepCount };
}
