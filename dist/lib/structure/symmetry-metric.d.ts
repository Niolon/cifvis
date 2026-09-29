/**
 * Finds symmetry operations that are not isometries of the given cell.
 * @param {Array<{rotMatrix: number[][]}>} symmetryOperations - Operations to check.
 * @param {object} cell - Unit cell the operations are declared with.
 * @returns {number[]} Indices of the operations that change distances.
 */
export function findNonIsometricOperations(symmetryOperations: Array<{
    rotMatrix: number[][];
}>, cell: object): number[];
//# sourceMappingURL=symmetry-metric.d.ts.map