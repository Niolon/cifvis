/**
 * Prepares direct typed-array interpolation only for ordinary regular grids.
 * An own data property is required so symmetry-orbit getters are never touched.
 * @param {object} field - Scalar grid with x-fastest typed-array storage.
 * @param {object} lattice - Rectangular fractional surface lattice.
 * @returns {object|null} Prepared axis maps, or null for a non-regular field.
 */
export function prepareRegularSurfaceSampler(field: object, lattice: object): object | null;
/**
 * Trilinearly samples selected lattice nodes into a caller-owned x-fastest buffer.
 * @param {object} prepared - Regular sampler returned by prepareRegularSurfaceSampler().
 * @param {object} lattice - Surface lattice matching the prepared axis maps.
 * @param {Uint32Array} activeNodeIndices - Flattened node indices to sample.
 * @param {number} count - Used prefix length of activeNodeIndices.
 * @param {Float32Array} output - Full lattice-node buffer mutated in place.
 * @returns {void}
 */
export function samplePreparedSurfaceNodes(prepared: object, lattice: object, activeNodeIndices: Uint32Array, count: number, output: Float32Array): void;
/**
 * Samples only nodes adjacent to active cells, sharing every node evaluation.
 * @param {object} lattice - Rectangular fractional surface lattice.
 * @param {Uint8Array} activeCellMask - X-fastest mask over lattice cells.
 * @param {object} field - Scalar field sampled in fractional coordinates.
 * @param {number|null} activeCount - Known active-cell count, or null to count it.
 * @param {object} options - Sampling backend, traversal, and allowed-node mask.
 * @returns {object} Shared node values, active indices, counts, and timings.
 */
export function sampleActiveCellNodes(lattice: object, activeCellMask: Uint8Array, field: object, activeCount?: number | null, options?: object): object;
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
export function extractMarchingCubes(options: {
    lattice: object;
    activeCellMask: Uint8Array;
    activeCellCount: number;
    field: object;
    level: number;
    signs?: string | undefined;
    samplingMode?: string | undefined;
    nodeTraversal?: string | undefined;
    allowedNodeMask?: Uint8Array<ArrayBufferLike> | null | undefined;
}): object;
//# sourceMappingURL=isosurface-extractor.d.ts.map