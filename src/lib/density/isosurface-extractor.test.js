/* eslint-disable jsdoc/require-jsdoc -- compact numerical fixtures */
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { UnitCell } from '../structure/crystal.js';
import { ScalarFieldGrid } from './scalar-field.js';
import {
    extractMarchingCubes,
    prepareRegularSurfaceSampler,
    sampleActiveCellNodes,
} from './isosurface-extractor.js';
import { planSurfaceLattice } from './surface-lattice.js';

function fullMask(lattice) {
    const mask = new Uint8Array(lattice.cellCount);
    mask.fill(1);
    return mask;
}

function extractField(sample, resolution = 24) {
    const lattice = planSurfaceLattice(
        new UnitCell(1, 1, 1, 90, 90, 90),
        { minimum: [0, 0, 0], maximum: [1, 1, 1] },
        resolution,
    );
    return extractMarchingCubes({
        lattice,
        activeCellMask: fullMask(lattice),
        activeCellCount: lattice.cellCount,
        field: { sample },
        level: 0,
        signs: 'positive',
    }).positive.positions;
}

function topology(positions, tolerance = 1e-5) {
    const vertexIndices = new Map();
    const triangleVertices = [];
    const parent = [];
    const root = value => {
        while (parent[value] !== value) {
            parent[value] = parent[parent[value]];
            value = parent[value];
        }
        return value;
    };
    for (let offset = 0; offset < positions.length; offset += 9) {
        const triangle = [];
        for (let vertex = 0; vertex < 3; vertex++) {
            const start = offset + vertex * 3;
            const key = [0, 1, 2].map(axis =>
                Math.round(positions[start + axis] / tolerance)).join(',');
            let index = vertexIndices.get(key);
            if (index === undefined) {
                index = vertexIndices.size;
                vertexIndices.set(key, index);
                parent.push(index);
            }
            triangle.push(index);
        }
        triangleVertices.push(triangle);
        const first = root(triangle[0]);
        const second = root(triangle[1]);
        const third = root(triangle[2]);
        parent[second] = first;
        parent[third] = first;
    }
    const edgeCounts = new Map();
    for (const triangle of triangleVertices) {
        for (const [first, second] of [[0, 1], [1, 2], [2, 0]]) {
            const edge = [triangle[first], triangle[second]].sort((a, b) => a - b).join(',');
            edgeCounts.set(edge, (edgeCounts.get(edge) ?? 0) + 1);
        }
    }
    return {
        componentCount: new Set([...vertexIndices.values()].map(root)).size,
        boundaryEdgeCount: [...edgeCounts.values()].filter(count => count === 1).length,
    };
}

