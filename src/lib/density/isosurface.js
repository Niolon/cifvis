/* eslint-disable jsdoc/require-param -- private rendering helpers keep compact documentation */
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import * as math from '../math-lite.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from './isosurface-options.js';
import { extractMarchingCubes } from './isosurface-extractor.js';
import {
    applyAtomCellStencil,
    applyAtomSurfaceStencils,
    createAtomCellStencil,
    planSurfaceLattice,
} from './surface-lattice.js';

export { DEFAULT_ISOSURFACE_OPTIONS } from './isosurface-options.js';

/** @returns {number[]} Cartesian coordinates for a fractional point. */
function cartesianCoordinates(matrix, x, y, z) {
    return [
        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
        matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
    ];
}

/**
 * Calculates the fractional region needed to cover the displayed atoms plus
 * a Cartesian padding radius. Fractional positions outside [0, 1] are kept so
 * fragment and hydrogen-bond growth can display periodic copies of the map.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Padding around atoms in Angstrom.
 * @returns {{minimum: number[], maximum: number[]}} Fractional clipping bounds.
 */
export function isosurfaceBounds(structure, radius) {
    if (!structure?.atoms?.length) {
        return { minimum: [0, 0, 0], maximum: [1, 1, 1] };
    }
    // Each row maps a Cartesian displacement onto one fractional coordinate;
    // its norm is the axis-aligned fractional extent of a Cartesian sphere.
    const cartesianToFractional = math.inv(structure.cell.fractToCartMatrix).toArray();
    const padding = cartesianToFractional.map(row =>
        radius * Math.sqrt(row[0] ** 2 + row[1] ** 2 + row[2] ** 2),
    );
    const minimum = [Infinity, Infinity, Infinity];
    const maximum = [-Infinity, -Infinity, -Infinity];
    for (const atom of structure.atoms) {
        const position = [atom.position.x, atom.position.y, atom.position.z];
        for (let axis = 0; axis < 3; axis++) {
            minimum[axis] = Math.min(minimum[axis], position[axis] - padding[axis]);
            maximum[axis] = Math.max(maximum[axis], position[axis] + padding[axis]);
        }
    }
    return { minimum, maximum };
}

/**
 * Chooses an isotropic marching-cubes resolution from the physical draw size.
 * The configured resolution remains a minimum, while maxResolution prevents
 * the cubic field allocation from growing without bound.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Isosurface display options.
 * @returns {number} Final surface resolution for this displayed structure.
 */
export function isosurfaceResolution(structure, options = {}) {
    const usedOptions = { ...DEFAULT_ISOSURFACE_OPTIONS, ...options };
    const minimumResolution = Math.max(8, Math.round(Number(usedOptions.resolution)));
    const maximumResolution = Math.max(
        minimumResolution,
        Math.round(Number(usedOptions.maxResolution)),
    );
    const gridSpacing = Number(usedOptions.gridSpacing);
    if (!(Number.isFinite(gridSpacing) && gridSpacing > 0)) {
        throw new Error('Isosurface grid spacing must be a positive number');
    }
    if (!(Number.isFinite(maximumResolution) && maximumResolution >= 8)) {
        throw new Error('Maximum isosurface resolution must be at least 8');
    }

    const bounds = isosurfaceBounds(structure, usedOptions.radius);
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const edgeLengths = bounds.maximum.map((maximum, axis) => {
        const span = maximum - bounds.minimum[axis];
        return span * Math.hypot(matrix[0][axis], matrix[1][axis], matrix[2][axis]);
    });
    const resolutionForSpacing = Math.ceil(Math.max(...edgeLengths) / gridSpacing) + 1;
    return Math.min(maximumResolution, Math.max(minimumResolution, resolutionForSpacing));
}

/** @returns {THREE.Matrix4} Transform from marching-cube coordinates to Cartesian coordinates. */
function createFractionalToCartesianMatrix(cell, bounds) {
    const matrix = cell.fractToCartMatrix.toArray();
    const span = bounds.maximum.map((value, index) => value - bounds.minimum[index]);
    const centre = bounds.minimum.map((value, index) => value + span[index] / 2);
    const translation = cartesianCoordinates(matrix, ...centre);

    return new THREE.Matrix4().set(
        matrix[0][0] * span[0] / 2,
        matrix[0][1] * span[1] / 2,
        matrix[0][2] * span[2] / 2,
        translation[0],
        matrix[1][0] * span[0] / 2,
        matrix[1][1] * span[1] / 2,
        matrix[1][2] * span[2] / 2,
        translation[1],
        matrix[2][0] * span[0] / 2,
        matrix[2][1] * span[1] / 2,
        matrix[2][2] * span[2] / 2,
        translation[2],
        0, 0, 0, 1,
    );
}

