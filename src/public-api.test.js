/**
 * @vi-environment jsdom
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

const coreNames = [
    'AtomLabelFilter',
    'BondGenerator',
    'BondGeometryFixer',
    'CIF',
    'CrystalStructure',
    'DisorderFilter',
    'HydrogenFilter',
    'IsolatedHydrogenFixer',
    'SymmetryGrower',
    'UAnisoADP',
    'atomLabelParts',
    'formatAtomLabel',
    'formatMeasurement',
    'formatValueEsd',
    'measureAtoms',
    'measurementAction',
    'tryToFixCifBlock',
];

const densityNames = [
    'BOHR_TO_ANGSTROM',
    'DEFAULT_CONTOUR_LINE_OPTIONS',
    'DEFAULT_DIFFERENCE_DENSITY_OPTIONS',
    'DEFAULT_ISOSURFACE_OPTIONS',
    'DEFAULT_SCALAR_FIELD_OPTIONS',
    'ScalarFieldGrid',
    'calculateDifferenceDensityMap',
    'calculateIAMStructureFactors',
    'calculatePlanarContours',
    'connectedIsosurfaceRegions',
    'createCifDifferenceDensityDataset',
    'createIAMStructureFactorCalculator',
    'createIsosurfaces',
    'createSymmetryAwareIsosurfaces',
    'evaluateCromerMann',
    'isosurfaceBounds',
    'isosurfaceResolution',
    'isSystematicAbsence',
    'lookupAnomalousDispersion',
    'lookupCromerMann',
    'mergeReflectionIntensities',
    'parseCube',
    'parseDifferenceDensitySource',
    'readReflectionIntensities',
    'resolveContourPlane',
];

describe('public package boundaries', () => {
    test('exports only the stable root API and has no registration side effect', async () => {
        expect(customElements.get('cifview-widget')).toBeUndefined();
        const root = await import('./index.js');
        expect(Object.keys(root).sort()).toEqual([
            ...coreNames,
            'CifViewWidget',
            'CrystalViewer',
            'DEFAULT_VIEWER_OPTIONS',
            'MeasurementControls',
        ].sort());
        expect(customElements.get('cifview-widget')).toBeUndefined();
    });

    test('exports the stable browser-independent core API', async () => {
        const core = await import('./core.js');
        expect(Object.keys(core).sort()).toEqual(coreNames.sort());
        expect('CrystalViewer' in core).toBe(false);
        expect('CifViewWidget' in core).toBe(false);
    });

    test('exports the supported numerical density API', async () => {
        const density = await import('./density.js');
        expect(Object.keys(density).sort()).toEqual(densityNames.sort());
    });

    test('exports only the declared experimental integrations', async () => {
        const experimental = await import('./experimental.js');
        expect(Object.keys(experimental).sort()).toEqual([
            'ORTEP3JsStructure',
            'ThreeContourLineLayer',
            'ThreeIsosurfaceLayer',
            'ViewerInteractionCoupling',
            'coupleViewerInteractions',
            'generateDisorderGroupIcon',
            'getDisorderIcon',
        ].sort());
    });

    test('removes nobrowser and declares every supported subpath', async () => {
        const packagePath = resolve(process.cwd(), 'package.json');
        const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
        expect(packageJson.exports).toEqual({
            '.': './src/index.js',
            './core': './src/core.js',
            './density': './src/density.js',
            './experimental': './src/experimental.js',
            './widget/register': './src/widget/register.js',
        });
        expect(packageJson.exports['./nobrowser']).toBeUndefined();
    });

    test('registers the widget explicitly and idempotently', async () => {
        const define = vi.spyOn(customElements, 'define');
        await import('./widget/register.js');
        await import('./widget/register.js');
        const { CifViewWidget } = await import('./index.js');
        expect(customElements.get('cifview-widget')).toBe(CifViewWidget);
        expect(define).toHaveBeenCalledTimes(1);
    });
});
