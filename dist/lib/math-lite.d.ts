/**
 * @param {Array} data - Plain 1D or 2D array, or a Matrix to rewrap
 * @returns {Matrix} A Matrix wrapping the given data
 */
export function matrix(data: any[]): Matrix;
/**
 * Matrix/vector/scalar multiplication (mat*mat, mat*vec, or mat*scalar). Hand-unrolled
 * fast paths for 3x3*3x3 and 3x3*3-vector - the only shapes this module ever sees (see
 * the module comment) - avoid the closure/iterator overhead of the generic map/reduce
 * fallback, which profiling showed as the dominant cost of symmetry growth on structures
 * with many atoms/operations (each applyToAtom call multiplies a 3x3 rotation matrix,
 * and anisotropic ADP transforms chain two more 3x3*3x3 multiplies on top of that).
 * @param {Matrix|Array|number} a - Left operand
 * @param {Matrix|Array|number} b - Right operand
 * @returns {Matrix|Array|number} The product, wrapped in a Matrix if either
 *  operand was a Matrix
 */
export function multiply(a: Matrix | any[] | number, b: Matrix | any[] | number): Matrix | any[] | number;
/**
 * Elementwise addition of two same-shaped vectors/matrices.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Matrix|Array} The elementwise sum
 */
export function add(a: Matrix | any[], b: Matrix | any[]): Matrix | any[];
/**
 * Elementwise subtraction of two same-shaped vectors/matrices.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Matrix|Array} The elementwise difference
 */
export function subtract(a: Matrix | any[], b: Matrix | any[]): Matrix | any[];
/**
 * @param {Matrix|Array} m - Matrix to transpose
 * @returns {Matrix|Array} The transposed matrix
 */
export function transpose(m: Matrix | any[]): Matrix | any[];
/**
 * @param {Matrix|Array} m - 3x3 matrix
 * @returns {number} The determinant
 * @throws {Error} If the matrix is not 3x3
 */
export function det(m: Matrix | any[]): number;
/**
 * @param {Matrix|Array} m - 3x3 matrix
 * @returns {Matrix|Array} The matrix inverse
 * @throws {Error} If the matrix is not 3x3 or is singular
 */
export function inv(m: Matrix | any[]): Matrix | any[];
/**
 * @param {Matrix|Array} v - Vector of diagonal entries
 * @returns {Matrix|Array} A square matrix with `v` on the diagonal
 */
export function diag(v: Matrix | any[]): Matrix | any[];
/**
 * @param {Matrix|Array} v - Vector
 * @returns {number} The Euclidean norm of `v`
 */
export function norm(v: Matrix | any[]): number;
/**
 * @param {number} value - Numeric value, currently only degrees supported
 * @param {string} fromUnit - Must be `'deg'`
 * @returns {{toNumber: function(string): number}} An object exposing `toNumber('rad')`
 * @throws {Error} If `fromUnit` is not `'deg'`
 */
export function unit(value: number, fromUnit: string): {
    toNumber: (arg0: string) => number;
};
/**
 * @param {number} n - Matrix size
 * @returns {number[][]} An n x n identity matrix
 */
export function identity(n: number): number[][];
/**
 * @param {number} n - Vector length
 * @returns {number[]} A length-n vector of zeros
 */
export function zeros(n: number): number[];
/**
 * @param {Matrix|Array} x - Vector or matrix to deep-copy
 * @returns {Matrix|Array} An independent copy of `x`
 */
export function clone(x: Matrix | any[]): Matrix | any[];
/**
 * Mirrors mathjs's elementwise equal(), which returns an (always-truthy)
 * array/matrix of booleans rather than a single boolean.
 * @param {Matrix|Array} a - First operand
 * @param {Matrix|Array} b - Second operand
 * @returns {Array} Elementwise equality, same shape as the inputs
 */
export function equal(a: Matrix | any[], b: Matrix | any[]): any[];
/**
 * mathjs-compatible eigs() for real symmetric 3x3 matrices.
 * @param {Matrix|number[][]} m - Symmetric 3x3 matrix
 * @returns {object} Result
 *  matching the subset of mathjs's eigs() output shape used by this codebase
 */
export function eigs(m: Matrix | number[][]): object;
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
    constructor(data: any[]);
    _data: any[];
    /**
     * @returns {Array} The underlying plain array
     */
    toArray(): any[];
    /**
     * @returns {number[]} [rows, cols] for a matrix, or [length] for a vector
     */
    size(): number[];
    /**
     * @param {number[]} index - [row, col] or [index]
     * @returns {number} The element at the given index
     */
    get(index: number[]): number;
    /**
     * @param {function(number, number[], Matrix): number} fn - Called with
     *  (value, index, matrix) per element
     * @returns {Matrix} A new Matrix of the same shape
     */
    map(fn: (arg0: number, arg1: number[], arg2: Matrix) => number): Matrix;
}
export const abs: (x: number) => number;
export function min(v: any): number;
/**
 * A plain 1D vector, 2D nested-array matrix, or scalar leaf thereof - the
 * only shapes this module's functions operate on.
 */
export type NDArray = number | NDArray[];
//# sourceMappingURL=math-lite.d.ts.map