/** @returns {THREE.Matrix4} Transform from fractional to Cartesian coordinates. */
function createCellMatrix(cell) {
    const matrix = cell.fractToCartMatrix.toArray();
    return new THREE.Matrix4().set(
        matrix[0][0], matrix[0][1], matrix[0][2], 0,
        matrix[1][0], matrix[1][1], matrix[1][2], 0,
        matrix[2][0], matrix[2][1], matrix[2][2], 0,
        0, 0, 0, 1,
    );
}

/** @returns {boolean} Whether a sample lies inside the atom clipping mask. */
function isNearDisplayedAtom(cartesian, atomCoordinates, radiusSquared, counters = null) {
    for (const atom of atomCoordinates) {
        if (counters) {
            counters.atomDistanceTestCount++;
        }
        const dx = cartesian[0] - atom[0];
        const dy = cartesian[1] - atom[1];
        const dz = cartesian[2] - atom[2];
        if (dx * dx + dy * dy + dz * dz <= radiusSquared) {
            return true;
        }
    }
    return false;
}

/** @returns {THREE.Material} Surface material matching the established renderer. */
function surfaceMaterial(options, color) {
    const MaterialClass = options.wireframe ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
    const materialOptions = {
        color,
        transparent: options.opacity < 1,
        opacity: options.opacity,
        wireframe: options.wireframe,
        side: THREE.DoubleSide,
        depthWrite: options.opacity >= 1,
    };
    if (!options.wireframe) {
        materialOptions.roughness = 0.35;
        materialOptions.metalness = 0;
    }
    return new MaterialClass(materialOptions);
}

/** @returns {THREE.Mesh} Numerical surface adapted to a renderable mesh. */
function typedArraySurface(data, material, name, transformation) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setDrawRange(0, data.positions.length / 3);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const surface = new THREE.Mesh(geometry, material);
    surface.name = name;
    surface.userData = {
        selectable: false,
        type: 'isosurface',
        sign: name.includes('Positive') ? 'positive' : 'negative',
    };
    surface.matrix.copy(transformation);
    surface.matrixAutoUpdate = false;
    return surface;
}

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
export function wireframeFromSurface(surface, color, opacity) {
    const trimmed = surface.geometry.index
        ? surface.geometry
        : trimToDrawRange(surface.geometry);
    const edges = new THREE.EdgesGeometry(trimmed);
    if (trimmed !== surface.geometry) {
        trimmed.dispose();
    }
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
    }));
    lines.name = surface.name;
    lines.userData = surface.userData;
    lines.matrix.copy(surface.matrix);
    lines.matrixAutoUpdate = surface.matrixAutoUpdate;
    return lines;
}

/** @returns {THREE.BufferGeometry} Copy of a non-indexed geometry trimmed to its draw range. */
function trimToDrawRange(geometry) {
    const { start, count } = geometry.drawRange;
    const trimmed = new THREE.BufferGeometry();
    for (const [attributeName, attribute] of Object.entries(geometry.attributes)) {
        trimmed.setAttribute(
            attributeName,
            new THREE.BufferAttribute(
                attribute.array.slice(
                    start * attribute.itemSize,
                    (start + count) * attribute.itemSize,
                ),
                attribute.itemSize,
                attribute.normalized,
            ),
        );
    }
    return trimmed;
}

/** @returns {MarchingCubes} Configured scalar-field surface. */
function createSurface(resolution, material, maxPolyCount, name, level) {
    const surface = new MarchingCubes(resolution, material, false, false, maxPolyCount);
    surface.name = name;
    surface.isolation = level;
    surface.userData = {
        selectable: false,
        type: 'isosurface',
        sign: name.includes('Positive') ? 'positive' : 'negative',
    };
    return surface;
}

