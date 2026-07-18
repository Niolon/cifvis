import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Atom, CrystalStructure, UnitCell } from '../structure/crystal.js';
import { FractPosition } from '../structure/position.js';
import { calculatePlanarContours, resolveContourPlane } from './plane-contours.js';
import { ThreeContourLineLayer } from '../ortep3d/three-contour-line-layer.js';

/** @returns {CrystalStructure} Four atoms in the fractional z=0.5 plane. */
function planarStructure() {
    return new CrystalStructure(
        new UnitCell(10, 10, 10, 90, 90, 90),
        [
            new Atom('C1', 'C', new FractPosition(0.3, 0.3, 0.5)),
            new Atom('C2', 'C', new FractPosition(0.7, 0.3, 0.5)),
            new Atom('C3', 'C', new FractPosition(0.5, 0.7, 0.5)),
            new Atom('H1', 'H', new FractPosition(0.5, 0.3, 0.5)),
        ],
    );
}

const field = {
    sigma: 0.1,
    contourMode: 'sigma',
    surfaceSign: 'both',
    fieldKind: 'difference-density',
    sourceType: 'test',
    sample(x, y) {
        return 0.5 - 10 * ((x - 0.5) ** 2 + (y - 0.5) ** 2);
    },
};

describe('planar scalar-field contours', () => {
    test('resolves atom-labelled and explicit fractional planes in Cartesian space', () => {
        const fromAtoms = resolveContourPlane(planarStructure(), {
            atoms: ['C1', 'C2', 'C3'],
        });
        const explicit = resolveContourPlane(planarStructure(), {
            coordinateSystem: 'fractional',
            origin: [0, 0, 0.5],
            normal: [0, 0, 1],
        });

        expect(Math.abs(fromAtoms.normal[2])).toBeCloseTo(1);
        expect(fromAtoms.origin[2]).toBeCloseTo(5);
        expect(explicit.origin[0]).toBeCloseTo(0);
        expect(explicit.origin[1]).toBeCloseTo(0);
        expect(explicit.origin[2]).toBeCloseTo(5);
        expect(explicit.normal[2]).toBeCloseTo(1);
    });

    test('extracts multiple positive and negative line levels on the plane', () => {
        const contours = calculatePlanarContours(field, planarStructure(), {
            plane: { atoms: ['C1', 'C2', 'C3'] },
            padding: 1,
            resolution: 24,
            maxResolution: 24,
            contourStep: 0.1,
            contourCount: 3,
            depthOffset: 0,
        });

        expect(contours.levels).toEqual([0.1, 0.2, 0.30000000000000004]);
        expect(contours.positiveSegments.length).toBeGreaterThan(0);
        expect(contours.negativeSegments.length).toBeGreaterThan(0);
        expect(contours.segmentCount).toBe(
            contours.positiveSegments.length + contours.negativeSegments.length,
        );
        for (const point of contours.positiveSegments.flat()) {
            expect(point[2]).toBeCloseTo(5);
        }
    });

    test('uses denser sub-levels and tricubic sampling by default', () => {
        const smoothField = {
            ...field,
            sample: vi.fn(field.sample),
            sampleCubic: vi.fn(field.sample),
        };
        const contours = calculatePlanarContours(smoothField, planarStructure(), {
            plane: { atoms: ['C1', 'C2', 'C3'] },
            padding: 1,
            resolution: 12,
            maxResolution: 12,
            gridSpacing: 1,
            depthOffset: 0,
        });

        expect(contours.levels).toHaveLength(20);
        expect(contours.levels[0]).toBeCloseTo(0.075);
        expect(contours.levels[1]).toBeCloseTo(0.15);
        expect(smoothField.sampleCubic).toHaveBeenCalled();
        expect(smoothField.sample).not.toHaveBeenCalled();
    });

    test('rejects missing and collinear atom plane definitions', () => {
        expect(() => resolveContourPlane(planarStructure(), {
            atoms: ['C1', 'C2', 'missing'],
        })).toThrow('Contour plane atom not found: missing');
        expect(() => resolveContourPlane(planarStructure(), {
            atoms: ['C1', 'H1', 'C2'],
        })).toThrow('must not all be collinear');
    });

    test('Three.js adapter creates only line objects and no background plane', () => {
        const parent = new THREE.Group();
        const layer = new ThreeContourLineLayer(parent, {
            plane: { atoms: ['C1', 'C2', 'C3'] },
            padding: 1,
            resolution: 20,
            maxResolution: 20,
            contourStep: 0.1,
            contourCount: 2,
            positiveColor: '#00ff00',
            negativeColor: '#ff0000',
            opacity: 1,
            lineWidth: 1,
            depthOffset: 0,
        });
        layer.setField(field);
        layer.setStructure(planarStructure());

        const statistics = layer.rebuild();

        expect(statistics.displayMode).toBe('contour-lines');
        expect(statistics.segmentCount).toBeGreaterThan(0);
        expect(layer.group.children.every(child => child.isLineSegments)).toBe(true);
        expect(layer.group.children.some(child => child.isMesh)).toBe(false);
        layer.dispose();
        expect(parent.children).toHaveLength(0);
    });
});
