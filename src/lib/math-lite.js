// Minimal drop-in replacement for the small slice of mathjs actually used by
// this codebase (3x3 matrices and 3-vectors only). mathjs's create(all) builds
// its entire ~400-function typed-dispatch registry at import time, which costs
// tens of ms on every cold page load regardless of how much of it is used.
// This module mirrors mathjs's array-vs-Matrix result polymorphism (functions
// return a Matrix wrapper if any operand was already a Matrix, otherwise a
// plain array) so call sites did not need to change.

/**
 * A plain 1D vector, 2D nested-array matrix, or scalar leaf thereof - the
 * only shapes this module's functions operate on.
 * @typedef {number|NDArray[]} NDArray
 */

/**
 * Lightweight stand-in for mathjs's Matrix, wrapping a plain 1D or 2D array.
 */
export class Matrix {
    /**
     * @param {Array} data - Plain 1D vector or 2D nested-array matrix
     */
    constructor(data) {
        this._data = data;
    }

    /**
     * @returns {Array} The underlying plain array
     */
    toArray() {
        return this._data;
    }

    /**
     * @returns {number[]} [rows, cols] for a matrix, or [length] for a vector
     */
    size() {
        return Array.isArray(this._data[0]) ? [this._data.length, this._data[0].length] : [this._data.length];
    }

    /**
     * @param {number[]} index - [row, col] or [index]
     * @returns {number} The element at the given index
     */
    get(index) {
        return index.length === 2 ? this._data[index[0]][index[1]] : this._data[index[0]];
    }

    /**
     * @param {function(number, number[], Matrix): number} fn - Called with
     *  (value, index, matrix) per element
     * @returns {Matrix} A new Matrix of the same shape
     */
    map(fn) {
        const is2D = Array.isArray(this._data[0]);
        const mapped = is2D
            ? this._data.map((row, i) => row.map((v, j) => fn(v, [i, j], this)))
            : this._data.map((v, i) => fn(v, [i], this));
        return new Matrix(mapped);
    }
}

/**
 * Recursively unwraps Matrix instances (including ones nested inside plain
 * arrays) down to plain numbers/arrays.
 * @param {Matrix|NDArray} x - Matrix, plain array, or scalar
 * @returns {NDArray} The equivalent plain array/scalar
 */
function raw(x) {
    if (x instanceof Matrix) {
        return raw(x.toArray());
    }
    if (Array.isArray(x)) {
        return x.map(raw);
    }
    return x;
}

/**
 * Mirrors mathjs's array-vs-Matrix result polymorphism: wraps `result` in a
 * Matrix if any of `inputs` was itself a Matrix, otherwise returns it as-is.
 * @param {Array<Matrix|NDArray>} inputs - The original (pre-`raw()`) operands
 * @param {NDArray} result - The plain-array/scalar result to conditionally wrap
 * @returns {Matrix|NDArray} `result`, or `result` wrapped in a Matrix
 */
function wrapLike(inputs, result) {
    return inputs.some(x => x instanceof Matrix) ? new Matrix(result) : result;
}

/**
 * @param {NDArray} a - First operand (plain array or scalar)
 * @param {NDArray} b - Second operand, same shape as `a`
 * @param {function(number, number): (number|boolean)} fn - Called on each pair of scalar leaves
 * @returns {NDArray} The elementwise result, same shape as the inputs
 */
function elementwise(a, b, fn) {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.map((v, i) => elementwise(v, b[i], fn));
    }
    return fn(a, b);
}

/**
 * @param {Array} data - Plain 1D or 2D array, or a Matrix to rewrap
 * @returns {Matrix} A Matrix wrapping the given data
 */
export function matrix(data) {
    return new Matrix(raw(data));
}

/**
 * Matrix/vector/scalar multiplication (mat*mat, mat*vec, or mat*scalar).
 * @param {Matrix|Array|number} a - Left operand
 * @param {Matrix|Array|number} b - Right operand
 * @returns {Matrix|Array|number} The product, wrapped in a Matrix if either
 *  operand was a Matrix
 */
