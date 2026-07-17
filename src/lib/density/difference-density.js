/* eslint-disable jsdoc/require-param -- private numerical helpers keep compact documentation */
import { CIF } from '../read-cif/base.js';
import { UnitCell } from '../structure/crystal.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import * as math from '../math-lite.js';

const TWO_PI = 2 * Math.PI;

/** @returns {number} Smallest power of two not less than value. */
function nextPowerOfTwo(value) {
    let result = 1;
    while (result < value) {
        result *= 2;
    }
    return Math.max(2, result);
}

/** @returns {number} Index wrapped into a periodic array. */
function wrapIndex(value, size) {
    return ((value % size) + size) % size;
}

/** @returns {Array|null} First matching reflection-loop column. */
function reflectionColumn(loop, names, defaultValue = null) {
    return loop.get(names, defaultValue);
}

/** Ensures all required reflection columns contain the same row count. */
function assertSameLength(columns) {
    const lengths = columns.map(column => column.length);
    if (lengths.some(length => length !== lengths[0])) {
        throw new Error(`Reflection columns have inconsistent lengths: ${lengths.join(', ')}`);
    }
}

/** @returns {number[]} Reciprocal index transformed by a direct-space rotation. */
function transformReflectionIndex(rotation, h, k, l) {
    const reciprocalRotation = math.transpose(math.inv(rotation));
    return math.multiply(reciprocalRotation, [h, k, l]).map(value => {
        const rounded = Math.round(value);
        if (Math.abs(value - rounded) > 1e-6) {
            throw new Error(`Symmetry operation produced a non-integral reflection index: ${value}`);
        }
        return rounded;
    });
}

/** Accumulates one possibly symmetry-duplicated complex coefficient. */
function addCoefficient(coefficients, h, k, l, real, imaginary) {
    const key = `${h},${k},${l}`;
    const current = coefficients.get(key);
    if (current) {
        current.real += real;
        current.imaginary += imaginary;
        current.count++;
    } else {
        coefficients.set(key, { h, k, l, real, imaginary, count: 1 });
    }
}

/** @returns {Map<string, object>} Symmetry- and Friedel-expanded coefficients. */
function expandReflectionCoefficients(reflections, symmetry) {
    const coefficients = new Map();

    for (let i = 0; i < reflections.h.length; i++) {
        const h = Number(reflections.h[i]);
        const k = Number(reflections.k[i]);
        const l = Number(reflections.l[i]);
        const measuredSquared = reflections.measuredSquared?.[i];
        const measured = reflections.measured?.[i];
        const calculatedSquared = reflections.calculatedSquared?.[i];
        const calculated = reflections.calculated?.[i];
        const phase = Number(reflections.phase[i]);

        const observedAmplitude = measuredSquared !== null && measuredSquared !== undefined
            ? Math.sqrt(Math.max(0, Number(measuredSquared)))
            : Math.max(0, Number(measured));
        const calculatedAmplitude = calculatedSquared !== null && calculatedSquared !== undefined
            ? Math.sqrt(Math.max(0, Number(calculatedSquared)))
            : Math.abs(Number(calculated));

        if (![h, k, l, observedAmplitude, calculatedAmplitude, phase].every(Number.isFinite)) {
            continue;
        }

        const differenceAmplitude = observedAmplitude - calculatedAmplitude;
        const phaseRadians = phase * Math.PI / 180;
        const baseReal = differenceAmplitude * Math.cos(phaseRadians);
        const baseImaginary = differenceAmplitude * Math.sin(phaseRadians);

        for (const operation of symmetry.symmetryOperations) {
            const [equivH, equivK, equivL] = transformReflectionIndex(operation.rotMatrix, h, k, l);
            const phaseShift = TWO_PI * (
                equivH * operation.transVector[0] +
                equivK * operation.transVector[1] +
                equivL * operation.transVector[2]
            );
            const cosShift = Math.cos(phaseShift);
            const sinShift = Math.sin(phaseShift);
            const real = baseReal * cosShift - baseImaginary * sinShift;
            const imaginary = baseReal * sinShift + baseImaginary * cosShift;

            addCoefficient(coefficients, equivH, equivK, equivL, real, imaginary);
            if (equivH !== 0 || equivK !== 0 || equivL !== 0) {
                addCoefficient(coefficients, -equivH, -equivK, -equivL, real, -imaginary);
            }
        }
    }

    // A difference Fourier conventionally has no F(000) contribution.
    coefficients.delete('0,0,0');
    for (const coefficient of coefficients.values()) {
        coefficient.real /= coefficient.count;
        coefficient.imaginary /= coefficient.count;
    }
    return coefficients;
}

