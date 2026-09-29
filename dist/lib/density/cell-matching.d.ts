/**
 * Tests whether two unit cells describe the same reflection lattice.
 * @param {object} first - Cell to validate.
 * @param {object} second - Reference cell.
 * @param {object} tolerances - Relative length and absolute degree tolerances.
 * @returns {boolean} Whether every cell parameter agrees.
 */
export function cellsMatch(first: object, second: object, tolerances?: object): boolean;
/**
 * Throws an informative mismatch error naming the first differing parameter.
 * @param {object} first - Cell to validate.
 * @param {object} second - Reference cell.
 * @param {string} label - Source label used in the error.
 * @returns {void}
 */
export function assertCellsMatch(first: object, second: object, label?: string): void;
/** Shared tolerances for matching coordinate and reflection unit cells. */
export const CELL_MATCH_TOLERANCES: Readonly<{
    relativeLength: 0.001;
    angleDegrees: 0.05;
}>;
//# sourceMappingURL=cell-matching.d.ts.map