import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';

const CORNERS = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
];
const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
];
const TRIANGLE_COUNTS = new Uint8Array(256);
for (let caseIndex = 0; caseIndex < 256; caseIndex++) {
    const offset = caseIndex * 16;
    while (triTable[offset + TRIANGLE_COUNTS[caseIndex] * 3] !== -1) {
        TRIANGLE_COUNTS[caseIndex]++;
    }
}

function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

function cellCoordinates(flattened, nx, ny, target) {
    const plane = nx * ny;
    const z = Math.floor(flattened / plane);
    const remainder = flattened - z * plane;
    const y = Math.floor(remainder / nx);
    target[0] = remainder - y * nx;
    target[1] = y;
    target[2] = z;
}

function nodeIndex(x, y, z, dimensions) {
    return (z * dimensions[1] + y) * dimensions[0] + x;
}

function prepareAxisMapping(field, lattice, axis) {
    const surfaceLength = lattice.dimensions[axis];
    const fieldLength = field.dimensions[axis];
    const origin = field.originFractional?.[axis] ?? 0;
    const periodic = field.boundaryMode !== 'zero';
    const lower = new Int32Array(surfaceLength);
    const upper = new Int32Array(surfaceLength);
    const fraction = new Float64Array(surfaceLength);
    const valid = new Uint8Array(surfaceLength);
    for (let index = 0; index < surfaceLength; index++) {
        const coordinate = lattice.bounds.minimum[axis] +
            index * lattice.fractionalStep[axis];
        const scaled = (coordinate - origin) * fieldLength;
        if (!periodic && (scaled < 0 || scaled > fieldLength - 1)) {
            continue;
        }
        let first = Math.floor(scaled);
        let amount = scaled - first;
        if (!periodic && first >= fieldLength - 1) {
            first = fieldLength - 1;
            amount = 0;
        }
        lower[index] = periodic
            ? ((first % fieldLength) + fieldLength) % fieldLength
            : first;
        upper[index] = periodic ? (lower[index] + 1) % fieldLength :
            Math.min(fieldLength - 1, first + 1);
        fraction[index] = amount;
        valid[index] = 1;
    }
    return { lower, upper, fraction, valid };
}

/**
 * Prepares direct typed-array interpolation only for ordinary regular grids.
 * An own data property is required so symmetry-orbit getters are never touched.
 * @param {object} field - Scalar grid with x-fastest typed-array storage.
 * @param {object} lattice - Rectangular fractional surface lattice.
 * @returns {object|null} Prepared axis maps, or null for a non-regular field.
 */
export function prepareRegularSurfaceSampler(field, lattice) {
    const valuesProperty = Object.getOwnPropertyDescriptor(field, 'values');
    const values = valuesProperty?.value;
    if (!ArrayBuffer.isView(values) || values instanceof DataView ||
        !Array.isArray(field.dimensions) || field.dimensions.length !== 3 ||
        values.length !== field.dimensions[0] * field.dimensions[1] * field.dimensions[2]) {
        return null;
    }
    return {
        values,
        dimensions: [...field.dimensions],
        axes: [0, 1, 2].map(axis => prepareAxisMapping(field, lattice, axis)),
    };
}

/**
 * Trilinearly samples selected lattice nodes into a caller-owned x-fastest buffer.
 * @param {object} prepared - Regular sampler returned by prepareRegularSurfaceSampler().
 * @param {object} lattice - Surface lattice matching the prepared axis maps.
 * @param {Uint32Array} activeNodeIndices - Flattened node indices to sample.
 * @param {number} count - Used prefix length of activeNodeIndices.
 * @param {Float32Array} output - Full lattice-node buffer mutated in place.
 * @returns {void}
 */
export function samplePreparedSurfaceNodes(prepared, lattice, activeNodeIndices, count, output) {
    const [surfaceNx, surfaceNy] = lattice.dimensions;
    const surfacePlane = surfaceNx * surfaceNy;
    const [fieldNx, fieldNy] = prepared.dimensions;
    const fieldPlane = fieldNx * fieldNy;
    const [xAxis, yAxis, zAxis] = prepared.axes;
    const values = prepared.values;
    for (let active = 0; active < count; active++) {
        const flattened = activeNodeIndices[active];
        const z = Math.floor(flattened / surfacePlane);
        const remainder = flattened - z * surfacePlane;
        const y = Math.floor(remainder / surfaceNx);
        const x = remainder - y * surfaceNx;
        if (!xAxis.valid[x] || !yAxis.valid[y] || !zAxis.valid[z]) {
            output[flattened] = 0;
            continue;
        }
        const x0 = xAxis.lower[x];
        const x1 = xAxis.upper[x];
        const y0 = yAxis.lower[y] * fieldNx;
        const y1 = yAxis.upper[y] * fieldNx;
        const z0 = zAxis.lower[z] * fieldPlane;
        const z1 = zAxis.upper[z] * fieldPlane;
        const tx = xAxis.fraction[x];
        const ty = yAxis.fraction[y];
        const tz = zAxis.fraction[z];
        const v000 = values[z0 + y0 + x0];
        const v100 = values[z0 + y0 + x1];
        const v010 = values[z0 + y1 + x0];
        const v110 = values[z0 + y1 + x1];
        const v001 = values[z1 + y0 + x0];
        const v101 = values[z1 + y0 + x1];
        const v011 = values[z1 + y1 + x0];
        const v111 = values[z1 + y1 + x1];
        const x00 = v000 + tx * (v100 - v000);
        const x10 = v010 + tx * (v110 - v010);
        const x01 = v001 + tx * (v101 - v001);
        const x11 = v011 + tx * (v111 - v011);
        const y0Value = x00 + ty * (x10 - x00);
        const y1Value = x01 + ty * (x11 - x01);
        output[flattened] = y0Value + tz * (y1Value - y0Value);
    }
}

