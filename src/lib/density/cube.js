/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- private parsing helpers */
import { UnitCell } from '../structure/crystal.js';
import * as math from '../math-lite.js';

export const BOHR_TO_ANGSTROM = 0.529177210903;

const CUBE_PROPERTIES = new Set([
    'density',
    'signed-density',
    'orbital',
    'potential',
    'generic',
]);

/** @returns {number} Dot product of two three-vectors. */
function dot(first, second) {
    return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

/** @returns {number} Euclidean length of a three-vector. */
function length(vector) {
    return Math.hypot(...vector);
}

/** @returns {number} Angle between vectors in degrees. */
function angle(first, second) {
    const cosine = Math.max(-1, Math.min(1, dot(first, second) / (length(first) * length(second))));
    return Math.acos(cosine) * 180 / Math.PI;
}

/** @returns {number[]} Plain array for math-lite results. */
function plainArray(value) {
    return Array.isArray(value) ? value : value.toArray();
}

/** @returns {number} Periodic array index. */
function wrapIndex(value, size) {
    return ((value % size) + size) % size;
}

/** Parses one fixed-header Cube line and validates its numeric fields. */
function numericLine(line, minimumValues, label) {
    const values = line.trim().split(/\s+/).map(Number);
    if (values.length < minimumValues || values.some(value => !Number.isFinite(value))) {
        throw new Error(`Invalid Gaussian Cube ${label} line`);
    }
    return values;
}

/** @returns {object} Presentation metadata for one Cube property kind. */
function propertyMetadata(property, coordinateUnit, options) {
    if (!CUBE_PROPERTIES.has(property)) {
        throw new Error(
            `Cube property must be one of: ${Array.from(CUBE_PROPERTIES).join(', ')}`,
        );
    }
    const densityProperty = property === 'density' || property === 'signed-density';
    let valueScale = options.valueScale;
    if (valueScale === undefined) {
        valueScale = densityProperty && coordinateUnit === 'bohr'
            ? 1 / BOHR_TO_ANGSTROM ** 3
            : 1;
    }
    if (!(Number.isFinite(valueScale) && valueScale !== 0)) {
        throw new Error('Cube valueScale must be a finite non-zero number');
    }

    if (property === 'density') {
        return {
            valueScale,
            valueUnit: 'e/angstrom^3',
            displayLabel: 'ρ/eÅ⁻³',
            quantityName: 'electron density',
            surfaceSign: 'positive',
            defaultLevel: options.level ?? 0.3,
        };
    }
    if (property === 'signed-density') {
        return {
            valueScale,
            valueUnit: 'e/angstrom^3',
            displayLabel: 'Δρ/eÅ⁻³',
            quantityName: 'signed density',
            surfaceSign: 'both',
            defaultLevel: options.level ?? 0.05,
        };
    }
    const names = {
        orbital: ['ψ', 'orbital'],
        potential: ['V', 'potential'],
        generic: ['Cube', 'Cube field'],
    };
    return {
        valueScale,
        valueUnit: options.valueUnit ?? 'cube',
        displayLabel: options.displayLabel ?? names[property][0],
        quantityName: options.quantityName ?? names[property][1],
        surfaceSign: options.sign ?? 'both',
        defaultLevel: options.level ?? null,
    };
}

/** Calculates scalar-field statistics in one pass. */
function fieldStatistics(values) {
    let sum = 0;
    let sumSquared = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const value of values) {
        sum += value;
        sumSquared += value * value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }
    const mean = sum / values.length;
    return {
        mean,
        sigma: Math.sqrt(Math.max(0, sumSquared / values.length - mean * mean)),
        minimum,
        maximum,
    };
}

/**
 * Periodic scalar values read from a Gaussian Cube grid whose three voxel axes
 * span one crystallographic cell.
 */
export class CubeDensityMap {
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
            mapType: 'cube',
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

    /** @returns {CubeDensityMap} Map reconstructed from a worker payload. */
    static fromPayload(payload) {
        const cell = new UnitCell(
            payload.cell.a,
            payload.cell.b,
            payload.cell.c,
            payload.cell.alpha,
            payload.cell.beta,
            payload.cell.gamma,
        );
        const { mapType: _mapType, cell: _cell, dimensions, values, ...metadata } = payload;
        return new CubeDensityMap(cell, dimensions, values, metadata);
    }