/** @returns {THREE.Group} Typed-array CifVis extraction adapted to Three.js. */
function createCifvisIsosurfaces(
    field,
    structure,
    usedOptions,
    bounds,
    level,
    sign,
    boundsTimeMs,
    generationStarted,
) {
    const maskStarted = performance.now();
    const resolution = Math.max(8, Math.round(usedOptions.resolution));
    const lattice = planSurfaceLattice(structure.cell, bounds, resolution);
    const stencil = createAtomCellStencil(lattice, usedOptions.radius);
    const useNodeStencil = usedOptions.surfaceNodeStencil !== false;
    const atomStencils = useNodeStencil
        ? applyAtomSurfaceStencils(lattice, structure.atoms ?? [], stencil)
        : null;
    const applied = atomStencils
        ? {
            mask: atomStencils.cellMask,
            candidateCellCount: atomStencils.candidateCellCount,
            activeCellCount: atomStencils.activeCellCount,
        }
        : applyAtomCellStencil(lattice, structure.atoms ?? [], stencil);
    const allowedNodes = atomStencils
        ? {
            mask: atomStencils.nodeMask,
            candidateNodeCount: atomStencils.candidateNodeCount,
            allowedNodeCount: atomStencils.allowedNodeCount,
        }
        : null;
    const surfaceMaskTimeMs = performance.now() - maskStarted;
    const extracted = extractMarchingCubes({
        lattice,
        activeCellMask: applied.mask,
        activeCellCount: applied.activeCellCount,
        field,
        level,
        signs: sign,
        samplingMode: usedOptions.surfaceSamplingMode ?? 'auto',
        nodeTraversal: usedOptions.surfaceNodeTraversal ?? 'active-list',
        allowedNodeMask: allowedNodes?.mask ?? null,
    });

    const geometryStarted = performance.now();
    const positiveMaterial = surfaceMaterial(usedOptions, usedOptions.positiveColor);
    const negativeMaterial = surfaceMaterial(usedOptions, usedOptions.negativeColor);
    const transformation = createCellMatrix(structure.cell);
    const renderPositive = sign !== 'negative';
    const renderNegative = sign !== 'positive';
    const positive = renderPositive ? typedArraySurface(
        extracted.positive,
        positiveMaterial,
        'PositiveIsosurface',
        transformation,
    ) : null;
    const negative = renderNegative ? typedArraySurface(
        extracted.negative,
        negativeMaterial,
        'NegativeIsosurface',
        transformation,
    ) : null;
    if (!positive) {
        positiveMaterial.dispose();
    }
    if (!negative) {
        negativeMaterial.dispose();
    }
    const surfaces = [positive, negative].filter(Boolean);
    const surfaceGeometryTimeMs = performance.now() - geometryStarted;
    const allocatedGeometryBytes = surfaces.reduce((sum, surface) =>
        sum + Object.values(surface.geometry.attributes).reduce(
            (attributeSum, attribute) => attributeSum + attribute.array.byteLength, 0,
        ), 0);

    const wireframeStarted = performance.now();
    let generatedLineSegmentCount = 0;
    const renderedSurfaces = usedOptions.wireframe && !usedOptions.keepTriangles
        ? surfaces.map(surface => {
            const lines = wireframeFromSurface(surface, surface.material.color, usedOptions.opacity);
            generatedLineSegmentCount += lines.geometry.getAttribute('position')?.count / 2 || 0;
            surface.geometry.dispose();
            surface.material.dispose();
            return lines;
        })
        : surfaces;
    const surfaceWireframeTimeMs = performance.now() - wireframeStarted;
    const group = new THREE.Group();
    group.name = 'Isosurface';
    group.visible = usedOptions.visible;
    group.add(...renderedSurfaces);
    const statistics = extracted.statistics;
    const surfaceTotalTimeMs = performance.now() - generationStarted;
    group.userData = {
        selectable: false,
        type: 'isosurface',
        bounds,
        level,
        sigmaLevel: Number.isFinite(field.sigma) && field.sigma !== 0
            ? level / field.sigma
            : null,
        resolution,
        positivePolygonCount: statistics.positiveTriangleCount,
        negativePolygonCount: statistics.negativeTriangleCount,
        polygonCount: statistics.positiveTriangleCount + statistics.negativeTriangleCount,
        symmetryUsed: false,
        displayedRegionCount: 1,
        generatedRegionCount: 1,
        reusedRegionCount: 0,
        marchingCubesPassCount: 1,
        stitched: false,
        stitchTimeMs: 0,
        removedDuplicateTriangleCount: 0,
        polygonizationTimeMs: statistics.surfaceClassificationTimeMs +
            statistics.surfaceAllocationTimeMs + statistics.surfaceInterpolationTimeMs,
        marchingCubesTimeMs: statistics.extractorTimeMs,
        generationTimeMs: surfaceTotalTimeMs,
        surfaceExtractor: 'cifvis',
        surfaceBoundsTimeMs: boundsTimeMs,
        surfaceMaskTimeMs,
        surfaceSamplingTimeMs: statistics.surfaceSamplingTimeMs,
        surfaceClassificationTimeMs: statistics.surfaceClassificationTimeMs,
        surfaceAllocationTimeMs: statistics.surfaceAllocationTimeMs,
        surfaceInterpolationTimeMs: statistics.surfaceInterpolationTimeMs,
        surfaceGeometryTimeMs,
        surfaceWireframeTimeMs,
        surfaceSymmetryAssemblyTimeMs: 0,
        surfaceTotalTimeMs,
        surfaceLatticeNodeCount: statistics.surfaceLatticeNodeCount,
        surfaceLatticeCellCount: statistics.surfaceLatticeCellCount,
        candidateCellCount: applied.candidateCellCount,
        activeCellCount: applied.activeCellCount,
        activeRowCount: statistics.activeRowCount,
        activeSurfaceCellCount: statistics.activeSurfaceCellCount,
        fieldSampleCount: statistics.fieldSampleCount,
        activeNodeCount: statistics.activeNodeCount,
        allowedNodeCount: allowedNodes?.allowedNodeCount ?? lattice.nodeCount,
        candidateNodeCount: allowedNodes?.candidateNodeCount ?? lattice.nodeCount,
        surfaceSamplingBackend: statistics.samplingBackend,
        surfaceNodeTraversal: statistics.nodeTraversal,
        surfaceNodeStencil: useNodeStencil,
        positiveTriangleCount: statistics.positiveTriangleCount,
        negativeTriangleCount: statistics.negativeTriangleCount,
        generatedVertexCount: statistics.generatedVertexCount,
        generatedLineSegmentCount,
        allocatedGeometryBytes,
        atomDistanceTestCount: 0,
        threeMarchingCubesTimeMs: 0,
        stencilOffsetCount: stencil.count,
        nodeStencilOffsetCount: useNodeStencil ? stencil.count : 0,
        stencilRadius: stencil.radius,
        clippingConservativeVoxelPadding: lattice.cellDiagonal,
    };
    return group;
}

