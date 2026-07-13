import { describe, expect, test } from 'vitest';
import { CrystalViewer } from './crystal-viewer.js';

describe('CrystalViewer rendering option validation', () => {
    test('rejects an invalid render style before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, { renderStyle: 'print' })).toThrow(
            'Invalid render style: "print". Must be one of: standard, 2d',
        );
    });

    test('rejects an invalid atom ellipsoid style before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, { atomEllipsoidStyle: 'wireframe' })).toThrow(
            'Invalid atom ellipsoid style: "wireframe". Must be one of: solid, cutout',
        );
    });
});
