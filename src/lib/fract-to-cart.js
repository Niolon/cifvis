import { create, all } from 'mathjs';

const config = { };
const math = create(all, config);

/**
 * Calculates the transformation matrix for converting fractional to cartesian coordinates.
 * Uses a standard crystallographic convention where:
 * - a axis is along x
 * - b axis is in the xy plane
 * - c axis has components in all directions as needed
 * 
 * @param {Object} cellParams - Unit cell parameters
 * @param {number} cellParams.a - a axis length in Ångstroms
 * @param {number} cellParams.b - b axis length in Ångstroms
 * @param {number} cellParams.c - c axis length in Ångstroms
 * @param {number} cellParams.alpha - α angle in degrees
 * @param {number} cellParams.beta - β angle in degrees
 * @param {number} cellParams.gamma - γ angle in degrees
 * @returns {Array<Array<number>>} 3x3 transformation matrix
 */
export function calculateFractToCartMatrix(cellParams) {
    // Convert angles to radians
    const alpha = math.unit(cellParams.alpha, 'deg').toNumber('rad');
    const beta = math.unit(cellParams.beta, 'deg').toNumber('rad');
    const gamma = math.unit(cellParams.gamma, 'deg').toNumber('rad');
    
    // Calculate helpful intermediate values
    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);
    const sinGamma = Math.sin(gamma);
    
    // Volume term needed for c axis components
    const V = Math.sqrt(1 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma + 
                       2 * cosAlpha * cosBeta * cosGamma);
    
    // Build the transformation matrix using matrix
    const M = math.matrix([
        [cellParams.a, cellParams.b * cosGamma, cellParams.c * cosBeta],
        [0, cellParams.b * sinGamma, cellParams.c * (cosAlpha - cosBeta * cosGamma) / sinGamma],
        [0, 0, cellParams.c * V / sinGamma]
    ]);
    
    return M;
}

/**
 * Converts an array of six unique ADPs to a symmetric 3x3 matrix
 * Order: [U11, U22, U33, U12, U13, U23]
 */
export function adpToMatrix(adp) {
    return math.matrix([
        [adp[0], adp[3], adp[4]],
        [adp[3], adp[1], adp[5]],
        [adp[4], adp[5], adp[2]]
    ]);
}

/**
 * Converts a symmetric 3x3 matrix to six unique ADPs
 * Order: [U11, U22, U33, U12, U13, U23]
 */
export function matrixToAdp(uij_matrix) {
    const m = math.matrix(uij_matrix);
    return [
        m.get([0, 0]),  // U11
        m.get([1, 1]),  // U22
        m.get([2, 2]),  // U33
        m.get([0, 1]),  // U12
        m.get([0, 2]),  // U13
        m.get([1, 2])   // U23
    ];
}

/**
 * Converts anisotropic displacement parameters from CIF to Cartesian convention.
 * 
 * @param {Array<Array<number>>} fractToCartMatrix - 3x3 matrix with cell vectors as row vectors
 * @param {Array<Array<number>>} adps - Array of ADPs, each containing [U11, U22, U33, U12, U13, U23]
 * @returns {Array<Array<number>>} Array of transformed ADPs in same order [U11, U22, U33, U12, U13, U23]
 */
export function uCifToUCart(fractToCartMatrix, adp) {
    const M = math.matrix(fractToCartMatrix);
    const F = math.transpose(math.inv(M));
    // Calculate norms of rows in F
    const norms = math.diag(math.matrix(math.transpose(F).toArray().map(row => math.norm(row))));
    const uMat = adpToMatrix(adp);
    
    // U* = N × U × N^T
    const uStar = math.multiply(math.multiply(norms, uMat), math.transpose(norms));
    
    // U_cart = M × U* × M^T
    const uCart = math.multiply(math.multiply(M, uStar), math.transpose(M));
    
    // Convert back to six parameters
    return matrixToAdp(uCart);
}