export function multiply(a, b) {
    const A = raw(a);
    const B = raw(b);
    let result;
    if (typeof B === 'number') {
        result = Array.isArray(A[0]) ? A.map(row => row.map(v => v * B)) : A.map(v => v * B);
    } else if (typeof A === 'number') {
        result = Array.isArray(B[0]) ? B.map(row => row.map(v => v * A)) : B.map(v => v * A);
    } else if (Array.isArray(A[0]) && Array.isArray(B[0])) {
        result = A.map((row, i) => row.map((_, j) => row.reduce((sum, _v, k) => sum + A[i][k] * B[k][j], 0)));
    } else if (Array.isArray(A[0])) {
        result = A.map(row => row.reduce((sum, v, k) => sum + v * B[k], 0));
    } else {
        throw new Error('multiply: unsupported operand shapes');
    }
    return wrapLike([a, b], result);
}

/**
 * Elementwise addition of two same-shaped vectors/matrices.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Matrix|Array} The elementwise sum
 */
export function add(a, b) {
    return wrapLike([a, b], elementwise(raw(a), raw(b), (x, y) => x + y));
}

/**
 * Elementwise subtraction of two same-shaped vectors/matrices.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Matrix|Array} The elementwise difference
 */
export function subtract(a, b) {
    return wrapLike([a, b], elementwise(raw(a), raw(b), (x, y) => x - y));
}

/**
 * @param {Matrix|Array} m - Matrix to transpose
 * @returns {Matrix|Array} The transposed matrix
 */
export function transpose(m) {
    const M = raw(m);
    const result = M[0].map((_, j) => M.map(row => row[j]));
    return wrapLike([m], result);
}

/**
 * @param {Matrix|Array} m - 3x3 matrix
 * @returns {number} The determinant
 * @throws {Error} If the matrix is not 3x3
 */
export function det(m) {
    const M = raw(m);
    if (M.length !== 3) {
        throw new Error('det: only 3x3 matrices are supported');
    }
    return (
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
    );
}

/**
 * @param {Matrix|Array} m - 3x3 matrix
 * @returns {Matrix|Array} The matrix inverse
 * @throws {Error} If the matrix is not 3x3 or is singular
 */
export function inv(m) {
    const M = raw(m);
    if (M.length !== 3) {
        throw new Error('inv: only 3x3 matrices are supported');
    }
    const d = det(M);
    if (d === 0) {
        throw new Error('inv: matrix is singular');
    }
    const cofactor = [
        [
            M[1][1] * M[2][2] - M[1][2] * M[2][1],
            -(M[1][0] * M[2][2] - M[1][2] * M[2][0]),
            M[1][0] * M[2][1] - M[1][1] * M[2][0],
        ],
        [
            -(M[0][1] * M[2][2] - M[0][2] * M[2][1]),
            M[0][0] * M[2][2] - M[0][2] * M[2][0],
            -(M[0][0] * M[2][1] - M[0][1] * M[2][0]),
        ],
        [
            M[0][1] * M[1][2] - M[0][2] * M[1][1],
            -(M[0][0] * M[1][2] - M[0][2] * M[1][0]),
            M[0][0] * M[1][1] - M[0][1] * M[1][0],
        ],
    ];
    // adjugate is the transpose of the cofactor matrix
    const result = cofactor.map((row, i) => row.map((_, j) => cofactor[j][i] / d));
    return wrapLike([m], result);
}

/**
 * @param {Matrix|Array} v - Vector of diagonal entries
 * @returns {Matrix|Array} A square matrix with `v` on the diagonal
 */
export function diag(v) {
    const V = raw(v);
    const n = V.length;
    const result = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? V[i] : 0)));
    return wrapLike([v], result);
}

/**
 * @param {Matrix|Array} v - Vector
 * @returns {number} The Euclidean norm of `v`
 */
export function norm(v) {
    const V = raw(v);
    return Math.sqrt(V.reduce((sum, x) => sum + x * x, 0));
}

/**
 * @param {number} value - Numeric value, currently only degrees supported
 * @param {string} fromUnit - Must be `'deg'`
 * @returns {{toNumber: function(string): number}} An object exposing `toNumber('rad')`
 * @throws {Error} If `fromUnit` is not `'deg'`
 */