/**
 * Samples only nodes adjacent to active cells, sharing every node evaluation.
 * @param {object} lattice - Rectangular fractional surface lattice.
 * @param {Uint8Array} activeCellMask - X-fastest mask over lattice cells.
 * @param {object} field - Scalar field sampled in fractional coordinates.
 * @param {number|null} activeCount - Known active-cell count, or null to count it.
 * @param {object} options - Sampling backend, traversal, and allowed-node mask.
 * @returns {object} Shared node values, active indices, counts, and timings.
 */
export function sampleActiveCellNodes(
    lattice,
    activeCellMask,
    field,
    activeCount = null,
    options = {},
) {
    const started = now();
    const count = activeCount ?? activeCellMask.reduce((sum, value) => sum + value, 0);
    const activeCellIndices = new Uint32Array(count);
    const nodeKnown = new Uint8Array(lattice.nodeCount);
    const nodeValues = new Float32Array(lattice.nodeCount);
    const activeNodeIndices = new Uint32Array(lattice.nodeCount);
    let activeOffset = 0;
    let activeNodeCount = 0;
    const [cx, cy] = lattice.cellDimensions;
    const [nx, ny] = lattice.dimensions;
    const nodePlane = nx * ny;
    const coordinates = new Int32Array(3);
    const corners = new Int32Array(8);
    for (let flattened = 0; flattened < activeCellMask.length; flattened++) {
        if (!activeCellMask[flattened]) {
            continue;
        }
        activeCellIndices[activeOffset++] = flattened;
        cellCoordinates(flattened, cx, cy, coordinates);
        const node = (coordinates[2] * ny + coordinates[1]) * nx + coordinates[0];
        corners[0] = node;
        corners[1] = node + 1;
        corners[2] = node + nx;
        corners[3] = node + nx + 1;
        corners[4] = node + nodePlane;
        corners[5] = node + nodePlane + 1;
        corners[6] = node + nodePlane + nx;
        corners[7] = node + nodePlane + nx + 1;
        for (let corner = 0; corner < 8; corner++) {
            const index = corners[corner];
            if (!nodeKnown[index] && (!options.allowedNodeMask || options.allowedNodeMask[index])) {
                nodeKnown[index] = 1;
                activeNodeIndices[activeNodeCount++] = index;
            }
        }
    }
    const requestedTraversal = options.nodeTraversal ?? 'active-list';
    const requestedSampling = options.samplingMode ?? 'auto';
    const prepared = requestedSampling === 'generic'
        ? null
        : prepareRegularSurfaceSampler(field, lattice);
    if (requestedSampling === 'prepared' && !prepared) {
        throw new Error('Prepared surface sampling requires an ordinary regular scalar grid');
    }
    const indices = requestedTraversal === 'full-scan'
        ? new Uint32Array(lattice.nodeCount)
        : activeNodeIndices;
    let sampleCount = activeNodeCount;
    if (requestedTraversal === 'full-scan') {
        sampleCount = 0;
        for (let index = 0; index < nodeKnown.length; index++) {
            if (nodeKnown[index]) {
                indices[sampleCount++] = index;
            }
        }
    }
    if (prepared) {
        samplePreparedSurfaceNodes(prepared, lattice, indices, sampleCount, nodeValues);
    } else {
        const surfacePlane = nx * ny;
        for (let active = 0; active < sampleCount; active++) {
            const flattened = indices[active];
            const z = Math.floor(flattened / surfacePlane);
            const remainder = flattened - z * surfacePlane;
            const y = Math.floor(remainder / nx);
            const x = remainder - y * nx;
            nodeValues[flattened] = field.sample(
                lattice.bounds.minimum[0] + x * lattice.fractionalStep[0],
                lattice.bounds.minimum[1] + y * lattice.fractionalStep[1],
                lattice.bounds.minimum[2] + z * lattice.fractionalStep[2],
            );
        }
    }
    return {
        activeCellIndices,
        activeNodeIndices: indices.subarray(0, sampleCount),
        nodeKnown,
        nodeValues,
        activeNodeCount: sampleCount,
        fieldSampleCount: sampleCount,
        samplingBackend: prepared ? 'prepared-trilinear' : 'generic-sample',
        nodeTraversal: requestedTraversal,
        samplingTimeMs: now() - started,
    };
}

