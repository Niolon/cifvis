import { describe, expect, test, vi } from 'vitest';
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

describe('CrystalViewer progressive difference-density events', () => {
    test('subscribes and unsubscribes update listeners', () => {
        const viewer = { differenceDensityUpdateCallbacks: new Set() };
        const updates = [];
        const unsubscribe = CrystalViewer.prototype.onDifferenceDensityUpdate.call(
            viewer,
            update => updates.push(update),
        );

        CrystalViewer.prototype.notifyDifferenceDensityUpdate.call(viewer, { type: 'update', stepIndex: 0 });
        unsubscribe();
        CrystalViewer.prototype.notifyDifferenceDensityUpdate.call(viewer, { type: 'update', stepIndex: 1 });

        expect(updates).toEqual([{ type: 'update', stepIndex: 0 }]);
    });

    test('normalizes progressive steps and always includes the final surface resolution', () => {
        const viewer = {
            options: { differenceDensity: { progressiveSteps: [1, 0.5, -1, 0.5, 2] } },
        };
        expect(CrystalViewer.prototype.normalizedDifferenceDensitySteps.call(viewer)).toEqual([0.5, 1]);
    });

    test('passes the active coordinate CIF to anomalous-dispersion correction', () => {
        const viewer = {
            state: { currentCifContent: 'data_model', currentCifBlock: 'model' },
            options: {
                differenceDensity: {
                    anomalousDispersion: { target: 'second', table: 'Mo' },
                },
            },
        };

        expect(CrystalViewer.prototype.differenceDensityAnomalousDispersionOptions.call(viewer))
            .toEqual({
                target: 'second',
                table: 'Mo',
                cifText: 'data_model',
                cifBlock: 'model',
            });
        viewer.options.differenceDensity.anomalousDispersion = false;
        expect(CrystalViewer.prototype.differenceDensityAnomalousDispersionOptions.call(viewer))
            .toBeNull();
    });

    test('reuses one density map while increasing only surface resolution', () => {
        const densityMap = {
            cell: {},
            dimensions: [64, 128, 64],
            resolutionFraction: 1,
            reflectionCount: 100,
            coefficientCount: 200,
            sigma: 0.05,
            minimum: -0.2,
            maximum: 0.3,
        };
        const viewer = {
            state: {
                baseStructure: { cell: {} },
                displayStructure: {},
                differenceDensityGroup: null,
            },
            options: { differenceDensity: { resolution: 64 } },
            validateDifferenceDensityCell: vi.fn(),
            updateDifferenceDensity3D: vi.fn(function () {
                this.state.differenceDensityGroup = {
                    userData: {
                        polygonCount: this.state.differenceDensitySurfaceResolutionFraction * 1000,
                        resolution: this.state.differenceDensitySurfaceResolutionFraction * 64,
                    },
                };
            }),
            requestRender: vi.fn(),
            notifyDifferenceDensityUpdate: vi.fn(),
        };

        CrystalViewer.prototype.applyProgressiveDifferenceDensityMap.call(viewer, densityMap, {
            stepIndex: 0,
            totalSteps: 2,
            final: false,
            surfaceResolutionFraction: 0.5,
        });
        CrystalViewer.prototype.applyProgressiveDifferenceDensityMap.call(viewer, densityMap, {
            stepIndex: 1,
            totalSteps: 2,
            final: true,
            surfaceResolutionFraction: 1,
        });

        expect(viewer.state.differenceDensityMap).toBe(densityMap);
        expect(viewer.notifyDifferenceDensityUpdate.mock.calls.map(call => call[0]))
            .toMatchObject([
                { surfaceResolution: 32, polygonCount: 500, dimensions: [64, 128, 64] },
                { surfaceResolution: 64, polygonCount: 1000, dimensions: [64, 128, 64] },
            ]);
    });
});
