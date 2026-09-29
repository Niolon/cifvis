/**
 * Creates the shared worker/main-thread map-refinement schedule.
 * A map is recomputed only when a stage changes FFT oversampling.
 * @param {object} dataset - Prepared difference-density coefficients.
 * @param {object} options - Resolution, oversampling, and progressive steps.
 * @returns {{steps:number[], mapAt:function(number):object}} Stateful progression.
 */
export function createDifferenceDensityProgression(dataset: object, options?: object): {
    steps: number[];
    mapAt: (arg0: number) => object;
};
//# sourceMappingURL=difference-density-progress.d.ts.map