function classifyCells(lattice, samples, level, signs) {
    const started = now();
    const capacity = samples.activeCellIndices.length;
    const cellIndices = new Uint32Array(capacity);
    const cellCases = new Uint16Array(capacity);
    let activeSurfaceCellCount = 0;
    let positiveSurfaceCellCount = 0;
    let negativeSurfaceCellCount = 0;
    let positiveTriangleCount = 0;
    let negativeTriangleCount = 0;
    const renderPositive = signs !== 'negative';
    const renderNegative = signs !== 'positive';
    const [nx, ny] = lattice.dimensions;
    const [cx, cy] = lattice.cellDimensions;
    const nodePlane = nx * ny;
    const coordinates = new Int32Array(3);
    const indices = new Int32Array(8);
    for (let active = 0; active < samples.activeCellIndices.length; active++) {
        const flattened = samples.activeCellIndices[active];
        cellCoordinates(flattened, cx, cy, coordinates);
        const node = (coordinates[2] * ny + coordinates[1]) * nx + coordinates[0];
        indices[0] = node;
        indices[1] = node + 1;
        indices[2] = node + nx + 1;
        indices[3] = node + nx;
        indices[4] = node + nodePlane;
        indices[5] = node + nodePlane + 1;
        indices[6] = node + nodePlane + nx + 1;
        indices[7] = node + nodePlane + nx;
        let positiveCase = 0;
        let negativeCase = 0;
        for (let corner = 0; corner < 8; corner++) {
            const value = samples.nodeValues[indices[corner]];
            if (renderPositive && value < level) {
                positiveCase |= 1 << corner;
            }
            if (renderNegative && -value < level) {
                negativeCase |= 1 << corner;
            }
        }
        const positiveActive = edgeTable[positiveCase] !== 0;
        const negativeActive = edgeTable[negativeCase] !== 0;
        if (!positiveActive && !negativeActive) {
            continue;
        }
        cellIndices[activeSurfaceCellCount] = flattened;
        cellCases[activeSurfaceCellCount] = positiveCase | (negativeCase << 8);
        activeSurfaceCellCount++;
        if (positiveActive) {
            positiveSurfaceCellCount++;
            positiveTriangleCount += TRIANGLE_COUNTS[positiveCase];
        }
        if (negativeActive) {
            negativeSurfaceCellCount++;
            negativeTriangleCount += TRIANGLE_COUNTS[negativeCase];
        }
    }
    return {
        cellIndices: cellIndices.subarray(0, activeSurfaceCellCount),
        cellCases: cellCases.subarray(0, activeSurfaceCellCount),
        activeSurfaceCellCount,
        positiveSurfaceCellCount,
        negativeSurfaceCellCount,
        positiveTriangleCount,
        negativeTriangleCount,
        classificationTimeMs: now() - started,
    };
}

function writeSignPositions(lattice, samples, classified, level, sign, positions) {
    const multiplier = sign === 'positive' ? 1 : -1;
    const shift = sign === 'positive' ? 0 : 8;
    const values = new Float32Array(8);
    const edgePositions = new Float64Array(36);
    const coordinates = new Int32Array(3);
    const [cx, cy] = lattice.cellDimensions;
    let output = 0;
    for (let cell = 0; cell < classified.activeSurfaceCellCount; cell++) {
        const packedCase = classified.cellCases[cell];
        const surfaceCase = (packedCase >> shift) & 0xff;
        const edgeBits = edgeTable[surfaceCase];
        if (edgeBits === 0) {
            continue;
        }
        cellCoordinates(classified.cellIndices[cell], cx, cy, coordinates);
        const x = coordinates[0];
        const y = coordinates[1];
        const z = coordinates[2];
        for (let corner = 0; corner < 8; corner++) {
            const offset = CORNERS[corner];
            values[corner] = multiplier * samples.nodeValues[nodeIndex(
                x + offset[0], y + offset[1], z + offset[2], lattice.dimensions,
            )];
        }
        for (let edge = 0; edge < 12; edge++) {
            if (!(edgeBits & (1 << edge))) {
                continue;
            }
            const [first, second] = EDGES[edge];
            const denominator = values[second] - values[first];
            const fraction = Math.abs(denominator) < 1e-20
                ? 0.5
                : (level - values[first]) / denominator;
            for (let axis = 0; axis < 3; axis++) {
                const cellCoordinate = axis === 0 ? x : axis === 1 ? y : z;
                const coordinate = cellCoordinate + CORNERS[first][axis] +
                    fraction * (CORNERS[second][axis] - CORNERS[first][axis]);
                edgePositions[edge * 3 + axis] = lattice.bounds.minimum[axis] +
                    coordinate * lattice.fractionalStep[axis];
            }
        }
        const tableOffset = surfaceCase * 16;
        for (let entry = 0; triTable[tableOffset + entry] !== -1; entry++) {
            const source = triTable[tableOffset + entry] * 3;
            positions[output++] = edgePositions[source];
            positions[output++] = edgePositions[source + 1];
            positions[output++] = edgePositions[source + 2];
        }
    }
}

