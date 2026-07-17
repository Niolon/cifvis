import { describe, expect, test } from 'vitest';
import { CrystalViewer } from './crystal-viewer.js';

describe('CrystalViewer rendering option validation', () => {
    test('rejects an invalid render style before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, { renderStyle: 'print' })).toThrow(
            'Invalid render style: "print". Must be one of: solid-3d, cutout-3d, cutout-2d',
        );
    });

    test('rejects invalid atom-label callout placement before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { calloutPlacement: 'corners' },
        })).toThrow(
            'Invalid atom label callout placement: "corners". ' +
            'Must be one of: structure, viewport',
        );
    });

    test('lists all omission policies when rejecting an invalid placement mode', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { placementMode: 'instant' },
        })).toThrow(
            'Invalid atom label placement mode: "instant". ' +
            'Must be one of: auto-omit, quality-omit, performance-omit, maximum-coverage',
        );
    });

    test('rejects a non-positive connector ceiling before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { maxConnectorLength: 0 },
        })).toThrow('atomLabels.maxConnectorLength must be a positive number');
    });

    test('rejects a non-positive performance tile size before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { performanceNoSpaceCellSize: 0 },
        })).toThrow('atomLabels.performanceNoSpaceCellSize must be a positive number');
    });

    test('rejects a fractional automatic performance threshold', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { autoPerformanceLabelThreshold: 2.5 },
        })).toThrow('atomLabels.autoPerformanceLabelThreshold must be a non-negative integer');
    });
});
