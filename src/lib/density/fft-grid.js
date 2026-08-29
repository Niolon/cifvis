/* eslint-disable jsdoc/require-jsdoc -- compact numerical planning helpers */

const AXES = [0, 1, 2];

export function nextPowerOfTwo(value) {
    let result = 1;
    while (result < value) {
        result *= 2;
    }
    return Math.max(2, result);
}

export function isSmooth235(value) {
    let remaining = Math.max(1, Math.round(value));
    for (const factor of [2, 3, 5]) {
        while (remaining % factor === 0) {
            remaining /= factor;
        }
    }
    return remaining === 1;
}

export function nextSmooth235(value, divisor = 1) {
    const required = Math.max(2, Math.ceil(value));
    const usedDivisor = Math.max(1, Math.round(divisor));
    for (let candidate = required; ; candidate++) {
        if (candidate % usedDivisor === 0 && isSmooth235(candidate)) {
            return candidate;
        }
    }
}

function gcd(first, second) {
    let a = Math.abs(Math.round(first));
    let b = Math.abs(Math.round(second));
    while (b) {
        [a, b] = [b, a % b];
    }
    return a;
}

function lcm(first, second) {
    return Math.abs(first * second) / Math.max(1, gcd(first, second));
}

/**
 * Finds the small crystallographic denominator of a fractional translation.
 * @param {number} value - Fractional translation component.
 * @param {number} tolerance - Maximum rational-approximation residual.
 * @param {number} maximum - Largest crystallographic denominator to consider.
 * @returns {number|null} Compatible denominator, or null for an implausible fraction.
 */
export function fractionalDenominator(value, tolerance = 1e-6, maximum = 12) {
    const fractional = ((Number(value) % 1) + 1) % 1;
    if (fractional < tolerance || Math.abs(fractional - 1) < tolerance) {
        return 1;
    }
    for (let denominator = 2; denominator <= maximum; denominator++) {
        if (Math.abs(fractional * denominator - Math.round(fractional * denominator)) <= tolerance) {
            return denominator;
        }
    }
    return null;
}

function union(parents, first, second) {
    const root = value => {
        while (parents[value] !== value) {
            parents[value] = parents[parents[value]];
            value = parents[value];
        }
        return value;
    };
    const a = root(first);
    const b = root(second);
    if (a !== b) {
        parents[b] = a;
    }
}

/**
 * Chooses a 2/3/5-smooth grid which every supplied space-group operation maps
 * onto itself. Axis-mixing rotations share a dimension; screw/glide
 * translations make the corresponding dimension a denominator multiple.
 * @param {number[]} minimumDimensions - Minimum samples along each fractional axis.
 * @param {object[]} symmetryOperations - Crystallographic rotations and translations.
 * @returns {object} Compatible dimensions and any fallback diagnostic.
 */
export function planCompatibleDimensions(minimumDimensions, symmetryOperations = []) {
    const minima = minimumDimensions.map(value => Math.max(2, Math.ceil(value)));
    const divisors = [1, 1, 1];
    const parents = [0, 1, 2];
    const fallbackReasons = [];
    let symmetryCompatible = true;

    for (const operation of symmetryOperations ?? []) {
        const rotation = operation.rotation ?? operation.rotMatrix;
        const translation = operation.translation ?? operation.transVector ?? [0, 0, 0];
        if (!Array.isArray(rotation) || rotation.length !== 3) {
            continue;
        }
        for (const row of AXES) {
            for (const column of AXES) {
                const value = Number(rotation[row]?.[column]);
                if (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 1e-6) {
                    symmetryCompatible = false;
                    fallbackReasons.push('non-integral-symmetry-rotation');
                    continue;
                }
                if (row !== column && Math.round(value) !== 0) {
                    union(parents, row, column);
                }
            }
            const denominator = fractionalDenominator(translation[row]);
            if (denominator === null || !isSmooth235(denominator)) {
                symmetryCompatible = false;
                fallbackReasons.push('non-crystallographic-translation');
            } else {
                divisors[row] = lcm(divisors[row], denominator);
            }
        }
    }

    if (!symmetryCompatible) {
        return {
            dimensions: minima.map(value => nextSmooth235(value)),
            symmetryCompatible: false,
            fallbackReason: [...new Set(fallbackReasons)].join(','),
        };
    }

    const components = new Map();
    const find = value => {
        while (parents[value] !== value) {
            value = parents[value];
        }
        return value;
    };
    for (const axis of AXES) {
        const root = find(axis);
        const component = components.get(root) ?? [];
        component.push(axis);
        components.set(root, component);
    }
    const dimensions = [...minima];
    for (const component of components.values()) {
        const minimum = Math.max(...component.map(axis => minima[axis]));
        const divisor = component.reduce((value, axis) => lcm(value, divisors[axis]), 1);
        const dimension = nextSmooth235(minimum, divisor);
        component.forEach(axis => {
            dimensions[axis] = dimension;
        });
    }
    return { dimensions, symmetryCompatible: true, fallbackReason: null };
}

/**
 * Plans production or exact legacy Fourier dimensions from coefficient bounds.
 * @param {Map} coefficients - Reciprocal coefficients keyed by Miller index.
 * @param {number} oversampling - Requested Fourier-grid oversampling.
 * @param {object} options - Backend and crystallographic symmetry metadata.
 * @returns {object} Planned dimensions, reciprocal limits, and diagnostics.
 */
export function planFourierDimensions(coefficients, oversampling = 1, options = {}) {
    const maxima = [0, 0, 0];
    for (const { h, k, l } of coefficients.values()) {
        maxima[0] = Math.max(maxima[0], Math.abs(h));
        maxima[1] = Math.max(maxima[1], Math.abs(k));
        maxima[2] = Math.max(maxima[2], Math.abs(l));
    }
    const factor = Math.max(1, Number(oversampling) || 1);
    if (options.backend === 'radix-2') {
        return {
            dimensions: maxima.map(maximum =>
                nextPowerOfTwo(nextPowerOfTwo(2 * maximum + 1) * factor)),
            maxima,
            symmetryCompatible: false,
            fallbackReason: 'legacy-radix-2-grid',
        };
    }
    const minimumDimensions = maxima.map(maximum => Math.ceil(factor * (2 * maximum + 1)));
    return {
        ...planCompatibleDimensions(minimumDimensions, options.symmetryOperations),
        maxima,
        minimumDimensions,
    };
}
