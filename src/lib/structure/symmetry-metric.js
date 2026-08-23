/**
 * Validation that a set of symmetry operations is compatible with the unit cell it is
 * declared alongside.
 *
 * A crystallographic symmetry operation must be an isometry: it maps the crystal onto
 * itself, so it cannot change the distance between two points. Whether a given integer
 * rotation matrix has that property depends on the cell - a two-fold along c is an
 * isometry only when alpha and beta are 90 degrees, for instance. A CIF that pairs an
 * operation with a cell it does not fit is self-contradictory, and every symmetry image
 * it produces comes out distorted: bonded pairs change length, and the distortion looks
 * like a modelling error rather than the metadata error it is.
 */

/** Largest relative change in the metric tensor still attributed to rounding. */
const METRIC_TOLERANCE = 1e-4;

/**
 * Builds the metric tensor of a unit cell, whose entries are the dot products of the
 * basis vectors. Distances depend on the cell only through this tensor, so an operation
 * preserves distance exactly when it preserves it.
 * @param {object} cell - Unit cell with a, b, c, alpha, beta, gamma.
 * @returns {number[][]} The 3x3 metric tensor.
 */
function metricTensor(cell) {
    const toRadians = degrees => (degrees * Math.PI) / 180;
    const { a, b, c } = cell;
    const cosAlpha = Math.cos(toRadians(cell.alpha));
    const cosBeta = Math.cos(toRadians(cell.beta));
    const cosGamma = Math.cos(toRadians(cell.gamma));
    return [
        [a * a, a * b * cosGamma, a * c * cosBeta],
        [a * b * cosGamma, b * b, b * c * cosAlpha],
        [a * c * cosBeta, b * c * cosAlpha, c * c],
    ];
}

/**
 * Whether a rotation matrix preserves the metric of a cell, i.e. whether W^T G W = G.
 * @param {number[][]} rotation - Rotation part of a symmetry operation.
 * @param {number[][]} metric - Metric tensor of the cell.
 * @param {number} scale - Largest metric entry, used to make the tolerance relative.
 * @returns {boolean} True when the operation is an isometry of the cell.
 */
function preservesMetric(rotation, metric, scale) {
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            let value = 0;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    value += rotation[i][row] * metric[i][j] * rotation[j][column];
                }
            }
            if (Math.abs(value - metric[row][column]) > METRIC_TOLERANCE * scale) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Finds symmetry operations that are not isometries of the given cell.
 * @param {Array<{rotMatrix: number[][]}>} symmetryOperations - Operations to check.
 * @param {object} cell - Unit cell the operations are declared with.
 * @returns {number[]} Indices of the operations that change distances.
 */
export function findNonIsometricOperations(symmetryOperations, cell) {
    if (!cell || !Array.isArray(symmetryOperations)) {
        return [];
    }
    const { a, b, c, alpha, beta, gamma } = cell;
    if (![a, b, c, alpha, beta, gamma].every(Number.isFinite)) {
        return [];
    }
    const metric = metricTensor(cell);
    const scale = Math.max(...metric.flat().map(Math.abs));
    const offenders = [];
    symmetryOperations.forEach((operation, index) => {
        const rotation = Array.isArray(operation.rotMatrix)
            ? operation.rotMatrix
            : operation.rotMatrix?.toArray?.();
        if (!rotation) {
            return;
        }
        if (!preservesMetric(rotation, metric, scale)) {
            offenders.push(index);
        }
    });
    return offenders;
}
