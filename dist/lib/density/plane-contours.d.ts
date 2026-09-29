/**
 * Resolves a best-fit, atom-defined, or explicit contour plane.
 * @param {object} structure - Displayed crystal structure.
 * @param {object|string|string[]} [definition] - Public plane definition.
 * @param {number} [padding] - Bounds padding around displayed atoms in Å.
 * @returns {object} Cartesian plane origin/basis and projected bounds.
 */
export function resolveContourPlane(structure: object, definition?: object | string | string[], padding?: number): object;
/**
 * Samples a scalar grid on a plane and extracts line-only marching-squares contours.
 * @param {object} field - Sampled scalar field.
 * @param {object} structure - Displayed crystal structure.
 * @param {object} [options] - Plane, resolution, levels, and display options.
 * @returns {object} Plane definition, levels, sampled dimensions, and Cartesian segments.
 */
export function calculatePlanarContours(field: object, structure: object, options?: object): object;
/**
 * Packs nested contour endpoints into transferable typed arrays.
 * @param {object} contours - Output from {@link calculatePlanarContours}.
 * @returns {object} Equivalent contour result with packed signed positions.
 */
export function packPlanarContours(contours: object): object;
//# sourceMappingURL=plane-contours.d.ts.map