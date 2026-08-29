/* eslint-disable jsdoc/require-jsdoc -- compact sparse marching-cubes implementation */
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';
import * as math from '../math-lite.js';
import { planCompatibleDimensions } from './fft-grid.js';
import { isosurfaceBounds, wireframeFromSurface } from './isosurface.js';

const CORNERS = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6],
    [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
];

function wrap(value, size) {
    return ((value % size) + size) % size;
}

export class SurfacePatchCache {
    constructor(maxBytes = 64 * 1024 * 1024) {
        this.maxBytes = Math.max(0, Number(maxBytes) || 0);
        this.entries = new Map();
        this.bytes = 0;
        this.evictions = 0;
        this.sampleValues = null;
        this.sampleKnown = null;
        this.sampleDimensions = null;
        this.surfaceMask = null;
        this.surfaceMaskLevel = null;
        this.surfaceCellIndices = null;
    }

    get(key) {
        const value = this.entries.get(key);
        if (!value) {
            return null;
        }
        this.entries.delete(key);
        this.entries.set(key, value);
        return value.entry;
    }

    set(key, entry) {
        const bytes = entry.positive.byteLength + entry.negative.byteLength + 16;
        if (bytes > this.maxBytes || this.maxBytes === 0) {
            return;
        }
        const previous = this.entries.get(key);
        if (previous) {
            this.bytes -= previous.bytes;
            this.entries.delete(key);
        }
        while (this.bytes + bytes > this.maxBytes && this.entries.size > 0) {
            const oldest = this.entries.keys().next().value;
            const removed = this.entries.get(oldest);
            this.entries.delete(oldest);
            this.bytes -= removed.bytes;
            this.evictions++;
        }
        this.entries.set(key, { entry, bytes });
        this.bytes += bytes;
    }

    configureSamples(dimensions) {
        if (this.sampleDimensions?.every((value, axis) => value === dimensions[axis])) {
            return;
        }
        if (this.surfaceMask) {
            this.bytes -= this.surfaceMask.byteLength;
        }
        if (this.surfaceCellIndices) {
            this.bytes -= this.surfaceCellIndices.byteLength;
        }
        this.surfaceMask = null;
        this.surfaceMaskLevel = null;
        this.surfaceCellIndices = null;
        const count = dimensions.reduce((product, value) => product * value, 1);
        const requiredBytes = count * 5;
        while (this.bytes + requiredBytes > this.maxBytes && this.entries.size > 0) {
            const oldest = this.entries.keys().next().value;
            const removed = this.entries.get(oldest);
            this.entries.delete(oldest);
            this.bytes -= removed.bytes;
            this.evictions++;
        }
        if (this.sampleValues) {
            this.bytes -= this.sampleValues.byteLength + this.sampleKnown.byteLength;
        }
        if (requiredBytes > this.maxBytes) {
            this.sampleValues = null;
            this.sampleKnown = null;
            this.sampleDimensions = null;
            return;
        }
        this.sampleValues = new Float32Array(count);
        this.sampleKnown = new Uint8Array(count);
        this.sampleDimensions = [...dimensions];
        this.bytes += requiredBytes;
    }

    configureSurfaceMask(field, dimensions, level) {
        if (!this.sampleValues) {
            return;
        }
        if (this.surfaceMask && this.surfaceMaskLevel === level) {
            return;
        }
        if (this.surfaceMask) {
            this.bytes -= this.surfaceMask.byteLength;
        }
        if (this.surfaceCellIndices) {
            this.bytes -= this.surfaceCellIndices.byteLength;
        }
        this.surfaceCellIndices = null;
        const count = dimensions.reduce((product, value) => product * value, 1);
        while (this.bytes + count > this.maxBytes && this.entries.size > 0) {
            const oldest = this.entries.keys().next().value;
            const removed = this.entries.get(oldest);
            this.entries.delete(oldest);
            this.bytes -= removed.bytes;
            this.evictions++;
        }
        if (this.bytes + count > this.maxBytes) {
            this.surfaceMask = null;
            this.surfaceMaskLevel = null;
            return;
        }
        this.surfaceMask = new Uint8Array(count);
        this.surfaceMaskLevel = level;
        this.bytes += count;
        const surfaceCellIndices = [];
        for (let z = 0; z < dimensions[2]; z++) {
            for (let y = 0; y < dimensions[1]; y++) {
                for (let x = 0; x < dimensions[0]; x++) {
                    const values = CORNERS.map(corner => sampledNode(
                        field,
                        dimensions,
                        [x + corner[0], y + corner[1], z + corner[2]],
                        this,
                    ));
                    let positive = 0;
                    let negative = 0;
                    values.forEach((value, corner) => {
                        if (value < level) {
                            positive |= 1 << corner;
                        }
                        if (-value < level) {
                            negative |= 1 << corner;
                        }
                    });
                    if ((positive !== 0 && positive !== 255) || (negative !== 0 && negative !== 255)) {
                        const index = (z * dimensions[1] + y) * dimensions[0] + x;
                        this.surfaceMask[index] = 1;
                        surfaceCellIndices.push(index);
                    }
                }
            }
        }
        const indexBytes = surfaceCellIndices.length * 4;
        if (this.bytes + indexBytes <= this.maxBytes) {
            this.surfaceCellIndices = Int32Array.from(surfaceCellIndices);
            this.bytes += indexBytes;
        } else {
            this.surfaceCellIndices = null;
        }
    }

