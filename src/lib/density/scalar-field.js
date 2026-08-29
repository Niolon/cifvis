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
        if (payload.storageMode === 'symmetry-orbits') {
            const {
                cell: _cell,
                dimensions,
                representativeIndices,
                representativeValues,
                symmetryOperations,
                ...metadata
            } = payload;
            return new SymmetryReducedScalarFieldGrid(
                cell,
                dimensions,
                representativeIndices,
                representativeValues,
                symmetryOperations,
                metadata,
            );
        }
        const { cell: _cell, dimensions, values, ...metadata } = payload;
        return new ScalarFieldGrid(cell, dimensions, values, metadata);
    }

    /**
     * @param {number} ix - Fractional-grid x index.
     * @param {number} iy - Fractional-grid y index.
     * @param {number} iz - Fractional-grid z index.
     * @returns {number} One stored grid-node value.
     */
    valueAtIndex(ix, iy, iz) {
        const [nx, ny, nz] = this.dimensions;
        return this.values[(wrapIndex(iz, nz) * ny + wrapIndex(iy, ny)) * nx + wrapIndex(ix, nx)];
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
            return this.valueAtIndex(usedX, usedY, usedZ);
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
            return cubicInterpolate(
                x0 < 0 ? 0 : this.valueAtIndex(x0, usedY, usedZ),
                x1 < 0 ? 0 : this.valueAtIndex(x1, usedY, usedZ),
                x2 < 0 ? 0 : this.valueAtIndex(x2, usedY, usedZ),
                x3 < 0 ? 0 : this.valueAtIndex(x3, usedY, usedZ),
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

/**
 * @param {Uint32Array} values - Sorted canonical grid indices.
 * @param {number} target - Grid index to locate.
 * @returns {number} Sorted typed-array position, or -1 when absent.
 */
function binarySearch(values, target) {
    let lower = 0;
    let upper = values.length - 1;
    while (lower <= upper) {
        const middle = (lower + upper) >> 1;
        const value = values[middle];
        if (value === target) {
            return middle;
        }
        if (value < target) {
            lower = middle + 1;
        } else {
            upper = middle - 1;
        }
    }
    return -1;
}

/**
 * @param {number} index - Flattened full-grid node index.
 * @param {number[]} dimensions - X-fastest periodic grid dimensions.
 * @param {object[]} operations - Crystallographic rotation/translation operations.
 * @param {number} tolerance - Grid-index integrality tolerance.
 * @returns {number} Smallest exact grid index in the node's crystallographic orbit.
 */
function canonicalGridIndex(index, dimensions, operations, tolerance = 1e-6) {
    const [nx, ny] = dimensions;
    const indices = [index % nx, Math.floor(index / nx) % ny, Math.floor(index / (nx * ny))];
    let canonical = index;
    for (const operation of operations) {
        const transformed = [0, 1, 2].map(row => {
            const coordinate = operation.translation[row] + [0, 1, 2].reduce(
                (sum, column) => sum + operation.rotation[row][column] *
                    indices[column] / dimensions[column],
                0,
            );
            const gridCoordinate = coordinate * dimensions[row];
            if (Math.abs(gridCoordinate - Math.round(gridCoordinate)) > tolerance) {
                throw new Error('symmetry operation does not map the scalar grid onto itself');
            }
            return wrapIndex(Math.round(gridCoordinate), dimensions[row]);
        });
        canonical = Math.min(canonical, (transformed[2] * dimensions[1] + transformed[1]) *
            dimensions[0] + transformed[0]);
    }
    return canonical;
}

/**
 * Orbit-quotiented scalar grid used by the gated crystallographic FFT prototype.
 * It keeps only canonical node values while retaining periodic interpolation.
 */
export class SymmetryReducedScalarFieldGrid extends ScalarFieldGrid {
    constructor(
        cell,
        dimensions,
        representativeIndices,
        representativeValues,
        symmetryOperations,
        metadata = {},
    ) {
        super(cell, dimensions, representativeValues, metadata);
        delete this.values;
        this.representativeIndices = representativeIndices;
        this.representativeValues = representativeValues;
        this.symmetryOperations = symmetryOperations;
        this.storageMode = 'symmetry-orbits';
        Object.defineProperty(this, 'values', {
            configurable: true,
            enumerable: false,
            get: () => this.materializeValues(),
        });
    }

    /**
     * @param {number} ix - Fractional-grid x index.
     * @param {number} iy - Fractional-grid y index.
     * @param {number} iz - Fractional-grid z index.
     * @returns {number} Value found through its canonical crystallographic orbit.
     */
    valueAtIndex(ix, iy, iz) {
        const [nx, ny, nz] = this.dimensions;
        const index = (wrapIndex(iz, nz) * ny + wrapIndex(iy, ny)) * nx + wrapIndex(ix, nx);
        const canonical = canonicalGridIndex(
            index, this.dimensions, this.symmetryOperations,
        );
        const representative = binarySearch(this.representativeIndices, canonical);
        if (representative < 0) {
            throw new Error('Missing scalar-field symmetry representative');
        }
        return this.representativeValues[representative];
    }

    /** @returns {Float32Array} Materialized compatibility view of the full periodic grid. */
    materializeValues() {
        const size = this.dimensions.reduce((product, value) => product * value, 1);
        const values = new Float32Array(size);
        const [nx, ny] = this.dimensions;
        for (let index = 0; index < size; index++) {
            values[index] = this.valueAtIndex(
                index % nx,
                Math.floor(index / nx) % ny,
                Math.floor(index / (nx * ny)),
            );
        }
        return values;
    }

    /** @returns {object} Compact structured-clone-safe worker payload. */
    toPayload() {
        const {
            cell,
            dimensions,
            representativeIndices,
            representativeValues,
            symmetryOperations,
            ...metadata
        } = this;
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
            representativeIndices,
            representativeValues,
            symmetryOperations,
            ...metadata,
        };
    }
}

/**
 * Validates and quotients a full periodic map by exact crystallographic grid orbits.
 * @param {ScalarFieldGrid} field - Full periodic scalar map to quotient.
 * @param {number} tolerance - Relative orbit-invariance tolerance.
 * @returns {{field: SymmetryReducedScalarFieldGrid|null, fallbackReason: string|null}} Reduced
 * field or a diagnostic explaining why quotienting was unsafe.
 */
export function quotientScalarFieldBySymmetry(field, tolerance = 2e-5) {
    const operations = field.symmetryOperations ?? [];
    if (operations.length < 2) {
        return { field: null, fallbackReason: 'symmetry-reduction-requires-nontrivial-group' };
    }
    const size = field.dimensions.reduce((product, value) => product * value, 1);
    const indices = [];
    const values = [];
    let maximumResidual = 0;
    try {
        for (let index = 0; index < size; index++) {
            const canonical = canonicalGridIndex(index, field.dimensions, operations);
            if (canonical === index) {
                indices.push(index);
                values.push(field.values[index]);
            } else {
                maximumResidual = Math.max(
                    maximumResidual,
                    Math.abs(field.values[index] - field.values[canonical]),
                );
            }
        }
    } catch (error) {
        return { field: null, fallbackReason: error.message };
    }
    const scale = Math.max(Math.abs(field.minimum ?? 0), Math.abs(field.maximum ?? 0), 1);
    if (maximumResidual > tolerance * scale) {
        return { field: null, fallbackReason: 'symmetry-orbit-validation-failed' };
    }
    if (indices.length >= size) {
        return { field: null, fallbackReason: 'symmetry-storage-has-no-reduction' };
    }
    const { values: _fullValues, ...metadata } = field;
    return {
        field: new SymmetryReducedScalarFieldGrid(
            field.cell,
            field.dimensions,
            Uint32Array.from(indices),
            Float32Array.from(values),
            operations,
            {
                ...metadata,
                symmetryReducedStorage: true,
                symmetryRepresentativeCount: indices.length,
                symmetryOrbitResidual: maximumResidual,
                symmetryStorageBytes: indices.length * (
                    Uint32Array.BYTES_PER_ELEMENT + Float32Array.BYTES_PER_ELEMENT
                ),
            },
        ),
        fallbackReason: null,
    };
}
