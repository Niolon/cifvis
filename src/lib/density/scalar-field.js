import { UnitCell } from '../structure/crystal.js';

/**
 * @param {number} value - Unbounded index.
 * @param {number} size - Period length.
 * @returns {number} Index wrapped into a periodic array.
 */
function wrapIndex(value, size) {
    return ((value % size) + size) % size;
}

/**
 * Scalar samples on a crystallographic fractional grid. Scientific meaning,
 * source format, units, contour defaults, and symmetry metadata are carried as
 * independent metadata rather than encoded in the class name.
 */
export class ScalarFieldGrid {
    constructor(cell, dimensions, values, metadata = {}) {
        this.cell = cell;
        this.dimensions = dimensions;
        this.values = values;
        Object.assign(this, metadata);
    }

    /** @returns {object} Structured-clone-safe worker payload. */
    toPayload() {
        const { cell, dimensions, values, ...metadata } = this;
        return {
            cell: {
                a: cell.a,
                b: cell.b,
                c: cell.c,
                alpha: cell.alpha,
                beta: cell.beta,
                gamma: cell.gamma,
            },
            dimensions,
            values,
            ...metadata,
        };
    }

    /**
     * @param {object} payload - Structured worker payload.
     * @returns {ScalarFieldGrid} Reconstructed scalar field.
     */
    static fromPayload(payload) {
        const cell = new UnitCell(
            payload.cell.a,
            payload.cell.b,
            payload.cell.c,
            payload.cell.alpha,
            payload.cell.beta,
            payload.cell.gamma,
        );
        const { cell: _cell, dimensions, values, ...metadata } = payload;
        return new ScalarFieldGrid(cell, dimensions, values, metadata);
    }

    /**
     * Trilinearly samples the field at crystallographic fractional coordinates.
     * Values are stored with x varying fastest, followed by y and z.
     * @param {number} x - Fractional x coordinate.
     * @param {number} y - Fractional y coordinate.
     * @param {number} z - Fractional z coordinate.
     * @returns {number} Interpolated scalar value.
     */
    sample(x, y, z) {
        const [nx, ny, nz] = this.dimensions;
        const origin = this.originFractional ?? [0, 0, 0];
        const scaled = [
            (x - origin[0]) * nx,
            (y - origin[1]) * ny,
            (z - origin[2]) * nz,
        ];
        const periodic = this.boundaryMode !== 'zero';
        if (!periodic && scaled.some((value, axis) =>
            value < 0 || value > this.dimensions[axis] - 1,
        )) {
            return 0;
        }
        const lower = scaled.map(Math.floor);
        const fraction = scaled.map((value, axis) => {
            if (!periodic && lower[axis] >= this.dimensions[axis] - 1) {
                lower[axis] = this.dimensions[axis] - 1;
                return 0;
            }
            return value - lower[axis];
        });
        const valueAt = (ix, iy, iz) => {
            const usedX = periodic ? wrapIndex(ix, nx) : Math.min(nx - 1, ix);
            const usedY = periodic ? wrapIndex(iy, ny) : Math.min(ny - 1, iy);
            const usedZ = periodic ? wrapIndex(iz, nz) : Math.min(nz - 1, iz);
            return this.values[(usedZ * ny + usedY) * nx + usedX];
        };
        const lerp = (first, second, amount) => first + (second - first) * amount;
        const x00 = lerp(valueAt(lower[0], lower[1], lower[2]),
            valueAt(lower[0] + 1, lower[1], lower[2]), fraction[0]);
        const x10 = lerp(valueAt(lower[0], lower[1] + 1, lower[2]),
            valueAt(lower[0] + 1, lower[1] + 1, lower[2]), fraction[0]);
        const x01 = lerp(valueAt(lower[0], lower[1], lower[2] + 1),
            valueAt(lower[0] + 1, lower[1], lower[2] + 1), fraction[0]);
        const x11 = lerp(valueAt(lower[0], lower[1] + 1, lower[2] + 1),
            valueAt(lower[0] + 1, lower[1] + 1, lower[2] + 1), fraction[0]);
        return lerp(
            lerp(x00, x10, fraction[1]),
            lerp(x01, x11, fraction[1]),
            fraction[2],
        );
    }
}