    clear() {
        this.entries.clear();
        this.bytes = 0;
        this.evictions = 0;
        this.sampleValues = null;
        this.sampleKnown = null;
        this.sampleDimensions = null;
        this.surfaceMask = null;
        this.surfaceMaskLevel = null;
        this.surfaceCellIndices = null;
    }
}

function cellLengths(cell) {
    const matrix = cell.fractToCartMatrix.toArray();
    return [0, 1, 2].map(axis => Math.hypot(
        matrix[0][axis], matrix[1][axis], matrix[2][axis],
    ));
}

export function surfacePatchDimensions(field, spacing, fallbackCell = null) {
    const cell = field.cell ?? fallbackCell;
    const minimum = cellLengths(cell).map(length => Math.max(2, Math.ceil(length / spacing)));
    return planCompatibleDimensions(minimum, field.symmetryOperations).dimensions;
}

function interpolate(first, second, firstValue, secondValue, level) {
    const denominator = secondValue - firstValue;
    const amount = Math.abs(denominator) < Number.EPSILON ? 0.5 : (level - firstValue) / denominator;
    return first.map((value, axis) => value + amount * (second[axis] - value));
}

function polygonizeSign(positions, sourceValues, level, signScale) {
    const values = sourceValues.map(value => signScale * value);
    let cubeIndex = 0;
    values.forEach((value, corner) => {
        if (value < level) {
            cubeIndex |= 1 << corner;
        }
    });
    const bits = edgeTable[cubeIndex];
    if (bits === 0) {
        return new Float32Array(0);
    }
    const vertices = Array(12);
    EDGES.forEach(([first, second], edge) => {
        if (bits & (1 << edge)) {
            vertices[edge] = interpolate(
                positions[first], positions[second], values[first], values[second], level,
            );
        }
    });
    const output = [];
    const tableOffset = cubeIndex << 4;
    for (let offset = 0; triTable[tableOffset + offset] !== -1; offset += 3) {
        for (let vertex = 0; vertex < 3; vertex++) {
            output.push(...vertices[triTable[tableOffset + offset + vertex]]);
        }
    }
    return Float32Array.from(output);
}

function sampledNode(field, dimensions, node, cache) {
    const normalized = node.map((value, axis) => wrap(value, dimensions[axis]));
    const index = (normalized[2] * dimensions[1] + normalized[1]) * dimensions[0] + normalized[0];
    if (!cache.sampleValues) {
        return field.sample(...normalized.map((value, axis) => value / dimensions[axis]));
    }
    if (!cache.sampleKnown[index]) {
        cache.sampleValues[index] = field.sample(
            normalized[0] / dimensions[0],
            normalized[1] / dimensions[1],
            normalized[2] / dimensions[2],
        );
        cache.sampleKnown[index] = 1;
    }
    return cache.sampleValues[index];
}

function polygonizeCell(field, dimensions, lower, level, cache) {
    const positions = CORNERS.map(corner => corner.map(
        (offset, axis) => (lower[axis] + offset) / dimensions[axis],
    ));
    const values = CORNERS.map(corner => sampledNode(
        field,
        dimensions,
        corner.map((offset, axis) => lower[axis] + offset),
        cache,
    ));
    return {
        positive: polygonizeSign(positions, values, level, 1),
        negative: polygonizeSign(positions, values, level, -1),
    };
}

function cartesian(matrix, fractional, target = new THREE.Vector3()) {
    return target.set(
        matrix[0][0] * fractional[0] + matrix[0][1] * fractional[1] + matrix[0][2] * fractional[2],
        matrix[1][0] * fractional[0] + matrix[1][1] * fractional[1] + matrix[1][2] * fractional[2],
        matrix[2][0] * fractional[0] + matrix[2][1] * fractional[1] + matrix[2][2] * fractional[2],
    );
}

