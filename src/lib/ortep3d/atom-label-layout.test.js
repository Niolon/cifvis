import { describe, expect, test } from 'vitest';
import {
    layoutAtomLabels,
    pointInPolygon,
    rectangleOverlapsCircle,
    rectanglesOverlap,
    segmentIntersectsRectangle,
    segmentsOverlap,
} from './atom-label-layout.js';
import { findSmallRings } from './atom-label-manager.js';

const options = {
    atomPadding: 3,
    labelPadding: 2,
    viewportPadding: 4,
    fallbackDistance: 18,
    ringPenalty: 1000,
    movementPenalty: 80,
    leaderWidth: 1,
    maxVisible: Infinity,
};

/**
 * Creates a compact projected-label fixture.
 * @param {string} id - Atom ID
 * @param {number} x - Anchor x
 * @param {number} y - Anchor y
 * @param {{x: number, y: number}} preferredDirection - Preferred direction
 * @param {number} priority - Label priority
 * @returns {object} Label fixture
 */
function label(id, x, y, preferredDirection = { x: 1, y: 0 }, priority = 0) {
    return {
        id,
        text: id,
        x,
        y,
        radius: 8,
        width: 20,
        height: 12,
        preferredDirection,
        priority,
    };
}

describe('atom label layout geometry', () => {
    test('detects rectangle and atom intersections', () => {
        expect(rectanglesOverlap(
            { left: 0, right: 10, top: 0, bottom: 10 },
            { left: 9, right: 20, top: 9, bottom: 20 },
        )).toBe(true);
        expect(rectangleOverlapsCircle(
            { left: 0, right: 10, top: 0, bottom: 10 },
            { x: 12, y: 5, radius: 3 },
        )).toBe(true);
        expect(segmentIntersectsRectangle(
            { x1: 0, y1: 5, x2: 20, y2: 5, radius: 1 },
            { left: 8, right: 12, top: 0, bottom: 10 },
        )).toBe(true);
        expect(segmentsOverlap(
            { x1: 0, y1: 0, x2: 20, y2: 20, radius: 1 },
            { x1: 0, y1: 20, x2: 20, y2: 0, radius: 1 },
        )).toBe(true);
        expect(segmentsOverlap(
            { x1: 0, y1: 0, x2: 5, y2: 0, radius: 1 },
            { x1: 10, y1: 0, x2: 15, y2: 0, radius: 1 },
        )).toBe(false);
    });

    test('detects points in ring polygons', () => {
        const square = [
            { x: 0, y: 0 }, { x: 10, y: 0 },
            { x: 10, y: 10 }, { x: 0, y: 10 },
        ];
        expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    test('never overlaps atom obstacles or other placed labels', () => {
        const obstacles = [
            { x: 80, y: 60, radius: 10 },
            { x: 120, y: 60, radius: 10 },
        ];
        const result = layoutAtomLabels(
            [label('C1', 80, 60), label('C2', 120, 60, { x: -1, y: 0 })],
            obstacles,
            [],
            [],
            { width: 200, height: 120 },
            options,
        );

        expect(result.placed).toHaveLength(2);
        for (const placed of result.placed) {
            expect(obstacles.some(atom => rectangleOverlapsCircle(placed.rect, atom))).toBe(false);
        }
        expect(rectanglesOverlap(result.placed[0].rect, result.placed[1].rect)).toBe(false);
    });

    test('uses a ring interior only as a soft penalty', () => {
        const ring = [[
            { x: 60, y: 20 }, { x: 145, y: 20 },
            { x: 145, y: 100 }, { x: 60, y: 100 },
        ]];
        const result = layoutAtomLabels(
            [label('C1', 55, 60, { x: 1, y: 0 })],
            [{ x: 55, y: 60, radius: 8 }],
            [],
            ring,
            { width: 200, height: 120 },
            options,
        );
        expect(result.placed).toHaveLength(1);
        expect(pointInPolygon(result.placed[0], ring[0])).toBe(false);
    });

    test('hides labels when collision-free placement is impossible', () => {
        const result = layoutAtomLabels(
            [label('C1', 10, 10)],
            [{ x: 10, y: 10, radius: 8 }],
            [],
            [],
            { width: 20, height: 20 },
            options,
        );
        expect(result.placed).toHaveLength(0);
        expect(result.hidden).toEqual([{ id: 'C1', text: 'C1', reason: 'no-space' }]);
    });

    test('honours priority when maxVisible is limited', () => {
        const result = layoutAtomLabels(
            [label('low', 50, 50), label('high', 150, 50, { x: 1, y: 0 }, 10)],
            [],
            [],
            [],
            { width: 240, height: 100 },
            { ...options, maxVisible: 1 },
        );
        expect(result.placed.map(item => item.id)).toEqual(['high']);
        expect(result.hidden).toContainEqual({ id: 'low', text: 'low', reason: 'max-visible' });
    });

    test('keeps label rectangles away from projected bonds', () => {
        const bonds = [{ x1: 108, y1: 60, x2: 190, y2: 60, radius: 4 }];
        const result = layoutAtomLabels(
            [label('C1', 100, 60, { x: 1, y: 0 })],
            [{ id: 'C1', x: 100, y: 60, radius: 8 }],
            bonds,
            [],
            { width: 220, height: 120 },
            options,
        );
        expect(result.placed).toHaveLength(1);
        expect(segmentIntersectsRectangle(bonds[0], result.placed[0].rect)).toBe(false);
    });
});

describe('small-ring topology hint', () => {
    test('finds a six-member chordless cycle', () => {
        const atoms = Array.from({ length: 6 }, (_, index) => ({
            label: `C${index + 1}`,
            uniqueId: `C${index + 1}|1_555`,
            atomType: 'C',
        }));
        const bonds = atoms.map((atom, index) => ({
            atom1Id: atom.uniqueId,
            atom2Id: atoms[(index + 1) % atoms.length].uniqueId,
            atom1Label: atom.label,
            atom2Label: atoms[(index + 1) % atoms.length].label,
            bondLength: 1.4,
        }));
        const rings = findSmallRings({ atoms, bonds });
        expect(rings).toHaveLength(1);
        expect(new Set(rings[0])).toEqual(new Set(atoms.map(atom => atom.uniqueId)));
    });
});
