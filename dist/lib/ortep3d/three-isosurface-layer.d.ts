/**
 * Three.js adapter for displaying a generic scalar field. It owns the generated
 * mesh hierarchy and its GPU resources; CrystalViewer supplies only a parent,
 * the displayed structure, and render-independent field/options state.
 */
export class ThreeIsosurfaceLayer {
    constructor(parent: any, options?: {});
    parent: any;
    options: {};
    field: any;
    structure: any;
    group: import("three").Group<import("three").Object3DEventMap> | null;
    resolutionFraction: number;
    regionCache: SymmetryRegionSurfaceCache;
    appearanceOnlyUpdate: boolean;
    setField(field: any, resolutionFraction?: number): void;
    setStructure(structure: any): void;
    setOptions(options?: {}): void;
    /**
     * Rebuilds the mesh for the current field and displayed structure.
     * @returns {object|null} Generated surface statistics, or null without input.
     */
    rebuild(): object | null;
    /** Updates colors, opacity, and visibility without rebuilding CPU geometry. */
    updateAppearance(): void;
    /** Removes only the generated mesh while retaining field and structure. */
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
    };
    dispose(): void;
}
import { SymmetryRegionSurfaceCache } from '../density/symmetry-isosurface.js';
//# sourceMappingURL=three-isosurface-layer.d.ts.map