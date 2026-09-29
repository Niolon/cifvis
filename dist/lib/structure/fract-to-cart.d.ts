/**
 * Calculates the transformation matrix for converting fractional to cartesian coordinates.
 * Uses a standard crystallographic convention where:
 * - a axis is along x
 * - b axis is in the xy plane
 * - c axis has components in all directions as needed
 * @param {object} cellParams - Unit cell parameters
 * @param {number} cellParams.a - a axis length in Ångstroms
 * @param {number} cellParams.b - b axis length in Ångstroms
 * @param {number} cellParams.c - c axis length in Ångstroms
 * @param {number} cellParams.alpha - α angle in degrees
 * @param {number} cellParams.beta - β angle in degrees
 * @param {number} cellParams.gamma - γ angle in degrees
 * @returns {math.Matrix} 3x3 transformation matrix
 */
export function calculateFractToCartMatrix(cellParams: {
    a: number;
    b: number;
    c: number;
    alpha: number;
    beta: number;
    gamma: number;
}): math.Matrix;
/**
 * Converts anisotropic displacement parameters array to a symmetric 3x3 matrix
 * @param {Array<number>} adp - ADPs [U11, U22, U33, U12, U13, U23]
 * @returns {math.Matrix} 3x3 symmetric matrix
 * @throws {Error} If input array length !== 6
 */
export function adpToMatrix(adp: Array<number>): math.Matrix;
/**
 * Converts symmetric 3x3 ADP matrix to six-parameter array
 * @param {math.Matrix|Array<Array<number>>} uij_matrix - 3x3 symmetric matrix
 * @returns {Array<number>} ADPs [U11, U22, U33, U12, U13, U23]
 * @throws {Error} If input not 3x3 matrix
 */
export function matrixToAdp(uij_matrix: math.Matrix | Array<Array<number>>): Array<number>;
/**
 * Converts ADPs from CIF (fractional) to Cartesian convention
 * @param {math.Matrix|Array<Array<number>>} fractToCartMatrix - 3x3 transformation matrix
 * @param {Array<number>} adp - ADPs [U11, U22, U33, U12, U13, U23]
 * @returns {Array<number>} Cartesian ADPs [U11, U22, U33, U12, U13, U23]
 * @throws {Error} If matrix not 3x3 or ADP array length !== 6
 */
export function uCifToUCart(fractToCartMatrix: math.Matrix | Array<Array<number>>, adp: Array<number>): Array<number>;
import * as math from '../math-lite.js';
//# sourceMappingURL=fract-to-cart.d.ts.map