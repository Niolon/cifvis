/**
 * Plans the renderer-independent numerical lattice used for surface extraction.
 * The step convention deliberately matches the established Three.js path: a
 * resolution-N lattice advances by the displayed fractional span divided by N.
 * @param {object} cell - Unit cell containing fractToCartMatrix.
 * @param {object} bounds - Unbounded fractional display bounds.
 * @param {number|number[]} resolution - Node count along each lattice axis.
 * @returns {object} Structured-cloneable surface lattice.
 */
export function planSurfaceLattice(cell: object, bounds: object, resolution: number | number[]): object;
/**
 * Creates a conservative Cartesian-radius stencil over lattice cells.
 * The radius includes a cell-diagonal pad so clipping cannot remove a crossing.
 * @param {object} lattice - Planned surface lattice.
 * @param {number} radius - Nominal atom cutoff in Angstrom.
 * @returns {object} Integer offsets grouped in split typed arrays.
 */
export function createAtomCellStencil(lattice: object, radius: number): object;
/**
 * @param {object} lattice - Planned surface lattice.
 * @param {number} radius - Nominal Cartesian atom cutoff in Angstrom.
 * @returns {object} Conservative integer stencil for allowed scalar nodes.
 */
export function createAtomNodeStencil(lattice: object, radius: number): object;
/**
 * Applies a precomputed stencil to displayed atoms without wrapping fractional
 * coordinates or performing Cartesian distance tests in the hot loop.
 * @param {object} lattice - Planned surface lattice.
 * @param {object[]} atoms - Displayed atoms, including grown periodic copies.
 * @param {object} stencil - Precomputed cell stencil.
 * @returns {object} Active-cell mask and work counts.
 */
export function applyAtomCellStencil(lattice: object, atoms: object[], stencil: object): object;
/**
 * Applies the independent node stencil. Nodes outside this mask deliberately
 * retain zero, approximating the legacy visual clipping without atom searches.
 * @param {object} lattice - Planned surface lattice.
 * @param {object[]} atoms - Displayed atoms without fractional wrapping.
 * @param {object} stencil - Precomputed node stencil.
 * @returns {object} Allowed-node mask and work counts.
 */
export function applyAtomNodeStencil(lattice: object, atoms: object[], stencil: object): object;
/**
 * Applies the shared geometric atom stencil to cells and nodes in one pass.
 * Cell and node lattices differ only at their positive boundary, so the hot
 * atom/offset traversal is shared while each mask retains its own bounds check.
 * @param {object} lattice - Planned surface lattice.
 * @param {object[]} atoms - Displayed atoms without fractional wrapping.
 * @param {object} stencil - Shared precomputed cell/node stencil.
 * @returns {object} Cell and node masks with their candidate and unique counts.
 */
export function applyAtomSurfaceStencils(lattice: object, atoms: object[], stencil: object): object;
//# sourceMappingURL=surface-lattice.d.ts.map