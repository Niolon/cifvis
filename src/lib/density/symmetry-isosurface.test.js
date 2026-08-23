/* eslint-disable jsdoc/require-param -- local test fixtures */
import { describe, expect, test } from 'vitest';
import { Atom, CrystalStructure, UnitCell } from '../structure/crystal.js';
import { FractPosition } from '../structure/position.js';
import {
    connectedIsosurfaceRegions,
    createSymmetryAwareIsosurfaces,
} from './symmetry-isosurface.js';

const identity = {
    rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    translation: [0, 0, 0],
};
const inversion = {
    rotation: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],
    translation: [0, 0, 0],
};

/** @returns {CrystalStructure} Cubic structure with copies of one site. */
function structureAt(...positions) {
    return new CrystalStructure(
        new UnitCell(10, 10, 10, 90, 90, 90),
        positions.map((position, index) => new Atom(
            'C1',
            'C',
            new FractPosition(...position),
            null,
            0,
            index === 0 ? null : { key: `${index + 1}_555` },
        )),
    );
}

/** @returns {object} Inversion-symmetric periodic scalar map. */
function densityMap(symmetryOperations = [identity, inversion]) {
    return {
        sigma: 0.1,
        symmetryOperations,
        sample(x, y, z) {
            return Math.cos(2 * Math.PI * x) +
                0.2 * Math.cos(2 * Math.PI * y) +
                0.1 * Math.cos(2 * Math.PI * z);
        },
    };
}

const surfaceOptions = {
    resolution: 24,
    radius: 1,
    sigmaLevel: 1,
    maxPolyCount: 10000,
};

describe('symmetry-aware isosurfaces', () => {
    test('reuses disconnected inversion-equivalent regions', () => {
        const structure = structureAt([0.2, 0.5, 0.5], [0.8, 0.5, 0.5]);
        const group = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            surfaceOptions,
        );

        expect(group.userData.symmetryUsed).toBe(true);
        expect(group.userData.displayedRegionCount).toBe(4);
        expect(group.userData.generatedRegionCount).toBe(2);
        expect(group.userData.reusedRegionCount).toBe(2);
        expect(group.userData.marchingCubesPassCount).toBe(2);
        expect(group.children).toHaveLength(2);
        expect(group.userData.stitched).toBe(true);
        expect(group.userData.polygonCount).toBeGreaterThan(0);
    });

    test('keeps overlapping regions in one field so bridges have no internal border', () => {
        const structure = structureAt([0.4, 0.5, 0.5], [0.6, 0.5, 0.5]);

        expect(connectedIsosurfaceRegions(structure, 1.1)).toHaveLength(1);
        const group = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            { ...surfaceOptions, radius: 1.1 },
        );
        expect(group.userData.negativeDisplayedRegionCount).toBe(1);
    });

    test('reverses shared geometry winding for an improper transform', () => {
        const structure = structureAt([0.2, 0.5, 0.5], [0.8, 0.5, 0.5]);
        const group = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            { ...surfaceOptions, wireframe: false },
        );

        expect(group.userData.improperTransformCount).toBe(2);
        expect(group.children.every(child => child.geometry.getIndex())).toBe(true);
        for (const child of group.children) {
            const index = child.geometry.getIndex();
            const triangleKeys = new Set();
            for (let offset = 0; offset < index.count; offset += 3) {
                triangleKeys.add([
                    index.getX(offset),
                    index.getX(offset + 1),
                    index.getX(offset + 2),
                ].sort((first, second) => first - second).join(','));
            }
            expect(triangleKeys.size).toBe(index.count / 3);
        }
    });

    test('does not reuse a structure relation absent from the FCF map symmetry', () => {
        const structure = structureAt([0.2, 0.5, 0.5], [0.8, 0.5, 0.5]);
        const group = createSymmetryAwareIsosurfaces(
            densityMap([identity]),
            structure,
            surfaceOptions,
        );

        expect(group.userData.symmetryUsed).toBe(false);
        expect(group.userData.reusedRegionCount).toBe(0);
    });

    test('does not duplicate a region fixed by a special-position operation', () => {
        const structure = structureAt([0, 0, 0]);
        const group = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            surfaceOptions,
        );

        expect(group.userData.symmetryUsed).toBe(false);
        expect(group.children).toHaveLength(2);
    });

    test('reuses lattice translations even for a P1 map', () => {
        const structure = structureAt([0.2, 0.5, 0.5], [1.2, 0.5, 0.5]);
        const group = createSymmetryAwareIsosurfaces(
            densityMap([identity]),
            structure,
            surfaceOptions,
        );

        expect(group.userData.symmetryUsed).toBe(true);
        expect(group.userData.reusedRegionCount).toBe(2);
    });

    test('reports directly comparable surface-generation timings', () => {
        const structure = structureAt([0.2, 0.5, 0.5], [0.8, 0.5, 0.5]);
        const symmetryGroup = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            surfaceOptions,
        );
        const directGroup = createSymmetryAwareIsosurfaces(
            densityMap(),
            structure,
            { ...surfaceOptions, useSymmetry: false },
        );

        expect(symmetryGroup.userData.generationTimeMs).toBeGreaterThanOrEqual(0);
        expect(symmetryGroup.userData.marchingCubesTimeMs).toBeGreaterThanOrEqual(0);
        expect(directGroup.userData.generationTimeMs).toBeGreaterThanOrEqual(0);
        expect(directGroup.userData.polygonizationTimeMs).toBeGreaterThanOrEqual(0);
    });
});
