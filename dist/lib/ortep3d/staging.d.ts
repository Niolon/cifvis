/**
 * Finds optimal rotation to view a molecular structure in a standard orientation:
 * perpendicular to its mean plane, with the longest axis aligned horizontally, and
 * with a slight tilt for better 3D perception.
 * @param {THREE.Object3D} structureGroup - The structure to analyze (containing atom objects)
 * @returns {THREE.Matrix4|null} Rotation matrix to orient structure, or null if no atoms found
 */
export function structureOrientationMatrix(structureGroup: THREE.Object3D): THREE.Matrix4 | null;
/**
 * Resolves the pixel dimensions of a captured image from the on-screen CSS
 * size, a scale multiplier, and an optional target for the longest edge.
 * A longEdge target overrides the scale; the result preserves aspect ratio
 * and is clamped to MAX_CAPTURE_EDGE.
 * @param {number} cssWidth - Container CSS width in pixels
 * @param {number} cssHeight - Container CSS height in pixels
 * @param {object} [options] - Capture sizing options
 * @param {number} [options.scale] - Multiplier over the CSS size
 * @param {number} [options.longEdge] - Target length of the longer edge in pixels
 * @returns {{width: number, height: number, scale: number}} Pixel dimensions and the applied scale
 */
export function resolveCaptureDimensions(cssWidth: number, cssHeight: number, options?: {
    scale?: number | undefined;
    longEdge?: number | undefined;
}): {
    width: number;
    height: number;
    scale: number;
};
/**
 * Sets up scene lighting optimized for molecular visualization based on structure dimensions.
 * Creates a studio-style square softbox with inexpensive ambient and directional fill lights.
 * @param {THREE.Scene} scene - The scene to add lights to
 * @param {THREE.Object3D} ortep3DGroup - The molecular structure object to light
 * @param {THREE.Box3} [structureExtent] - Precomputed rendered bounds, when available
 */
export function setupLighting(scene: THREE.Scene, ortep3DGroup: THREE.Object3D, structureExtent?: THREE.Box3): void;
/** Largest square image dimension WebGL/canvas backends reliably support. */
export const MAX_CAPTURE_EDGE: 16384;
import * as THREE from 'three';
//# sourceMappingURL=staging.d.ts.map