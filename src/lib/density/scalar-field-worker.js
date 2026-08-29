/* eslint-disable jsdoc/require-jsdoc */
import {
    parseDifferenceDensitySource,
} from './difference-density.js';
import {
    createDifferenceDensityProgression,
} from './difference-density-progress.js';
import { normalizeIsosurfaceSteps } from './isosurface-progress.js';
import { parseCube } from './cube.js';
import { readReflectionIntensities } from './reflection-intensities.js';
import {
    calculateContourWorkerTask,
    contourTransferables,
} from './contour-worker-task.js';

const continuationResolvers = new Map();
const preparedReflectionSources = new Map();

function prepareReflectionSource(message) {
    const started = performance.now();
    const startedEpochMs = performance.timeOrigin + started;
    preparedReflectionSources.clear();
    try {
        const iamOptions = { includeAnomalous: false, ...message.iam };
        const reflectionOptions = { ...message.reflections };
        if (reflectionOptions.mergeFriedel === undefined) {
            reflectionOptions.mergeFriedel = iamOptions.includeAnomalous === false;
        }
        const observed = readReflectionIntensities(
            message.fcfText,
            message.fcfBlock,
            reflectionOptions,
        );
        const completed = performance.now();
        const completedEpochMs = performance.timeOrigin + completed;
        preparedReflectionSources.set(message.preparationId, {
            observed,
            preparationTimeMs: completed - started,
            started,
            startedEpochMs,
            completedEpochMs,
        });
        globalThis.postMessage({
            type: 'reflection-prepared',
            preparationId: message.preparationId,
            preparationTimeMs: completed - started,
            startedEpochMs,
            completedEpochMs,
        });
    } catch {
        // Explicit FCF coefficient sources need no observed-intensity loop.
        // Their normal parser remains the fallback when the load message arrives.
    }
}

function scalarFieldTransferables(payload) {
    if (!payload) {
        return [];
    }
    if (payload.storageMode === 'symmetry-orbits') {
        return [payload.representativeIndices.buffer, payload.representativeValues.buffer];
    }
    return [payload.values.buffer];
}

function waitForContinuation(loadId, stepIndex) {
    return new Promise(resolve => {
        continuationResolvers.set(`${loadId}:${stepIndex}`, resolve);
    });
}

async function calculateDifferenceDensityProgressively(message) {
    const calculationStartedEpochMs = performance.timeOrigin + performance.now();
    const prepared = preparedReflectionSources.get(message.preparationId);
    preparedReflectionSources.delete(message.preparationId);
    const started = prepared?.started ?? performance.now();
    const modelPostedEpochMs = message.modelPostedEpochMs;
    const joinReadyEpochMs = prepared && Number.isFinite(modelPostedEpochMs)
        ? Math.max(prepared.completedEpochMs, modelPostedEpochMs)
        : prepared?.completedEpochMs ?? calculationStartedEpochMs;
    const modelWaitForReflectionPreparationMs = prepared && Number.isFinite(modelPostedEpochMs)
        ? Math.max(0, prepared.completedEpochMs - modelPostedEpochMs)
        : 0;
    const workerWaitForModelMs = prepared && Number.isFinite(modelPostedEpochMs)
        ? Math.max(0, modelPostedEpochMs - prepared.completedEpochMs)
        : 0;
    const workerIdleAfterReflectionPreparationMs = workerWaitForModelMs;
    const workerJoinDelayMs = Math.max(0, calculationStartedEpochMs - joinReadyEpochMs);
    try {
        const datasetStarted = performance.now();
        const dataset = parseDifferenceDensitySource(
            message.fcfText,
            message.fcfBlock,
            {
                ...message.datasetOptions,
                preparedObservations: prepared?.observed,
            },
        );
        const datasetPreparationTimeMs = performance.now() - datasetStarted;
        const progressionStarted = performance.now();
        const progression = createDifferenceDensityProgression(dataset, {
            steps: message.steps,
            reciprocalResolution: message.reciprocalResolution,
            initialGridOversampling: message.initialGridOversampling,
            gridOversampling: message.gridOversampling,
            fftBackend: message.fftBackend,
            fftGridPlanner: message.fftGridPlanner,
            fftAxisKernel: message.fftAxisKernel,
            realTransform: message.realTransform,
            symmetryReducedFft: message.symmetryReducedFft,
        });
        const progressionSetupTimeMs = performance.now() - progressionStarted;
        const steps = progression.steps;
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const mapStarted = performance.now();
            const { map, changed } = progression.mapAt(stepIndex);
            const mapTimeMs = changed ? performance.now() - mapStarted : 0;
            const contourStarted = performance.now();
            const contours = calculateContourWorkerTask(
                map,
                message.contourRequest,
                steps[stepIndex],
            );
            const contourTimeMs = contours ? performance.now() - contourStarted : 0;
            const payloadStarted = performance.now();
            const payload = changed ? map.toPayload() : null;
            const payloadPreparationTimeMs = performance.now() - payloadStarted;
            const update = {
                type: 'update',
                loadId: message.loadId,
                stepIndex,
                totalSteps: steps.length,
                final: stepIndex === steps.length - 1,
                computeTimeMs: mapTimeMs,
                datasetPreparationTimeMs,
                reflectionPreparationTimeMs: prepared?.preparationTimeMs ?? 0,
                workerIdleAfterReflectionPreparationMs,
                modelWaitForReflectionPreparationMs,
                workerWaitForModelMs,
                workerJoinDelayMs,
                modelPostedAfterReflectionStartMs: prepared && Number.isFinite(modelPostedEpochMs)
                    ? modelPostedEpochMs - prepared.startedEpochMs
                    : null,
                calculationStartedEpochMs,
                progressionSetupTimeMs,
                payloadPreparationTimeMs,
                contourTimeMs,
                elapsedTimeMs: performance.now() - started,
                surfaceResolutionFraction: steps[stepIndex],
                map: payload,
                contours,
            };
            update.updatePostedEpochMs = performance.timeOrigin + performance.now();
            globalThis.postMessage(update, [
                ...(!message.contourRequest ? scalarFieldTransferables(payload) : []),
                ...contourTransferables(contours),
            ]);

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

async function loadCubeProgressively(message) {
    const started = performance.now();
    try {
        const map = parseCube(message.cubeText, message.cubeOptions);
        const computeTimeMs = performance.now() - started;
        const steps = normalizeIsosurfaceSteps(message.steps);
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const payload = stepIndex === 0 ? map.toPayload() : null;
            const contourStarted = performance.now();
            const contours = calculateContourWorkerTask(
                map,
                message.contourRequest,
                steps[stepIndex],
            );
            const contourTimeMs = contours ? performance.now() - contourStarted : 0;
            globalThis.postMessage({
                type: 'update',
                loadId: message.loadId,
                stepIndex,
                totalSteps: steps.length,
                final: stepIndex === steps.length - 1,
                computeTimeMs: stepIndex === 0 ? computeTimeMs : 0,
                contourTimeMs,
                elapsedTimeMs: performance.now() - started,
                surfaceResolutionFraction: steps[stepIndex],
                map: payload,
                contours,
            }, [
                ...(!message.contourRequest ? scalarFieldTransferables(payload) : []),
                ...contourTransferables(contours),
            ]);

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
    if (message.type === 'prepare-difference-density-reflections') {
        prepareReflectionSource(message);
    } else if (message.type === 'load-difference-density') {
        calculateDifferenceDensityProgressively(message);
    } else if (message.type === 'load-cube') {
        loadCubeProgressively(message);
    }
});