    /**
     * Trilinearly samples the Cube at crystallographic fractional coordinates.
     * @param {number} x - Fractional coordinate along the Cube x lattice vector.
     * @param {number} y - Fractional coordinate along the Cube y lattice vector.
     * @param {number} z - Fractional coordinate along the Cube z lattice vector.
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
        if (!this.periodic && scaled.some((value, axis) =>
            value < 0 || value > this.dimensions[axis] - 1,
        )) {
            return 0;
        }
        const lower = scaled.map(value => Math.floor(value));
        const fraction = scaled.map((value, axis) => {
            if (!this.periodic && lower[axis] >= this.dimensions[axis] - 1) {
                lower[axis] = this.dimensions[axis] - 1;
                return 0;
            }
            return value - lower[axis];
        });
        const index = (ix, iy, iz) => {
            const usedX = this.periodic ? wrapIndex(ix, nx) : Math.min(nx - 1, ix);
            const usedY = this.periodic ? wrapIndex(iy, ny) : Math.min(ny - 1, iy);
            const usedZ = this.periodic ? wrapIndex(iz, nz) : Math.min(nz - 1, iz);
            // Cube text stores z fastest, then y, then x.
            return (usedX * ny + usedY) * nz + usedZ;
        };
        const valueAt = (ix, iy, iz) => this.values[index(ix, iy, iz)];
        const lerp = (first, second, fractionValue) =>
            first + (second - first) * fractionValue;
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

/**
 * Parses a Gaussian Cube scalar grid. Coordinates are normalized to Å; density
 * properties are additionally normalized from e/bohr³ to e/Å³.
 * @param {string} cubeText - Complete Cube file contents.
 * @param {object} [options] - Property, dataset, scaling, and periodicity options.
 * @returns {CubeDensityMap} Parsed grid and metadata.
 */
export function parseCube(cubeText, options = {}) {
    if (typeof cubeText !== 'string' || cubeText.trim().length === 0) {
        throw new Error('Cannot parse an empty Gaussian Cube file');
    }
    const lines = cubeText.replace(/\r\n?/g, '\n').split('\n');
    if (lines.length < 6) {
        throw new Error('Gaussian Cube file is missing its header');
    }
    const comments = [lines[0], lines[1]];
    const atomOrigin = numericLine(lines[2], 4, 'atom/origin');
    const signedAtomCount = Math.trunc(atomOrigin[0]);
    const atomCount = Math.abs(signedAtomCount);
    const rawOrigin = atomOrigin.slice(1, 4);
    const headerDatasetCount = atomOrigin.length >= 5 ? Math.trunc(atomOrigin[4]) : 1;
    if (headerDatasetCount < 1) {
        throw new Error('Gaussian Cube dataset count must be positive');
    }

    const rawAxes = [];
    const signedDimensions = [];
    for (let axis = 0; axis < 3; axis++) {
        const values = numericLine(lines[3 + axis], 4, `axis ${axis + 1}`);
        signedDimensions.push(Math.trunc(values[0]));
        rawAxes.push(values.slice(1, 4));
    }
    if (signedDimensions.some(value => value === 0)) {
        throw new Error('Gaussian Cube grid dimensions must be non-zero');
    }
    const allBohr = signedDimensions.every(value => value > 0);
    const allAngstrom = signedDimensions.every(value => value < 0);
    if (!allBohr && !allAngstrom) {
        throw new Error('Gaussian Cube grid dimensions must use one consistent unit sign');
    }
    const coordinateUnit = allBohr ? 'bohr' : 'angstrom';
    const coordinateScale = allBohr ? BOHR_TO_ANGSTROM : 1;
    const dimensions = signedDimensions.map(Math.abs);
    const origin = rawOrigin.map(value => value * coordinateScale);
    const axisVectors = rawAxes.map(vector => vector.map(value => value * coordinateScale));

    const atoms = [];
    const atomLinesStart = 6;
    if (lines.length < atomLinesStart + atomCount) {
        throw new Error('Gaussian Cube file ends inside its atom list');
    }
    for (let index = 0; index < atomCount; index++) {
        const values = numericLine(lines[atomLinesStart + index], 5, `atom ${index + 1}`);
        atoms.push({
            atomicNumber: Math.trunc(values[0]),
            charge: values[1],
            position: values.slice(2, 5).map(value => value * coordinateScale),
        });
    }

    const tokens = lines.slice(atomLinesStart + atomCount)
        .join(' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    let tokenIndex = 0;
    let datasetCount = headerDatasetCount;
    let datasetIds = Array.from({ length: datasetCount }, (_, index) => index + 1);
    if (signedAtomCount < 0) {
        datasetCount = Number(tokens[tokenIndex++]);
        if (!(Number.isInteger(datasetCount) && datasetCount > 0)) {
            throw new Error('Gaussian Cube orbital dataset count is invalid');
        }
        datasetIds = tokens.slice(tokenIndex, tokenIndex + datasetCount).map(Number);
        if (datasetIds.length !== datasetCount || datasetIds.some(value => !Number.isFinite(value))) {
            throw new Error('Gaussian Cube orbital identifiers are incomplete');
        }
        tokenIndex += datasetCount;
    }
    const datasetIndex = options.datasetIndex ?? 0;
    if (!(Number.isInteger(datasetIndex) && datasetIndex >= 0 && datasetIndex < datasetCount)) {
        throw new Error(`Cube datasetIndex must be between 0 and ${datasetCount - 1}`);
    }
    const pointCount = dimensions[0] * dimensions[1] * dimensions[2];
    const expectedValueCount = pointCount * datasetCount;
    if (tokens.length - tokenIndex !== expectedValueCount) {
        throw new Error(
            `Gaussian Cube grid contains ${tokens.length - tokenIndex} values; ` +
            `expected ${expectedValueCount}`,
        );
    }

    const property = options.property ?? 'density';
    const presentation = propertyMetadata(property, coordinateUnit, options);
    const values = new Float32Array(pointCount);
    for (let point = 0; point < pointCount; point++) {
        const value = Number(tokens[tokenIndex + point * datasetCount + datasetIndex]);
        if (!Number.isFinite(value)) {
            throw new Error(`Gaussian Cube grid value ${point + 1} is not finite`);
        }
        values[point] = value * presentation.valueScale;
    }

    const latticeVectors = axisVectors.map((vector, axis) =>
        vector.map(value => value * dimensions[axis]),
    );
    if (latticeVectors.some(vector => length(vector) === 0)) {
        throw new Error('Gaussian Cube lattice vectors must be non-zero');
    }
    const cell = new UnitCell(
        length(latticeVectors[0]),
        length(latticeVectors[1]),
        length(latticeVectors[2]),
        angle(latticeVectors[1], latticeVectors[2]),
        angle(latticeVectors[0], latticeVectors[2]),
        angle(latticeVectors[0], latticeVectors[1]),
    );
    const latticeMatrix = [
        [latticeVectors[0][0], latticeVectors[1][0], latticeVectors[2][0]],
        [latticeVectors[0][1], latticeVectors[1][1], latticeVectors[2][1]],
        [latticeVectors[0][2], latticeVectors[1][2], latticeVectors[2][2]],
    ];
    const originFractional = plainArray(math.multiply(math.inv(latticeMatrix), origin));
    const statistics = fieldStatistics(values);
    const defaultLevel = presentation.defaultLevel ?? 3 * statistics.sigma;

    return new CubeDensityMap(cell, dimensions, values, {
        ...statistics,
        comments,
        atoms,
        origin,
        originFractional,
        axisVectors,
        latticeVectors,
        coordinateUnit,
        datasetCount,
        datasetIds,
        datasetIndex,
        datasetId: datasetIds[datasetIndex],
        property,
        valueScale: presentation.valueScale,
        valueUnit: presentation.valueUnit,
        displayLabel: presentation.displayLabel,
        quantityName: presentation.quantityName,
        surfaceSign: presentation.surfaceSign,
        defaultLevel,
        periodic: options.periodic ?? true,
        densitySource: 'cube',
        densityKind: property === 'signed-density' ? 'deformation' : 'cube',
        resolutionFraction: 1,
        gridOversampling: 1,
    });
}
