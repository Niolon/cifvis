/* eslint-disable jsdoc/require-jsdoc */
import {
    calculateDifferenceDensityMap,
    parseDifferenceDensitySource,
} from './difference-density.js';

const continuationResolvers = new Map();

function normalizedSteps(steps) {
    const valid = (Array.isArray(steps) ? steps : [0.25, 0.5, 1])
        .map(Number)
        .filter(step => Number.isFinite(step) && step > 0 && step <= 1)
        .sort((a, b) => a - b);
    if (!valid.includes(1)) {
        valid.push(1);
    }
    return [...new Set(valid)];
}

function mapPayload(map) {
    return {
        cell: {
            a: map.cell.a,
            b: map.cell.b,
            c: map.cell.c,
            alpha: map.cell.alpha,
            beta: map.cell.beta,
            gamma: map.cell.gamma,
        },
        dimensions: map.dimensions,
        values: map.values,
        reflectionCount: map.reflectionCount,
        coefficientCount: map.coefficientCount,
        fullCoefficientCount: map.fullCoefficientCount,
        coefficientMode: map.coefficientMode,
        omitF000: map.omitF000,
        anomalousDispersion: map.anomalousDispersion,
        densitySource: map.densitySource,
        intensityScale: map.intensityScale,
        intensityScaleExplicit: map.intensityScaleExplicit,
        scaleFittedReflectionCount: map.scaleFittedReflectionCount,
        scaleR1: map.scaleR1,
        negativeIntensityCount: map.negativeIntensityCount,
        observations: map.observations,
        iam: map.iam,
        extinctionCorrection: map.extinctionCorrection,
        symmetryOperations: map.symmetryOperations,
        resolutionFraction: map.resolutionFraction,
        gridOversampling: map.gridOversampling,
        mean: map.mean,
        sigma: map.sigma,
        minimum: map.minimum,
        maximum: map.maximum,
        maxImaginary: map.maxImaginary,
        volume: map.volume,
    };
}

function waitForContinuation(loadId, stepIndex) {
    return new Promise(resolve => {
        continuationResolvers.set(`${loadId}:${stepIndex}`, resolve);
    });
}

async function calculateProgressively(message) {
    const started = performance.now();
    try {
        const dataset = parseDifferenceDensitySource(
            message.fcfText,
            message.fcfBlock,
            message.datasetOptions,
        );
        const steps = normalizedSteps(message.steps);
        const finalOversampling = Math.max(1, Number(message.gridOversampling) || 1);
        const initialOversampling = steps.length === 1
            ? finalOversampling
            : Math.min(finalOversampling, Math.max(1, Number(message.initialGridOversampling) || 1));
        let mapStarted = performance.now();
        let map = calculateDifferenceDensityMap(
            dataset,
            Number(message.reciprocalResolution) || 1,
            initialOversampling,
        );
        let mapTimeMs = performance.now() - mapStarted;
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            let payload = stepIndex === 0 ? mapPayload(map) : null;
            if (stepIndex === 1 && initialOversampling !== finalOversampling) {
                mapStarted = performance.now();
                map = calculateDifferenceDensityMap(
                    dataset,
                    Number(message.reciprocalResolution) || 1,
                    finalOversampling,
                );
                mapTimeMs = performance.now() - mapStarted;
                payload = mapPayload(map);
            }
            const update = {
                type: 'update',
                loadId: message.loadId,
                stepIndex,
                totalSteps: steps.length,
                final: stepIndex === steps.length - 1,
                computeTimeMs: payload ? mapTimeMs : 0,
                elapsedTimeMs: performance.now() - started,
                surfaceResolutionFraction: steps[stepIndex],
                map: payload,
            };
            globalThis.postMessage(update, payload ? [payload.values.buffer] : []);

            if (stepIndex < steps.length - 1) {
                await waitForContinuation(message.loadId, stepIndex);
            }
        }
    } catch (error) {
        globalThis.postMessage({
            type: 'error',
            loadId: message.loadId,
            error: error.message,
        });
    }
}

globalThis.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'continue') {
        const key = `${message.loadId}:${message.stepIndex}`;
        continuationResolvers.get(key)?.();
        continuationResolvers.delete(key);
        return;
    }
    if (message.type === 'load') {
        calculateProgressively(message);
    }
});