function cellKeysNearAtoms(structure, dimensions, radius, surfaceCellIndices = null) {
    const inverseResult = math.inv(structure.cell.fractToCartMatrix);
    const inverse = Array.isArray(inverseResult) ? inverseResult : inverseResult.toArray();
    const padding = inverse.map(row => radius * Math.hypot(...row));
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const halfDiagonal = 0.5 * Math.hypot(...cellLengths(structure.cell).map(
        (length, axis) => length / dimensions[axis],
    ));
    const limitSquared = (radius + halfDiagonal) ** 2;
    const cells = new Map();
    if (surfaceCellIndices) {
        const atoms = structure.atoms.map(atom => {
            const position = [atom.position.x, atom.position.y, atom.position.z];
            return { position, cartesian: cartesian(matrix, position) };
        });
        const translationMinimum = [0, 1, 2].map(axis => Math.floor(Math.min(
            ...atoms.map(atom => atom.position[axis] - padding[axis]),
        )));
        const translationMaximum = [0, 1, 2].map(axis => Math.floor(Math.max(
            ...atoms.map(atom => atom.position[axis] + padding[axis]),
        )));
        for (let tz = translationMinimum[2]; tz <= translationMaximum[2]; tz++) {
            for (let ty = translationMinimum[1]; ty <= translationMaximum[1]; ty++) {
                for (let tx = translationMinimum[0]; tx <= translationMaximum[0]; tx++) {
                    for (const index of surfaceCellIndices) {
                        const x = index % dimensions[0];
                        const yz = (index - x) / dimensions[0];
                        const y = yz % dimensions[1];
                        const z = (yz - y) / dimensions[1];
                        const lower = [
                            x + tx * dimensions[0],
                            y + ty * dimensions[1],
                            z + tz * dimensions[2],
                        ];
                        const centre = lower.map(
                            (value, axis) => (value + 0.5) / dimensions[axis],
                        );
                        const centreCartesian = cartesian(matrix, centre);
                        const nearAtoms = atoms.filter(atom =>
                            centreCartesian.distanceToSquared(atom.cartesian) <= limitSquared,
                        ).map(atom => atom.cartesian);
                        if (nearAtoms.length > 0) {
                            cells.set(lower.join(','), { lower, atoms: nearAtoms });
                        }
                    }
                }
            }
        }
        return cells;
    }
    for (const atom of structure.atoms) {
        const position = [atom.position.x, atom.position.y, atom.position.z];
        const atomCartesian = cartesian(matrix, position);
        const minima = position.map((value, axis) => Math.floor(
            (value - padding[axis]) * dimensions[axis],
        ));
        const maxima = position.map((value, axis) => Math.ceil(
            (value + padding[axis]) * dimensions[axis],
        ));
        for (let z = minima[2]; z < maxima[2]; z++) {
            for (let y = minima[1]; y < maxima[1]; y++) {
                for (let x = minima[0]; x < maxima[0]; x++) {
                    const lower = [x, y, z];
                    const centre = lower.map((value, axis) => (value + 0.5) / dimensions[axis]);
                    if (cartesian(matrix, centre).distanceToSquared(atomCartesian) > limitSquared) {
                        continue;
                    }
                    const key = lower.join(',');
                    const record = cells.get(key) ?? { lower, atoms: [] };
                    record.atoms.push(atomCartesian);
                    cells.set(key, record);
                }
            }
        }
    }
    return cells;
}

function appendNearTriangles(target, fractionalPositions, shift, matrix, atoms, radiusSquared) {
    const triangle = new THREE.Triangle();
    const point = new THREE.Vector3();
    const closest = new THREE.Vector3();
    for (let offset = 0; offset < fractionalPositions.length; offset += 9) {
        const vertices = [0, 1, 2].map(vertex => cartesian(matrix, [
            fractionalPositions[offset + vertex * 3] + shift[0],
            fractionalPositions[offset + vertex * 3 + 1] + shift[1],
            fractionalPositions[offset + vertex * 3 + 2] + shift[2],
        ]));
        triangle.set(vertices[0], vertices[1], vertices[2]);
        const keep = atoms.some(atom => {
            point.copy(atom);
            triangle.closestPointToPoint(point, closest);
            return closest.distanceToSquared(point) <= radiusSquared;
        });
        if (keep) {
            vertices.forEach(vertex => target.push(vertex.x, vertex.y, vertex.z));
        }
    }
}

function materialFor(options, color) {
    const Material = options.wireframe ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
    const settings = {
        color, transparent: options.opacity < 1, opacity: options.opacity,
        side: THREE.DoubleSide, depthWrite: options.opacity >= 1,
    };
    if (!options.wireframe) {
        Object.assign(settings, { roughness: 0.35, metalness: 0 });
    }
    return new Material(settings);
}

