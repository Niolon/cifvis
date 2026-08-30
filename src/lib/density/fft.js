
const mixedPlanCache = new Map();
const radix2PlanCache = new Map();
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
const COSINE_72 = (Math.sqrt(5) - 1) / 4;
const COSINE_144 = -(Math.sqrt(5) + 1) / 4;
const SINE_72 = Math.sin(2 * Math.PI / 5);
const SINE_144 = Math.sin(Math.PI / 5);

function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * @param {number} length - Candidate transform length.
 * @returns {boolean} Whether radix-2 supports the length.
 */
export function isPowerOfTwo(length) {
    return Number.isInteger(length) && length > 0 && (length & (length - 1)) === 0;
}

/**
 * Factors an FFT length into supported radices and an unsupported remainder.
 * @param {number} length - Transform length.
 * @returns {{exponents:object, remaining:number}} Radix exponents and remainder.
 */
export function factorization235(length) {
    let remaining = length;
    const exponents = { 2: 0, 3: 0, 5: 0 };
    for (const factor of [2, 3, 5]) {
        while (remaining % factor === 0) {
            exponents[factor]++;
            remaining /= factor;
        }
    }
    return { exponents, remaining };
}

function smallestFactor235(length) {
    for (const factor of [2, 3, 5]) {
        if (length % factor === 0) {
            return factor;
        }
    }
    return length;
}

