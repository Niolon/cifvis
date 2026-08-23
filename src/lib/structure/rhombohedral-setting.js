/**
 * Conversion of R-centred space-group operators from the hexagonal axes used by the
 * standard-setting table to the primitive rhombohedral axes some CIFs use instead.
 *
 * A rhombohedral space group has two conventional descriptions: hexagonal axes
 * (a = b, gamma = 120 degrees, three lattice points per cell) and rhombohedral axes
 * (a = b = c, alpha = beta = gamma != 90 degrees, one lattice point per cell). The
 * International Tables standard - and therefore the generated operator table - uses
 * the hexagonal axes. Applying those operators to a cell given on rhombohedral axes
 * is not merely unconventional but geometrically wrong: the rotation parts are only
 * isometries with respect to the metric they were written for, so symmetry images
 * come out distorted and bonded pairs change length.
 */

/**
 * Basis change taking hexagonal fractional coordinates to rhombohedral ones, for the
 * obverse setting used by the International Tables.
 *
 * The conventional relation between the two bases is
 *   a_hex = a_rh - b_rh,  b_hex = b_rh - c_rh,  c_hex = a_rh + b_rh + c_rh,
 * so writing the hexagonal basis in terms of the rhombohedral one gives the matrix
 * below, and a point's coordinates transform by that same matrix.
 */
const HEXAGONAL_TO_RHOMBOHEDRAL = [
    [1, 0, 1],
    [-1, 1, 1],
    [0, -1, 1],
];

/** Inverse of {@link HEXAGONAL_TO_RHOMBOHEDRAL}, taking rhombohedral coordinates to hexagonal. */
const RHOMBOHEDRAL_TO_HEXAGONAL = [
    [2 / 3, -1 / 3, -1 / 3],
    [1 / 3, 1 / 3, -2 / 3],
    [1 / 3, 1 / 3, 1 / 3],
];

/** Denominator used when snapping transformed translations back to exact fractions. */
const TRANSLATION_DENOMINATOR = 12;

/**
 * Multiplies two 3x3 matrices.
 * @param {number[][]} first - Left matrix.
 * @param {number[][]} second - Right matrix.
 * @returns {number[][]} The product.
 */
function multiply(first, second) {
    return first.map(row => [0, 1, 2].map(
        column => row[0] * second[0][column] + row[1] * second[1][column] + row[2] * second[2][column],
    ));
}

/**
 * Applies a 3x3 matrix to a 3-vector.
 * @param {number[][]} matrix - Matrix to apply.
 * @param {number[]} vector - Vector to transform.
 * @returns {number[]} The transformed vector.
 */
function apply(matrix, vector) {
    return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
}

/**
 * Snaps a value to the nearest twelfth and wraps it into [0, 1).
 *
 * The basis change introduces thirds, so the exact fractions a symmetry translation
 * must take are recovered by rounding rather than left as floating-point noise that
 * would defeat the duplicate removal below.
 * @param {number} value - Translation component.
 * @returns {number} Wrapped, snapped component.
 */
function normaliseTranslation(value) {
    const snapped = Math.round(value * TRANSLATION_DENOMINATOR) / TRANSLATION_DENOMINATOR;
    return ((snapped % 1) + 1) % 1;
}

/**
 * Formats a rotation row and translation component as one CIF coordinate expression.
 * @param {number[]} row - Row of the rotation matrix.
 * @param {number} translation - Matching translation component, already wrapped.
 * @returns {string} Expression such as `-x+2/3`.
 */
function formatComponent(row, translation) {
    const axes = ['x', 'y', 'z'];
    let expression = '';
    row.forEach((coefficient, index) => {
        const rounded = Math.round(coefficient);
        if (rounded === 0) {
            return;
        }
        if (rounded > 0 && expression !== '') {
            expression += '+';
        }
        if (rounded === -1) {
            expression += '-';
        } else if (rounded !== 1) {
            expression += String(rounded);
        }
        expression += axes[index];
    });
    if (translation !== 0) {
        const numerator = Math.round(translation * TRANSLATION_DENOMINATOR);
        const divisor = gcd(numerator, TRANSLATION_DENOMINATOR);
        expression += `+${numerator / divisor}/${TRANSLATION_DENOMINATOR / divisor}`;
    }
    return expression === '' ? '0' : expression;
}

/**
 * Greatest common divisor of two non-negative integers.
 * @param {number} first - First value.
 * @param {number} second - Second value.
 * @returns {number} Greatest common divisor.
 */
