import { isosurfaceResolution } from '../density/isosurface.js';
import { createSymmetryAwareIsosurfaces } from '../density/symmetry-isosurface.js';

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
    }

    setField(field, resolutionFraction = 1) {
        this.field = field;
        this.resolutionFraction = resolutionFraction;
    }

    setStructure(structure) {
        this.structure = structure;
    }

    setOptions(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Rebuilds the mesh for the current field and displayed structure.
     * @returns {object|null} Generated surface statistics, or null without input.
     */
    rebuild() {
        this.clearMesh();
        if (!this.field || !this.structure) {
            return null;
        }
        const finalResolution = isosurfaceResolution(this.structure, this.options);
        const fieldColors = this.field.fieldKind === 'deformation-density'
            ? {
                positiveColor: this.options.deformationPositiveColor,
                negativeColor: this.options.deformationNegativeColor,
            }
            : {};
        this.group = createSymmetryAwareIsosurfaces(
            this.field,
            this.structure,
            {
                ...this.options,
                ...fieldColors,
                resolution: Math.max(
                    8,
                    Math.round(finalResolution * this.resolutionFraction),
                ),
            },
        );
        this.group.visible = this.options.visible !== false;
        this.parent.add(this.group);
        return this.group.userData;
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
        this.field = null;
        this.resolutionFraction = 1;
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