function mixedRadixRecursive(
    inputReal, inputImaginary, inputOffset, inputStride, length,
    outputReal, outputImaginary, outputOffset,
    scratchReal, scratchImaginary, scratchOffset, sign, twiddleTables,
) {
    if (length === 1) {
        outputReal[outputOffset] = inputReal[inputOffset];
        outputImaginary[outputOffset] = inputImaginary[inputOffset];
        return;
    }
    const radix = smallestFactor235(length);
    if (radix === length && ![2, 3, 5].includes(radix)) {
        throw new Error(`Mixed-radix FFT length contains an unsupported factor: ${length}`);
    }
    const remainder = length / radix;
    for (let q = 0; q < radix; q++) {
        mixedRadixRecursive(
            inputReal, inputImaginary,
            inputOffset + q * inputStride, inputStride * radix, remainder,
            outputReal, outputImaginary, outputOffset + q * remainder,
            scratchReal, scratchImaginary, scratchOffset + q * remainder, sign, twiddleTables,
        );
    }
    const twiddles = twiddleTables.get(length);
    for (let low = 0; low < remainder; low++) {
        const input0 = outputOffset + low;
        const r0 = outputReal[input0];
        const i0 = outputImaginary[input0];
        const input1 = outputOffset + remainder + low;
        const sine1 = sign < 0
            ? twiddles.imaginary[remainder + low]
            : -twiddles.imaginary[remainder + low];
        const r1 = outputReal[input1] * twiddles.real[remainder + low] -
            outputImaginary[input1] * sine1;
        const i1 = outputReal[input1] * sine1 +
            outputImaginary[input1] * twiddles.real[remainder + low];
        if (radix === 2) {
            scratchReal[scratchOffset + low] = r0 + r1;
            scratchImaginary[scratchOffset + low] = i0 + i1;
            scratchReal[scratchOffset + remainder + low] = r0 - r1;
            scratchImaginary[scratchOffset + remainder + low] = i0 - i1;
            continue;
        }
        const input2 = outputOffset + 2 * remainder + low;
        const sine2 = sign < 0
            ? twiddles.imaginary[2 * remainder + low]
            : -twiddles.imaginary[2 * remainder + low];
        const r2 = outputReal[input2] * twiddles.real[2 * remainder + low] -
            outputImaginary[input2] * sine2;
        const i2 = outputReal[input2] * sine2 +
            outputImaginary[input2] * twiddles.real[2 * remainder + low];
        if (radix === 3) {
            const sine = sign < 0 ? SQRT_THREE_OVER_TWO : -SQRT_THREE_OVER_TWO;
            const sharedReal = r0 - 0.5 * (r1 + r2);
            const sharedImaginary = i0 - 0.5 * (i1 + i2);
            const deltaReal = sine * (i1 - i2);
            const deltaImaginary = sine * (r2 - r1);
            scratchReal[scratchOffset + low] = r0 + r1 + r2;
            scratchImaginary[scratchOffset + low] = i0 + i1 + i2;
            scratchReal[scratchOffset + remainder + low] = sharedReal + deltaReal;
            scratchImaginary[scratchOffset + remainder + low] = sharedImaginary + deltaImaginary;
            scratchReal[scratchOffset + 2 * remainder + low] = sharedReal - deltaReal;
            scratchImaginary[scratchOffset + 2 * remainder + low] = sharedImaginary - deltaImaginary;
            continue;
        }
        const input3 = outputOffset + 3 * remainder + low;
        const sine3 = sign < 0
            ? twiddles.imaginary[3 * remainder + low]
            : -twiddles.imaginary[3 * remainder + low];
        const r3 = outputReal[input3] * twiddles.real[3 * remainder + low] -
            outputImaginary[input3] * sine3;
        const i3 = outputReal[input3] * sine3 +
            outputImaginary[input3] * twiddles.real[3 * remainder + low];
        const input4 = outputOffset + 4 * remainder + low;
        const sine4 = sign < 0
            ? twiddles.imaginary[4 * remainder + low]
            : -twiddles.imaginary[4 * remainder + low];
        const r4 = outputReal[input4] * twiddles.real[4 * remainder + low] -
            outputImaginary[input4] * sine4;
        const i4 = outputReal[input4] * sine4 +
            outputImaginary[input4] * twiddles.real[4 * remainder + low];
        const sum14Real = r1 + r4;
        const sum14Imaginary = i1 + i4;
        const sum23Real = r2 + r3;
        const sum23Imaginary = i2 + i3;
        const difference14Real = r1 - r4;
        const difference14Imaginary = i1 - i4;
        const difference23Real = r2 - r3;
        const difference23Imaginary = i2 - i3;
        const sine72 = sign < 0 ? SINE_72 : -SINE_72;
        const sine144 = sign < 0 ? SINE_144 : -SINE_144;
        const shared1Real = r0 + COSINE_72 * sum14Real + COSINE_144 * sum23Real;
        const shared1Imaginary = i0 + COSINE_72 * sum14Imaginary + COSINE_144 * sum23Imaginary;
        const delta1Real = sine72 * difference14Imaginary + sine144 * difference23Imaginary;
        const delta1Imaginary = -sine72 * difference14Real - sine144 * difference23Real;
        const shared2Real = r0 + COSINE_144 * sum14Real + COSINE_72 * sum23Real;
        const shared2Imaginary = i0 + COSINE_144 * sum14Imaginary + COSINE_72 * sum23Imaginary;
        const delta2Real = sine144 * difference14Imaginary - sine72 * difference23Imaginary;
        const delta2Imaginary = -sine144 * difference14Real + sine72 * difference23Real;
        scratchReal[scratchOffset + low] = r0 + sum14Real + sum23Real;
        scratchImaginary[scratchOffset + low] = i0 + sum14Imaginary + sum23Imaginary;
        scratchReal[scratchOffset + remainder + low] = shared1Real + delta1Real;
        scratchImaginary[scratchOffset + remainder + low] = shared1Imaginary + delta1Imaginary;
        scratchReal[scratchOffset + 2 * remainder + low] = shared2Real + delta2Real;
        scratchImaginary[scratchOffset + 2 * remainder + low] = shared2Imaginary + delta2Imaginary;
        scratchReal[scratchOffset + 3 * remainder + low] = shared2Real - delta2Real;
        scratchImaginary[scratchOffset + 3 * remainder + low] = shared2Imaginary - delta2Imaginary;
        scratchReal[scratchOffset + 4 * remainder + low] = shared1Real - delta1Real;
        scratchImaginary[scratchOffset + 4 * remainder + low] = shared1Imaginary - delta1Imaginary;
    }
    for (let index = 0; index < length; index++) {
        outputReal[outputOffset + index] = scratchReal[scratchOffset + index];
        outputImaginary[outputOffset + index] = scratchImaginary[scratchOffset + index];
    }
}

/**
 * Allocates reusable twiddles and scratch buffers for one 2/3/5-smooth length.
 * @param {number} length - Transform length.
 * @returns {object} Mutable plan; do not use concurrently for two FFT lines.
 */
export function createMixedRadixPlan(length) {
    let remaining = length;
    for (const factor of [2, 3, 5]) {
        while (remaining % factor === 0) {
            remaining /= factor;
        }
    }
    if (remaining !== 1 || length < 2) {
        throw new Error(`Mixed-radix FFT length must be a 2/3/5-smooth integer: ${length}`);
    }
    const twiddleTables = new Map();
    for (let usedLength = length; usedLength > 1;) {
        const radix = smallestFactor235(usedLength);
        const remainder = usedLength / radix;
        const real = new Float64Array(radix * remainder);
        const imaginary = new Float64Array(radix * remainder);
        for (let q = 0; q < radix; q++) {
            for (let low = 0; low < remainder; low++) {
                const angle = -2 * Math.PI * q * low / usedLength;
                real[q * remainder + low] = Math.cos(angle);
                imaginary[q * remainder + low] = Math.sin(angle);
            }
        }
        twiddleTables.set(usedLength, { real, imaginary });
        usedLength /= radix;
    }
    return {
        length,
        outputReal: new Float64Array(length),
        outputImaginary: new Float64Array(length),
        scratchReal: new Float64Array(length),
        scratchImaginary: new Float64Array(length),
        twiddleTables,
    };
}

