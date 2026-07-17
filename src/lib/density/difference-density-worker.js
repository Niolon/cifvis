/* eslint-disable jsdoc/require-jsdoc */
import {
    parseDifferenceDensitySource,
} from './difference-density.js';
import { createDifferenceDensityProgression } from './difference-density-progress.js';

const continuationResolvers = new Map();

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
        const progression = createDifferenceDensityProgression(dataset, {
            steps: message.steps,
            reciprocalResolution: message.reciprocalResolution,
            initialGridOversampling: message.initialGridOversampling,
            gridOversampling: message.gridOversampling,
        });
        const steps = progression.steps;
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const mapStarted = performance.now();
            const { map, changed } = progression.mapAt(stepIndex);
            const mapTimeMs = changed ? performance.now() - mapStarted : 0;
            const payload = changed ? map.toPayload() : null;
            const update = {
                type: 'update',
                loadId: message.loadId,
                stepIndex,
                totalSteps: steps.length,
                final: stepIndex === steps.length - 1,
                computeTimeMs: mapTimeMs,
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