describe('typed-array isosurface extractor', () => {
    test('extracts positive and negative planes in one traversal', () => {
        const lattice = planSurfaceLattice(
            new UnitCell(1, 1, 1, 90, 90, 90),
            { minimum: [0, 0, 0], maximum: [1, 1, 1] },
            8,
        );
        const result = extractMarchingCubes({
            lattice,
            activeCellMask: fullMask(lattice),
            activeCellCount: lattice.cellCount,
            field: { sample: x => x - 0.5 },
            level: 0.1,
            signs: 'both',
        });

        expect(result.statistics.positiveTriangleCount).toBe(98);
        expect(result.statistics.negativeTriangleCount).toBe(98);
        const positiveX = result.positive.positions.filter((_, index) => index % 3 === 0);
        const negativeX = result.negative.positions.filter((_, index) => index % 3 === 0);
        expect([...positiveX].every(value => Math.abs(value - 0.6) < 1e-6)).toBe(true);
        expect([...negativeX].every(value => Math.abs(value - 0.4) < 1e-6)).toBe(true);
        expect(result.statistics.fieldSampleCount).toBe(lattice.nodeCount);
        expect(result.statistics.generatedVertexCount).toBe(196 * 3);
    });

    test('matches Three.js cases and interpolated positions on the same interior cells', () => {
        const resolution = 12;
        const lattice = planSurfaceLattice(
            new UnitCell(1, 1, 1, 90, 90, 90),
            { minimum: [0, 0, 0], maximum: [1, 1, 1] },
            resolution,
        );
        const mask = new Uint8Array(lattice.cellCount);
        const [cx, cy] = lattice.cellDimensions;
        let activeCellCount = 0;
        for (let z = 1; z < resolution - 2; z++) {
            for (let y = 1; y < resolution - 2; y++) {
                for (let x = 1; x < resolution - 2; x++) {
                    mask[(z * cy + y) * cx + x] = 1;
                    activeCellCount++;
                }
            }
        }
        const level = 0.1;
        const field = { sample: x => x - 0.5 };
        const custom = extractMarchingCubes({
            lattice,
            activeCellMask: mask,
            activeCellCount,
            field,
            level,
            signs: 'positive',
        });
        const material = new THREE.MeshBasicMaterial();
        const three = new MarchingCubes(resolution, material, false, false, 10000);
        three.isolation = level;
        for (let z = 0; z < resolution; z++) {
            for (let y = 0; y < resolution; y++) {
                for (let x = 0; x < resolution; x++) {
                    three.field[(z * resolution + y) * resolution + x] = field.sample(x / resolution);
                }
            }
        }
        three.update();
        const threePositions = three.geometry.getAttribute('position');
        const keys = positions => positions.sort();
        const customKeys = keys([...custom.positive.positions].reduce((result, _value, index, array) => {
            if (index % 3 === 0) {
                result.push(array.slice(index, index + 3).map(value => value.toFixed(6)).join(','));
            }
            return result;
        }, []));
        const threeKeys = keys(Array.from({ length: three.geometry.drawRange.count }, (_, index) =>
            [0, 1, 2].map(axis => ((threePositions.array[index * 3 + axis] + 1) / 2)
                .toFixed(6)).join(',')));

        expect(custom.statistics.positiveTriangleCount)
            .toBe(three.geometry.drawRange.count / 3);
        expect(customKeys).toEqual(threeKeys);
        three.geometry.dispose();
        material.dispose();
    });

    test('samples only nodes adjacent to a sparse active-cell mask', () => {
        const lattice = planSurfaceLattice(
            new UnitCell(1, 1, 1, 90, 90, 90),
            { minimum: [0, 0, 0], maximum: [1, 1, 1] },
            32,
        );
        const mask = new Uint8Array(lattice.cellCount);
        const [nx, ny] = lattice.cellDimensions;
        mask[(15 * ny + 15) * nx + 15] = 1;
        let samples = 0;
        const result = extractMarchingCubes({
            lattice,
            activeCellMask: mask,
            activeCellCount: 1,
            field: {
                sample(x, y, z) {
                    samples++;
                    return x + y + z;
                },
            },
            level: 1.5,
        });

        expect(samples).toBe(8);
        expect(result.statistics.fieldSampleCount).toBe(8);
        expect(samples).toBeLessThan(lattice.nodeCount);
    });

    test.each(['periodic', 'zero'])('prepared %s sampling matches generic field.sample()', mode => {
        const cell = new UnitCell(1, 1, 1, 90, 90, 90);
        const dimensions = [8, 10, 12];
        const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2]);
        for (let index = 0; index < values.length; index++) {
            values[index] = Math.sin(index * 0.137) + Math.cos(index * 0.031);
        }
        const field = new ScalarFieldGrid(cell, dimensions, values, mode === 'zero' ? {
            boundaryMode: 'zero',
            originFractional: [0.1, -0.05, 0.2],
        } : {});
        const lattice = planSurfaceLattice(
            cell,
            { minimum: [-0.2, -0.1, 0.05], maximum: [1.2, 1.1, 1.3] },
            [19, 17, 15],
        );
        const mask = fullMask(lattice);
        const generic = sampleActiveCellNodes(
            lattice, mask, field, lattice.cellCount,
            { samplingMode: 'generic', nodeTraversal: 'full-scan' },
        );
        const prepared = sampleActiveCellNodes(
            lattice, mask, field, lattice.cellCount,
            { samplingMode: 'prepared', nodeTraversal: 'active-list' },
        );

        expect(prepared.samplingBackend).toBe('prepared-trilinear');
        expect(prepared.activeNodeCount).toBe(generic.activeNodeCount);
        for (const index of prepared.activeNodeIndices) {
            expect(prepared.nodeValues[index]).toBeCloseTo(generic.nodeValues[index], 6);
        }
    });

    test('prepared-sampler eligibility does not touch a values getter', () => {
        let getterCalls = 0;
        const field = { dimensions: [4, 4, 4], sample: () => 1 };
        Object.defineProperty(field, 'values', {
            get() {
                getterCalls++;
                throw new Error('must not materialize');
            },
        });
        const lattice = planSurfaceLattice(
            new UnitCell(1, 1, 1, 90, 90, 90),
            { minimum: [0, 0, 0], maximum: [1, 1, 1] },
            8,
        );

        expect(prepareRegularSurfaceSampler(field, lattice)).toBeNull();
        expect(getterCalls).toBe(0);
    });

    test('active-list and prepared sampling preserve extracted geometry', () => {
        const cell = new UnitCell(1, 1, 1, 90, 90, 90);
        const dimensions = [16, 18, 20];
        const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2]);
        for (let z = 0; z < dimensions[2]; z++) {
            for (let y = 0; y < dimensions[1]; y++) {
                for (let x = 0; x < dimensions[0]; x++) {
                    values[(z * dimensions[1] + y) * dimensions[0] + x] =
                        Math.sin(2 * Math.PI * x / dimensions[0]) +
                        0.4 * Math.cos(2 * Math.PI * y / dimensions[1]) -
                        0.2 * Math.sin(2 * Math.PI * z / dimensions[2]);
                }
            }
        }
        const field = new ScalarFieldGrid(cell, dimensions, values);
        const lattice = planSurfaceLattice(
            cell,
            { minimum: [-0.1, -0.15, -0.2], maximum: [1.1, 1.15, 1.2] },
            [23, 21, 19],
        );
        const mask = fullMask(lattice);
        const common = {
            lattice,
            activeCellMask: mask,
            activeCellCount: lattice.cellCount,
            field,
            level: 0.15,
        };
        const current = extractMarchingCubes({
            ...common, samplingMode: 'generic', nodeTraversal: 'full-scan',
        });
        const activeList = extractMarchingCubes({
            ...common, samplingMode: 'generic', nodeTraversal: 'active-list',
        });
        const prepared = extractMarchingCubes({
            ...common, samplingMode: 'prepared', nodeTraversal: 'active-list',
        });

        for (const sign of ['positive', 'negative']) {
            expect(activeList[sign].positions).toEqual(current[sign].positions);
            expect(prepared[sign].positions.length).toBe(current[sign].positions.length);
            let maximumDifference = 0;
            for (let index = 0; index < prepared[sign].positions.length; index++) {
                maximumDifference = Math.max(
                    maximumDifference,
                    Math.abs(prepared[sign].positions[index] - current[sign].positions[index]),
                );
            }
            expect(maximumDifference).toBeLessThan(1e-6);
        }
    });

    test('produces a closed connected sphere', () => {
        const positions = extractField((x, y, z) =>
            0.25 ** 2 - ((x - 0.5) ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2));
        const result = topology(positions);

        expect(positions.length).toBeGreaterThan(0);
        expect(result.componentCount).toBe(1);
        expect(result.boundaryEdgeCount).toBe(0);
    });

    test('keeps two separated spheres disconnected', () => {
        const positions = extractField((x, y, z) => Math.max(
            0.16 ** 2 - ((x - 0.3) ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2),
            0.16 ** 2 - ((x - 0.7) ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2),
        ));

        expect(topology(positions).componentCount).toBe(2);
    });

    test.each([
        ['periodic', (x, y, z) => Math.sin(2 * Math.PI * x) +
            Math.sin(2 * Math.PI * y) + Math.sin(2 * Math.PI * z)],
        ['saddle', (x, y, z) => (x - 0.5) * (y - 0.5) - (z - 0.5)],
        ['tiny isolated peak', (x, y, z) => 0.06 ** 2 -
            ((x - 0.5) ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2)],
        ['boundary-crossing periodic blob', (x, y, z) => {
            const dx = Math.min(Math.abs(x - 0.02), 1 - Math.abs(x - 0.02));
            return 0.14 ** 2 - (dx ** 2 + (y - 0.5) ** 2 + (z - 0.5) ** 2);
        }],
    ])('extracts the %s analytical field', (_name, sample) => {
        expect(extractField(sample, 32).length).toBeGreaterThan(0);
    });
});
