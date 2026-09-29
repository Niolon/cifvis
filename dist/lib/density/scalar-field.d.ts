/**
 * Scalar samples on a crystallographic fractional grid. Scientific meaning,
 * source format, units, contour defaults, and symmetry metadata are carried as
 * independent metadata rather than encoded in the class name.
 */
export class ScalarFieldGrid {
    /**
     * @param {object} payload - Structured worker payload.
     * @returns {ScalarFieldGrid} Reconstructed scalar field.
     */
    static fromPayload(payload: object): ScalarFieldGrid;
    constructor(cell: any, dimensions: any, values: any, metadata?: {});
    cell: any;
    dimensions: any;
    values: any;
    /** @returns {object} Structured-clone-safe worker payload. */
    toPayload(): object;
    /**
     * @param {number} ix - Fractional-grid x index.
     * @param {number} iy - Fractional-grid y index.
     * @param {number} iz - Fractional-grid z index.
     * @returns {number} One stored grid-node value.
     */
    valueAtIndex(ix: number, iy: number, iz: number): number;
    /**
     * Trilinearly samples the field at crystallographic fractional coordinates.
     * Values are stored with x varying fastest, followed by y and z.
     * @param {number} x - Fractional x coordinate.
     * @param {number} y - Fractional y coordinate.
     * @param {number} z - Fractional z coordinate.
     * @returns {number} Interpolated scalar value.
     */
    sample(x: number, y: number, z: number): number;
    /**
     * Tricubically samples the field for smoother high-resolution planar
     * contours. Periodic maps wrap all neighbours; finite Cube grids use zero
     * outside their stored extent, consistently with {@link sample}.
     * @param {number} x - Fractional x coordinate.
     * @param {number} y - Fractional y coordinate.
     * @param {number} z - Fractional z coordinate.
     * @returns {number} Slope-limited monotone tricubic interpolation.
     */
    sampleCubic(x: number, y: number, z: number): number;
}
//# sourceMappingURL=scalar-field.d.ts.map