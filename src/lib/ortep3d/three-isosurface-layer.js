import { isosurfaceResolution } from '../density/isosurface.js';
import {
    createSymmetryAwareIsosurfaces,
    SymmetryRegionSurfaceCache,
} from '../density/symmetry-isosurface.js';
import {
    createPatchCachedIsosurfaces,
    SurfacePatchCache,
} from '../density/surface-patches.js';

const APPEARANCE_OPTIONS = new Set([
    'positiveColor',
    'negativeColor',
    'deformationPositiveColor',
    'deformationNegativeColor',
    'opacity',
    'visible',
]);

/**
 * Three.js adapter for displaying a generic scalar field. It owns the generated
 * mesh hierarchy and its GPU resources; CrystalViewer supplies only a parent,
 * the displayed structure, and render-independent field/options state.
 */
export class ThreeIsosurfaceLayer {
    constructor(parent, options = {}) {
        this.parent = parent;
        this.options = { ...options };
        this.field = null;
        this.structure = null;
        this.group = null;
        this.resolutionFraction = 1;
        this.patchCache = new SurfacePatchCache(options.patchCacheMaxBytes);
        this.regionCache = new SymmetryRegionSurfaceCache(options.patchCacheMaxBytes);
        this.appearanceOnlyUpdate = false;
    }

    setField(field, resolutionFraction = 1) {
        if (field !== this.field) {
            this.patchCache.clear();
            this.regionCache.clear();
            this.appearanceOnlyUpdate = false;
        }
        this.field = field;
        this.resolutionFraction = resolutionFraction;
    }

    setStructure(structure) {
        if (structure !== this.structure) {
            this.appearanceOnlyUpdate = false;
        }
        this.structure = structure;
    }

    setOptions(options = {}) {
        const changedOptions = Object.entries(options).filter(
            ([name, value]) => this.options[name] !== value,
        );
        this.appearanceOnlyUpdate = Boolean(this.group) && changedOptions.length > 0 &&
            changedOptions.every(([name]) => APPEARANCE_OPTIONS.has(name));
        this.options = { ...this.options, ...options };
        if (options.patchCacheMaxBytes !== undefined) {
            this.patchCache.maxBytes = Math.max(0, Number(options.patchCacheMaxBytes) || 0);
            this.regionCache.maxBytes = this.patchCache.maxBytes;
        }
    }

    /**
     * Rebuilds the mesh for the current field and displayed structure.
     * @returns {object|null} Generated surface statistics, or null without input.
     */
    rebuild() {
        if (this.appearanceOnlyUpdate && this.group) {
            this.appearanceOnlyUpdate = false;
            this.updateAppearance();
            this.group.userData.appearanceCacheHitCount =
                (this.group.userData.appearanceCacheHitCount ?? 0) + 1;
            return {
                ...this.group.userData,
                surfaceTotalTimeMs: 0,
                generationTimeMs: 0,
            };
        }
        this.clearMesh();
        if (!this.field || !this.structure) {
            return null;
        }
        if (!['legacy', 'patch-cache'].includes(this.options.generationMode)) {
            throw new Error('Isosurface generationMode must be "patch-cache" or "legacy"');
        }
        const finalResolution = isosurfaceResolution(this.structure, this.options);
        const fieldColors = this.field.fieldKind === 'deformation-density'
            ? {
                positiveColor: this.options.deformationPositiveColor,
                negativeColor: this.options.deformationNegativeColor,
            }
            : {};
        const generationOptions = {
            ...this.options,
            ...fieldColors,
            gridSpacing: this.options.gridSpacing / this.resolutionFraction,
            resolution: Math.max(
                8,
                Math.round(finalResolution * this.resolutionFraction),
            ),
        };
        this.group = this.options.generationMode === 'legacy'
            ? createSymmetryAwareIsosurfaces(
                this.field,
                this.structure,
                generationOptions,
                this.regionCache,
            )
            : createPatchCachedIsosurfaces(
                this.field,
                this.structure,
                generationOptions,
                this.patchCache,
            );
        this.group.visible = this.options.visible !== false;
        this.parent.add(this.group);
        return this.group.userData;
    }

    /** Updates colors, opacity, and visibility without rebuilding CPU geometry. */
    updateAppearance() {
        const deformation = this.field?.fieldKind === 'deformation-density';
        this.group.visible = this.options.visible !== false;
        this.group.traverse(object => {
            const sign = object.userData?.sign;
            if (!sign || !object.material) {
                return;
            }
            const color = deformation
                ? sign === 'positive'
                    ? this.options.deformationPositiveColor
                    : this.options.deformationNegativeColor
                : sign === 'positive'
                    ? this.options.positiveColor
                    : this.options.negativeColor;
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            for (const material of materials) {
                material.color?.set(color);
                material.opacity = this.options.opacity;
                material.transparent = this.options.opacity < 1;
                material.depthWrite = this.options.opacity >= 1;
                material.needsUpdate = true;
            }
        });
    }

    /** Removes only the generated mesh while retaining field and structure. */
    clearMesh() {
        if (!this.group) {
            return;
        }
        this.group.traverse(object => {
            object.geometry?.dispose();
            object.material?.dispose();
        });
        this.group.removeFromParent();
        this.group = null;
    }

    clear() {
        this.clearMesh();
        this.patchCache.clear();
        this.regionCache.clear();
        this.field = null;
        this.resolutionFraction = 1;
        this.appearanceOnlyUpdate = false;
    }

    setVisible(visible) {
        const usedVisibility = Boolean(visible);
        this.options.visible = usedVisibility;
        if (this.group) {
            this.group.visible = usedVisibility;
        }
        return usedVisibility;
    }

    get statistics() {
        return this.group?.userData ?? {};
    }

    get displayState() {
        const surface = this.group?.userData;
        return {
            available: Number.isFinite(surface?.level),
            visible: this.group?.visible ?? this.options.visible !== false,
            level: Number.isFinite(surface?.level) ? surface.level : null,
            sigmaLevel: this.field?.contourMode === 'sigma'
                ? Number.isFinite(surface?.sigmaLevel)
                    ? surface.sigmaLevel
                    : this.options.sigmaLevel
                : null,
            sourceType: this.field?.sourceType ?? null,
            fieldKind: this.field?.fieldKind ?? null,
            displayLabel: this.field?.displayLabel ?? 'Scalar field',
            quantityName: this.field?.quantityName ?? 'scalar field',
            signed: this.field?.surfaceSign !== 'positive',
            displayMode: 'isosurface',
        };
    }

    dispose() {
        this.clear();
        this.structure = null;
        this.parent = null;
    }
}
