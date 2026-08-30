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
    const debugTimings = message.debugTimings === true;
    const started = debugTimings ? performance.now() : null;
    const startedEpochMs = debugTimings ? performance.timeOrigin + started : null;
    preparedReflectionSources.clear();
    try {
        const iamOptions = { includeAnomalous: false, ...message.iam };
        const reflectionOptions = { ...message.reflections };
        if (reflectionOptions.mergeFriedel === undefined) {
            reflectionOptions.mergeFriedel = iamOptions.includeAnomalous === false;
        }
        reflectionOptions.debug = debugTimings;
        reflectionOptions.resolveDifferenceDensityInputMode = true;
        reflectionOptions.differenceDensityInputMode = message.inputMode;
        reflectionOptions.differenceDensityCoefficientColumns = message.coefficientColumns;
        const observed = readReflectionIntensities(
            message.fcfText,
            message.fcfBlock,
            reflectionOptions,
        );
        const completed = debugTimings ? performance.now() : null;
        const completedEpochMs = debugTimings ? performance.timeOrigin + completed : null;
        preparedReflectionSources.set(message.preparationId, {
            observed,
            resolvedInputMode: observed.metadata.resolvedDifferenceDensityInputMode,
            preparationTimeMs: debugTimings ? completed - started : null,
            started,
            startedEpochMs,
            completedEpochMs,
        });
        if (debugTimings) {
            globalThis.postMessage({
                type: 'reflection-prepared',
                preparationId: message.preparationId,
                preparationTimeMs: completed - started,
                startedEpochMs,
                completedEpochMs,
                reflectionDiagnostics: observed.diagnostics,
                ...observed.diagnostics,
            });
        }
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
    const debugTimings = message.debugTimings === true;
    const calculationStartedEpochMs = debugTimings
        ? performance.timeOrigin + performance.now()
        : null;
    const prepared = preparedReflectionSources.get(message.preparationId);
    preparedReflectionSources.delete(message.preparationId);
    const started = debugTimings ? prepared?.started ?? performance.now() : null;
    const modelPostedEpochMs = message.modelPostedEpochMs;
    const joinReadyEpochMs = debugTimings && prepared && Number.isFinite(modelPostedEpochMs)
        ? Math.max(prepared.completedEpochMs, modelPostedEpochMs)
        : prepared?.completedEpochMs ?? calculationStartedEpochMs;
    const modelWaitForReflectionPreparationMs = debugTimings && prepared &&
        Number.isFinite(modelPostedEpochMs)
        ? Math.max(0, prepared.completedEpochMs - modelPostedEpochMs)
        : 0;
    const workerWaitForModelMs = debugTimings && prepared && Number.isFinite(modelPostedEpochMs)
        ? Math.max(0, modelPostedEpochMs - prepared.completedEpochMs)
        : 0;
    const workerIdleAfterReflectionPreparationMs = workerWaitForModelMs;
    const workerJoinDelayMs = debugTimings
        ? Math.max(0, calculationStartedEpochMs - joinReadyEpochMs)
        : 0;
    try {
        const datasetStarted = debugTimings ? performance.now() : null;
        const dataset = parseDifferenceDensitySource(
            message.fcfText,
            message.fcfBlock,
            {
                ...message.datasetOptions,
                preparedSource: prepared ? {
                    mode: prepared.resolvedInputMode,
                    observations: prepared.observed,
                } : null,
                debugTimings,
            },
        );
        const datasetPreparationTimeMs = debugTimings
            ? performance.now() - datasetStarted
            : null;
        const progressionStarted = debugTimings ? performance.now() : null;
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
        const progressionSetupTimeMs = debugTimings
            ? performance.now() - progressionStarted
            : null;
        const steps = progression.steps;
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const mapStarted = debugTimings ? performance.now() : null;
            const { map, changed } = progression.mapAt(stepIndex);
            const mapTimeMs = debugTimings && changed ? performance.now() - mapStarted : 0;
            const contourStarted = debugTimings ? performance.now() : null;
            const contours = calculateContourWorkerTask(
                map,
                message.contourRequest,
                steps[stepIndex],
            );
            const contourTimeMs = debugTimings && contours
                ? performance.now() - contourStarted
                : 0;
            const payloadStarted = debugTimings ? performance.now() : null;
            const payload = changed ? map.toPayload() : null;
            const payloadPreparationTimeMs = debugTimings
                ? performance.now() - payloadStarted
                : null;
            const update = {
                type: 'update',
                loadId: message.loadId,
                stepIndex,
                totalSteps: steps.length,
                final: stepIndex === steps.length - 1,
                ...(debugTimings ? {
                    computeTimeMs: mapTimeMs,
                    datasetPreparationTimeMs,
                    datasetPreparationTimings: dataset.datasetPreparationTimings,
                    reflectionPreparationTimeMs: prepared?.preparationTimeMs ?? 0,
                    reflectionDiagnostics: prepared?.observed.diagnostics,
                    ...prepared?.observed.diagnostics,
                    workerIdleAfterReflectionPreparationMs,
                    modelWaitForReflectionPreparationMs,
                    workerWaitForModelMs,
                    workerJoinDelayMs,
                    modelPostedAfterReflectionStartMs:
                        prepared && Number.isFinite(modelPostedEpochMs)
                            ? modelPostedEpochMs - prepared.startedEpochMs
                            : null,
                    calculationStartedEpochMs,
                    progressionSetupTimeMs,
                    payloadPreparationTimeMs,
                    contourTimeMs,
                    elapsedTimeMs: performance.now() - started,
                } : {}),
                surfaceResolutionFraction: steps[stepIndex],
                map: payload,
                contours,
            };
            if (debugTimings) {
                update.updatePostedEpochMs = performance.timeOrigin + performance.now();
            }
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

globalThis.postMessage({
    type: 'ready',
    epochMs: performance.timeOrigin + performance.now(),
});
