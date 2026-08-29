/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns -- hot kernels */
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

/** Samples only nodes adjacent to active cells, sharing every node evaluation. */
export function sampleActiveCellNodes(lattice, activeCellMask, field, activeCount = null) {
    const started = now();
    const count = activeCount ?? activeCellMask.reduce((sum, value) => sum + value, 0);
    const activeCellIndices = new Uint32Array(count);
    const nodeKnown = new Uint8Array(lattice.nodeCount);
    const nodeValues = new Float32Array(lattice.nodeCount);
    let activeOffset = 0;
    let fieldSampleCount = 0;
    const [cx, cy] = lattice.cellDimensions;
    const [nx, ny, nz] = lattice.dimensions;
    const nodePlane = nx * ny;
    const coordinates = new Int32Array(3);
    for (let flattened = 0; flattened < activeCellMask.length; flattened++) {
        if (!activeCellMask[flattened]) {
            continue;
        }
        activeCellIndices[activeOffset++] = flattened;
        cellCoordinates(flattened, cx, cy, coordinates);
        const node = (coordinates[2] * ny + coordinates[1]) * nx + coordinates[0];
        nodeKnown[node] = 1;
        nodeKnown[node + 1] = 1;
        nodeKnown[node + nx] = 1;
        nodeKnown[node + nx + 1] = 1;
        nodeKnown[node + nodePlane] = 1;
        nodeKnown[node + nodePlane + 1] = 1;
        nodeKnown[node + nodePlane + nx] = 1;
        nodeKnown[node + nodePlane + nx + 1] = 1;
    }
    for (let z = 0; z < nz; z++) {
        const fractionalZ = lattice.bounds.minimum[2] + z * lattice.fractionalStep[2];
        for (let y = 0; y < ny; y++) {
            const fractionalY = lattice.bounds.minimum[1] + y * lattice.fractionalStep[1];
            const row = (z * ny + y) * nx;
            for (let x = 0; x < nx; x++) {
                const index = row + x;
                if (!nodeKnown[index]) {
                    continue;
                }
                nodeValues[index] = field.sample(
                    lattice.bounds.minimum[0] + x * lattice.fractionalStep[0],
                    fractionalY,
                    fractionalZ,
                );
                fieldSampleCount++;
            }
        }
    }
    return {
        activeCellIndices,
        nodeKnown,
        nodeValues,
        fieldSampleCount,
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
 */
export function extractMarchingCubes({
    lattice,
    activeCellMask,
    activeCellCount,
    field,
    level,
    signs = 'both',
}) {
    const started = now();
    const samples = sampleActiveCellNodes(lattice, activeCellMask, field, activeCellCount);
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
