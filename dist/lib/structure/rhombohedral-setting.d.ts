/**
 * Whether a unit cell is given on rhombohedral rather than hexagonal axes.
 * @param {object} cell - Cell with a, b, c, alpha, beta, gamma.
 * @param {number} [lengthTolerance] - Permitted spread of the axis lengths, in Å.
 * @param {number} [angleTolerance] - Permitted spread of the angles, in degrees.
 * @returns {boolean} True for a = b = c with equal angles that are not 90 degrees.
 */
export function isRhombohedralCell(cell: object, lengthTolerance?: number, angleTolerance?: number): boolean;
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
export function toRhombohedralSetting(hexagonalOperations: string[]): string[];
//# sourceMappingURL=rhombohedral-setting.d.ts.map