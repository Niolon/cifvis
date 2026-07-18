/* eslint-disable jsdoc/require-param -- compact private vector helpers */
import * as math from '../math-lite.js';
import { DEFAULT_CONTOUR_LINE_OPTIONS } from './contour-line-options.js';

/** @returns {number} Monotonic high-resolution time where available. */
function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

/** @returns {number} Three-vector dot product. */
function dot(first, second) {
    return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

/** @returns {number[]} Three-vector cross product. */
function cross(first, second) {
    return [
        first[1] * second[2] - first[2] * second[1],
        first[2] * second[0] - first[0] * second[2],
        first[0] * second[1] - first[1] * second[0],
    ];
}

/** @returns {number[]} Unit three-vector. */
function normalize(vector, label) {
    const magnitude = Math.hypot(...vector);
    if (!(Number.isFinite(magnitude) && magnitude > 1e-12)) {
        throw new Error(`${label} must be a finite non-zero vector`);
    }
    return vector.map(value => value / magnitude);
}

/** @returns {number[]} Vector sum. */
function add(first, second) {
    return first.map((value, index) => value + second[index]);
}

/** @returns {number[]} Vector difference. */
function subtract(first, second) {
    return first.map((value, index) => value - second[index]);
}

/** @returns {number[]} Scaled vector. */
function scale(vector, factor) {
    return vector.map(value => value * factor);
}

/** @returns {number[]} Plain array for math-lite results. */
function plainArray(value) {
    return Array.isArray(value) ? value : value.toArray();
}

/** @returns {number[]} Cartesian coordinates for one fractional position. */
function fractionalToCartesian(matrix, position) {
    return plainArray(math.multiply(matrix, position));
}

/** @returns {number[]} Centroid of Cartesian points. */
function centroid(points) {
    return scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
}

/** @returns {number[]} Best-fit plane normal from a Cartesian point cloud. */
function bestFitNormal(points, centre) {
    if (points.length < 3) {
        throw new Error('A best-fit contour plane requires at least three atoms');
    }
    const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const point of points) {
        const delta = subtract(point, centre);
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 3; column++) {
                covariance[row][column] += delta[row] * delta[column];
            }
        }
    }
    const eigensystem = math.eigs(covariance);
    const eigenvalues = eigensystem.values.map(Number).sort((first, second) => first - second);
    const scaleValue = Math.max(1, eigenvalues[2]);
    if (!(eigenvalues[1] > scaleValue * 1e-12)) {
        throw new Error('Contour plane atoms must not all be collinear');
    }
    const minimum = eigenvalues[0];
    const match = eigensystem.eigenvectors.find(entry =>
        Math.abs(Number(entry.value) - minimum) <= scaleValue * 1e-12);
    return normalize(plainArray(match.vector), 'Best-fit plane normal');
}

/** @returns {number[]} Stable plane normal for a one- or two-atom structure. */
function sparseStructureNormal(points, fractionalToCartesianMatrix) {
    if (points.length === 1) {
        return normalize(plainArray(math.multiply(
            math.transpose(math.inv(fractionalToCartesianMatrix)),
            [0, 0, 1],
        )), 'Sparse-structure contour plane normal');
    }
    const direction = normalize(subtract(points[1], points[0]), 'Sparse atom separation');
    const references = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const reference = references.reduce((best, candidate) =>
        Math.abs(dot(direction, candidate)) < Math.abs(dot(direction, best))
            ? candidate
            : best);
    return normalize(cross(direction, reference), 'Sparse-structure contour plane normal');
}

/** @returns {{u:number[], v:number[]}} Stable orthonormal in-plane basis. */
function planeBasis(normal) {
    const reference = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    const u = normalize(cross(reference, normal), 'Contour plane basis');
    return { u, v: normalize(cross(normal, u), 'Contour plane basis') };
}

/** @returns {number[][]} Cartesian coordinates of displayed atoms. */
function structureAtomCoordinates(structure) {
    const matrix = structure.cell.fractToCartMatrix.toArray();
    return structure.atoms.map(atom => fractionalToCartesian(matrix, [
        atom.position.x,
        atom.position.y,
        atom.position.z,
    ]));
}

/**
 * Resolves a best-fit, atom-defined, or explicit contour plane.
 * @param {object} structure - Displayed crystal structure.
 * @param {object|string|string[]} [definition] - Public plane definition.
 * @param {number} [padding] - Bounds padding around displayed atoms in Å.
 * @returns {object} Cartesian plane origin/basis and projected bounds.
 */