/**
 * Precomputes bit reversal and stage roots for a power-of-two length.
 * @param {number} length - Transform length.
 * @returns {object} Immutable radix-2 plan.
 */
export function createRadix2Plan(length) {
    if (!isPowerOfTwo(length) || length < 2) {
        throw new Error(`Radix-2 FFT length must be a power of two: ${length}`);
    }
    const bitReversal = new Uint32Array(length);
    for (let index = 1, reversed = 0; index < length; index++) {
        let bit = length >> 1;
        for (; reversed & bit; bit >>= 1) {
            reversed ^= bit;
        }
        reversed ^= bit;
        bitReversal[index] = reversed;
    }
    const stages = [];
    for (let width = 2; width <= length; width *= 2) {
        const angle = -2 * Math.PI / width;
        stages.push({
            width,
            rootReal: Math.cos(angle),
            rootImaginary: Math.sin(angle),
        });
    }
    return { length, bitReversal, stages };
}

/**
 * Resolves automatic per-axis selection, preferring radix-2 for power-of-two lines.
 * @param {number} length - Axis length.
 * @param {string} requested - Requested kernel or `auto`.
 * @returns {string} `radix-2` or `mixed-radix`.
 */
export function resolveAxisKernel(length, requested = 'auto') {
    if (!['auto', 'mixed-radix', 'radix-2'].includes(requested)) {
        throw new Error('FFT axis kernel must be "auto", "mixed-radix", or "radix-2"');
    }
    if (requested === 'auto') {
        return isPowerOfTwo(length) ? 'radix-2' : 'mixed-radix';
    }
    if (requested === 'radix-2' && !isPowerOfTwo(length)) {
        throw new Error(`Radix-2 axis kernel cannot transform length ${length}`);
    }
    return requested;
}

/**
 * Returns a process-cached plan for one axis length.
 * @param {number} length - Axis length.
 * @param {string} requestedKernel - Requested kernel or `auto`.
 * @returns {object} Kernel, plan, cache status, and setup time.
 */
export function getFftPlan(length, requestedKernel = 'auto') {
    const kernel = resolveAxisKernel(length, requestedKernel);
    const cache = kernel === 'radix-2' ? radix2PlanCache : mixedPlanCache;
    const cached = cache.get(length);
    if (cached) {
        return { kernel, plan: cached, cacheHit: true, setupTimeMs: 0 };
    }
    const started = now();
    const plan = kernel === 'radix-2'
        ? createRadix2Plan(length)
        : createMixedRadixPlan(length);
    const setupTimeMs = now() - started;
    cache.set(length, plan);
    return { kernel, plan, cacheHit: false, setupTimeMs };
}

/** Clears reusable FFT plans, primarily for deterministic measurement. */
export function clearFftPlanCache() {
    mixedPlanCache.clear();
    radix2PlanCache.clear();
}

/**
 * @param {number} length - One-dimensional transform length.
 * @param {string} backend - FFT implementation used for the line.
 * @returns {number} Reusable line, plan, scratch, and twiddle storage in bytes.
 */
export function fftLineWorkBytes(length, backend = 'mixed-radix') {
    const lineBytes = 2 * length * Float64Array.BYTES_PER_ELEMENT;
    const kernel = resolveAxisKernel(length, backend);
    if (kernel === 'radix-2') {
        return lineBytes + length * Uint32Array.BYTES_PER_ELEMENT +
            Math.log2(length) * 3 * Float64Array.BYTES_PER_ELEMENT;
    }
    let twiddleElements = 0;
    for (let usedLength = length; usedLength > 1;) {
        const radix = smallestFactor235(usedLength);
        twiddleElements += 2 * usedLength;
        usedLength /= radix;
    }
    const planElements = 4 * length + twiddleElements;
    return lineBytes + planElements * Float64Array.BYTES_PER_ELEMENT;
}

/**
 * Transforms split complex arrays in place with the unnormalized forward sign.
 * The inverse is normalized by the line length.
 * @param {Float64Array} real - Real line, mutated in place.
 * @param {Float64Array} imaginary - Imaginary line, mutated in place.
 * @param {object} plan - Exclusive reusable mixed-radix plan.
 * @param {boolean} inverse - Whether to apply the normalized inverse transform.
 * @returns {void}
 */