export function unit(value, fromUnit) {
    if (fromUnit !== 'deg') {
        throw new Error(`unit: unsupported unit '${fromUnit}'`);
    }
    return {
        /**
         * @param {string} toUnit - Must be `'rad'`
         * @returns {number} `value` converted to radians
         * @throws {Error} If `toUnit` is not `'rad'`
         */
        toNumber(toUnit) {
            if (toUnit !== 'rad') {
                throw new Error(`unit: unsupported conversion to '${toUnit}'`);
            }
            return value * Math.PI / 180;
        },
    };
}

/**
 * @param {number} n - Matrix size
 * @returns {number[][]} An n x n identity matrix
 */
export function identity(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/**
 * @param {number} n - Vector length
 * @returns {number[]} A length-n vector of zeros
 */
export function zeros(n) {
    return new Array(n).fill(0);
}

/**
 * @param {Matrix|Array} x - Vector or matrix to deep-copy
 * @returns {Matrix|Array} An independent copy of `x`
 */
export function clone(x) {
    const X = raw(x);
    const cloned = Array.isArray(X[0]) ? X.map(row => [...row]) : [...X];
    return wrapLike([x], cloned);
}

/**
 * Mirrors mathjs's elementwise equal(), which returns an (always-truthy)
 * array/matrix of booleans rather than a single boolean.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Array} Elementwise equality, same shape as the inputs
 */
export function equal(a, b) {
    return elementwise(raw(a), raw(b), (x, y) => x === y);
}

export const abs = Math.abs;
export const min = v => Math.min(...raw(v));

/**
 * Jacobi eigenvalue algorithm specialised for real symmetric 3x3 matrices,
 * the only case this codebase needs (ADP ellipsoids, mean-plane normals).
 * @param {number[][]} M - Symmetric 3x3 matrix
 * @returns {{eigenvalues: number[], eigenvectors: number[][]}} Eigenvalues and
 *  corresponding unit eigenvectors (columns), ascending by eigenvalue
 */
function jacobiEigenSymmetric3(M) {
    const n = 3;
    const a = M.map(row => [...row]);
    const v = identity(n);

    for (let sweep = 0; sweep < 100; sweep++) {
        let off = 0;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                off += a[i][j] * a[i][j];
            }
        }
        if (off < 1e-28) {
            break;
        }
        for (let p = 0; p < n; p++) {
            for (let q = p + 1; q < n; q++) {
                if (Math.abs(a[p][q]) < 1e-300) {
                    continue;
                }
                const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
                const sign = theta >= 0 ? 1 : -1;
                const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                const app = a[p][p];
                const aqq = a[q][q];
                const apq = a[p][q];
                a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
                a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
                a[p][q] = 0;
                a[q][p] = 0;
                for (let k = 0; k < n; k++) {
                    if (k !== p && k !== q) {
                        const akp = a[k][p];
                        const akq = a[k][q];
                        a[k][p] = c * akp - s * akq;
                        a[p][k] = a[k][p];
                        a[k][q] = s * akp + c * akq;
                        a[q][k] = a[k][q];
                    }
                }
                for (let k = 0; k < n; k++) {
                    const vkp = v[k][p];
                    const vkq = v[k][q];
                    v[k][p] = c * vkp - s * vkq;
                    v[k][q] = s * vkp + c * vkq;
                }
            }
        }
    }

    const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
    const eigenvalues = order.map(i => a[i][i]);
    const eigenvectors = order.map(i => [v[0][i], v[1][i], v[2][i]]);
    return { eigenvalues, eigenvectors };
}

/**
 * mathjs-compatible eigs() for real symmetric 3x3 matrices.
 * @param {Matrix|number[][]} m - Symmetric 3x3 matrix
 * @returns {{values: number[], eigenvectors: {value: number, vector: Matrix}[]}} Result
 *  matching the subset of mathjs's eigs() output shape used by this codebase
 */
export function eigs(m) {
    const M = raw(m);
    const { eigenvalues, eigenvectors } = jacobiEigenSymmetric3(M);
    return {
        values: eigenvalues,
        eigenvectors: eigenvalues.map((value, i) => ({
            value,
            vector: new Matrix(eigenvectors[i]),
        })),
    };
}