export function resolveContourPlane(structure, definition = { mode: 'best-fit' }, padding = 1.5) {
    if (!structure?.atoms?.length) {
        throw new Error('A contour plane requires a displayed structure');
    }
    const usedDefinition = typeof definition === 'string'
        ? { mode: definition }
        : Array.isArray(definition)
            ? { atoms: definition }
            : definition ?? { mode: 'best-fit' };
    if (usedDefinition.mode !== undefined && usedDefinition.mode !== 'best-fit') {
        throw new Error('Contour plane mode must be "best-fit"');
    }
    const fractionalToCartesianMatrix = structure.cell.fractToCartMatrix.toArray();
    const allCoordinates = structureAtomCoordinates(structure);
    let definingCoordinates = allCoordinates;
    if (usedDefinition.atoms) {
        if (!Array.isArray(usedDefinition.atoms) || usedDefinition.atoms.length < 3) {
            throw new Error('A contour plane atom definition requires at least three labels');
        }
        definingCoordinates = usedDefinition.atoms.map(label => {
            const index = structure.atoms.findIndex(atom => atom.label === label);
            if (index === -1) {
                throw new Error(`Contour plane atom not found: ${label}`);
            }
            return allCoordinates[index];
        });
    }

    let origin;
    let normal;
    if (usedDefinition.origin || usedDefinition.normal) {
        if (!Array.isArray(usedDefinition.origin) || usedDefinition.origin.length !== 3 ||
            !Array.isArray(usedDefinition.normal) || usedDefinition.normal.length !== 3) {
            throw new Error('An explicit contour plane requires three-value origin and normal arrays');
        }
        const suppliedOrigin = usedDefinition.origin.map(Number);
        const suppliedNormal = usedDefinition.normal.map(Number);
        if (!suppliedOrigin.every(Number.isFinite) || !suppliedNormal.every(Number.isFinite)) {
            throw new Error('Contour plane origin and normal must contain finite numbers');
        }
        if (usedDefinition.coordinateSystem !== undefined &&
            !['cartesian', 'fractional'].includes(usedDefinition.coordinateSystem)) {
            throw new Error('Contour plane coordinateSystem must be "cartesian" or "fractional"');
        }
        if (usedDefinition.coordinateSystem === 'fractional') {
            const matrix = structure.cell.fractToCartMatrix.toArray();
            origin = fractionalToCartesian(matrix, suppliedOrigin);
            normal = plainArray(math.multiply(
                math.transpose(math.inv(matrix)),
                suppliedNormal,
            ));
        } else {
            origin = suppliedOrigin;
            normal = suppliedNormal;
        }
        normal = normalize(normal, 'Contour plane normal');
    } else {
        origin = centroid(definingCoordinates);
        normal = definingCoordinates.length >= 3
            ? bestFitNormal(definingCoordinates, origin)
            : sparseStructureNormal(definingCoordinates, fractionalToCartesianMatrix);
    }
    const { u, v } = planeBasis(normal);
    let minimumU = Infinity;
    let maximumU = -Infinity;
    let minimumV = Infinity;
    let maximumV = -Infinity;
    for (const point of allCoordinates) {
        const delta = subtract(point, origin);
        const projectedU = dot(delta, u);
        const projectedV = dot(delta, v);
        minimumU = Math.min(minimumU, projectedU);
        maximumU = Math.max(maximumU, projectedU);
        minimumV = Math.min(minimumV, projectedV);
        maximumV = Math.max(maximumV, projectedV);
    }
    const usedPadding = Number(padding);
    if (!(Number.isFinite(usedPadding) && usedPadding >= 0)) {
        throw new Error('Contour plane padding must be a non-negative number');
    }
    const bounds = usedDefinition.bounds ?? {
        u: [minimumU - usedPadding, maximumU + usedPadding],
        v: [minimumV - usedPadding, maximumV + usedPadding],
    };
    if (!Array.isArray(bounds.u) || !Array.isArray(bounds.v) ||
        bounds.u.length !== 2 || bounds.v.length !== 2 ||
        !bounds.u.concat(bounds.v).every(Number.isFinite) ||
        bounds.u[1] <= bounds.u[0] || bounds.v[1] <= bounds.v[0]) {
        throw new Error('Contour plane bounds must contain increasing u and v pairs');
    }
    return { origin, normal, u, v, bounds };
}

/** @returns {number[]} Cartesian point on a resolved plane. */
function pointOnPlane(plane, coordinateU, coordinateV, normalOffset = 0) {
    return add(
        add(plane.origin, scale(plane.u, coordinateU)),
        add(scale(plane.v, coordinateV), scale(plane.normal, normalOffset)),
    );
}

