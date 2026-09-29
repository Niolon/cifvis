/**
 * Calculates the fractional region needed to cover the displayed atoms plus
 * a Cartesian padding radius. Fractional positions outside [0, 1] are kept so
 * fragment and hydrogen-bond growth can display periodic copies of the map.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Padding around atoms in Angstrom.
 * @returns {{minimum: number[], maximum: number[]}} Fractional clipping bounds.
 */
export function isosurfaceBounds(structure: object, radius: number): {
    minimum: number[];
    maximum: number[];
};
/**
 * Chooses an isotropic marching-cubes resolution from the physical draw size.
 * The configured resolution remains a minimum, while maxResolution prevents
 * the cubic field allocation from growing without bound.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Isosurface display options.
 * @returns {number} Final surface resolution for this displayed structure.
 */
export function isosurfaceResolution(structure: object, options?: object): number;
/**
 * Replaces a triangulated surface mesh with a true edge-line representation.
 * Drawing wireframe via a fully triangulated GL_LINE mesh rasterizes every
 * triangle edge (including internal diagonals) every frame; extracting real
 * edges once at rebuild time yields far fewer line segments and lets the GPU
 * skip per-fragment PBR shading entirely.
 * @param {THREE.Mesh} surface - Triangulated surface, kept for triangle-count statistics.
 * @param {THREE.Color} color - Wireframe line color.
 * @param {number} opacity - Wireframe line opacity.
 * @returns {THREE.LineSegments} Edge-line replacement carrying the surface's name/userData/matrix.
 */
export function wireframeFromSurface(surface: THREE.Mesh, color: THREE.Color, opacity: number): THREE.LineSegments;
/**
 * Creates positive and negative isosurfaces clipped around
 * the atoms in the currently displayed (and potentially symmetry-grown) structure.
 * @param {object} field - Sampled scalar field.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Surface display options.
 * @returns {THREE.Group} Isosurface group.
 */
export function createIsosurfaces(field: object, structure: object, options?: object): THREE.Group;
export { DEFAULT_ISOSURFACE_OPTIONS } from "./isosurface-options.js";
import * as THREE from 'three';
//# sourceMappingURL=isosurface.d.ts.map