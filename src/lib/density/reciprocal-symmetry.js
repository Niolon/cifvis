/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact reciprocal helpers */
import * as math from '../math-lite.js';

const TWO_PI = 2 * Math.PI;
const SYMMETRY_KERNELS = new WeakMap();

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
export function canonicalReflectionIndex(h, k, l, symmetry, mergeFriedel = true) {
    const equivalents = reciprocalSymmetryKernel(symmetry).map(operation =>
        multiplyReflectionIndex(operation.reciprocalRotation, [h, k, l]),
    );
    if (mergeFriedel) {
        equivalents.push(...equivalents.map(indices => indices.map(value => value === 0 ? 0 : -value)));
    }
    equivalents.sort(compareReflectionIndices);
    return equivalents[0];
}

/** Tests the general-position phase sum for a systematic absence. */
export function isGeneralPositionSystematicAbsence(h, k, l, symmetry, tolerance = 1e-8) {
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
