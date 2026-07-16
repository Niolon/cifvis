import { describe, expect, test } from 'vitest';
import { CrystalViewer } from './crystal-viewer.js';

describe('CrystalViewer rendering option validation', () => {
    test('rejects an invalid render style before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, { renderStyle: 'print' })).toThrow(
            'Invalid render style: "print". Must be one of: solid-3d, cutout-3d, cutout-2d',
        );
    });
});
