/* eslint-disable jsdoc/require-param -- local test fixture helper */
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { Atom, CrystalStructure, UnitCell } from '../structure/crystal.js';
import { FractPosition } from '../structure/position.js';
import {
    createIsosurfaces,
    isosurfaceBounds,
    isosurfaceResolution,
} from './isosurface.js';
import { ThreeIsosurfaceLayer } from '../ortep3d/three-isosurface-layer.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from './isosurface-options.js';

/** @returns {CrystalStructure} Minimal structure with one atom at fractional x. */
function structureAt(x) {
    return new CrystalStructure(
        new UnitCell(10, 10, 10, 90, 90, 90),
        [new Atom('C1', 'C', new FractPosition(x, 0.5, 0.5))],
        [],
        [],
        null,
    );
}

const densityMap = {
    sigma: 0.1,
    sample(x, y, z) {
        return Math.sin(2 * Math.PI * x) + 0.2 * Math.cos(2 * Math.PI * (y + z));
    },
};

describe('isosurfaces', () => {
    test('retains fractional positions outside the cell for symmetry-grown fragments', () => {
        const bounds = isosurfaceBounds(structureAt(1.2), 1.5);

        expect(bounds.minimum[0]).toBeCloseTo(1.05);
        expect(bounds.maximum[0]).toBeCloseTo(1.35);
    });

    test('creates paired positive and negative surfaces around displayed atoms', () => {
        const group = createIsosurfaces(densityMap, structureAt(0.5), {
            resolution: 8,
            radius: 2,
            sigmaLevel: 1,
            maxPolyCount: 2000,
        });

        expect(group.name).toBe('Isosurface');
        expect(group.children.map(child => child.userData.sign)).toEqual(['positive', 'negative']);
        expect(group.userData.level).toBeCloseTo(0.1);
        expect(group.userData.bounds.minimum[0]).toBeCloseTo(0.3);
        expect(group.userData.bounds.maximum[0]).toBeCloseTo(0.7);
        expect(group.children.every(child => child.isLineSegments)).toBe(true);
    });

    test('renders solid meshes when wireframe display is disabled', () => {
        const group = createIsosurfaces(densityMap, structureAt(0.5), {
            resolution: 8,
            radius: 2,
            sigmaLevel: 1,
            maxPolyCount: 2000,
            wireframe: false,
        });

        expect(group.children.every(child => child.isMesh)).toBe(true);
        expect(group.children.every(child => !child.material.wireframe)).toBe(true);
    });

    test('uses the sparse typed-array extractor with detailed cold-stage statistics', () => {
        const group = createIsosurfaces(densityMap, structureAt(0.5), {
            resolution: 16,
            radius: 2,
            sigmaLevel: 1,
            surfaceExtractor: 'cifvis',
            wireframe: false,
        });

        expect(group.children.every(child => child.isMesh)).toBe(true);
        expect(group.userData.surfaceExtractor).toBe('cifvis');
        expect(group.userData.atomDistanceTestCount).toBe(0);
        expect(group.userData.fieldSampleCount)
            .toBeLessThanOrEqual(group.userData.surfaceLatticeNodeCount);
        expect(group.userData.activeCellCount).toBeGreaterThan(0);
        expect(group.userData.polygonCount).toBeGreaterThan(0);
        expect(group.userData.surfaceTotalTimeMs).toBeGreaterThanOrEqual(0);
        expect(group.userData.allocatedGeometryBytes).toBeGreaterThan(0);
    });

    test('reports attributable named stages for the Three.js reference path', () => {
        const group = createIsosurfaces(densityMap, structureAt(0.5), {
            resolution: 16,
            radius: 2,
            sigmaLevel: 1,
            surfaceExtractor: 'three-marching-cubes',
        });
        const namedTime = [
            'surfaceBoundsTimeMs',
            'surfaceMaskTimeMs',
            'surfaceSamplingTimeMs',
            'surfaceClassificationTimeMs',
            'surfaceAllocationTimeMs',
            'surfaceInterpolationTimeMs',
            'surfaceGeometryTimeMs',
            'surfaceWireframeTimeMs',
        ].reduce((sum, key) => sum + group.userData[key], 0);

        expect(group.userData.surfaceExtractor).toBe('three-marching-cubes');
        expect(group.userData.atomDistanceTestCount).toBeGreaterThan(0);
        expect(group.userData.threeMarchingCubesTimeMs).toBeGreaterThanOrEqual(0);
        expect(namedTime / group.userData.surfaceTotalTimeMs).toBeGreaterThan(0.8);
    });

    test('honours a Cube map absolute level and positive-only surface', () => {
        const group = createIsosurfaces({
            ...densityMap,
            defaultLevel: 0.3,
            surfaceSign: 'positive',
        }, structureAt(0.5), {
            resolution: 8,
            radius: 2,
            maxPolyCount: 2000,
        });

        expect(group.userData.level).toBe(0.3);
        expect(group.children.map(child => child.userData.sign)).toEqual(['positive']);
    });

    test('increases final mesh resolution with physical draw size up to a cap', () => {
        const small = structureAt(0.5);
        const large = new CrystalStructure(
            small.cell,
            [
                new Atom('C1', 'C', new FractPosition(0.1, 0.5, 0.5)),
                new Atom('C2', 'C', new FractPosition(0.9, 0.5, 0.5)),
            ],
            [],
            [],
            null,
        );

        expect(isosurfaceResolution(small, {
            resolution: 64,
            maxResolution: 96,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(64);
        expect(isosurfaceResolution(large, {
            resolution: 64,
            maxResolution: 96,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(75);
        expect(isosurfaceResolution(large, {
            resolution: 64,
            maxResolution: 70,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(70);
    });

    test('Three layer rebuilds clipping bounds when the displayed atoms change', () => {
        const parent = new THREE.Group();
        const layer = new ThreeIsosurfaceLayer(parent, {
            ...DEFAULT_ISOSURFACE_OPTIONS,
            resolution: 8,
            radius: 1.5,
            sigmaLevel: 1,
            maxPolyCount: 2000,
        });
        layer.setField(densityMap);
        layer.setStructure(structureAt(0.2));
        layer.rebuild();
        const originalGroup = layer.group;
        const originalMinimum = originalGroup.userData.bounds.minimum[0];

        layer.setStructure(structureAt(1.2));
        layer.rebuild();

        expect(originalGroup.parent).toBeNull();
        expect(layer.group).not.toBe(originalGroup);
        expect(layer.group.userData.bounds.minimum[0])
            .toBeCloseTo(originalMinimum + 1);
    });

    test('Three layer gives deformation fields their distinct default colors', () => {
        const layer = new ThreeIsosurfaceLayer(new THREE.Group(), {
            ...DEFAULT_ISOSURFACE_OPTIONS,
            resolution: 8,
        });
        layer.setField({ ...densityMap, fieldKind: 'deformation-density' });
        layer.setStructure(structureAt(0.5));
        layer.rebuild();

        const colors = Object.fromEntries(layer.group.children.map(
            child => [child.userData.sign, `#${child.material.color.getHexString().toUpperCase()}`],
        ));
        expect(colors).toEqual({ positive: '#4FC3F7', negative: '#FF9800' });
        expect(colors.positive).not.toBe(DEFAULT_ISOSURFACE_OPTIONS.positiveColor);
        expect(colors.negative).not.toBe(DEFAULT_ISOSURFACE_OPTIONS.negativeColor);
    });

    test('reuses fixed-lattice patches across displayed expansion changes', () => {
        const parent = new THREE.Group();
        const layer = new ThreeIsosurfaceLayer(parent, {
            ...DEFAULT_ISOSURFACE_OPTIONS,
            generationMode: 'patch-cache',
            gridSpacing: 1,
            radius: 2,
            sigmaLevel: 1,
        });
        layer.setField(densityMap);
        layer.setStructure(structureAt(0.2));
        const first = layer.rebuild();
        layer.setStructure(new CrystalStructure(
            structureAt(0.2).cell,
            [
                ...structureAt(0.2).atoms,
                new Atom('C2', 'C', new FractPosition(1.2, 0.5, 0.5)),
            ],
            [],
            [],
            null,
        ));
        const expanded = layer.rebuild();

        expect(first.cacheMissCellCount).toBeGreaterThan(0);
        expect(expanded.cacheHitCellCount).toBeGreaterThan(0);
        expect(expanded.patchCacheBytes).toBeGreaterThan(0);
    });

    test('retains cached CPU geometry across appearance-only changes', () => {
        const layer = new ThreeIsosurfaceLayer(new THREE.Group(), {
            ...DEFAULT_ISOSURFACE_OPTIONS,
            resolution: 8,
            radius: 1.5,
            sigmaLevel: 1,
            maxPolyCount: 2000,
        });
        layer.setField(densityMap);
        layer.setStructure(structureAt(0.5));
        const cold = layer.rebuild();
        const coldGroup = layer.group;
        layer.setOptions({ positiveColor: '#123456', opacity: 0.8 });
        const recolored = layer.rebuild();

        expect(cold.surfaceTotalTimeMs).toBeGreaterThanOrEqual(0);
        expect(recolored.appearanceCacheHitCount).toBeGreaterThan(0);
        expect(recolored.surfaceTotalTimeMs).toBe(0);
        expect(layer.group).toBe(coldGroup);
        const positive = layer.group.children.find(child => child.userData.sign === 'positive');
        expect(`#${positive.material.color.getHexString()}`).toBe('#123456');
        expect(positive.material.opacity).toBe(0.8);
    });
});
