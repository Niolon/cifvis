/**
 * Three.js adapter for renderer-independent planar contours. The adapter only
 * creates screen-space line primitives: it deliberately has no plane or
 * background fill.
 */
export class ThreeContourLineLayer {
    constructor(parent: any, options?: {});
    parent: any;
    options: {};
    field: any;
    structure: any;
    group: THREE.Group<THREE.Object3DEventMap> | null;
    setField(field: any): void;
    setStructure(structure: any): void;
    setOptions(options?: {}): void;
    /**
     * Adds one signed collection of contour segments.
     * @param {THREE.Group} group - Contour parent.
     * @param {number[][][]} segments - Cartesian endpoint pairs.
     * @param {string} sign - Signed contour category.
     * @param {THREE.ColorRepresentation} color - Line colour.
     */
    addSegments(group: THREE.Group, segments: number[][][], sign: string, color: THREE.ColorRepresentation): void;
    /** @returns {object|null} Generated contour statistics, or null without input. */
    rebuild(): object | null;
    /**
     * Installs contours calculated outside the rendering thread.
     * @param {object} contours - Nested or packed planar-contour result.
     * @returns {object|null} Generated contour statistics.
     */
    rebuildFromContours(contours: object): object | null;
    /**
     * @param {object} contours - Calculated nested or packed contours.
     * @param {number} started - Geometry installation start time.
     * @returns {object} Three.js geometry statistics for a calculated contour result.
     */
    buildContours(contours: object, started: number): object;
    /** Removes only generated lines while retaining the field and structure. */
    clearMesh(): void;
    clear(): void;
    setVisible(visible: any): boolean;
    get statistics(): Record<string, any>;
    get displayState(): {
        available: boolean;
        visible: boolean;
        level: any;
        sigmaLevel: any;
        sourceType: any;
        fieldKind: any;
        displayLabel: any;
        quantityName: any;
        signed: boolean;
        displayMode: string;
        segmentCount: any;
        contourLevels: any;
    };
    dispose(): void;
}
import * as THREE from 'three';
//# sourceMappingURL=three-contour-line-layer.d.ts.map