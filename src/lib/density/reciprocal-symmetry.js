/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact reciprocal helpers */
import * as math from '../math-lite.js';

const TWO_PI = 2 * Math.PI;
const SYMMETRY_KERNELS = new WeakMap();
const COMPILED_SYMMETRY_KERNELS = new WeakMap();

/** Multiplies and validates an integral Miller-index transform. */
export function multiplyReflectionIndex(matrix, reflection, tolerance = 1e-6) {
    return matrix.map(row => {
        const value = row[0] * reflection[0] + row[1] * reflection[1] + row[2] * reflection[2];
        const rounded = Math.round(value);
        if (Math.abs(value - rounded) > tolerance) {
            throw new Error(`Symmetry operation produced a non-integral reflection index: ${value}`);
        }
        return Object.is(rounded, -0) ? 0 : rounded;
    });
}

/** Cached direct/reciprocal representations of every space-group operation. */
export function reciprocalSymmetryKernel(symmetry) {
    let kernel = SYMMETRY_KERNELS.get(symmetry);
    if (!kernel) {
        kernel = symmetry.symmetryOperations.map(operation => ({
            operation,
            reciprocalRotation: math.transpose(math.inv(operation.rotMatrix)),
            positionReciprocalRotation: math.transpose(operation.rotMatrix),
            translation: operation.transVector,
        }));
        SYMMETRY_KERNELS.set(symmetry, kernel);
    }
    return kernel;
}

/** Rounds a matrix entry after confirming crystallographic integrality. */
function integralMatrixEntry(value, tolerance = 1e-6) {
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) > tolerance) {
        throw new Error(`Symmetry operation contains a non-integral reciprocal rotation: ${value}`);
    }
    return Object.is(rounded, -0) ? 0 : rounded;
}

/** Greatest common divisor of non-negative integers. */
function greatestCommonDivisor(first, second) {
    while (second !== 0) {
        [first, second] = [second, first % second];
    }
    return first;
}

/** Finds a small crystallographic denominator or returns null. */
function rationalComponent(value, tolerance = 1e-8, maximumDenominator = 192) {
    for (let denominator = 1; denominator <= maximumDenominator; denominator++) {
        const numerator = Math.round(value * denominator);
        if (Math.abs(value - numerator / denominator) <= tolerance) {
            return { numerator, denominator };
        }
    }
    return null;
}

/** Compiles rational translations into a shared root-of-unity phase table. */
function compileAbsencePhases(operations) {
    const fractions = [];
    let denominator = 1;
    for (const operation of operations) {
        for (const value of operation.translation) {
            const fraction = rationalComponent(value);
            if (!fraction) {
                return null;
            }
            fractions.push(fraction);
            denominator = denominator * fraction.denominator /
                greatestCommonDivisor(denominator, fraction.denominator);
            if (!Number.isSafeInteger(denominator) || denominator > 4096) {
                return null;
            }
        }
    }
    const translationNumerators = new Int32Array(fractions.length);
    fractions.forEach((fraction, index) => {
        translationNumerators[index] = fraction.numerator * denominator / fraction.denominator;
    });
    const rootReal = new Float64Array(denominator);
    const rootImaginary = new Float64Array(denominator);
    for (let residue = 0; residue < denominator; residue++) {
        const phase = TWO_PI * residue / denominator;
        rootReal[residue] = Math.cos(phase);
        rootImaginary[residue] = Math.sin(phase);
    }
    return { denominator, translationNumerators, rootReal, rootImaginary };
}

/** Flat numeric symmetry data for allocation-free reflection preparation. */
export function compiledReciprocalSymmetryKernel(symmetry) {
    let compiled = COMPILED_SYMMETRY_KERNELS.get(symmetry);
    if (compiled) {
        return compiled;
    }
    const operations = reciprocalSymmetryKernel(symmetry);
    const reciprocalRotations = new Int32Array(operations.length * 9);
    const positionReciprocalRotations = new Int32Array(operations.length * 9);
    const translations = new Float64Array(operations.length * 3);
    operations.forEach((operation, operationIndex) => {
        const matrixOffset = operationIndex * 9;
        const vectorOffset = operationIndex * 3;
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 3; column++) {
                const offset = matrixOffset + row * 3 + column;
                reciprocalRotations[offset] = integralMatrixEntry(
                    operation.reciprocalRotation[row][column],
                );
                positionReciprocalRotations[offset] = integralMatrixEntry(
                    operation.positionReciprocalRotation[row][column],
                );
            }
            translations[vectorOffset + row] = operation.translation[row];
        }
    });
    compiled = {
        operationCount: operations.length,
        reciprocalRotations,
        positionReciprocalRotations,
        translations,
        absencePhases: compileAbsencePhases(operations),
        absenceScratch: {
            h: new Int32Array(operations.length),
            k: new Int32Array(operations.length),
            l: new Int32Array(operations.length),
            real: new Float64Array(operations.length),
            imaginary: new Float64Array(operations.length),
        },
    };
    COMPILED_SYMMETRY_KERNELS.set(symmetry, compiled);
    return compiled;
}

/** Lexicographic Miller-index comparison. */
export function compareReflectionIndices(first, second) {
    for (let index = 0; index < 3; index++) {
        if (first[index] !== second[index]) {
            return first[index] - second[index];
        }
    }
    return 0;
}