export function mixedRadixFftLine(real, imaginary, plan, inverse = false) {
    if (real.length !== plan.length || imaginary.length !== plan.length) {
        throw new Error('FFT line and plan lengths must match');
    }
    mixedRadixRecursive(
        real, imaginary, 0, 1, plan.length,
        plan.outputReal, plan.outputImaginary, 0,
        plan.scratchReal, plan.scratchImaginary, 0,
        inverse ? 1 : -1, plan.twiddleTables,
    );
    const scale = inverse ? 1 / plan.length : 1;
    for (let index = 0; index < plan.length; index++) {
        real[index] = plan.outputReal[index] * scale;
        imaginary[index] = plan.outputImaginary[index] * scale;
    }
}

/**
 * Transforms split complex arrays in place with the unnormalized forward sign.
 * @param {Float64Array} real - Real line, mutated in place.
 * @param {Float64Array} imaginary - Imaginary line, mutated in place.
 * @param {boolean} inverse - Whether to apply the normalized inverse transform.
 * @param {object|null} suppliedPlan - Reusable plan or null to use the cache.
 * @returns {void}
 */
export function radix2FftLine(real, imaginary, inverse = false, suppliedPlan = null) {
    const length = real.length;
    const plan = suppliedPlan ?? getFftPlan(length, 'radix-2').plan;
    for (let index = 1; index < length; index++) {
        const reversed = plan.bitReversal[index];
        if (index < reversed) {
            [real[index], real[reversed]] = [real[reversed], real[index]];
            [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
        }
    }
    for (const stage of plan.stages) {
        const { width, rootReal } = stage;
        const rootImaginary = inverse ? -stage.rootImaginary : stage.rootImaginary;
        for (let start = 0; start < length; start += width) {
            let twiddleReal = 1;
            let twiddleImaginary = 0;
            for (let offset = 0; offset < width / 2; offset++) {
                const even = start + offset;
                const odd = even + width / 2;
                const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
                const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
                const evenReal = real[even];
                const evenImaginary = imaginary[even];
                real[even] = evenReal + oddReal;
                imaginary[even] = evenImaginary + oddImaginary;
                real[odd] = evenReal - oddReal;
                imaginary[odd] = evenImaginary - oddImaginary;
                const nextReal = twiddleReal * rootReal - twiddleImaginary * rootImaginary;
                twiddleImaginary = twiddleReal * rootImaginary + twiddleImaginary * rootReal;
                twiddleReal = nextReal;
            }
        }
    }
    if (inverse) {
        for (let index = 0; index < length; index++) {
            real[index] /= length;
            imaginary[index] /= length;
        }
    }
}

/**
 * Applies an in-place complex FFT along one dimension of an x-fastest array.
 * @param {Float64Array} realGrid - Real component of the complex grid.
 * @param {Float64Array} imaginaryGrid - Imaginary component of the complex grid.
 * @param {number[]} dimensions - X-fastest grid dimensions.
 * @param {number} axis - Axis to transform.
 * @param {string} backend - Mixed-radix or validation radix-2 implementation.
 * @returns {object} Per-axis kernel, plan, line-count, and timing diagnostics.
 */
export function transformComplexAxis(realGrid, imaginaryGrid, dimensions, axis, backend = 'mixed-radix') {
    const started = now();
    const [nx, ny, nz] = dimensions;
    const length = dimensions[axis];
    const lineReal = new Float64Array(length);
    const lineImaginary = new Float64Array(length);
    const planned = getFftPlan(length, backend);
    const kernelStarted = now();
    const transformLine = (offset, stride) => {
        for (let index = 0; index < length; index++) {
            const source = offset + index * stride;
            lineReal[index] = realGrid[source];
            lineImaginary[index] = imaginaryGrid[source];
        }
        if (planned.kernel === 'mixed-radix') {
            mixedRadixFftLine(lineReal, lineImaginary, planned.plan);
        } else {
            radix2FftLine(lineReal, lineImaginary, false, planned.plan);
        }
        for (let index = 0; index < length; index++) {
            const target = offset + index * stride;
            realGrid[target] = lineReal[index];
            imaginaryGrid[target] = lineImaginary[index];
        }
    };
    if (axis === 0) {
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                const offset = (z * ny + y) * nx;
                transformLine(offset, 1);
            }
        }
    } else if (axis === 1) {
        for (let z = 0; z < nz; z++) {
            for (let x = 0; x < nx; x++) {
                transformLine(z * ny * nx + x, nx);
            }
        }
    } else {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                transformLine(y * nx + x, nx * ny);
            }
        }
    }
    const lineCount = axis === 0 ? ny * nz : axis === 1 ? nx * nz : nx * ny;
    return {
        axis,
        length,
        lineCount,
        kernel: planned.kernel,
        planCacheHit: planned.cacheHit,
        planSetupTimeMs: planned.setupTimeMs,
        kernelTimeMs: now() - kernelStarted,
        totalTimeMs: now() - started,
    };
}
