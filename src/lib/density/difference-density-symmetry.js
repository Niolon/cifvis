/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- private geometry helpers */
import * as THREE from 'three';
import * as math from '../math-lite.js';
import {
    createDifferenceDensitySurfaces,
    DEFAULT_DIFFERENCE_DENSITY_OPTIONS,
    differenceDensityBounds,
} from './difference-density-surface.js';

const POSITION_TOLERANCE_ANGSTROM = 1e-4;

/** @returns {number[]} Cartesian coordinates for a fractional point. */
function cartesianCoordinates(matrix, position) {
    return [
        matrix[0][0] * position[0] + matrix[0][1] * position[1] + matrix[0][2] * position[2],
        matrix[1][0] * position[0] + matrix[1][1] * position[1] + matrix[1][2] * position[2],
        matrix[2][0] * position[0] + matrix[2][1] * position[1] + matrix[2][2] * position[2],
    ];
}

/** @returns {number} Squared Euclidean distance. */
function distanceSquared(first, second) {
    return first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0);
}

/** @returns {number[]} Plain array for math-lite array/matrix results. */
function plainArray(value) {
    return Array.isArray(value) ? value : value.toArray();
}

/** @returns {number} Longest physical edge of fractional bounds. */
function longestBoundsEdge(cell, bounds) {
    const matrix = cell.fractToCartMatrix.toArray();
    return Math.max(...bounds.maximum.map((maximum, axis) => {
        const span = maximum - bounds.minimum[axis];
        return span * Math.hypot(matrix[0][axis], matrix[1][axis], matrix[2][axis]);
    }));
}

/** Union-find root with path compression. */
function findRoot(parents, index) {
    let root = index;
    while (parents[root] !== root) {
        root = parents[root];
    }
    while (parents[index] !== index) {
        const parent = parents[index];
        parents[index] = root;
        index = parent;
    }
    return root;
}

/** Joins two union-find sets. */
function joinRoots(parents, first, second) {
    const firstRoot = findRoot(parents, first);
    const secondRoot = findRoot(parents, second);
    if (firstRoot !== secondRoot) {
        parents[secondRoot] = firstRoot;
    }
}

/**
 * Groups atom-radius masks into connected regions. Intersecting masks always
 * remain in one marching-cubes field, so symmetry reuse cannot introduce an
 * internal clipping boundary or remove an isosurface bridge.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Density clipping radius in Angstrom.
 * @param {number} [connectionMargin] - Extra conservative grid-scale overlap.
 * @returns {Array<{atoms: object[]}>} Connected atom-mask regions.
 */
export function connectedDifferenceDensityRegions(structure, radius, connectionMargin = 0) {
    const atoms = structure?.atoms ?? [];
    if (atoms.length === 0) {
        return [];
    }
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const coordinates = atoms.map(atom => cartesianCoordinates(
        matrix,
        [atom.position.x, atom.position.y, atom.position.z],
    ));
    const parents = atoms.map((_, index) => index);
    const connectionDistanceSquared = (2 * radius + connectionMargin) ** 2;
    for (let first = 0; first < atoms.length; first++) {
        for (let second = first + 1; second < atoms.length; second++) {
            if (distanceSquared(coordinates[first], coordinates[second]) <= connectionDistanceSquared) {
                joinRoots(parents, first, second);
            }
        }
    }

    const regionsByRoot = new Map();
    for (let index = 0; index < atoms.length; index++) {
        const root = findRoot(parents, index);
        if (!regionsByRoot.has(root)) {
            regionsByRoot.set(root, { atoms: [] });
        }
        regionsByRoot.get(root).atoms.push(atoms[index]);
    }
    return Array.from(regionsByRoot.values());
}

