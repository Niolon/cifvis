import { describe, expect, test } from 'vitest';
import { DEFAULT_DIFFERENCE_DENSITY_OPTIONS } from '../density/difference-density-options.js';
import { DEFAULT_SCALAR_FIELD_OPTIONS } from '../density/scalar-field-options.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from '../density/isosurface-options.js';
import { DEFAULT_CONTOUR_LINE_OPTIONS } from '../density/contour-line-options.js';
import { resolveViewerOptions } from './crystal-viewer.js';
import { DEFAULT_VIEWER_OPTIONS } from './structure-settings.js';

/**
 * Asserts that every object reachable from a value is frozen.
 * @param {unknown} value - Value to inspect
 * @returns {void}
 */
function expectDeeplyFrozen(value) {
    if (!value || typeof value !== 'object') {
        return;
    }
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) {
        expectDeeplyFrozen(child);
    }
}

describe('viewer option defaults', () => {
    test('are deeply frozen and use the canonical density defaults', () => {
        expectDeeplyFrozen(DEFAULT_VIEWER_OPTIONS);
        expect(DEFAULT_VIEWER_OPTIONS.differenceDensity).toBe(DEFAULT_DIFFERENCE_DENSITY_OPTIONS);
        expect(DEFAULT_VIEWER_OPTIONS.scalarField).toBe(DEFAULT_SCALAR_FIELD_OPTIONS);
        expect(DEFAULT_VIEWER_OPTIONS.isosurface).toBe(DEFAULT_ISOSURFACE_OPTIONS);
        expect(DEFAULT_VIEWER_OPTIONS.contourLines).toBe(DEFAULT_CONTOUR_LINE_OPTIONS);
    });

    test('resolves detached nested options and preserves valid falsy overrides', () => {
        const input = {
            debug: false,
            bondDisorderColorsEnabled: false,
            plot2DBondOutlineWidth: 0,
            camera: { near: 0 },
            atomLabels: { text: { C1: 'custom' } },
            differenceDensity: { enabled: false },
        };
        const resolved = resolveViewerOptions(input, DEFAULT_VIEWER_OPTIONS.metalRingCentroidOptions);

        expect(resolved.debug).toBe(false);
        expect(resolved.bondDisorderColorsEnabled).toBe(false);
        expect(resolved.plot2DBondOutlineWidth).toBe(0);
        expect(resolved.camera.near).toBe(0);
        expect(resolved.camera.maxDistance).toBe(DEFAULT_VIEWER_OPTIONS.camera.maxDistance);
        expect(resolved.atomLabels.text.C1).toBe('custom');
        expect(resolved.differenceDensity.enabled).toBe(false);
        expect(resolved.selection).not.toBe(DEFAULT_VIEWER_OPTIONS.selection);
        expect(resolved.selection.markerColors).not.toBe(DEFAULT_VIEWER_OPTIONS.selection.markerColors);
        expect(resolved.elementProperties.C).not.toBe(DEFAULT_VIEWER_OPTIONS.elementProperties.C);

        resolved.selection.markerColors.push(0);
        expect(DEFAULT_VIEWER_OPTIONS.selection.markerColors).not.toContain(0);
        expect(input.atomLabels.text).toEqual({ C1: 'custom' });
    });
});
