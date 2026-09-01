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

    test('removes nobrowser and declares runtime and type entry points', async () => {
        const packagePath = resolve(process.cwd(), 'package.json');
        const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
        expect(packageJson.exports).toEqual({
            '.': {
                types: './dist/index.d.ts',
                import: './src/index.js',
                default: './src/index.js',
            },
            './core': {
                types: './dist/core.d.ts',
                import: './src/core.js',
                default: './src/core.js',
            },
            './density': {
                types: './dist/density.d.ts',
                import: './src/density.js',
                default: './src/density.js',
            },
            './experimental': {
                types: './dist/experimental.d.ts',
                import: './src/experimental.js',
                default: './src/experimental.js',
            },
            './widget/register': {
                types: './dist/widget/register.d.ts',
                import: './src/widget/register.js',
                default: './src/widget/register.js',
            },
        });
        expect(packageJson.types).toBe('./dist/index.d.ts');
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
