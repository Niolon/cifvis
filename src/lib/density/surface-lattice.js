/* eslint-disable jsdoc/require-jsdoc -- compact numerical surface helpers */

function cross(first, second) {
    return [
        first[1] * second[2] - first[2] * second[1],
        first[2] * second[0] - first[0] * second[2],
        first[0] * second[1] - first[1] * second[0],
    ];
}

function dot(first, second) {
    return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function norm(vector) {
    return Math.hypot(...vector);
}

/**
 * Plans the renderer-independent numerical lattice used for surface extraction.
 * The step convention deliberately matches the established Three.js path: a
 * resolution-N lattice advances by the displayed fractional span divided by N.
 * @param {object} cell - Unit cell containing fractToCartMatrix.
 * @param {object} bounds - Unbounded fractional display bounds.
 * @param {number|number[]} resolution - Node count along each lattice axis.
 * @returns {object} Structured-cloneable surface lattice.
 */
export function planSurfaceLattice(cell, bounds, resolution) {
    const dimensions = (Array.isArray(resolution) ? resolution : [resolution, resolution, resolution])
        .map(value => Math.max(2, Math.round(Number(value))));
    const span = bounds.maximum.map((value, axis) => value - bounds.minimum[axis]);
    const fractionalStep = span.map((value, axis) => value / dimensions[axis]);
    const matrix = cell.fractToCartMatrix.toArray();
    const cartesianStepVectors = fractionalStep.map((step, axis) => [
        matrix[0][axis] * step,
        matrix[1][axis] * step,
        matrix[2][axis] * step,
    ]);
    const diagonalLengths = [
        [1, 1, 1],
        [1, 1, -1],
        [1, -1, 1],
        [-1, 1, 1],
    ].map(signs => norm([0, 1, 2].map(axis =>
        signs[0] * cartesianStepVectors[0][axis] +
        signs[1] * cartesianStepVectors[1][axis] +
        signs[2] * cartesianStepVectors[2][axis])));
    const cellDimensions = dimensions.map(value => value - 1);
    return {
        dimensions,
        cellDimensions,
        bounds: {
            minimum: [...bounds.minimum],
            maximum: [...bounds.maximum],
        },
        fractionalStep,
        cartesianStepVectors,
        cellDiagonal: Math.max(...diagonalLengths),
        nodeCount: dimensions[0] * dimensions[1] * dimensions[2],
        cellCount: cellDimensions[0] * cellDimensions[1] * cellDimensions[2],
    };
}

/**
 * Builds the conservative atom-centred cell stencil. Surface clipping is
 * conservative to approximately one surface-grid voxel.
 * @param {object} lattice - Planned surface lattice.
 * @param {number} radius - Nominal Cartesian atom cutoff in Angstrom.
 * @returns {object} Parallel typed arrays of integer cell offsets.
 */
function createAtomStencil(lattice, radius) {
    const vectors = lattice.cartesianStepVectors;
    const determinant = dot(vectors[0], cross(vectors[1], vectors[2]));
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-15) {
        throw new Error('Surface lattice step vectors must span a finite volume');
    }
    const stencilRadius = radius + lattice.cellDiagonal;
    const reciprocalRows = [
        cross(vectors[1], vectors[2]),
        cross(vectors[2], vectors[0]),
        cross(vectors[0], vectors[1]),
    ].map(vector => vector.map(value => value / determinant));
    const extents = reciprocalRows.map(row => Math.ceil(stencilRadius * norm(row)));
    const offsets = [];
    const radiusSquared = stencilRadius ** 2;
    for (let dz = -extents[2]; dz <= extents[2]; dz++) {
        for (let dy = -extents[1]; dy <= extents[1]; dy++) {
            for (let dx = -extents[0]; dx <= extents[0]; dx++) {
                const cartesian = [0, 1, 2].map(axis =>
                    dx * vectors[0][axis] + dy * vectors[1][axis] + dz * vectors[2][axis]);
                if (dot(cartesian, cartesian) <= radiusSquared * (1 + 1e-12)) {
                    offsets.push(dx, dy, dz);
                }
            }
        }
    }
    const ArrayType = Math.max(...extents) <= 32767 ? Int16Array : Int32Array;
    const count = offsets.length / 3;
    const dx = new ArrayType(count);
    const dy = new ArrayType(count);
    const dz = new ArrayType(count);
    for (let index = 0; index < count; index++) {
        dx[index] = offsets[3 * index];
        dy[index] = offsets[3 * index + 1];
        dz[index] = offsets[3 * index + 2];
    }
    return { dx, dy, dz, count, radius: stencilRadius };
}