function gcd(first, second) {
    return second === 0 ? first : gcd(second, first % second);
}

/**
 * Whether a unit cell is given on rhombohedral rather than hexagonal axes.
 * @param {object} cell - Cell with a, b, c, alpha, beta, gamma.
 * @param {number} [lengthTolerance] - Permitted spread of the axis lengths, in Å.
 * @param {number} [angleTolerance] - Permitted spread of the angles, in degrees.
 * @returns {boolean} True for a = b = c with equal angles that are not 90 degrees.
 */
export function isRhombohedralCell(cell, lengthTolerance = 1e-3, angleTolerance = 1e-2) {
    if (!cell) {
        return false;
    }
    const { a, b, c, alpha, beta, gamma } = cell;
    if (![a, b, c, alpha, beta, gamma].every(Number.isFinite)) {
        return false;
    }
    const lengthsEqual = Math.abs(a - b) < lengthTolerance
        && Math.abs(b - c) < lengthTolerance;
    const anglesEqual = Math.abs(alpha - beta) < angleTolerance
        && Math.abs(beta - gamma) < angleTolerance;
    return lengthsEqual && anglesEqual && Math.abs(alpha - 90) > angleTolerance;
}

/**
 * Converts hexagonal-setting operators of an R-centred group to the rhombohedral
 * setting.
 *
 * Each operator is conjugated into the rhombohedral basis. The three centring
 * translations that distinguish otherwise identical hexagonal operators become whole
 * lattice vectors there, so the resulting list collapses to a third of its length -
 * 18 operators to 6 for R-3, matching the primitive cell containing one lattice point
 * instead of three.
 * @param {string[]} hexagonalOperations - Operator strings in the hexagonal setting.
 * @returns {string[]} Operator strings in the rhombohedral setting, duplicates removed.
 */
export function toRhombohedralSetting(hexagonalOperations) {
    const seen = new Set();
    const converted = [];

    for (const operation of hexagonalOperations) {
        const { rotation, translation } = parseOperation(operation);
        // W_rhombohedral = P * W_hexagonal * P^-1, with the translation carried through
        // the same change of basis.
        const rotated = multiply(
            multiply(HEXAGONAL_TO_RHOMBOHEDRAL, rotation), RHOMBOHEDRAL_TO_HEXAGONAL,
        );
        const shifted = apply(HEXAGONAL_TO_RHOMBOHEDRAL, translation).map(normaliseTranslation);

        const key = rotated.map(row => row.map(value => Math.round(value)).join(',')).join(';')
            + '|' + shifted.map(value => Math.round(value * TRANSLATION_DENOMINATOR)).join(',');
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        converted.push([0, 1, 2].map(index => formatComponent(rotated[index], shifted[index])).join(','));
    }
    return converted;
}

/**
 * Parses a CIF coordinate triplet into a rotation matrix and translation vector.
 * @param {string} operation - Triplet such as `-y,x-y,z+2/3`.
 * @returns {{rotation: number[][], translation: number[]}} Parsed operation.
 */
function parseOperation(operation) {
    const rotation = [];
    const translation = [];
    const components = operation.split(',');
    if (components.length !== 3) {
        throw new Error(`Invalid symmetry operation: ${operation}`);
    }

    for (const component of components) {
        const row = [0, 0, 0];
        let shift = 0;
        const terms = component.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
        for (const term of terms) {
            const axisMatch = term.match(/^([+-]?)(\d*)\/?(\d*)?\*?([xyz])$/);
            if (axisMatch) {
                const sign = axisMatch[1] === '-' ? -1 : 1;
                const magnitude = axisMatch[2] === '' ? 1 : Number(axisMatch[2]);
                row['xyz'.indexOf(axisMatch[4])] = sign * magnitude;
                continue;
            }
            const fractionMatch = term.match(/^([+-]?)(\d+)\/(\d+)$/);
            if (fractionMatch) {
                const sign = fractionMatch[1] === '-' ? -1 : 1;
                shift += sign * Number(fractionMatch[2]) / Number(fractionMatch[3]);
                continue;
            }
            const numberMatch = term.match(/^([+-]?)(\d+(?:\.\d+)?)$/);
            if (numberMatch) {
                shift += (numberMatch[1] === '-' ? -1 : 1) * Number(numberMatch[2]);
            }
        }
        rotation.push(row);
        translation.push(shift);
    }
    return { rotation, translation };
}
