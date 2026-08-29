/* eslint-disable jsdoc/require-jsdoc -- hot numerical kernels */

const mixedPlanCache = new Map();
const radix2PlanCache = new Map();

function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

export function isPowerOfTwo(length) {
    return Number.isInteger(length) && length > 0 && (length & (length - 1)) === 0;
}

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
        for (let high = 0; high < radix; high++) {
            let real = 0;
            let imaginary = 0;
            const outputIndex = low + remainder * high;
            for (let q = 0; q < radix; q++) {
                const inputIndex = outputOffset + q * remainder + low;
                const twiddleIndex = q * length + outputIndex;
                const cosine = twiddles.real[twiddleIndex];
                const sine = sign < 0
                    ? twiddles.imaginary[twiddleIndex]
                    : -twiddles.imaginary[twiddleIndex];
                real += outputReal[inputIndex] * cosine - outputImaginary[inputIndex] * sine;
                imaginary += outputReal[inputIndex] * sine + outputImaginary[inputIndex] * cosine;
            }
            scratchReal[scratchOffset + outputIndex] = real;
            scratchImaginary[scratchOffset + outputIndex] = imaginary;
        }
    }
    for (let index = 0; index < length; index++) {
        outputReal[outputOffset + index] = scratchReal[scratchOffset + index];
        outputImaginary[outputOffset + index] = scratchImaginary[scratchOffset + index];
    }
}

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
        const real = new Float64Array(radix * usedLength);
        const imaginary = new Float64Array(radix * usedLength);
        for (let q = 0; q < radix; q++) {
            for (let output = 0; output < usedLength; output++) {
                const angle = -2 * Math.PI * q * output / usedLength;
                real[q * usedLength + output] = Math.cos(angle);
                imaginary[q * usedLength + output] = Math.sin(angle);
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
        twiddleElements += 2 * radix * usedLength;
        usedLength /= radix;
    }
    const planElements = 4 * length + twiddleElements;
    return lineBytes + planElements * Float64Array.BYTES_PER_ELEMENT;
}

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
    const transformLine = indexAt => {
        for (let index = 0; index < length; index++) {
            const source = indexAt(index);
            lineReal[index] = realGrid[source];
            lineImaginary[index] = imaginaryGrid[source];
        }
        if (planned.kernel === 'mixed-radix') {
            mixedRadixFftLine(lineReal, lineImaginary, planned.plan);
        } else {
            radix2FftLine(lineReal, lineImaginary, false, planned.plan);
        }
        for (let index = 0; index < length; index++) {
            const target = indexAt(index);
            realGrid[target] = lineReal[index];
            imaginaryGrid[target] = lineImaginary[index];
        }
    };
    if (axis === 0) {
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                const offset = (z * ny + y) * nx;
                transformLine(x => offset + x);
            }
        }
    } else if (axis === 1) {
        for (let z = 0; z < nz; z++) {
            for (let x = 0; x < nx; x++) {
                transformLine(y => (z * ny + y) * nx + x);
            }
        }
    } else {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                transformLine(z => (z * ny + y) * nx + x);
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
