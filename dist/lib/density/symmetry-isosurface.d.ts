/**
 * Groups atom-radius masks into connected regions. Intersecting masks always
 * remain in one marching-cubes field, so symmetry reuse cannot introduce an
 * internal clipping boundary or remove an isosurface bridge.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Density clipping radius in Angstrom.
 * @param {number} [connectionMargin] - Extra conservative grid-scale overlap.
 * @returns {Array<{atoms: object[]}>} Connected atom-mask regions.
 */
export function connectedIsosurfaceRegions(structure: object, radius: number, connectionMargin?: number): Array<{
    atoms: object[];
}>;
/**
 * Groups every geometrically intersecting clipping mask. The density is not
 * sampled to decide connectivity: even an arbitrarily thin contour bridge is
 * therefore polygonized in one field and cannot acquire an internal seam.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Density clipping radius in Angstrom.
 * @param {object} _field - Scalar field (unused by design).
 * @param {number} _level - Positive absolute contour level (unused by design).
 * @param {string} _sign - Contour sign (unused by design).
 * @returns {Array<{atoms: object[]}>} Contour-connected atom-mask regions.
 */
export function contourConnectedIsosurfaceRegions(structure: object, radius: number, _field: object, _level: number, _sign?: string): Array<{
    atoms: object[];
}>;
/**
 * Creates positive and negative isosurfaces while reusing symmetry-equivalent regions.
 * Falls back to the direct isosurface path when symmetry reuse is disabled or unavailable.
 * @param {object} field - Periodic scalar field to contour.
 * @param {object} structure - Structure defining atoms, cell, and symmetry.
 * @param {object} [options] - Isosurface display and symmetry-generation options.
 * @param {SymmetryRegionSurfaceCache|null} [regionCache] - Active-field CPU geometry cache.
 * @returns {THREE.Group} Renderable isosurface group with generation statistics.
 */
export function createSymmetryAwareIsosurfaces(field: object, structure: object, options?: object, regionCache?: SymmetryRegionSurfaceCache | null): THREE.Group;
/** Bounded CPU-side cache of canonical symmetry-region triangulations. */
export class SymmetryRegionSurfaceCache {
    constructor(maxBytes?: number);
    maxBytes: number;
    entries: Map<any, any>;
    bytes: number;
    evictions: number;
    get(key: any): any;
    has(key: any): boolean;
    set(key: any, value: any): void;
    clear(): void;
}
import * as THREE from 'three';
//# sourceMappingURL=symmetry-isosurface.d.ts.map