/**
 * @param {number} length - Candidate transform length.
 * @returns {boolean} Whether radix-2 supports the length.
 */
export function isPowerOfTwo(length: number): boolean;
/**
 * Factors an FFT length into supported radices and an unsupported remainder.
 * @param {number} length - Transform length.
 * @returns {{exponents:object, remaining:number}} Radix exponents and remainder.
 */
export function factorization235(length: number): {
    exponents: object;
    remaining: number;
};
/**
 * Allocates reusable twiddles and scratch buffers for one 2/3/5-smooth length.
 * @param {number} length - Transform length.
 * @returns {object} Mutable plan; do not use concurrently for two FFT lines.
 */
export function createMixedRadixPlan(length: number): object;
/**
 * Precomputes bit reversal and stage roots for a power-of-two length.
 * @param {number} length - Transform length.
 * @returns {object} Immutable radix-2 plan.
 */
export function createRadix2Plan(length: number): object;
/**
 * Resolves automatic per-axis selection, preferring radix-2 for power-of-two lines.
 * @param {number} length - Axis length.
 * @param {string} requested - Requested kernel or `auto`.
 * @returns {string} `radix-2` or `mixed-radix`.
 */
export function resolveAxisKernel(length: number, requested?: string): string;
/**
 * Returns a process-cached plan for one axis length.
 * @param {number} length - Axis length.
 * @param {string} requestedKernel - Requested kernel or `auto`.
 * @returns {object} Kernel, plan, cache status, and setup time.
 */
export function getFftPlan(length: number, requestedKernel?: string): object;
/** Clears reusable FFT plans, primarily for deterministic measurement. */
export function clearFftPlanCache(): void;
/**
 * @param {number} length - One-dimensional transform length.
 * @param {string} backend - FFT implementation used for the line.
 * @returns {number} Reusable line, plan, scratch, and twiddle storage in bytes.
 */
export function fftLineWorkBytes(length: number, backend?: string): number;
/**
 * Transforms split complex arrays in place with the unnormalized forward sign.
 * The inverse is normalized by the line length.
 * @param {Float64Array} real - Real line, mutated in place.
 * @param {Float64Array} imaginary - Imaginary line, mutated in place.
 * @param {object} plan - Exclusive reusable mixed-radix plan.
 * @param {boolean} inverse - Whether to apply the normalized inverse transform.
 * @returns {void}
 */
export function mixedRadixFftLine(real: Float64Array, imaginary: Float64Array, plan: object, inverse?: boolean): void;
/**
 * Transforms split complex arrays in place with the unnormalized forward sign.
 * @param {Float64Array} real - Real line, mutated in place.
 * @param {Float64Array} imaginary - Imaginary line, mutated in place.
 * @param {boolean} inverse - Whether to apply the normalized inverse transform.
 * @param {object|null} suppliedPlan - Reusable plan or null to use the cache.
 * @returns {void}
 */
export function radix2FftLine(real: Float64Array, imaginary: Float64Array, inverse?: boolean, suppliedPlan?: object | null): void;
/**
 * Applies an in-place complex FFT along one dimension of an x-fastest array.
 * @param {Float64Array} realGrid - Real component of the complex grid.
 * @param {Float64Array} imaginaryGrid - Imaginary component of the complex grid.
 * @param {number[]} dimensions - X-fastest grid dimensions.
 * @param {number} axis - Axis to transform.
 * @param {string} backend - Mixed-radix or validation radix-2 implementation.
 * @returns {object} Per-axis kernel, plan, line-count, and timing diagnostics.
 */
export function transformComplexAxis(realGrid: Float64Array, imaginaryGrid: Float64Array, dimensions: number[], axis: number, backend?: string): object;
//# sourceMappingURL=fft.d.ts.map