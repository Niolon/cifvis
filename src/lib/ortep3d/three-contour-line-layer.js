import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { calculatePlanarContours } from '../density/plane-contours.js';

/** @returns {number} Monotonic high-resolution time where available. */
function now() {
    return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Flattens Cartesian line segments into a Three.js position array.
 * @param {number[][][]} segments - Cartesian endpoint pairs.
 * @returns {Float32Array} Packed xyz positions.
 */
function segmentPositions(segments) {
    return ArrayBuffer.isView(segments)
        ? segments
        : new Float32Array(segments.flat(2));
}

/**
 * @param {number[][][]|Float32Array} segments - Nested or packed endpoints.
 * @returns {number} Number of endpoint pairs in nested or packed segments.
 */
function segmentCount(segments) {
    return ArrayBuffer.isView(segments) ? segments.length / 6 : segments.length;
}

/**
 * Three.js adapter for renderer-independent planar contours. The adapter only
 * creates screen-space line primitives: it deliberately has no plane or
 * background fill.
 */
export class ThreeContourLineLayer {
    constructor(parent, options = {}) {
        this.parent = parent;
        this.options = { ...options };
        this.field = null;
        this.structure = null;
        this.group = null;
    }

    setField(field) {
        this.field = field;
    }

    setStructure(structure) {
        this.structure = structure;
    }

    setOptions(options = {}) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Adds one signed collection of contour segments.
     * @param {THREE.Group} group - Contour parent.
     * @param {number[][][]} segments - Cartesian endpoint pairs.
     * @param {string} sign - Signed contour category.
     * @param {THREE.ColorRepresentation} color - Line colour.
     */
    addSegments(group, segments, sign, color) {
        const count = segmentCount(segments);
        if (count === 0) {
            return;
        }
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(segmentPositions(segments));
        const material = new LineMaterial({
            color,
            linewidth: this.options.lineWidth,
            opacity: this.options.opacity,
            transparent: this.options.opacity < 1,
            depthWrite: false,
            worldUnits: false,
            alphaToCoverage: true,
        });
        const lines = new LineSegments2(geometry, material);
        lines.name = `${sign[0].toUpperCase()}${sign.slice(1)} contour lines`;
        lines.userData.sign = sign;
        lines.userData.segmentCount = count;
        group.add(lines);
    }

    /** @returns {object|null} Generated contour statistics, or null without input. */
    rebuild() {
        const started = now();
        this.clearMesh();
        if (!this.field || !this.structure) {
            return null;
        }
        const contours = calculatePlanarContours(this.field, this.structure, this.options);
        return this.buildContours(contours, started);
    }

    /**
     * Installs contours calculated outside the rendering thread.
     * @param {object} contours - Nested or packed planar-contour result.
     * @returns {object|null} Generated contour statistics.
     */
    rebuildFromContours(contours) {
        const started = now();
        this.clearMesh();
        if (!this.field || !contours) {
            return null;
        }
        return this.buildContours(contours, started);
    }

    /**
     * @param {object} contours - Calculated nested or packed contours.
     * @param {number} started - Geometry installation start time.
     * @returns {object} Three.js geometry statistics for a calculated contour result.
     */
    buildContours(contours, started) {
        const deformation = this.field.fieldKind === 'deformation-density';
        const positiveColor = this.options.lineColor ?? (deformation
            ? this.options.deformationPositiveColor
            : this.options.positiveColor);
        const negativeColor = this.options.lineColor ?? (deformation
            ? this.options.deformationNegativeColor
            : this.options.negativeColor);
        const geometryStarted = now();
        const group = new THREE.Group();
        group.name = 'Planar contour lines';
        this.addSegments(group, contours.positiveSegments, 'positive', positiveColor);
        this.addSegments(group, contours.negativeSegments, 'negative', negativeColor);
        this.addSegments(group, contours.zeroSegments, 'zero', this.options.zeroColor);
        const geometryCompleted = now();
        group.userData = {
            displayMode: 'contour-lines',
            level: contours.level,
            sigmaLevel: Number.isFinite(this.field.sigma) && this.field.sigma !== 0
                ? contours.level / this.field.sigma
                : null,
            levels: contours.levels,
            dimensions: contours.dimensions,
            plane: contours.plane,
            segmentCount: contours.segmentCount,
            positiveSegmentCount: segmentCount(contours.positiveSegments),
            negativeSegmentCount: segmentCount(contours.negativeSegments),
            zeroSegmentCount: segmentCount(contours.zeroSegments),
            polygonCount: 0,
            resolution: Math.max(...contours.dimensions),
            planeSetupTimeMs: contours.timings.planeSetupTimeMs,
            samplingTimeMs: contours.timings.samplingTimeMs,
            contourExtractionTimeMs: contours.timings.contourExtractionTimeMs,
            calculationTimeMs: contours.timings.totalTimeMs,
            geometryTimeMs: geometryCompleted - geometryStarted,
            generationTimeMs: geometryCompleted - started,
        };
        group.visible = this.options.visible !== false;
        this.group = group;
        this.parent.add(group);
        return group.userData;
    }

    /** Removes only generated lines while retaining the field and structure. */
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
        const contours = this.group?.userData;
        return {
            available: Number.isFinite(contours?.level),
            visible: this.group?.visible ?? this.options.visible !== false,
            level: Number.isFinite(contours?.level) ? contours.level : null,
            sigmaLevel: this.field?.contourMode === 'sigma'
                ? Number.isFinite(contours?.sigmaLevel)
                    ? contours.sigmaLevel
                    : this.options.sigmaLevel
                : null,
            sourceType: this.field?.sourceType ?? null,
            fieldKind: this.field?.fieldKind ?? null,
            displayLabel: this.field?.displayLabel ?? 'Scalar field',
            quantityName: this.field?.quantityName ?? 'scalar field',
            signed: this.field?.surfaceSign !== 'positive',
            displayMode: 'contour-lines',
            segmentCount: contours?.segmentCount ?? 0,
            contourLevels: contours?.levels ?? [],
        };
    }

    dispose() {
        this.clear();
        this.structure = null;
        this.parent = null;
    }
}
