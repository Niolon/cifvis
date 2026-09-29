/**
 * Multiplies and validates an integral Miller-index transform.
 * @param {number[][]} matrix - Reciprocal-space rotation matrix.
 * @param {number[]} reflection - Miller index [h,k,l].
 * @param {number} tolerance - Integrality tolerance.
 * @returns {number[]} Integral transformed index.
 */
export function multiplyReflectionIndex(matrix: number[][], reflection: number[], tolerance?: number): number[];
/**
 * Returns cached direct/reciprocal representations of all symmetry operations.
 * @param {object} symmetry - CellSymmetry instance used as the cache identity.
 * @returns {object[]} Operation kernels retaining exact fractional translations.
 */
export function reciprocalSymmetryKernel(symmetry: object): object[];
/**
 * Compiles symmetry into flat integer rotations and rational phase tables.
 * @param {object} symmetry - CellSymmetry instance used as the cache identity.
 * @returns {object} Allocation-free reciprocal-symmetry kernel with shared scratch.
 */
export function compiledReciprocalSymmetryKernel(symmetry: object): object;
/**
 * Compares Miller indices lexicographically in h, k, l order.
 * @param {number[]} first - First Miller index.
 * @param {number[]} second - Second Miller index.
 * @returns {number} Negative, zero, or positive ordering value.
 */
export function compareReflectionIndices(first: number[], second: number[]): number;
/**
 * Finds an orbit representative using the reference object implementation.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {object} symmetry - Full space-group symmetry.
 * @param {boolean} mergeFriedel - Whether Friedel inversion belongs to the orbit.
 * @returns {number[]} Lexicographically minimal [h,k,l].
 */
export function canonicalReflectionIndexLegacy(h: number, k: number, l: number, symmetry: object, mergeFriedel?: boolean): number[];
/**
 * Finds an orbit representative without allocating equivalent-index arrays.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {object} symmetry - Full space-group symmetry.
 * @param {boolean} mergeFriedel - Whether Friedel inversion belongs to the orbit.
 * @returns {number[]} Lexicographically minimal [h,k,l].
 */
export function canonicalReflectionIndex(h: number, k: number, l: number, symmetry: object, mergeFriedel?: boolean): number[];
/**
 * Tests systematic absence with the reference complex phase-sum implementation.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {object} symmetry - Full space-group symmetry.
 * @param {number} tolerance - Complex phase-sum tolerance.
 * @returns {boolean} Whether all transformed-index phase sums vanish.
 */
export function isGeneralPositionSystematicAbsenceLegacy(h: number, k: number, l: number, symmetry: object, tolerance?: number): boolean;
/**
 * Tests systematic absence with compiled rational phases and shared scratch.
 * This function is not re-entrant for the same symmetry kernel.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {object} symmetry - Full space-group symmetry.
 * @param {number} tolerance - Complex phase-sum tolerance.
 * @returns {boolean} Whether all transformed-index phase sums vanish.
 */
export function isGeneralPositionSystematicAbsence(h: number, k: number, l: number, symmetry: object, tolerance?: number): boolean;
//# sourceMappingURL=reciprocal-symmetry.d.ts.map