/**
 * Extracts positive and negative non-indexed surfaces in a shared typed-array
 * traversal. Returned positions are fractional coordinates.
 * @param {object} options - Extraction inputs and traversal settings.
 * @param {object} options.lattice - Rectangular fractional lattice.
 * @param {Uint8Array} options.activeCellMask - Cells eligible for contouring.
 * @param {number} options.activeCellCount - Number of eligible cells.
 * @param {object} options.field - Periodic scalar field.
 * @param {number} options.level - Positive absolute contour level.
 * @param {string} [options.signs] - `positive`, `negative`, or `both`.
 * @param {string} [options.samplingMode] - Prepared or generic sampling selection.
 * @param {string} [options.nodeTraversal] - Active-list or full-scan traversal.
 * @param {Uint8Array|null} [options.allowedNodeMask] - Conservative clipping stencil.
 * @returns {object} Fractional positions, triangle counts, and stage diagnostics.
 */
export function extractMarchingCubes(options) {
    const {
        lattice,
        activeCellMask,
        activeCellCount,
        field,
        level,
        signs = 'both',
        samplingMode = 'auto',
        nodeTraversal = 'active-list',
        allowedNodeMask = null,
    } = options;
    const started = now();
    const samples = sampleActiveCellNodes(
        lattice,
        activeCellMask,
        field,
        activeCellCount,
        { samplingMode, nodeTraversal, allowedNodeMask },
    );
    const classified = classifyCells(lattice, samples, level, signs);
    const allocationStarted = now();
    const positivePositions = new Float32Array(classified.positiveTriangleCount * 9);
    const negativePositions = new Float32Array(classified.negativeTriangleCount * 9);
    const allocationTimeMs = now() - allocationStarted;
    const interpolationStarted = now();
    if (positivePositions.length) {
        writeSignPositions(lattice, samples, classified, level, 'positive', positivePositions);
    }
    if (negativePositions.length) {
        writeSignPositions(lattice, samples, classified, level, 'negative', negativePositions);
    }
    const interpolationTimeMs = now() - interpolationStarted;
    const activeRows = new Uint8Array(
        lattice.cellDimensions[1] * lattice.cellDimensions[2],
    );
    const rowCoordinates = new Int32Array(3);
    for (const flattened of samples.activeCellIndices) {
        cellCoordinates(
            flattened,
            lattice.cellDimensions[0],
            lattice.cellDimensions[1],
            rowCoordinates,
        );
        activeRows[rowCoordinates[2] * lattice.cellDimensions[1] + rowCoordinates[1]] = 1;
    }
    let activeRowCount = 0;
    for (const active of activeRows) {
        activeRowCount += active;
    }
    return {
        positive: { positions: positivePositions, indices: null },
        negative: { positions: negativePositions, indices: null },
        statistics: {
            surfaceSamplingTimeMs: samples.samplingTimeMs,
            surfaceClassificationTimeMs: classified.classificationTimeMs,
            surfaceAllocationTimeMs: allocationTimeMs,
            surfaceInterpolationTimeMs: interpolationTimeMs,
            surfaceLatticeNodeCount: lattice.nodeCount,
            surfaceLatticeCellCount: lattice.cellCount,
            activeCellCount: samples.activeCellIndices.length,
            activeSurfaceCellCount: classified.activeSurfaceCellCount,
            activeRowCount,
            fieldSampleCount: samples.fieldSampleCount,
            activeNodeCount: samples.activeNodeCount,
            samplingBackend: samples.samplingBackend,
            nodeTraversal: samples.nodeTraversal,
            positiveSurfaceCellCount: classified.positiveSurfaceCellCount,
            negativeSurfaceCellCount: classified.negativeSurfaceCellCount,
            positiveTriangleCount: classified.positiveTriangleCount,
            negativeTriangleCount: classified.negativeTriangleCount,
            generatedVertexCount: (positivePositions.length + negativePositions.length) / 3,
            allocatedGeometryBytes: positivePositions.byteLength + negativePositions.byteLength,
            extractorTimeMs: now() - started,
        },
    };
}
