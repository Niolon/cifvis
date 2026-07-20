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
 * Slope-limited monotone cubic interpolation through four consecutive samples.
 * @param {number} p0 - Sample before the interval.
 * @param {number} p1 - Sample at the interval start.
 * @param {number} p2 - Sample at the interval end.
 * @param {number} p3 - Sample after the interval.
 * @param {number} amount - Position within the interval.
 * @returns {number} Cubically interpolated value.
 */
function cubicInterpolate(p0, p1, p2, p3, amount) {
    const before = p1 - p0;
    const interval = p2 - p1;
    const after = p3 - p2;
    if (interval === 0) {
        return p1;
    }
    const startSlope = before * interval <= 0
        ? 0
        : 2 * before * interval / (before + interval);
    const endSlope = interval * after <= 0
        ? 0
        : 2 * interval * after / (interval + after);
    const squared = amount * amount;
    const cubed = squared * amount;
    return (2 * cubed - 3 * squared + 1) * p1 +
        (cubed - 2 * squared + amount) * startSlope +
        (-2 * cubed + 3 * squared) * p2 +
        (cubed - squared) * endSlope;
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

    /**
     * Tricubically samples the field for smoother high-resolution planar
     * contours. Periodic maps wrap all neighbours; finite Cube grids use zero
     * outside their stored extent, consistently with {@link sample}.
     * @param {number} x - Fractional x coordinate.
     * @param {number} y - Fractional y coordinate.
     * @param {number} z - Fractional z coordinate.
     * @returns {number} Slope-limited monotone tricubic interpolation.
     */
    sampleCubic(x, y, z) {
        const [nx, ny, nz] = this.dimensions;
        const origin = this.originFractional ?? [0, 0, 0];
        const scaledX = (x - origin[0]) * nx;
        const scaledY = (y - origin[1]) * ny;
        const scaledZ = (z - origin[2]) * nz;
        const periodic = this.boundaryMode !== 'zero';
        if (!periodic && (
            scaledX < 0 || scaledX > nx - 1 ||
            scaledY < 0 || scaledY > ny - 1 ||
            scaledZ < 0 || scaledZ > nz - 1
        )) {
            return 0;
        }
        const lowerX = periodic ? Math.floor(scaledX) : Math.min(Math.floor(scaledX), nx - 1);
        const lowerY = periodic ? Math.floor(scaledY) : Math.min(Math.floor(scaledY), ny - 1);
        const lowerZ = periodic ? Math.floor(scaledZ) : Math.min(Math.floor(scaledZ), nz - 1);
        const fractionX = lowerX === nx - 1 && !periodic ? 0 : scaledX - lowerX;
        const fractionY = lowerY === ny - 1 && !periodic ? 0 : scaledY - lowerY;
        const fractionZ = lowerZ === nz - 1 && !periodic ? 0 : scaledZ - lowerZ;
        const usedIndex = (value, size) => {
            if (periodic) {
                return wrapIndex(value, size);
            }
            return value < 0 || value >= size ? -1 : value;
        };
        const x0 = usedIndex(lowerX - 1, nx);
        const x1 = usedIndex(lowerX, nx);
        const x2 = usedIndex(lowerX + 1, nx);
        const x3 = usedIndex(lowerX + 2, nx);
        const y0 = usedIndex(lowerY - 1, ny);
        const y1 = usedIndex(lowerY, ny);
        const y2 = usedIndex(lowerY + 1, ny);
        const y3 = usedIndex(lowerY + 2, ny);
        const z0 = usedIndex(lowerZ - 1, nz);
        const z1 = usedIndex(lowerZ, nz);
        const z2 = usedIndex(lowerZ + 1, nz);
        const z3 = usedIndex(lowerZ + 2, nz);
        const interpolateX = (usedY, usedZ) => {
            if (usedY < 0 || usedZ < 0) {
                return 0;
            }
            const rowStart = (usedZ * ny + usedY) * nx;
            return cubicInterpolate(
                x0 < 0 ? 0 : this.values[rowStart + x0],
                x1 < 0 ? 0 : this.values[rowStart + x1],
                x2 < 0 ? 0 : this.values[rowStart + x2],
                x3 < 0 ? 0 : this.values[rowStart + x3],
                fractionX,
            );
        };
        const interpolateY = usedZ => cubicInterpolate(
            interpolateX(y0, usedZ),
            interpolateX(y1, usedZ),
            interpolateX(y2, usedZ),
            interpolateX(y3, usedZ),
            fractionY,
        );
        return cubicInterpolate(
            interpolateY(z0),
            interpolateY(z1),
            interpolateY(z2),
            interpolateY(z3),
            fractionZ,
        );
    }
}
