import * as THREE from 'three';
import * as math from '../math-lite.js';
import {
    createIsosurfaces,
    DEFAULT_ISOSURFACE_OPTIONS,
    isosurfaceBounds,
    wireframeFromSurface,
} from './isosurface.js';

const POSITION_TOLERANCE_ANGSTROM = 1e-4;

/** Bounded CPU-side cache of canonical symmetry-region triangulations. */
export class SymmetryRegionSurfaceCache {
    constructor(maxBytes = 64 * 1024 * 1024) {
        this.maxBytes = Math.max(0, Number(maxBytes) || 0);
        this.entries = new Map();
        this.bytes = 0;
        this.evictions = 0;
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) {
            return null;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    has(key) {
        return this.entries.has(key);
    }

    set(key, value) {
        const bytes = Object.values(value.geometry.attributes).reduce(
            (sum, attribute) => sum + attribute.array.byteLength,
            0,
        );
        if (bytes > this.maxBytes || this.maxBytes === 0) {
            return;
        }
        while (this.bytes + bytes > this.maxBytes && this.entries.size > 0) {
            const oldest = this.entries.keys().next().value;
            const removed = this.entries.get(oldest);
            this.entries.delete(oldest);
            this.bytes -= removed.bytes;
            removed.value.geometry.dispose();
            this.evictions++;
        }
        const stored = {
            geometry: value.geometry.clone(),
            matrix: value.matrix.clone(),
        };
        this.entries.set(key, { value: stored, bytes });
        this.bytes += bytes;
    }

    clear() {
        for (const { value } of this.entries.values()) {
            value.geometry.dispose();
        }
        this.entries.clear();
        this.bytes = 0;
        this.evictions = 0;
    }
}

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
export function connectedIsosurfaceRegions(structure, radius, connectionMargin = 0) {
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
export function contourConnectedIsosurfaceRegions(
    structure,
    radius,
    _field,
    _level,
    _sign = 'both',
) {
    return connectedIsosurfaceRegions(structure, radius);
}

/** @returns {string} Fast rejection signature for symmetry matching. */
function regionSignature(region) {
    return region.atoms.map(atom =>
        `${atom.label}\u0000${atom.atomType}\u0000${atom.disorderGroup}`,
    ).sort().join('\u0001');
}

/**
 *
 */
function regionCacheKey(region, sign, level, resolution, options) {
    const atoms = region.atoms.map(atom => [
        atom.label,
        atom.atomType,
        Number(atom.disorderGroup),
        Math.round(atom.position.x * 1e8),
        Math.round(atom.position.y * 1e8),
        Math.round(atom.position.z * 1e8),
    ].join(':')).sort().join('|');
    return [
        sign,
        level.toPrecision(12),
        resolution,
        Number(options.radius).toPrecision(8),
        'cifvis',
        atoms,
    ].join(';');
}

/** @returns {THREE.Material} Fresh appearance for cached CPU geometry. */
function regionMaterial(sign, options) {
    const Material = options.wireframe ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
    const settings = {
        color: sign === 'positive' ? options.positiveColor : options.negativeColor,
        transparent: options.opacity < 1,
        opacity: options.opacity,
        side: THREE.DoubleSide,
        depthWrite: options.opacity >= 1,
    };
    if (!options.wireframe) {
        Object.assign(settings, { roughness: 0.35, metalness: 0 });
    }
    return new Material(settings);
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
function symmetryTransformBetween(source, target, field, cellMatrix) {
    if (source.atoms.length !== target.atoms.length ||
        regionSignature(source) !== regionSignature(target)) {
        return null;
    }
    const operations = field.symmetryOperations ?? [{
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

/** @returns {{geometry: THREE.BufferGeometry, removedTriangles: number}} Stitched sign mesh. */
function stitchSurfacePatches(patches, tolerance) {
    const positions = [];
    const indices = [];
    const vertices = new Map();
    const triangles = new Set();
    const multiplier = 1 / Math.max(tolerance, Number.EPSILON);
    let removedTriangles = 0;

    for (const patch of patches) {
        const attribute = patch.getAttribute('position');
        for (let triangleOffset = 0; triangleOffset < attribute.count; triangleOffset += 3) {
            const triangle = [];
            for (let vertexOffset = 0; vertexOffset < 3; vertexOffset++) {
                const vertex = triangleOffset + vertexOffset;
                const coordinates = [
                    attribute.getX(vertex),
                    attribute.getY(vertex),
                    attribute.getZ(vertex),
                ];
                const key = coordinates.map(value => Math.round(value * multiplier)).join(',');
                let index = vertices.get(key);
                if (index === undefined) {
                    index = positions.length / 3;
                    vertices.set(key, index);
                    positions.push(...coordinates);
                }
                triangle.push(index);
            }
            if (new Set(triangle).size < 3) {
                removedTriangles++;
                continue;
            }
            const triangleKey = [...triangle].sort((first, second) => first - second).join(',');
            if (triangles.has(triangleKey)) {
                removedTriangles++;
                continue;
            }
            triangles.add(triangleKey);
            indices.push(...triangle);
        }
        patch.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
    geometry.setIndex(new THREE.BufferAttribute(new IndexArray(indices), 1));
    geometry.setDrawRange(0, indices.length);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, removedTriangles };
}

/** @returns {object} Lightweight structure view containing one connected region. */
function regionStructure(structure, region) {
    return { cell: structure.cell, atoms: region.atoms };
}

/** @returns {Array<object>} Exact symmetry-equivalence classes for regions. */
function classifyRegions(regions, field, cellMatrix) {
    const classes = [];
    for (const region of regions) {
        let matchedClass = null;
        let matchedTransform = null;
        for (const candidate of classes) {
            const transform = symmetryTransformBetween(
                candidate.representative,
                region,
                field,
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
 * Creates isosurfaces while reusing exact symmetry-equivalent,
 * disconnected regions. Connected masks are never split, ensuring bridges and
 * shared surface topology are produced by one marching-cubes calculation.
 * @param {object} field - Sampled scalar field.
 * @param {object} structure - Current displayed CrystalStructure.
 * @param {object} [options] - Isosurface options.
 * @returns {THREE.Group} Symmetry-aware surface group.
 */
/**
 * Fraction of the direct pass's sampling volume the per-region passes may occupy before
 * the symmetry route is abandoned.
 *
 * Set below one because the sampling is only part of what the symmetry route costs: every
 * copy is transformed and cloned, and the patches are then welded together. Those scale
 * with the copies and their boundary rather than with the sampled volume, so the sampling
 * has to come in meaningfully cheaper for the route to be worth taking at all.
 */
const SYMMETRY_SAMPLE_COST_BUDGET = 0.7;

/**
 * Grid resolution used for one region's own marching-cubes pass.
 *
 * Shared by the cost estimate and the pass itself so the two cannot drift apart - an
 * estimate computed from a different formula than the work it predicts is worse than no
 * estimate.
 * @param {object} structure - Displayed structure the region belongs to.
 * @param {object} region - Region whose representative is being sized.
 * @param {number} radius - Density clipping radius in Ångström.
 * @param {number} globalResolution - Resolution the direct pass would use.
 * @param {number} globalSpacing - Sample spacing of the direct pass.
 * @returns {number} Resolution for this region.
 */
function regionResolutionFor(structure, region, radius, globalResolution, globalSpacing) {
    const bounds = isosurfaceBounds(regionStructure(structure, region), radius);
    return Math.max(
        8,
        Math.min(
            globalResolution,
            Math.ceil(longestBoundsEdge(structure.cell, bounds) / globalSpacing) + 1,
        ),
    );
}

/**
 * Creates positive and negative isosurfaces while reusing symmetry-equivalent regions.
 * Falls back to the direct isosurface path when symmetry reuse is disabled or unavailable.
 * @param {object} field - Periodic scalar field to contour.
 * @param {object} structure - Structure defining atoms, cell, and symmetry.
 * @param {object} [options] - Isosurface display and symmetry-generation options.
 * @param {SymmetryRegionSurfaceCache|null} [regionCache] - Active-field CPU geometry cache.
 * @returns {THREE.Group} Renderable isosurface group with generation statistics.
 */
export function createSymmetryAwareIsosurfaces(
    field,
    structure,
    options = {},
    regionCache = null,
) {
    const usedOptions = { ...DEFAULT_ISOSURFACE_OPTIONS, ...options };
    if (usedOptions.useSymmetry === false || !structure?.atoms?.length) {
        return createIsosurfaces(field, structure, usedOptions);
    }

    const started = performance.now();
    const globalBounds = isosurfaceBounds(structure, usedOptions.radius);
    const globalResolution = Math.max(8, Math.round(usedOptions.resolution));
    const globalSpacing = longestBoundsEdge(structure.cell, globalBounds) /
        Math.max(1, globalResolution - 1);
    const level = usedOptions.level ?? field.defaultLevel ??
        usedOptions.sigmaLevel * field.sigma;
    const cellMatrix = structure.cell.fractToCartMatrix.toArray();
    const plans = ['positive', 'negative'].map(sign => {
        const regions = contourConnectedIsosurfaceRegions(
            structure,
            usedOptions.radius,
            field,
            level,
            sign,
        );
        return {
            sign,
            regions,
            classes: classifyRegions(regions, field, cellMatrix),
        };
    });
    const displayedRegionCount = plans.reduce((sum, plan) => sum + plan.regions.length, 0);
    const generatedRegionCount = plans.reduce((sum, plan) => sum + plan.classes.length, 0);
    const reusedRegionCount = displayedRegionCount - generatedRegionCount;
    if (reusedRegionCount === 0 && !regionCache) {
        const group = createIsosurfaces(field, structure, usedOptions);
        for (const plan of plans) {
            group.userData[`${plan.sign}DisplayedRegionCount`] = plan.regions.length;
        }
        return group;
    }

    // Reuse existing is not the same as reuse paying. Each representative is marched in
    // its own box, and those boxes overlap freely, so a structure whose density breaks
    // into many separate clusters can sample far more volume in total than one pass over
    // the whole cell would - and then still owes the transform and stitch for every
    // copy. Both costs are known here, before any marching cubes runs, so compare them
    // and take the cheaper route rather than assuming the reuse wins.
    let regionSampleCost = 0;
    let uncachedRegionSampleCost = 0;
    for (const plan of plans) {
        for (const regionClass of plan.classes) {
            const resolution = regionResolutionFor(
                structure, regionClass.representative, usedOptions.radius,
                globalResolution, globalSpacing,
            );
            const sampleCost = resolution ** 3;
            regionSampleCost += sampleCost;
            const cacheKey = regionCacheKey(
                regionClass.representative,
                plan.sign,
                level,
                resolution,
                usedOptions,
            );
            if (!regionCache?.has(cacheKey)) {
                uncachedRegionSampleCost += sampleCost;
            }
        }
    }
    const directSampleCost = globalResolution ** 3;
    if (uncachedRegionSampleCost > directSampleCost * SYMMETRY_SAMPLE_COST_BUDGET) {
        const group = createIsosurfaces(field, structure, usedOptions);
        for (const plan of plans) {
            group.userData[`${plan.sign}DisplayedRegionCount`] = plan.regions.length;
        }
        group.userData.symmetryDeclinedForCost = true;
        group.userData.symmetryRegionSampleCost = regionSampleCost;
        group.userData.symmetryUncachedRegionSampleCost = uncachedRegionSampleCost;
        group.userData.symmetryDirectSampleCost = directSampleCost;
        return group;
    }

    const planningTimeMs = performance.now() - started;
    const group = new THREE.Group();
    group.name = 'Isosurface';
    group.visible = usedOptions.visible;
    let positivePolygonCount = 0;
    let negativePolygonCount = 0;
    let polygonizationTimeMs = 0;
    let marchingCubesTimeMs = 0;
    let improperTransformCount = 0;
    let regionCacheHitCount = 0;
    let regionCacheMissCount = 0;
    let surfaceWireframeTimeMs = 0;
    const surfaceStageStatistics = Object.fromEntries([
        'surfaceBoundsTimeMs',
        'surfaceMaskTimeMs',
        'surfaceSamplingTimeMs',
        'surfaceClassificationTimeMs',
        'surfaceAllocationTimeMs',
        'surfaceInterpolationTimeMs',
        'surfaceGeometryTimeMs',
        'surfaceLatticeNodeCount',
        'surfaceLatticeCellCount',
        'candidateCellCount',
        'activeCellCount',
        'activeRowCount',
        'fieldSampleCount',
        'activeNodeCount',
        'allowedNodeCount',
        'candidateNodeCount',
        'generatedVertexCount',
        'generatedLineSegmentCount',
        'allocatedGeometryBytes',
        'atomDistanceTestCount',
        'threeMarchingCubesTimeMs',
    ].map(key => [key, 0]));
    let numericalExtractionTimeMs = 0;
    let surfaceSamplingBackend = null;
    const initialCacheEvictions = regionCache?.evictions ?? 0;
    const surfacePatches = { positive: [], negative: [] };
    const surfaceMaterials = { positive: [], negative: [] };
    plans.forEach(plan => {
        plan.classes.forEach(regionClass => {
            const representativeStructure = regionStructure(structure, regionClass.representative);
            const regionResolution = regionResolutionFor(
                structure, regionClass.representative, usedOptions.radius,
                globalResolution, globalSpacing,
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
            const cacheKey = regionCacheKey(
                regionClass.representative, plan.sign, level, regionResolution, usedOptions,
            );
            const cached = regionCache?.get(cacheKey);
            let geometryData;
            if (cached) {
                regionCacheHitCount++;
                geometryData = {
                    regular: cached.geometry.clone(),
                    mirrored: null,
                    material: regionMaterial(plan.sign, usedOptions),
                    matrix: cached.matrix.clone(),
                };
            } else {
                regionCacheMissCount++;
                const regionStarted = performance.now();
                const canonicalGroup = createIsosurfaces(
                    field,
                    representativeStructure,
                    {
                        ...usedOptions,
                        resolution: regionResolution,
                        maxPolyCount: regionMaxPolyCount,
                        sign: plan.sign,
                        // Region patches must stay triangulated for stitching; the
                        // final stitched mesh is converted to line edges below.
                        keepTriangles: true,
                    },
                );
                marchingCubesTimeMs += performance.now() - regionStarted;
                polygonizationTimeMs += canonicalGroup.userData.polygonizationTimeMs;
                numericalExtractionTimeMs += canonicalGroup.userData.surfaceTotalTimeMs ?? 0;
                surfaceSamplingBackend ??= canonicalGroup.userData.surfaceSamplingBackend ?? null;
                for (const key of Object.keys(surfaceStageStatistics)) {
                    surfaceStageStatistics[key] += canonicalGroup.userData[key] ?? 0;
                }
                const canonicalSurface = canonicalGroup.children[0];
                geometryData = {
                    regular: compactGeometry(canonicalSurface.geometry),
                    mirrored: null,
                    material: canonicalSurface.material,
                    matrix: canonicalSurface.matrix.clone(),
                };
                canonicalSurface.geometry.dispose();
                regionCache?.set(cacheKey, {
                    geometry: geometryData.regular,
                    matrix: geometryData.matrix,
                });
            }
            surfaceMaterials[plan.sign].push(geometryData.material);

            regionClass.copies.forEach(copy => {
                const transform = cartesianTransform(structure.cell, copy.transform);
                let geometry = geometryData.regular;
                if (transform.determinant < 0) {
                    improperTransformCount++;
                    geometryData.mirrored ??= compactGeometry(geometryData.regular, true);
                    geometry = geometryData.mirrored;
                }
                const patch = geometry.clone();
                patch.applyMatrix4(transform.matrix.clone().multiply(geometryData.matrix));
                // Welding must depend on position alone; normals are recomputed
                // after coincident boundary vertices and duplicate faces merge.
                patch.deleteAttribute('normal');
                surfacePatches[plan.sign].push(patch);
            });
            geometryData.regular.dispose();
            geometryData.mirrored?.dispose();
        });
    });

    const stitchingStarted = performance.now();
    let removedDuplicateTriangleCount = 0;
    for (const sign of ['positive', 'negative']) {
        const stitched = stitchSurfacePatches(
            surfacePatches[sign],
            usedOptions.stitchTolerance ?? 1e-4,
        );
        removedDuplicateTriangleCount += stitched.removedTriangles;
        const material = surfaceMaterials[sign][0];
        surfaceMaterials[sign].slice(1).forEach(extraMaterial => extraMaterial.dispose());
        const polygons = (stitched.geometry.getIndex()?.count ?? 0) / 3;
        const surface = new THREE.Mesh(stitched.geometry, material);
        surface.name = `${sign === 'positive' ? 'Positive' : 'Negative'}Isosurface`;
        surface.userData = { selectable: false, type: 'isosurface', sign };
        if (usedOptions.wireframe) {
            const wireframeStarted = performance.now();
            const lines = wireframeFromSurface(surface, material.color, usedOptions.opacity);
            surfaceWireframeTimeMs += performance.now() - wireframeStarted;
            surfaceStageStatistics.generatedLineSegmentCount +=
                lines.geometry.getAttribute('position')?.count / 2 || 0;
            surface.geometry.dispose();
            material.dispose();
            group.add(lines);
        } else {
            group.add(surface);
        }
        if (sign === 'positive') {
            positivePolygonCount = polygons;
        } else {
            negativePolygonCount = polygons;
        }
    }
    const stitchTimeMs = performance.now() - stitchingStarted;
    const surfaceTotalTimeMs = performance.now() - started;

    group.userData = {
        selectable: false,
        type: 'isosurface',
        bounds: globalBounds,
        level,
        sigmaLevel: Number.isFinite(field.sigma) && field.sigma !== 0
            ? level / field.sigma
            : null,
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
        stitched: true,
        stitchTolerance: usedOptions.stitchTolerance ?? 1e-4,
        stitchTimeMs,
        removedDuplicateTriangleCount,
        improperTransformCount,
        symmetryPlanningTimeMs: planningTimeMs,
        polygonizationTimeMs,
        marchingCubesTimeMs,
        generationTimeMs: surfaceTotalTimeMs,
        regionCacheHitCount,
        regionCacheMissCount,
        regionCacheBytes: regionCache?.bytes ?? 0,
        regionCacheEvictionCount: (regionCache?.evictions ?? 0) - initialCacheEvictions,
        ...surfaceStageStatistics,
        surfaceExtractor: 'cifvis',
        surfaceSamplingBackend,
        surfaceNodeTraversal: 'active-list',
        surfaceNodeStencil: true,
        surfaceWireframeTimeMs,
        surfaceSymmetryAssemblyTimeMs: Math.max(
            0, surfaceTotalTimeMs - numericalExtractionTimeMs,
        ),
        surfaceTotalTimeMs,
        positiveTriangleCount: positivePolygonCount,
        negativeTriangleCount: negativePolygonCount,
    };
    return group;
}