export function createAtomCellStencil(lattice, radius) {
    return createAtomStencil(lattice, radius);
}

/**
 * @param {object} lattice - Planned surface lattice.
 * @param {number} radius - Nominal Cartesian atom cutoff in Angstrom.
 * @returns {object} Conservative integer stencil for allowed scalar nodes.
 */
export function createAtomNodeStencil(lattice, radius) {
    return createAtomStencil(lattice, radius);
}

/**
 * Applies a precomputed stencil to displayed atoms without wrapping fractional
 * coordinates or performing Cartesian distance tests in the hot loop.
 * @param {object} lattice - Planned surface lattice.
 * @param {object[]} atoms - Displayed atoms, including grown periodic copies.
 * @param {object} stencil - Precomputed cell stencil.
 * @returns {object} Active-cell mask and work counts.
 */
export function applyAtomCellStencil(lattice, atoms, stencil) {
    const [nx, ny, nz] = lattice.cellDimensions;
    const mask = new Uint8Array(lattice.cellCount);
    let candidateCellCount = 0;
    for (const atom of atoms) {
        const position = atom.position;
        const centreX = Math.floor(
            (position.x - lattice.bounds.minimum[0]) / lattice.fractionalStep[0],
        );
        const centreY = Math.floor(
            (position.y - lattice.bounds.minimum[1]) / lattice.fractionalStep[1],
        );
        const centreZ = Math.floor(
            (position.z - lattice.bounds.minimum[2]) / lattice.fractionalStep[2],
        );
        for (let offset = 0; offset < stencil.count; offset++) {
            const x = centreX + stencil.dx[offset];
            const y = centreY + stencil.dy[offset];
            const z = centreZ + stencil.dz[offset];
            if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) {
                continue;
            }
            candidateCellCount++;
            mask[(z * ny + y) * nx + x] = 1;
        }
    }
    let activeCellCount = 0;
    for (const value of mask) {
        activeCellCount += value;
    }
    return { mask, candidateCellCount, activeCellCount };
}

/**
 * Applies the independent node stencil. Nodes outside this mask deliberately
 * retain zero, approximating the legacy visual clipping without atom searches.
 * @param {object} lattice - Planned surface lattice.
 * @param {object[]} atoms - Displayed atoms without fractional wrapping.
 * @param {object} stencil - Precomputed node stencil.
 * @returns {object} Allowed-node mask and work counts.
 */
export function applyAtomNodeStencil(lattice, atoms, stencil) {
    const [nx, ny, nz] = lattice.dimensions;
    const mask = new Uint8Array(lattice.nodeCount);
    let candidateNodeCount = 0;
    for (const atom of atoms) {
        const position = atom.position;
        const centreX = Math.floor(
            (position.x - lattice.bounds.minimum[0]) / lattice.fractionalStep[0],
        );
        const centreY = Math.floor(
            (position.y - lattice.bounds.minimum[1]) / lattice.fractionalStep[1],
        );
        const centreZ = Math.floor(
            (position.z - lattice.bounds.minimum[2]) / lattice.fractionalStep[2],
        );
        for (let offset = 0; offset < stencil.count; offset++) {
            const x = centreX + stencil.dx[offset];
            const y = centreY + stencil.dy[offset];
            const z = centreZ + stencil.dz[offset];
            if (x < 0 || x >= nx || y < 0 || y >= ny || z < 0 || z >= nz) {
                continue;
            }
            candidateNodeCount++;
            mask[(z * ny + y) * nx + x] = 1;
        }
    }
    let allowedNodeCount = 0;
    for (const value of mask) {
        allowedNodeCount += value;
    }
    return { mask, candidateNodeCount, allowedNodeCount };
}
