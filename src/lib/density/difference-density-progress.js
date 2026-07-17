/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact progression helpers */
import { calculateDifferenceDensityMap } from './difference-density.js';

/** Normalizes a progressive surface-resolution schedule. */
export function normalizeDifferenceDensitySteps(steps) {
    const valid = (Array.isArray(steps) ? steps : [1])
        .map(Number)
        .filter(step => Number.isFinite(step) && step > 0 && step <= 1)
        .sort((first, second) => first - second);
    if (!valid.includes(1)) {
        valid.push(1);
    }
    return [...new Set(valid)];
}

/** Creates the shared worker/main-thread map-refinement schedule. */
export function createDifferenceDensityProgression(dataset, options = {}) {
    const steps = normalizeDifferenceDensitySteps(options.steps);
    const reciprocalResolution = Number(options.reciprocalResolution) || 1;
    const finalOversampling = Math.max(1, Number(options.gridOversampling) || 1);
    const initialOversampling = steps.length === 1
        ? finalOversampling
        : Math.min(
            finalOversampling,
            Math.max(1, Number(options.initialGridOversampling) || 1),
        );
    let map = null;
    return {
        steps,
        mapAt(stepIndex) {
            const oversampling = stepIndex === 0
                ? initialOversampling
                : stepIndex === 1 && initialOversampling !== finalOversampling
                    ? finalOversampling
                    : null;
            if (oversampling !== null) {
                map = calculateDifferenceDensityMap(dataset, reciprocalResolution, oversampling);
            }
            return { map, changed: oversampling !== null };
        },
    };
}
