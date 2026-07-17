/* eslint-disable jsdoc/require-param -- private rendering helpers keep compact documentation */
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import * as math from '../math-lite.js';

export const DEFAULT_DIFFERENCE_DENSITY_OPTIONS = Object.freeze({
    visible: true,
    sigmaLevel: 3,
    radius: 1.5,
    resolution: 48,
    gridSpacing: 0.15,
    maxResolution: 96,
    positiveColor: '#36b566',
    negativeColor: '#d94b64',
    opacity: 0.55,
    wireframe: true,
    maxPolyCount: 100000,
});

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
export function differenceDensityBounds(structure, radius) {
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
 * @param {object} [options] - Difference-density display options.
 * @returns {number} Final surface resolution for this displayed structure.
 */
export function differenceDensitySurfaceResolution(structure, options = {}) {
    const usedOptions = { ...DEFAULT_DIFFERENCE_DENSITY_OPTIONS, ...options };
    const minimumResolution = Math.max(8, Math.round(Number(usedOptions.resolution)));
    const maximumResolution = Math.max(
        minimumResolution,
        Math.round(Number(usedOptions.maxResolution)),
    );
    const gridSpacing = Number(usedOptions.gridSpacing);
    if (!(Number.isFinite(gridSpacing) && gridSpacing > 0)) {
        throw new Error('Difference-density surface grid spacing must be a positive number');
    }
    if (!(Number.isFinite(maximumResolution) && maximumResolution >= 8)) {
        throw new Error('Difference-density maximum surface resolution must be at least 8');
    }

    const bounds = differenceDensityBounds(structure, usedOptions.radius);
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

/** @returns {boolean} Whether a sample lies inside the atom clipping mask. */
function isNearDisplayedAtom(cartesian, atomCoordinates, radiusSquared) {
    for (const atom of atomCoordinates) {
        const dx = cartesian[0] - atom[0];
        const dy = cartesian[1] - atom[1];
        const dz = cartesian[2] - atom[2];
        if (dx * dx + dy * dy + dz * dz <= radiusSquared) {
            return true;
        }
    }
    return false;
}

/** @returns {MarchingCubes} Configured scalar-field surface. */
function createSurface(resolution, material, maxPolyCount, name, level) {
    const surface = new MarchingCubes(resolution, material, false, false, maxPolyCount);
    surface.name = name;
    surface.isolation = level;
    surface.frustumCulled = false;
    surface.userData = {
        selectable: false,
        type: 'difference-density',
        sign: name.includes('Positive') ? 'positive' : 'negative',
    };
    return surface;
}

/**
 * Creates positive and negative difference-density isosurfaces clipped around
 * the atoms in the currently displayed (and potentially symmetry-grown) structure.
 * @param {import('./difference-density.js').DifferenceDensityMap} densityMap - Periodic unit-cell map.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Surface display options.
 * @returns {THREE.Group} Difference-density surface group.
 */
export function createDifferenceDensitySurfaces(densityMap, structure, options = {}) {
    const generationStarted = performance.now();
    const usedOptions = { ...DEFAULT_DIFFERENCE_DENSITY_OPTIONS, ...options };
    const resolution = Math.max(8, Math.round(usedOptions.resolution));
    const level = usedOptions.level ?? usedOptions.sigmaLevel * densityMap.sigma;
    if (!(Number.isFinite(level) && level > 0)) {
        throw new Error('Difference-density contour level must be a positive finite number');
    }
    if (!(Number.isFinite(usedOptions.radius) && usedOptions.radius > 0)) {
        throw new Error('Difference-density radius must be a positive finite number');
    }

    const bounds = differenceDensityBounds(structure, usedOptions.radius);
    const sign = usedOptions.sign ?? 'both';
    if (!['positive', 'negative', 'both'].includes(sign)) {
        throw new Error('Difference-density surface sign must be "positive", "negative", or "both"');
    }
    const renderPositive = sign !== 'negative';
    const renderNegative = sign !== 'positive';
    const positiveMaterial = new THREE.MeshStandardMaterial({
        color: usedOptions.positiveColor,
        transparent: usedOptions.opacity < 1,
        opacity: usedOptions.opacity,
        wireframe: usedOptions.wireframe,
        side: THREE.DoubleSide,
        depthWrite: usedOptions.opacity >= 1,
        roughness: 0.35,
        metalness: 0,
    });
    const negativeMaterial = positiveMaterial.clone();
    negativeMaterial.color.set(usedOptions.negativeColor);

    const positive = renderPositive ? createSurface(
        resolution,
        positiveMaterial,
        usedOptions.maxPolyCount,
        'PositiveDifferenceDensity',
        level,
    ) : null;
    const negative = renderNegative ? createSurface(
        resolution,
        negativeMaterial,
        usedOptions.maxPolyCount,
        'NegativeDifferenceDensity',
        level,
    ) : null;
    if (!positive) {
        positiveMaterial.dispose();
    }
    if (!negative) {
        negativeMaterial.dispose();
    }

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

    for (let z = 0; z < resolution; z++) {
        const fractionalZ = bounds.minimum[2] + ((z - half) / half + 1) * span[2] / 2;
        for (let y = 0; y < resolution; y++) {
            const fractionalY = bounds.minimum[1] + ((y - half) / half + 1) * span[1] / 2;
            const offset = (z * resolution + y) * resolution;
            for (let x = 0; x < resolution; x++) {
                const fractionalX = bounds.minimum[0] + ((x - half) / half + 1) * span[0] / 2;
                const cartesian = cartesianCoordinates(cellMatrix, fractionalX, fractionalY, fractionalZ);
                if (!isNearDisplayedAtom(cartesian, atomCoordinates, radiusSquared)) {
                    continue;
                }
                const value = densityMap.sample(fractionalX, fractionalY, fractionalZ);
                if (positive) {
                    positive.field[offset + x] = value;
                }
                if (negative) {
                    negative.field[offset + x] = -value;
                }
            }
        }
    }

    const polygonizationStarted = performance.now();
    positive?.update();
    negative?.update();
    const polygonizationTimeMs = performance.now() - polygonizationStarted;
    const positivePolygonCount = positive ? positive.geometry.drawRange.count / 3 : 0;
    const negativePolygonCount = negative ? negative.geometry.drawRange.count / 3 : 0;
    const transformation = createFractionalToCartesianMatrix(structure.cell, bounds);
    const surfaces = [positive, negative].filter(Boolean);
    for (const surface of surfaces) {
        surface.matrix.copy(transformation);
        surface.matrixAutoUpdate = false;
    }

    const group = new THREE.Group();
    group.name = 'DifferenceDensity';
    group.visible = usedOptions.visible;
    const generationTimeMs = performance.now() - generationStarted;
    group.userData = {
        selectable: false,
        type: 'difference-density',
        bounds,
        level,
        sigmaLevel: level / densityMap.sigma,
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
        marchingCubesTimeMs: generationTimeMs,
        generationTimeMs,
    };
    group.add(...surfaces);
    return group;
}