/**
 * Creates positive and negative isosurfaces clipped around
 * the atoms in the currently displayed (and potentially symmetry-grown) structure.
 * @param {object} field - Sampled scalar field.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Surface display options.
 * @returns {THREE.Group} Isosurface group.
 */
export function createIsosurfaces(field, structure, options = {}) {
    const generationStarted = performance.now();
    const usedOptions = { ...DEFAULT_ISOSURFACE_OPTIONS, ...options };
    const resolution = Math.max(8, Math.round(usedOptions.resolution));
    const level = usedOptions.level ?? field.defaultLevel ??
        usedOptions.sigmaLevel * field.sigma;
    if (!(Number.isFinite(level) && level > 0)) {
        throw new Error('Isosurface level must be a positive finite number');
    }
    if (!(Number.isFinite(usedOptions.radius) && usedOptions.radius > 0)) {
        throw new Error('Isosurface radius must be a positive finite number');
    }

    const boundsStarted = performance.now();
    const bounds = isosurfaceBounds(structure, usedOptions.radius);
    const boundsTimeMs = performance.now() - boundsStarted;
    const sign = usedOptions.sign ?? field.surfaceSign ?? 'both';
    if (!['positive', 'negative', 'both'].includes(sign)) {
        throw new Error('Isosurface sign must be "positive", "negative", or "both"');
    }
    const renderPositive = sign !== 'negative';
    const renderNegative = sign !== 'positive';
    if (!['three-marching-cubes', 'cifvis'].includes(usedOptions.surfaceExtractor)) {
        throw new Error(
            'Isosurface surfaceExtractor must be "three-marching-cubes" or "cifvis"',
        );
    }
    if (usedOptions.surfaceExtractor === 'cifvis') {
        return createCifvisIsosurfaces(
            field,
            structure,
            usedOptions,
            bounds,
            level,
            sign,
            boundsTimeMs,
            generationStarted,
        );
    }
    const allocationStarted = performance.now();
    const positiveMaterial = surfaceMaterial(usedOptions, usedOptions.positiveColor);
    const negativeMaterial = surfaceMaterial(usedOptions, usedOptions.negativeColor);
    const positive = renderPositive ? createSurface(
        resolution,
        positiveMaterial,
        usedOptions.maxPolyCount,
        'PositiveIsosurface',
        level,
    ) : null;
    const negative = renderNegative ? createSurface(
        resolution,
        negativeMaterial,
        usedOptions.maxPolyCount,
        'NegativeIsosurface',
        level,
    ) : null;
    if (!positive) {
        positiveMaterial.dispose();
    }
    if (!negative) {
        negativeMaterial.dispose();
    }
    const surfaceAllocationTimeMs = performance.now() - allocationStarted;

    const span = bounds.maximum.map((value, index) => value - bounds.minimum[index]);
    const half = resolution / 2;
    const cellMatrix = structure.cell.fractToCartMatrix.toArray();
    const atomCoordinates = structure.atoms.map(atom => cartesianCoordinates(
        cellMatrix,
        atom.position.x,
        atom.position.y,
        atom.position.z,
    ));
    const radiusSquared = usedOptions.radius ** 2;
    const nodeMask = new Uint8Array(resolution ** 3);
    const counters = { atomDistanceTestCount: 0 };

    const maskStarted = performance.now();
    for (let z = 0; z < resolution; z++) {
        const fractionalZ = bounds.minimum[2] + ((z - half) / half + 1) * span[2] / 2;
        for (let y = 0; y < resolution; y++) {
            const fractionalY = bounds.minimum[1] + ((y - half) / half + 1) * span[1] / 2;
            const offset = (z * resolution + y) * resolution;
            for (let x = 0; x < resolution; x++) {
                const fractionalX = bounds.minimum[0] + ((x - half) / half + 1) * span[0] / 2;
                const cartesian = cartesianCoordinates(cellMatrix, fractionalX, fractionalY, fractionalZ);
                if (isNearDisplayedAtom(
                    cartesian, atomCoordinates, radiusSquared, counters,
                )) {
                    nodeMask[offset + x] = 1;
                }
            }
        }
    }
    const surfaceMaskTimeMs = performance.now() - maskStarted;

    const samplingStarted = performance.now();
    let fieldSampleCount = 0;
    for (let z = 0; z < resolution; z++) {
        const fractionalZ = bounds.minimum[2] + ((z - half) / half + 1) * span[2] / 2;
        for (let y = 0; y < resolution; y++) {
            const fractionalY = bounds.minimum[1] + ((y - half) / half + 1) * span[1] / 2;
            const offset = (z * resolution + y) * resolution;
            for (let x = 0; x < resolution; x++) {
                if (!nodeMask[offset + x]) {
                    continue;
                }
                const fractionalX = bounds.minimum[0] + ((x - half) / half + 1) * span[0] / 2;
                const value = field.sample(fractionalX, fractionalY, fractionalZ);
                fieldSampleCount++;
                if (positive) {
                    positive.field[offset + x] = value;
                }
                if (negative) {
                    negative.field[offset + x] = -value;
                }
            }
        }
    }
    const surfaceSamplingTimeMs = performance.now() - samplingStarted;

    const classificationStarted = performance.now();
    const cellResolution = resolution - 1;
    let activeCellCount = 0;
    let activeRowCount = 0;
    for (let z = 0; z < cellResolution; z++) {
        for (let y = 0; y < cellResolution; y++) {
            let rowActive = false;
            for (let x = 0; x < cellResolution; x++) {
                const node = (z * resolution + y) * resolution + x;
                const active = nodeMask[node] || nodeMask[node + 1] ||
                    nodeMask[node + resolution] || nodeMask[node + resolution + 1] ||
                    nodeMask[node + resolution ** 2] || nodeMask[node + resolution ** 2 + 1] ||
                    nodeMask[node + resolution ** 2 + resolution] ||
                    nodeMask[node + resolution ** 2 + resolution + 1];
                if (active) {
                    activeCellCount++;
                    rowActive = true;
                }
            }
            activeRowCount += Number(rowActive);
        }
    }
    const surfaceClassificationTimeMs = performance.now() - classificationStarted;

    const polygonizationStarted = performance.now();
    positive?.update();
    negative?.update();
    const polygonizationTimeMs = performance.now() - polygonizationStarted;
    const positivePolygonCount = positive ? positive.geometry.drawRange.count / 3 : 0;
    const negativePolygonCount = negative ? negative.geometry.drawRange.count / 3 : 0;
    const geometryStarted = performance.now();
    const transformation = createFractionalToCartesianMatrix(structure.cell, bounds);
    const surfaces = [positive, negative].filter(Boolean);
    for (const surface of surfaces) {
        surface.matrix.copy(transformation);
        surface.matrixAutoUpdate = false;
    }

    const group = new THREE.Group();
    group.name = 'Isosurface';
    group.visible = usedOptions.visible;
    const surfaceGeometryTimeMs = performance.now() - geometryStarted;
    const generatedVertexCount = surfaces.reduce(
        (sum, surface) => sum + surface.geometry.drawRange.count, 0,
    );
    const allocatedGeometryBytes = surfaces.reduce((sum, surface) =>
        sum + Object.values(surface.geometry.attributes).reduce(
            (attributeSum, attribute) => attributeSum + attribute.array.byteLength, 0,
        ), 0);
    const wireframeStarted = performance.now();
    let generatedLineSegmentCount = 0;
    const renderedSurfaces = usedOptions.wireframe && !usedOptions.keepTriangles
        ? surfaces.map(surface => {
            const lines = wireframeFromSurface(surface, surface.material.color, usedOptions.opacity);
            generatedLineSegmentCount += lines.geometry.getAttribute('position')?.count / 2 || 0;
            surface.geometry.dispose();
            surface.material.dispose();
            return lines;
        })
        : surfaces;
    const surfaceWireframeTimeMs = performance.now() - wireframeStarted;
    group.add(...renderedSurfaces);
    const surfaceTotalTimeMs = performance.now() - generationStarted;
    group.userData = {
        selectable: false,
        type: 'isosurface',
        bounds,
        level,
        sigmaLevel: Number.isFinite(field.sigma) && field.sigma !== 0
            ? level / field.sigma
            : null,
        resolution,
        positivePolygonCount,
        negativePolygonCount,
        polygonCount: positivePolygonCount + negativePolygonCount,
        symmetryUsed: false,
        displayedRegionCount: 1,
        generatedRegionCount: 1,
        reusedRegionCount: 0,
        marchingCubesPassCount: surfaces.length,
        stitched: false,
        stitchTimeMs: 0,
        removedDuplicateTriangleCount: 0,
        polygonizationTimeMs,
        marchingCubesTimeMs: surfaceTotalTimeMs,
        generationTimeMs: surfaceTotalTimeMs,
        surfaceExtractor: 'three-marching-cubes',
        surfaceBoundsTimeMs: boundsTimeMs,
        surfaceMaskTimeMs,
        surfaceSamplingTimeMs,
        surfaceClassificationTimeMs,
        surfaceAllocationTimeMs,
        surfaceInterpolationTimeMs: polygonizationTimeMs,
        surfaceGeometryTimeMs,
        surfaceWireframeTimeMs,
        surfaceSymmetryAssemblyTimeMs: 0,
        surfaceTotalTimeMs,
        surfaceLatticeNodeCount: resolution ** 3,
        surfaceLatticeCellCount: cellResolution ** 3,
        candidateCellCount: cellResolution ** 3,
        activeCellCount,
        activeRowCount,
        fieldSampleCount,
        positiveTriangleCount: positivePolygonCount,
        negativeTriangleCount: negativePolygonCount,
        generatedVertexCount,
        generatedLineSegmentCount,
        allocatedGeometryBytes,
        atomDistanceTestCount: counters.atomDistanceTestCount,
        threeMarchingCubesTimeMs: polygonizationTimeMs,
    };
    return group;
}
