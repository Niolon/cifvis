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

    test.each([
        ['placementMode', ''],
        ['placementMode', null],
        ['calloutPlacement', ''],
        ['calloutPlacement', false],
    ])('rejects falsy invalid atom-label %s values', (option, value) => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { [option]: value },
        })).toThrow(`Invalid atom label ${option === 'placementMode' ?
            'placement mode' : 'callout placement'}`);
    });

    test('rejects invalid constructor label selections before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { show: 'C1' },
        })).toThrow(
            'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
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

describe('CrystalViewer atom-label runtime option validation', () => {
    test.each([
        ['placementMode', ''],
        ['calloutPlacement', null],
    ])('rejects falsy invalid %s updates', (option, value) => {
        expect(() => CrystalViewer.prototype.updateAtomLabelOptions.call({}, {
            [option]: value,
        })).toThrow(`Invalid atom label ${option === 'placementMode' ?
            'placement mode' : 'callout placement'}`);
    });

    test('rejects a scalar atom selector instead of silently hiding labels', () => {
        expect(() => CrystalViewer.prototype.setAtomLabels.call({}, 'C1')).toThrow(
            'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
        );
    });

    test('rejects malformed entries in a label request array', () => {
        expect(() => CrystalViewer.prototype.setAtomLabels.call({}, ['C1', { text: 'oxygen' }]))
            .toThrow(
                'atomLabels.show must be "none", "all", "non-hydrogen", ' +
                'or an array of label requests',
            );
    });

    test('does not replace active options with explicit undefined partial values', () => {
        const viewer = {
            options: {
                atomLabels: {
                    placementMode: 'quality-omit',
                    calloutPlacement: 'structure',
                    text: {},
                },
            },
            atomLabelManager: { setOptions: () => {} },
            requestRender: () => {},
        };

        CrystalViewer.prototype.updateAtomLabelOptions.call(viewer, {
            placementMode: undefined,
            calloutPlacement: undefined,
        });

        expect(viewer.options.atomLabels.placementMode).toBe('quality-omit');
        expect(viewer.options.atomLabels.calloutPlacement).toBe('structure');
    });
});
