/* eslint-disable jsdoc/require-param -- local test fixture helper */
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { Atom, CrystalStructure, UnitCell } from '../structure/crystal.js';
import { FractPosition } from '../structure/position.js';
import {
    createDifferenceDensitySurfaces,
    differenceDensityBounds,
    differenceDensitySurfaceResolution,
} from './difference-density-surface.js';
import { CrystalViewer } from '../ortep3d/crystal-viewer.js';

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

describe('difference-density surfaces', () => {
    test('retains fractional positions outside the cell for symmetry-grown fragments', () => {
        const bounds = differenceDensityBounds(structureAt(1.2), 1.5);

        expect(bounds.minimum[0]).toBeCloseTo(1.05);
        expect(bounds.maximum[0]).toBeCloseTo(1.35);
    });

    test('creates paired positive and negative surfaces around displayed atoms', () => {
        const group = createDifferenceDensitySurfaces(densityMap, structureAt(0.5), {
            resolution: 8,
            radius: 2,
            sigmaLevel: 1,
            maxPolyCount: 2000,
        });

        expect(group.name).toBe('DifferenceDensity');
        expect(group.children.map(child => child.userData.sign)).toEqual(['positive', 'negative']);
        expect(group.userData.level).toBeCloseTo(0.1);
        expect(group.userData.bounds.minimum[0]).toBeCloseTo(0.3);
        expect(group.userData.bounds.maximum[0]).toBeCloseTo(0.7);
        expect(group.children.every(child => child.material.wireframe)).toBe(true);
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

        expect(differenceDensitySurfaceResolution(small, {
            resolution: 64,
            maxResolution: 96,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(64);
        expect(differenceDensitySurfaceResolution(large, {
            resolution: 64,
            maxResolution: 96,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(75);
        expect(differenceDensitySurfaceResolution(large, {
            resolution: 64,
            maxResolution: 70,
            gridSpacing: 0.15,
            radius: 1.5,
        })).toBe(70);
    });

    test('viewer rebuilds clipping bounds when a growth mode changes the displayed atoms', () => {
        const viewer = {
            state: {
                differenceDensityMap: densityMap,
                differenceDensityGroup: null,
            },
            options: {
                differenceDensity: {
                    resolution: 8,
                    radius: 1.5,
                    sigmaLevel: 1,
                    maxPolyCount: 2000,
                },
            },
            moleculeContainer: new THREE.Group(),
            removeDifferenceDensity3D() {
                return CrystalViewer.prototype.removeDifferenceDensity3D.call(this);
            },
        };

        CrystalViewer.prototype.updateDifferenceDensity3D.call(viewer, structureAt(0.2));
        const originalGroup = viewer.state.differenceDensityGroup;
        const originalMinimum = originalGroup.userData.bounds.minimum[0];

        CrystalViewer.prototype.updateDifferenceDensity3D.call(viewer, structureAt(1.2));

        expect(originalGroup.parent).toBeNull();
        expect(viewer.state.differenceDensityGroup).not.toBe(originalGroup);
        expect(viewer.state.differenceDensityGroup.userData.bounds.minimum[0])
            .toBeCloseTo(originalMinimum + 1);
    });
});
