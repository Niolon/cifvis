/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact progression helpers */
import { calculateDifferenceDensityMap } from './difference-density.js';
import { normalizeIsosurfaceSteps } from './isosurface-progress.js';

/** Creates the shared worker/main-thread map-refinement schedule. */
export function createDifferenceDensityProgression(dataset, options = {}) {
    const steps = normalizeIsosurfaceSteps(options.steps);
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