/** @returns {number[]} Interpolated 2D edge crossing. */
function edgeIntersection(first, second, firstValue, secondValue, level) {
    const fraction = firstValue === secondValue ? 0.5 :
        Math.max(0, Math.min(1, (level - firstValue) / (secondValue - firstValue)));
    return [
        first[0] + (second[0] - first[0]) * fraction,
        first[1] + (second[1] - first[1]) * fraction,
    ];
}

/** @returns {number[][][]} Marching-squares segments for multiple levels. */
function contourSegments(values, dimensions, plane, levels, normalOffset) {
    const [countU, countV] = dimensions;
    const stepU = (plane.bounds.u[1] - plane.bounds.u[0]) / (countU - 1);
    const stepV = (plane.bounds.v[1] - plane.bounds.v[0]) / (countV - 1);
    const segments = [];
    for (let row = 0; row < countV - 1; row++) {
        for (let column = 0; column < countU - 1; column++) {
            const minimumU = plane.bounds.u[0] + column * stepU;
            const maximumU = minimumU + stepU;
            const minimumV = plane.bounds.v[0] + row * stepV;
            const maximumV = minimumV + stepV;
            const coordinates = [
                [minimumU, minimumV],
                [maximumU, minimumV],
                [maximumU, maximumV],
                [minimumU, maximumV],
            ];
            const lowerIndex = row * countU + column;
            const upperIndex = lowerIndex + countU;
            const corners = [
                values[lowerIndex],
                values[lowerIndex + 1],
                values[upperIndex + 1],
                values[upperIndex],
            ];
            const minimum = Math.min(...corners);
            const maximum = Math.max(...corners);
            for (const level of levels) {
                if (!(minimum < level && maximum >= level)) {
                    continue;
                }
                const edgeCorners = [[0, 1], [1, 2], [2, 3], [3, 0]];
                const crossings = [];
                for (let edge = 0; edge < edgeCorners.length; edge++) {
                    const [first, second] = edgeCorners[edge];
                    if ((corners[first] < level && corners[second] >= level) ||
                        (corners[second] < level && corners[first] >= level)) {
                        crossings.push({
                            edge,
                            point: edgeIntersection(
                                coordinates[first],
                                coordinates[second],
                                corners[first],
                                corners[second],
                                level,
                            ),
                        });
                    }
                }
                let pairs = [];
                if (crossings.length === 2) {
                    pairs = [[crossings[0], crossings[1]]];
                } else if (crossings.length === 4) {
                    const centreValue = corners.reduce((sum, value) => sum + value, 0) / 4;
                    pairs = centreValue >= level
                        ? [[crossings[0], crossings[1]], [crossings[2], crossings[3]]]
                        : [[crossings[0], crossings[3]], [crossings[1], crossings[2]]];
                }
                for (const [first, second] of pairs) {
                    segments.push([
                        pointOnPlane(plane, first.point[0], first.point[1], normalOffset),
                        pointOnPlane(plane, second.point[0], second.point[1], normalOffset),
                    ]);
                }
            }
        }
    }
    return segments;
}

/** @returns {number[]} Positive contour magnitudes. */
function contourLevels(field, options) {
    if (Array.isArray(options.levels)) {
        const levels = [...new Set(options.levels.map(value => Math.abs(Number(value))))]
            .filter(value => Number.isFinite(value) && value > 0)
            .sort((first, second) => first - second);
        if (levels.length === 0) {
            throw new Error('Contour line levels must contain positive finite values');
        }
        return levels;
    }
    const referenceLevel = options.level ?? field.defaultLevel ??
        (options.sigmaLevel ?? 3) * field.sigma;
    const subdivisions = Number(options.levelSubdivisions);
    if (!(Number.isFinite(subdivisions) && subdivisions >= 1)) {
        throw new Error('Contour line levelSubdivisions must be at least one');
    }
    const step = options.contourStep ?? referenceLevel / subdivisions;
    const count = Math.max(1, Math.round(Number(options.contourCount)));
    if (!(Number.isFinite(step) && step > 0)) {
        throw new Error('Contour line step must be a positive finite number');
    }
    if (!Number.isFinite(count)) {
        throw new Error('Contour line count must be a positive integer');
    }
    return Array.from({ length: count }, (_, index) => step * (index + 1));
}

/**
 * Samples a scalar grid on a plane and extracts line-only marching-squares contours.
 * @param {import('./scalar-field.js').ScalarFieldGrid} field - Sampled scalar field.
 * @param {object} structure - Displayed crystal structure.
 * @param {object} [options] - Plane, resolution, levels, and display options.
 * @returns {object} Plane definition, levels, sampled dimensions, and Cartesian segments.
 */