/** @returns {boolean} Whether a contour can pass through two overlapping atom masks. */
function overlapContainsContour(
    first,
    second,
    radius,
    densityMap,
    cartesianToFractional,
    level,
    sign,
) {
    const minimum = first.map((value, axis) => Math.max(value - radius, second[axis] - radius));
    const maximum = first.map((value, axis) => Math.min(value + radius, second[axis] + radius));
    if (minimum.some((value, axis) => value > maximum[axis])) {
        return false;
    }
    const sampleCount = 9;
    const radiusSquared = radius ** 2;
    for (let z = 0; z < sampleCount; z++) {
        const cartesianZ = minimum[2] + (maximum[2] - minimum[2]) * z / (sampleCount - 1);
        for (let y = 0; y < sampleCount; y++) {
            const cartesianY = minimum[1] + (maximum[1] - minimum[1]) * y / (sampleCount - 1);
            for (let x = 0; x < sampleCount; x++) {
                const point = [
                    minimum[0] + (maximum[0] - minimum[0]) * x / (sampleCount - 1),
                    cartesianY,
                    cartesianZ,
                ];
                if (distanceSquared(point, first) > radiusSquared ||
                    distanceSquared(point, second) > radiusSquared) {
                    continue;
                }
                const fractional = cartesianCoordinates(cartesianToFractional, point);
                const value = densityMap.sample(...fractional);
                if ((sign !== 'negative' && value >= level) ||
                    (sign !== 'positive' && value <= -level)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Groups masks only when the requested contour can traverse their overlap.
 * This is the seam-safety test used by symmetry reuse: active overlaps are
 * tessellated together, whereas inactive overlaps cannot contain a shared
 * contour and are safe to generate independently.
 * @param {object} structure - Displayed CrystalStructure.
 * @param {number} radius - Density clipping radius in Angstrom.
 * @param {object} densityMap - Periodic difference-density map.
 * @param {number} level - Positive absolute contour level.
 * @returns {Array<{atoms: object[]}>} Contour-connected atom-mask regions.
 */
export function contourConnectedDifferenceDensityRegions(
    structure,
    radius,
    densityMap,
    level,
    sign = 'both',
) {
    const atoms = structure?.atoms ?? [];
    if (atoms.length === 0) {
        return [];
    }
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const inverseMatrix = plainArray(math.inv(matrix));
    const coordinates = atoms.map(atom => cartesianCoordinates(
        matrix,
        [atom.position.x, atom.position.y, atom.position.z],
    ));
    const parents = atoms.map((_, index) => index);
    const overlapDistanceSquared = (2 * radius) ** 2;
    for (let first = 0; first < atoms.length; first++) {
        for (let second = first + 1; second < atoms.length; second++) {
            const separationSquared = distanceSquared(coordinates[first], coordinates[second]);
            if (separationSquared > overlapDistanceSquared) {
                continue;
            }
            if (separationSquared <= POSITION_TOLERANCE_ANGSTROM ** 2 || overlapContainsContour(
                coordinates[first],
                coordinates[second],
                radius,
                densityMap,
                inverseMatrix,
                level,
                sign,
            )) {
                joinRoots(parents, first, second);
            }
        }
    }

    const regionsByRoot = new Map();
    for (let index = 0; index < atoms.length; index++) {
        const root = findRoot(parents, index);
        if (!regionsByRoot.has(root)) {
            regionsByRoot.set(root, { atoms: [] });
        }
        regionsByRoot.get(root).atoms.push(atoms[index]);
    }
    return Array.from(regionsByRoot.values());
}

/** @returns {string} Fast rejection signature for symmetry matching. */
function regionSignature(region) {
    return region.atoms.map(atom =>
        `${atom.label}\u0000${atom.atomType}\u0000${atom.disorderGroup}`,
    ).sort().join('\u0001');
}

/** @returns {boolean} Whether two atoms represent the same asymmetric site. */
function sameSiteIdentity(first, second) {
    return first.label === second.label &&
        first.atomType === second.atomType &&
        Number(first.disorderGroup) === Number(second.disorderGroup);
}

/** @returns {number[]} Fractional point after a symmetry and lattice translation. */
function transformFractional(operation, latticeTranslation, position) {
    const rotated = plainArray(math.multiply(operation.rotation, position));
    return rotated.map((value, axis) =>
        value + operation.translation[axis] + latticeTranslation[axis],
    );
}

/**
 * Tests one exact crystallographic operation between two connected regions.
 * @returns {{rotation: number[][], translation: number[]}|null} Full fractional transform.
 */
function matchOperation(source, target, operation, cellMatrix) {
    const sourceAnchor = source.atoms[0];
    const anchorPosition = [
        sourceAnchor.position.x,
        sourceAnchor.position.y,
        sourceAnchor.position.z,
    ];
    const operatedAnchor = transformFractional(operation, [0, 0, 0], anchorPosition);
    const targetAnchors = target.atoms.filter(atom => sameSiteIdentity(sourceAnchor, atom));

    for (const targetAnchor of targetAnchors) {
        const latticeTranslation = [
            targetAnchor.position.x - operatedAnchor[0],
            targetAnchor.position.y - operatedAnchor[1],
            targetAnchor.position.z - operatedAnchor[2],
        ].map(Math.round);
        const unmatchedTargets = new Set(target.atoms.map((_, index) => index));
        let matches = true;

        for (const sourceAtom of source.atoms) {
            const transformed = transformFractional(operation, latticeTranslation, [
                sourceAtom.position.x,
                sourceAtom.position.y,
                sourceAtom.position.z,
            ]);
            const transformedCartesian = cartesianCoordinates(cellMatrix, transformed);
            let matchingIndex = -1;
            for (const targetIndex of unmatchedTargets) {
                const targetAtom = target.atoms[targetIndex];
                if (!sameSiteIdentity(sourceAtom, targetAtom)) {
                    continue;
                }
                const targetCartesian = cartesianCoordinates(cellMatrix, [
                    targetAtom.position.x,
                    targetAtom.position.y,
                    targetAtom.position.z,
                ]);
                if (distanceSquared(transformedCartesian, targetCartesian) <=
                    POSITION_TOLERANCE_ANGSTROM ** 2) {
                    matchingIndex = targetIndex;
                    break;
                }
            }
            if (matchingIndex === -1) {
                matches = false;
                break;
            }
            unmatchedTargets.delete(matchingIndex);
        }
        if (matches && unmatchedTargets.size === 0) {
            return {
                rotation: operation.rotation,
                translation: operation.translation.map(
                    (value, axis) => value + latticeTranslation[axis],
                ),
            };
        }
    }
    return null;
}

/** @returns {object|null} Exact map-symmetry transform between two regions. */
function symmetryTransformBetween(source, target, densityMap, cellMatrix) {
    if (source.atoms.length !== target.atoms.length ||
        regionSignature(source) !== regionSignature(target)) {
        return null;
    }
    const operations = densityMap.symmetryOperations ?? [{
        rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        translation: [0, 0, 0],
    }];
    for (const operation of operations) {
        const transform = matchOperation(source, target, operation, cellMatrix);
        if (transform) {
            return transform;
        }
    }
    return null;
}

/** @returns {THREE.Matrix4} Cartesian form of a fractional affine transform. */
function cartesianTransform(cell, transform) {
    const fractionalToCartesian = cell.fractToCartMatrix.toArray();
    const cartesianToFractional = plainArray(math.inv(fractionalToCartesian));
    const cartesianRotation = plainArray(math.multiply(
        fractionalToCartesian,
        math.multiply(transform.rotation, cartesianToFractional),
    ));
    const translation = cartesianCoordinates(fractionalToCartesian, transform.translation);
    return {
        determinant: math.det(cartesianRotation),
        matrix: new THREE.Matrix4().set(
            cartesianRotation[0][0], cartesianRotation[0][1], cartesianRotation[0][2], translation[0],
            cartesianRotation[1][0], cartesianRotation[1][1], cartesianRotation[1][2], translation[1],
            cartesianRotation[2][0], cartesianRotation[2][1], cartesianRotation[2][2], translation[2],
            0, 0, 0, 1,
        ),
    };
}

/**
 * Compacts a marching-cubes buffer and optionally reverses every triangle.
 * Reversed winding compensates improper symmetry transforms while transformed
 * gradient normals retain the physically correct orientation.
 * @returns {THREE.BufferGeometry} Compact reusable geometry.
 */
function compactGeometry(source, reverseWinding = false) {
    const geometry = new THREE.BufferGeometry();
    const vertexCount = source.drawRange.count;
    for (const [name, attribute] of Object.entries(source.attributes)) {
        const values = attribute.array.slice(0, vertexCount * attribute.itemSize);
        if (reverseWinding) {
            for (let triangle = 0; triangle < vertexCount; triangle += 3) {
                for (let component = 0; component < attribute.itemSize; component++) {
                    const first = (triangle + 1) * attribute.itemSize + component;
                    const second = (triangle + 2) * attribute.itemSize + component;
                    [values[first], values[second]] = [values[second], values[first]];
                }
            }
        }
        geometry.setAttribute(
            name,
            new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized),
        );
    }
    geometry.setDrawRange(0, vertexCount);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

/** @returns {object} Lightweight structure view containing one connected region. */
function regionStructure(structure, region) {
    return { cell: structure.cell, atoms: region.atoms };
}

/** @returns {Array<object>} Exact symmetry-equivalence classes for regions. */
function classifyRegions(regions, densityMap, cellMatrix) {
    const classes = [];
    for (const region of regions) {
        let matchedClass = null;
        let matchedTransform = null;
        for (const candidate of classes) {
            const transform = symmetryTransformBetween(
                candidate.representative,
                region,
                densityMap,
                cellMatrix,
            );
            if (transform) {
                matchedClass = candidate;
                matchedTransform = transform;
                break;
            }
        }
        if (matchedClass) {
            matchedClass.copies.push({ region, transform: matchedTransform });
        } else {
            classes.push({
                representative: region,
                copies: [{
                    region,
                    transform: {
                        rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
                        translation: [0, 0, 0],
                    },
                }],
            });
        }
    }
    return classes;
}

/**
 * Creates difference-density surfaces while reusing exact symmetry-equivalent,
 * disconnected regions. Connected masks are never split, ensuring bridges and
 * shared surface topology are produced by one marching-cubes calculation.
 * @param {import('./difference-density.js').DifferenceDensityMap} densityMap - Periodic map.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Difference-density surface options.
 * @returns {THREE.Group} Symmetry-aware surface group.
 */
export function createSymmetryAwareDifferenceDensitySurfaces(
    densityMap,
    structure,
    options = {},
) {
    const usedOptions = { ...DEFAULT_DIFFERENCE_DENSITY_OPTIONS, ...options };
    if (usedOptions.useSymmetry === false || !structure?.atoms?.length) {
        return createDifferenceDensitySurfaces(densityMap, structure, usedOptions);
    }

    const started = performance.now();
    const globalBounds = differenceDensityBounds(structure, usedOptions.radius);
    const globalResolution = Math.max(8, Math.round(usedOptions.resolution));
    const globalSpacing = longestBoundsEdge(structure.cell, globalBounds) /
        Math.max(1, globalResolution - 1);
    const level = usedOptions.level ?? usedOptions.sigmaLevel * densityMap.sigma;
    const cellMatrix = structure.cell.fractToCartMatrix.toArray();
    const plans = ['positive', 'negative'].map(sign => {
        const regions = contourConnectedDifferenceDensityRegions(
            structure,
            usedOptions.radius,
            densityMap,
            level,
            sign,
        );
        return {
            sign,
            regions,
            classes: classifyRegions(regions, densityMap, cellMatrix),
        };
    });
    const displayedRegionCount = plans.reduce((sum, plan) => sum + plan.regions.length, 0);
    const generatedRegionCount = plans.reduce((sum, plan) => sum + plan.classes.length, 0);
    const reusedRegionCount = displayedRegionCount - generatedRegionCount;
    if (reusedRegionCount === 0) {
        return createDifferenceDensitySurfaces(densityMap, structure, usedOptions);
    }

    const planningTimeMs = performance.now() - started;
    const group = new THREE.Group();
    group.name = 'DifferenceDensity';
    group.visible = usedOptions.visible;
    let positivePolygonCount = 0;
    let negativePolygonCount = 0;
    let polygonizationTimeMs = 0;
    let marchingCubesTimeMs = 0;
    plans.forEach(plan => {
        plan.classes.forEach((regionClass, classIndex) => {
            const representativeStructure = regionStructure(structure, regionClass.representative);
            const regionBounds = differenceDensityBounds(representativeStructure, usedOptions.radius);
            const regionResolution = Math.max(
                8,
                Math.min(
                    globalResolution,
                    Math.ceil(longestBoundsEdge(structure.cell, regionBounds) / globalSpacing) + 1,
                ),
            );
            const regionMaxPolyCount = Math.max(
                2000,
                Math.min(
                    usedOptions.maxPolyCount,
                    Math.ceil(
                        usedOptions.maxPolyCount *
                        (regionResolution / globalResolution) ** 2 * 2,
                    ),
                ),
            );
            const regionStarted = performance.now();
            const canonicalGroup = createDifferenceDensitySurfaces(
                densityMap,
                representativeStructure,
                {
                    ...usedOptions,
                    resolution: regionResolution,
                    maxPolyCount: regionMaxPolyCount,
                    sign: plan.sign,
                },
            );
            marchingCubesTimeMs += performance.now() - regionStarted;
            polygonizationTimeMs += canonicalGroup.userData.polygonizationTimeMs;

            const canonicalSurface = canonicalGroup.children[0];
            const geometryData = {
                regular: compactGeometry(canonicalSurface.geometry),
                mirrored: null,
                material: canonicalSurface.material,
                matrix: canonicalSurface.matrix.clone(),
                name: canonicalSurface.name,
                userData: { ...canonicalSurface.userData },
            };
            canonicalSurface.geometry.dispose();

            regionClass.copies.forEach((copy, copyIndex) => {
                const transform = cartesianTransform(structure.cell, copy.transform);
                let geometry = geometryData.regular;
                if (transform.determinant < 0) {
                    geometryData.mirrored ??= compactGeometry(geometryData.regular, true);
                    geometry = geometryData.mirrored;
                }
                const surface = new THREE.Mesh(geometry, geometryData.material);
                surface.name = `${geometryData.name}_${plan.sign}_${classIndex}_${copyIndex}`;
                surface.userData = { ...geometryData.userData, symmetryReused: copyIndex > 0 };
                surface.frustumCulled = false;
                surface.matrix.copy(transform.matrix).multiply(geometryData.matrix);
                surface.matrixAutoUpdate = false;
                group.add(surface);
            });

            positivePolygonCount += canonicalGroup.userData.positivePolygonCount *
                regionClass.copies.length;
            negativePolygonCount += canonicalGroup.userData.negativePolygonCount *
                regionClass.copies.length;
        });
    });

    group.userData = {
        selectable: false,
        type: 'difference-density',
        bounds: globalBounds,
        level,
        sigmaLevel: level / densityMap.sigma,
        resolution: globalResolution,
        positivePolygonCount,
        negativePolygonCount,
        polygonCount: positivePolygonCount + negativePolygonCount,
        symmetryUsed: true,
        displayedRegionCount,
        generatedRegionCount,
        positiveDisplayedRegionCount: plans[0].regions.length,
        positiveGeneratedRegionCount: plans[0].classes.length,
        negativeDisplayedRegionCount: plans[1].regions.length,
        negativeGeneratedRegionCount: plans[1].classes.length,
        reusedRegionCount,
        marchingCubesPassCount: generatedRegionCount,
        symmetryPlanningTimeMs: planningTimeMs,
        polygonizationTimeMs,
        marchingCubesTimeMs,
        generationTimeMs: performance.now() - started,
    };
    return group;
}
