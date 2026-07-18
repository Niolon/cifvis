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
        const logModel = workPerUnit?.logLinear?.[name];
        if (logModel) {
            const features = Array.isArray(logModel.features) ? logModel.features : [];
            const coefficients = Array.isArray(logModel.coefficients)
                ? logModel.coefficients.map(Number)
                : [];
            if (coefficients.length !== features.length + 1 ||
                !coefficients.every(Number.isFinite)) {
                throw new Error(`Invalid ${name} log-linear timing model`);
            }
            const logWork = features.reduce((sum, feature, index) => {
                const value = Number(metrics[feature]);
                if (!(Number.isFinite(value) && value > 0)) {
                    throw new Error(
                        `Missing positive ${feature} metric for ${name} timing model`,
                    );
                }
                return sum + coefficients[index + 1] * Math.log(value);
            }, coefficients[0]);
            return Math.exp(logWork) / processorSpeed;
        }
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
 * Selects a bounded number of sequential preview redraws. Every preview is a
 * complete lower-resolution calculation, so its cost is additive rather than
 * reusable. Cheap calculations remain single-stage; expensive calculations
 * get previews whose combined estimated overhead stays below the configured
 * budget. Long gaps should use progress-only signals instead of more redraws.
 * @param {number} totalMs - Estimated complete pipeline duration.
 * @param {object} [options] - Preview timing, budget, and cubic scaling options.
 * @returns {object} Fractions, preview costs, total overhead, and signal cadence.
 */
export function recommendProgressiveSchedule(totalMs, options = {}) {
    const minimumStepMs = Number(options.minimumStepMs ?? 100);
    const maximumStepMs = Number(options.maximumStepMs ?? 200);
    const minimumPreviewTotalMs = Number(options.minimumPreviewTotalMs ?? 300);
    const maximumPreviewBudgetMs = Number(options.maximumPreviewBudgetMs ?? 750);
    const maximumPreviewSteps = Math.max(0, Math.round(options.maximumPreviewSteps ?? 5));
    const maximumOverheadFraction = Number(options.maximumOverheadFraction ?? 0.5);
    const progressSignalIntervalMs = Number(options.progressSignalIntervalMs ?? 150);
    const exponent = Number(options.exponent ?? 3);
    if (!(Number.isFinite(totalMs) && totalMs >= 0)) {
        throw new Error('Estimated pipeline duration must be a non-negative finite number');
    }
    if (!(minimumStepMs > 0 && maximumStepMs >= minimumStepMs)) {
        throw new Error('Progressive timing window must satisfy 0 < minimum <= maximum');
    }
    if (!(minimumPreviewTotalMs >= 0 && maximumPreviewBudgetMs >= 0 &&
        maximumOverheadFraction >= 0 && progressSignalIntervalMs > 0)) {
        throw new Error('Progressive preview budgets and signal interval must be non-negative');
    }
    if (!(Number.isFinite(exponent) && exponent > 0)) {
        throw new Error('Progressive work exponent must be a positive finite number');
    }
    const singleStage = () => ({
        fractions: [1],
        stepCount: 1,
        previewCount: 0,
        estimatedPreviewMs: [],
        estimatedExtraWorkMs: 0,
        estimatedSequentialMs: totalMs,
        progressSignalIntervalMs,
    });
    if (totalMs < minimumPreviewTotalMs || maximumPreviewSteps === 0) {
        return singleStage();
    }
    const availableBudgetMs = Math.min(
        maximumPreviewBudgetMs,
        totalMs * maximumOverheadFraction,
    );
    let estimatedPreviewMs = [];
    for (let count = 1; count <= maximumPreviewSteps; count++) {
        const candidate = count === 1
            ? [(minimumStepMs + maximumStepMs) / 2]
            : Array.from({ length: count }, (_, index) =>
                minimumStepMs + index / (count - 1) * (maximumStepMs - minimumStepMs));
        const candidateCost = candidate.reduce((sum, value) => sum + value, 0);
        if (candidateCost > availableBudgetMs || candidate.at(-1) >= totalMs) {
            break;
        }
        estimatedPreviewMs = candidate;
    }
    if (estimatedPreviewMs.length === 0) {
        return singleStage();
    }
    const previewFractions = estimatedPreviewMs.map(duration =>
        Math.round((duration / totalMs) ** (1 / exponent) * 1000) / 1000);
    const estimatedExtraWorkMs = estimatedPreviewMs.reduce((sum, value) => sum + value, 0);
    return {
        fractions: [...previewFractions, 1],
        stepCount: estimatedPreviewMs.length + 1,
        previewCount: estimatedPreviewMs.length,
        estimatedPreviewMs,
        estimatedExtraWorkMs,
        estimatedSequentialMs: totalMs + estimatedExtraWorkMs,
        progressSignalIntervalMs,
    };
}