function surfaceFromPositions(positions, sign, options) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const color = sign === 'positive' ? options.positiveColor : options.negativeColor;
    const surface = new THREE.Mesh(geometry, materialFor(options, color));
    surface.name = `${sign === 'positive' ? 'Positive' : 'Negative'}Isosurface`;
    surface.userData = { selectable: false, type: 'isosurface', sign };
    if (!options.wireframe) {
        return surface;
    }
    const lines = wireframeFromSurface(surface, surface.material.color, options.opacity);
    surface.geometry.dispose();
    surface.material.dispose();
    return lines;
}

export function createPatchCachedIsosurfaces(field, structure, options, cache) {
    const started = performance.now();
    const level = options.level ?? field.defaultLevel ?? options.sigmaLevel * field.sigma;
    if (!(Number.isFinite(level) && level > 0)) {
        throw new Error('Isosurface level must be positive');
    }
    const spacing = Number(options.gridSpacing);
    if (!(Number.isFinite(spacing) && spacing > 0)) {
        throw new Error('Isosurface grid spacing must be positive');
    }
    const dimensions = surfacePatchDimensions(field, spacing, structure.cell);
    cache.configureSamples(dimensions);
    cache.configureSurfaceMask(field, dimensions, level);
    const cells = cellKeysNearAtoms(
        structure,
        dimensions,
        options.radius,
        cache.surfaceCellIndices,
    );
    const matrix = structure.cell.fractToCartMatrix.toArray();
    const positions = { positive: [], negative: [] };
    const prefix = `${dimensions.join('x')}@${level.toPrecision(12)}`;
    const initialEvictions = cache.evictions;
    let cacheHitCellCount = 0;
    let cacheMissCellCount = 0;
    let generatedCellCount = 0;
    for (const { lower, atoms } of cells.values()) {
        const normalized = lower.map((value, axis) => wrap(value, dimensions[axis]));
        const shift = lower.map((value, axis) => (value - normalized[axis]) / dimensions[axis]);
        const normalizedIndex = (normalized[2] * dimensions[1] + normalized[1]) *
            dimensions[0] + normalized[0];
        if (cache.surfaceMask && cache.surfaceMask[normalizedIndex] === 0) {
            cacheHitCellCount++;
            continue;
        }
        const key = `${prefix}:${normalized.join(',')}`;
        let patch = cache.get(key);
        if (patch) {
            cacheHitCellCount++;
        } else {
            patch = polygonizeCell(field, dimensions, normalized, level, cache);
            cache.set(key, patch);
            cacheMissCellCount++;
            generatedCellCount++;
        }
        appendNearTriangles(
            positions.positive, patch.positive, shift, matrix, atoms, options.radius ** 2,
        );
        appendNearTriangles(
            positions.negative, patch.negative, shift, matrix, atoms, options.radius ** 2,
        );
    }
    const sign = options.sign ?? field.surfaceSign ?? 'both';
    const group = new THREE.Group();
    group.name = 'Isosurface';
    group.visible = options.visible !== false;
    if (sign !== 'negative') {
        group.add(surfaceFromPositions(positions.positive, 'positive', options));
    }
    if (sign !== 'positive') {
        group.add(surfaceFromPositions(positions.negative, 'negative', options));
    }
    const positivePolygonCount = positions.positive.length / 9;
    const negativePolygonCount = positions.negative.length / 9;
    group.userData = {
        selectable: false,
        type: 'isosurface',
        bounds: isosurfaceBounds(structure, options.radius),
        level,
        sigmaLevel: Number.isFinite(field.sigma) && field.sigma !== 0 ? level / field.sigma : null,
        resolution: Math.max(...dimensions),
        surfaceGridDimensions: dimensions,
        positivePolygonCount,
        negativePolygonCount,
        polygonCount: positivePolygonCount + negativePolygonCount,
        symmetryUsed: false,
        displayedRegionCount: cells.size,
        generatedRegionCount: generatedCellCount,
        reusedRegionCount: cacheHitCellCount,
        marchingCubesPassCount: generatedCellCount,
        stitched: false,
        stitchTimeMs: 0,
        cacheHitCellCount,
        cacheMissCellCount,
        generatedCellCount,
        reusedCellCount: cacheHitCellCount,
        patchCacheBytes: cache.bytes,
        patchCacheEvictionCount: cache.evictions - initialEvictions,
        surfaceAssemblyTimeMs: performance.now() - started,
        generationTimeMs: performance.now() - started,
        marchingCubesTimeMs: performance.now() - started,
        polygonizationTimeMs: 0,
        openClipping: true,
    };
    return group;
}
