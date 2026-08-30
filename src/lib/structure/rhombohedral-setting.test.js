import { describe, expect, test } from 'vitest';
import { isRhombohedralCell, toRhombohedralSetting } from './rhombohedral-setting.js';
import { SPACE_GROUP_TABLE } from './space-group-table.js';
import { SymmetryOperation } from './cell-symmetry.js';
import { UnitCell } from './crystal.js';

describe('isRhombohedralCell', () => {
    test('accepts a = b = c with equal angles other than 90 degrees', () => {
        expect(isRhombohedralCell(new UnitCell(11.301, 11.301, 11.301, 52.93, 52.93, 52.93)))
            .toBe(true);
    });

    test('rejects the hexagonal description of the same group', () => {
        expect(isRhombohedralCell(new UnitCell(10, 10, 24, 90, 90, 120))).toBe(false);
    });

    test('rejects a cubic cell, where the angles are 90 degrees', () => {
        expect(isRhombohedralCell(new UnitCell(10, 10, 10, 90, 90, 90))).toBe(false);
    });
});

describe('toRhombohedralSetting', () => {
    /**
     * @param {number} number - International Tables number.
     * @returns {string[]} Hexagonal-setting operators from the standard table.
     */
    const hexagonalOperations = number =>
        SPACE_GROUP_TABLE.find(entry => entry.number === number).operations;

    test('R -3 collapses to the six primitive rhombohedral operators', () => {
        // The R centring contributes two of every three hexagonal operators; on
        // rhombohedral axes those become whole lattice translations and drop out,
        // leaving the 3-fold along the body diagonal plus inversion.
        const operations = toRhombohedralSetting(hexagonalOperations(148));

        expect(operations).toHaveLength(6);
        expect(new Set(operations)).toEqual(new Set([
            'x,y,z', 'z,x,y', 'y,z,x', '-x,-y,-z', '-z,-x,-y', '-y,-z,-x',
        ]));
    });

    test('R 3 collapses to the three rotations alone', () => {
        const operations = toRhombohedralSetting(hexagonalOperations(146));

        expect(operations).toHaveLength(3);
        expect(new Set(operations)).toEqual(new Set(['x,y,z', 'z,x,y', 'y,z,x']));
    });

    test('every R group reduces to exactly a third of its hexagonal operators', () => {
        for (const entry of SPACE_GROUP_TABLE.filter(e => e.universal_h_m?.endsWith(':H'))) {
            const operations = toRhombohedralSetting(entry.operations);
            expect(operations).toHaveLength(entry.operations.length / 3);
        }
    });

    test('the converted operators are isometries of a rhombohedral cell', () => {
        // The defect this guards against is subtle: hexagonal operators applied to a
        // rhombohedral cell still produce plausible-looking coordinates, but they do
        // not preserve distance, so bonded pairs silently change length.
        const cell = new UnitCell(11.301, 11.301, 11.301, 52.93, 52.93, 52.93);
        const matrix = cell.fractToCartMatrix.toArray();
        const toCartesian = f => [0, 1, 2].map(row =>
            matrix[row][0] * f[0] + matrix[row][1] * f[1] + matrix[row][2] * f[2]);
        const first = [0.1234, 0.2345, 0.3456];
        const second = [0.2345, 0.4567, 0.1234];
        const reference = toCartesian(first);
        const other = toCartesian(second);
        const original = Math.hypot(
            reference[0] - other[0], reference[1] - other[1], reference[2] - other[2],
        );

        for (const operation of toRhombohedralSetting(hexagonalOperations(148))) {
            const symmetryOperation = new SymmetryOperation(operation);
            const imageFirst = toCartesian(symmetryOperation.applyToPoint(first));
            const imageSecond = toCartesian(symmetryOperation.applyToPoint(second));
            const imaged = Math.hypot(
                imageFirst[0] - imageSecond[0],
                imageFirst[1] - imageSecond[1],
                imageFirst[2] - imageSecond[2],
            );
            expect(imaged).toBeCloseTo(original, 6);
        }
    });
});