export function calculatePlanarContours(field, structure, options = {}) {
    const started = now();
    const usedOptions = { ...DEFAULT_CONTOUR_LINE_OPTIONS, ...options };
    const plane = resolveContourPlane(structure, usedOptions.plane, usedOptions.padding);
    const spanU = plane.bounds.u[1] - plane.bounds.u[0];
    const spanV = plane.bounds.v[1] - plane.bounds.v[0];
    const minimumResolution = Math.max(8, Math.round(Number(usedOptions.resolution)));
    const maximumResolution = Math.max(
        minimumResolution,
        Math.round(Number(usedOptions.maxResolution)),
    );
    const spacing = Number(usedOptions.gridSpacing);
    if (!(Number.isFinite(spacing) && spacing > 0)) {
        throw new Error('Contour line grid spacing must be a positive number');
    }
    if (!(Number.isFinite(minimumResolution) && Number.isFinite(maximumResolution))) {
        throw new Error('Contour line resolutions must be finite numbers');
    }
    const dimensions = [spanU, spanV].map(span => Math.min(
        maximumResolution,
        Math.max(minimumResolution, Math.ceil(span / spacing) + 1),
    ));
    const values = new Float32Array(dimensions[0] * dimensions[1]);
    const cartesianToFractional = math.inv(structure.cell.fractToCartMatrix);
    const fractionalOrigin = plainArray(math.multiply(cartesianToFractional, plane.origin));
    const fractionalU = plainArray(math.multiply(cartesianToFractional, plane.u));
    const fractionalV = plainArray(math.multiply(cartesianToFractional, plane.v));
    const interpolation = usedOptions.interpolation;
    if (!['linear', 'tricubic'].includes(interpolation)) {
        throw new Error('Contour line interpolation must be "linear" or "tricubic"');
    }
    const sample = interpolation === 'tricubic' && typeof field.sampleCubic === 'function'
        ? (...fractional) => field.sampleCubic(...fractional)
        : (...fractional) => field.sample(...fractional);
    const samplingStarted = now();
    for (let row = 0; row < dimensions[1]; row++) {
        const coordinateV = plane.bounds.v[0] +
            row / (dimensions[1] - 1) * spanV;
        for (let column = 0; column < dimensions[0]; column++) {
            const coordinateU = plane.bounds.u[0] +
                column / (dimensions[0] - 1) * spanU;
            const fractional = fractionalOrigin.map((value, axis) =>
                value + fractionalU[axis] * coordinateU + fractionalV[axis] * coordinateV);
            values[row * dimensions[0] + column] = sample(...fractional);
        }
    }
    const contouringStarted = now();
    const levels = contourLevels(field, usedOptions);
    const sign = usedOptions.sign ?? field.surfaceSign ?? 'both';
    if (!['positive', 'negative', 'both'].includes(sign)) {
        throw new Error('Contour line sign must be "positive", "negative", or "both"');
    }
    const offset = Number(usedOptions.depthOffset);
    if (!Number.isFinite(offset)) {
        throw new Error('Contour line depth offset must be a finite number');
    }
    const positiveSegments = sign === 'negative'
        ? []
        : contourSegments(values, dimensions, plane, levels, offset);
    const negativeSegments = sign === 'positive'
        ? []
        : contourSegments(values, dimensions, plane, levels.map(level => -level), offset);
    const zeroSegments = usedOptions.zeroLine
        ? contourSegments(values, dimensions, plane, [0], offset)
        : [];
    const completed = now();
    return {
        plane,
        dimensions,
        levels,
        level: levels[0],
        positiveSegments,
        negativeSegments,
        zeroSegments,
        segmentCount: positiveSegments.length + negativeSegments.length + zeroSegments.length,
        timings: {
            planeSetupTimeMs: samplingStarted - started,
            samplingTimeMs: contouringStarted - samplingStarted,
            contourExtractionTimeMs: completed - contouringStarted,
            totalTimeMs: completed - started,
        },
    };
}

/** @returns {Float32Array} Packed xyz endpoint positions for transferable output. */
function packSegments(segments) {
    const positions = new Float32Array(segments.length * 6);
    let offset = 0;
    for (const [start, end] of segments) {
        positions.set(start, offset);
        positions.set(end, offset + 3);
        offset += 6;
    }
    return positions;
}

/**
 * Packs nested contour endpoints into transferable typed arrays.
 * @param {object} contours - Output from {@link calculatePlanarContours}.
 * @returns {object} Equivalent contour result with packed signed positions.
 */
export function packPlanarContours(contours) {
    return {
        ...contours,
        positiveSegments: packSegments(contours.positiveSegments),
        negativeSegments: packSegments(contours.negativeSegments),
        zeroSegments: packSegments(contours.zeroSegments),
        packed: true,
    };
}