/** Canonical representative of a reciprocal-space symmetry orbit. */
export function canonicalReflectionIndexLegacy(h, k, l, symmetry, mergeFriedel = true) {
    const equivalents = reciprocalSymmetryKernel(symmetry).map(operation =>
        multiplyReflectionIndex(operation.reciprocalRotation, [h, k, l]),
    );
    if (mergeFriedel) {
        equivalents.push(...equivalents.map(indices => indices.map(value => value === 0 ? 0 : -value)));
    }
    equivalents.sort(compareReflectionIndices);
    return equivalents[0];
}

/** Canonical representative found by a scalar lexicographic minimum scan. */
export function canonicalReflectionIndex(h, k, l, symmetry, mergeFriedel = true) {
    const kernel = compiledReciprocalSymmetryKernel(symmetry);
    const rotations = kernel.reciprocalRotations;
    let bestH = Infinity;
    let bestK = Infinity;
    let bestL = Infinity;
    for (let operation = 0; operation < kernel.operationCount; operation++) {
        const offset = operation * 9;
        let candidateH = rotations[offset] * h + rotations[offset + 1] * k + rotations[offset + 2] * l;
        let candidateK = rotations[offset + 3] * h + rotations[offset + 4] * k + rotations[offset + 5] * l;
        let candidateL = rotations[offset + 6] * h + rotations[offset + 7] * k + rotations[offset + 8] * l;
        if (mergeFriedel) {
            const inverseIsSmaller = candidateH > 0 ||
                (candidateH === 0 && (candidateK > 0 || (candidateK === 0 && candidateL > 0)));
            if (inverseIsSmaller) {
                candidateH = -candidateH;
                candidateK = -candidateK;
                candidateL = -candidateL;
            }
        }
        if (candidateH < bestH ||
            (candidateH === bestH && (candidateK < bestK ||
                (candidateK === bestK && candidateL < bestL)))) {
            bestH = candidateH;
            bestK = candidateK;
            bestL = candidateL;
        }
    }
    return [bestH === 0 ? 0 : bestH, bestK === 0 ? 0 : bestK, bestL === 0 ? 0 : bestL];
}

/** Tests the general-position phase sum for a systematic absence. */
export function isGeneralPositionSystematicAbsenceLegacy(h, k, l, symmetry, tolerance = 1e-8) {
    if (h === 0 && k === 0 && l === 0) {
        return false;
    }
    const sums = new Map();
    for (const operation of reciprocalSymmetryKernel(symmetry)) {
        const transformed = multiplyReflectionIndex(
            operation.positionReciprocalRotation,
            [h, k, l],
        );
        const key = transformed.join(',');
        const phase = TWO_PI * (
            h * operation.translation[0] +
            k * operation.translation[1] +
            l * operation.translation[2]
        );
        const sum = sums.get(key) ?? { real: 0, imaginary: 0 };
        sum.real += Math.cos(phase);
        sum.imaginary += Math.sin(phase);
        sums.set(key, sum);
    }
    return [...sums.values()].every(sum => Math.hypot(sum.real, sum.imaginary) <= tolerance);
}

/** Allocation-free general-position phase-sum absence test. */
export function isGeneralPositionSystematicAbsence(h, k, l, symmetry, tolerance = 1e-8) {
    if (h === 0 && k === 0 && l === 0) {
        return false;
    }
    const kernel = compiledReciprocalSymmetryKernel(symmetry);
    const phases = kernel.absencePhases;
    if (!phases) {
        return isGeneralPositionSystematicAbsenceLegacy(h, k, l, symmetry, tolerance);
    }
    const rotations = kernel.positionReciprocalRotations;
    const scratch = kernel.absenceScratch;
    let groupCount = 0;
    for (let operation = 0; operation < kernel.operationCount; operation++) {
        const matrixOffset = operation * 9;
        const vectorOffset = operation * 3;
        const transformedH = rotations[matrixOffset] * h + rotations[matrixOffset + 1] * k +
            rotations[matrixOffset + 2] * l;
        const transformedK = rotations[matrixOffset + 3] * h + rotations[matrixOffset + 4] * k +
            rotations[matrixOffset + 5] * l;
        const transformedL = rotations[matrixOffset + 6] * h + rotations[matrixOffset + 7] * k +
            rotations[matrixOffset + 8] * l;
        let group = 0;
        while (group < groupCount && (scratch.h[group] !== transformedH ||
            scratch.k[group] !== transformedK || scratch.l[group] !== transformedL)) {
            group++;
        }
        if (group === groupCount) {
            scratch.h[group] = transformedH;
            scratch.k[group] = transformedK;
            scratch.l[group] = transformedL;
            scratch.real[group] = 0;
            scratch.imaginary[group] = 0;
            groupCount++;
        }
        let residue = h * phases.translationNumerators[vectorOffset] +
            k * phases.translationNumerators[vectorOffset + 1] +
            l * phases.translationNumerators[vectorOffset + 2];
        residue = ((residue % phases.denominator) + phases.denominator) % phases.denominator;
        scratch.real[group] += phases.rootReal[residue];
        scratch.imaginary[group] += phases.rootImaginary[residue];
    }
    for (let group = 0; group < groupCount; group++) {
        if (Math.hypot(scratch.real[group], scratch.imaginary[group]) > tolerance) {
            return false;
        }
    }
    return true;
}