/** Performs an in-place radix-2 complex FFT on one line. */
function fftLine(real, imaginary, inverse = false) {
    const length = real.length;
    for (let i = 1, j = 0; i < length; i++) {
        let bit = length >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
            [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
        }
    }

    const sign = inverse ? 1 : -1;
    for (let width = 2; width <= length; width *= 2) {
        const angle = sign * TWO_PI / width;
        const rootReal = Math.cos(angle);
        const rootImaginary = Math.sin(angle);
        for (let start = 0; start < length; start += width) {
            let twiddleReal = 1;
            let twiddleImaginary = 0;
            const half = width / 2;
            for (let offset = 0; offset < half; offset++) {
                const evenIndex = start + offset;
                const oddIndex = evenIndex + half;
                const oddReal = real[oddIndex] * twiddleReal - imaginary[oddIndex] * twiddleImaginary;
                const oddImaginary = real[oddIndex] * twiddleImaginary + imaginary[oddIndex] * twiddleReal;
                const evenReal = real[evenIndex];
                const evenImaginary = imaginary[evenIndex];

                real[evenIndex] = evenReal + oddReal;
                imaginary[evenIndex] = evenImaginary + oddImaginary;
                real[oddIndex] = evenReal - oddReal;
                imaginary[oddIndex] = evenImaginary - oddImaginary;

                const nextReal = twiddleReal * rootReal - twiddleImaginary * rootImaginary;
                twiddleImaginary = twiddleReal * rootImaginary + twiddleImaginary * rootReal;
                twiddleReal = nextReal;
            }
        }
    }

    if (inverse) {
        for (let i = 0; i < length; i++) {
            real[i] /= length;
            imaginary[i] /= length;
        }
    }
}

