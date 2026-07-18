import { describe, expect, test } from 'vitest';
import { getPlaygroundViewerOptions, parseContourPlaneFlag } from './playground-options.js';

describe('playground viewer URL options', () => {
    test('parses best-fit and atom-defined contour planes', () => {
        expect(parseContourPlaneFlag('best-fit')).toEqual({ mode: 'best-fit' });
        expect(parseContourPlaneFlag('atoms:C1,C2,O3')).toEqual({
            atoms: ['C1', 'C2', 'O3'],
        });
    });

    test('parses explicit fractional and Cartesian planes', () => {
        expect(parseContourPlaneFlag('frac:0,0,0.5:0,0,1')).toEqual({
            coordinateSystem: 'fractional',
            origin: [0, 0, 0.5],
            normal: [0, 0, 1],
        });
        expect(parseContourPlaneFlag('cart:1,2,3:0,1,0')).toEqual({
            coordinateSystem: 'cartesian',
            origin: [1, 2, 3],
            normal: [0, 1, 0],
        });
    });

    test('enables contours only for a valid plane flag', () => {
        expect(getPlaygroundViewerOptions('?contours=atoms:C1,C2,C3')).toMatchObject({
            contourLines: { enabled: true, plane: { atoms: ['C1', 'C2', 'C3'] } },
        });
        expect(getPlaygroundViewerOptions('?contours=atoms:C1,C2')).not.toHaveProperty(
            'contourLines',
        );
    });
});