/** Applies the forward FFT along one dimension of a 3D array. */
function transformAxis(realGrid, imaginaryGrid, dimensions, axis) {
    const [nx, ny, nz] = dimensions;
    const lineLength = dimensions[axis];
    const lineReal = new Float64Array(lineLength);
    const lineImaginary = new Float64Array(lineLength);

    const transformLine = (indexAt) => {
        for (let i = 0; i < lineLength; i++) {
            const index = indexAt(i);
            lineReal[i] = realGrid[index];
            lineImaginary[i] = imaginaryGrid[index];
        }
        fftLine(lineReal, lineImaginary);
        for (let i = 0; i < lineLength; i++) {
            const index = indexAt(i);
            realGrid[index] = lineReal[i];
            imaginaryGrid[index] = lineImaginary[i];
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
}

/** @returns {number} Unit-cell volume in cubic Angstrom. */
function calculateCellVolume(cell) {
    return Math.abs(math.det(cell.fractToCartMatrix));
}

/** @returns {object} Difference density and statistics on a periodic FFT grid. */
function fourierGrid(coefficients, cell, gridOversampling = 1) {
    let maxH = 0;
    let maxK = 0;
    let maxL = 0;
    for (const { h, k, l } of coefficients.values()) {
        maxH = Math.max(maxH, Math.abs(h));
        maxK = Math.max(maxK, Math.abs(k));
        maxL = Math.max(maxL, Math.abs(l));
    }

    const minimumDimensions = [
        nextPowerOfTwo(2 * maxH + 1),
        nextPowerOfTwo(2 * maxK + 1),
        nextPowerOfTwo(2 * maxL + 1),
    ];
    const dimensions = minimumDimensions.map(dimension =>
        nextPowerOfTwo(dimension * Math.max(1, gridOversampling)),
    );
    const [nx, ny] = dimensions;
    const size = dimensions[0] * dimensions[1] * dimensions[2];
    const realGrid = new Float64Array(size);
    const imaginaryGrid = new Float64Array(size);

    for (const { h, k, l, real, imaginary } of coefficients.values()) {
        const index = (wrapIndex(l, dimensions[2]) * ny + wrapIndex(k, ny)) * nx + wrapIndex(h, nx);
        realGrid[index] = real;
        imaginaryGrid[index] = imaginary;
    }

    // The crystallographic inverse transform uses exp(-2*pi*i*h.x), which is
    // the forward FFT sign convention. It is normalized only by cell volume.
    transformAxis(realGrid, imaginaryGrid, dimensions, 0);
    transformAxis(realGrid, imaginaryGrid, dimensions, 1);
    transformAxis(realGrid, imaginaryGrid, dimensions, 2);

    const volume = calculateCellVolume(cell);
    const values = new Float32Array(size);
    let sum = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    let maxImaginary = 0;
    for (let i = 0; i < size; i++) {
        const value = realGrid[i] / volume;
        values[i] = value;
        sum += value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        maxImaginary = Math.max(maxImaginary, Math.abs(imaginaryGrid[i] / volume));
    }
    const mean = sum / size;
    let variance = 0;
    for (const value of values) {
        variance += (value - mean) ** 2;
    }

    return {
        dimensions,
        values,
        mean,
        sigma: Math.sqrt(variance / size),
        minimum,
        maximum,
        maxImaginary,
        volume,
    };
}

/**
 * Parses and symmetry-expands an FCF once so multiple resolution shells can
 * reuse the expensive text/reflection work.
 * @param {string} fcfText - LIST 6/8-style FCF text.
 * @param {number|string} [cifBlock] - FCF block index or name.
 * @returns {object} Parsed progressive-density dataset.
 */
export function parseDifferenceDensityDataset(fcfText, cifBlock = 0) {
    const cif = new CIF(fcfText, false);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const cell = UnitCell.fromCIF(block);
    const symmetry = CellSymmetry.fromCIF(block);
    const loop = block.get('_refln');

    const h = reflectionColumn(loop, ['_refln.index_h', '_refln_index_h']);
    const k = reflectionColumn(loop, ['_refln.index_k', '_refln_index_k']);
    const l = reflectionColumn(loop, ['_refln.index_l', '_refln_index_l']);
    const phase = reflectionColumn(loop, ['_refln.phase_calc', '_refln_phase_calc']);
    const measuredSquared = reflectionColumn(
        loop,
        ['_refln.F_squared_meas', '_refln_F_squared_meas'],
        null,
    );
    const measured = measuredSquared === null
        ? reflectionColumn(loop, ['_refln.F_meas', '_refln_F_meas'], null)
        : null;
    const calculated = reflectionColumn(loop, ['_refln.F_calc', '_refln_F_calc'], null);
    const calculatedSquared = calculated === null
        ? reflectionColumn(loop, ['_refln.F_squared_calc', '_refln_F_squared_calc'], null)
        : null;

    if (measuredSquared === null && measured === null) {
        throw new Error('FCF contains neither measured F nor measured F-squared values');
    }
    if (calculated === null && calculatedSquared === null) {
        throw new Error('FCF contains neither calculated F nor calculated F-squared values');
    }

    const presentColumns = [h, k, l, phase, measuredSquared ?? measured, calculated ?? calculatedSquared];
    assertSameLength(presentColumns);
    const reflections = { h, k, l, phase, measuredSquared, measured, calculated, calculatedSquared };
    const coefficients = expandReflectionCoefficients(reflections, symmetry);
    if (coefficients.size === 0) {
        throw new Error('FCF contains no usable difference-map coefficients');
    }

    const reciprocalTransform = math.transpose(math.inv(cell.fractToCartMatrix));
    let maximumReciprocalLength = 0;
    for (const coefficient of coefficients.values()) {
        const reciprocal = math.multiply(
            reciprocalTransform,
            [coefficient.h, coefficient.k, coefficient.l],
        );
        coefficient.reciprocalLength = math.norm(reciprocal);
        maximumReciprocalLength = Math.max(maximumReciprocalLength, coefficient.reciprocalLength);
    }

    return {
        cell,
        coefficients,
        reflectionCount: h.length,
        maximumReciprocalLength,
    };
}

/**
 * Calculates one resolution shell from a previously parsed FCF dataset.
 * @param {object} dataset - Result of parseDifferenceDensityDataset().
 * @param {number} [resolutionFraction] - Fraction of the maximum reciprocal resolution.
 * @param {number} [gridOversampling] - Real-space FFT grid oversampling factor.
 * @returns {DifferenceDensityMap} Periodic difference-density grid.
 */
export function calculateDifferenceDensityMap(dataset, resolutionFraction = 1, gridOversampling = 1) {
    if (!(Number.isFinite(resolutionFraction) && resolutionFraction > 0 && resolutionFraction <= 1)) {
        throw new Error('Difference-density resolution fraction must be in the interval (0, 1]');
    }
    const cutoff = dataset.maximumReciprocalLength * resolutionFraction;
    let coefficients = resolutionFraction === 1
        ? dataset.coefficients
        : new Map(Array.from(dataset.coefficients.entries()).filter(([, coefficient]) =>
            coefficient.reciprocalLength <= cutoff + 1e-12,
        ));
    if (coefficients.size === 0) {
        const minimumLength = Math.min(...Array.from(dataset.coefficients.values()).map(
            coefficient => coefficient.reciprocalLength,
        ));
        coefficients = new Map(Array.from(dataset.coefficients.entries()).filter(([, coefficient]) =>
            coefficient.reciprocalLength <= minimumLength + 1e-12,
        ));
    }
    if (!(Number.isFinite(gridOversampling) && gridOversampling >= 1)) {
        throw new Error('Difference-density grid oversampling must be at least 1');
    }
    const grid = fourierGrid(coefficients, dataset.cell, gridOversampling);
    return new DifferenceDensityMap(dataset.cell, grid.dimensions, grid.values, {
        reflectionCount: dataset.reflectionCount,
        coefficientCount: coefficients.size,
        fullCoefficientCount: dataset.coefficients.size,
        resolutionFraction,
        gridOversampling,
        mean: grid.mean,
        sigma: grid.sigma,
        minimum: grid.minimum,
        maximum: grid.maximum,
        maxImaginary: grid.maxImaginary,
        volume: grid.volume,
    });
}

/**
 * Periodic difference-electron-density values over one crystallographic unit cell.
 */
export class DifferenceDensityMap {
    constructor(cell, dimensions, values, statistics = {}) {
        this.cell = cell;
        this.dimensions = dimensions;
        this.values = values;
        Object.assign(this, statistics);
    }

    /**
     * Trilinearly samples the periodic map at fractional coordinates.
     * @param {number} x - Fractional x coordinate.
     * @param {number} y - Fractional y coordinate.
     * @param {number} z - Fractional z coordinate.
     * @returns {number} Difference density in electrons per cubic Angstrom.
     */
    sample(x, y, z) {
        const [nx, ny, nz] = this.dimensions;
        const scaled = [x * nx, y * ny, z * nz];
        const lower = scaled.map(Math.floor);
        const fraction = scaled.map((value, index) => value - lower[index]);
        const valueAt = (ix, iy, iz) => this.values[
            (wrapIndex(iz, nz) * ny + wrapIndex(iy, ny)) * nx + wrapIndex(ix, nx)
        ];

        const c000 = valueAt(lower[0], lower[1], lower[2]);
        const c100 = valueAt(lower[0] + 1, lower[1], lower[2]);
        const c010 = valueAt(lower[0], lower[1] + 1, lower[2]);
        const c110 = valueAt(lower[0] + 1, lower[1] + 1, lower[2]);
        const c001 = valueAt(lower[0], lower[1], lower[2] + 1);
        const c101 = valueAt(lower[0] + 1, lower[1], lower[2] + 1);
        const c011 = valueAt(lower[0], lower[1] + 1, lower[2] + 1);
        const c111 = valueAt(lower[0] + 1, lower[1] + 1, lower[2] + 1);
        const lerp = (a, b, t) => a + (b - a) * t;
        const x00 = lerp(c000, c100, fraction[0]);
        const x10 = lerp(c010, c110, fraction[0]);
        const x01 = lerp(c001, c101, fraction[0]);
        const x11 = lerp(c011, c111, fraction[0]);
        return lerp(
            lerp(x00, x10, fraction[1]),
            lerp(x01, x11, fraction[1]),
            fraction[2],
        );
    }

    static fromCIF(fcfText, cifBlock = 0) {
        return calculateDifferenceDensityMap(parseDifferenceDensityDataset(fcfText, cifBlock));
    }
}
