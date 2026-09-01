/**
 * @vi-environment jsdom
 */

import { glob, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
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
                import: './dist/cifvis.js',
                default: './dist/cifvis.js',
            },
            './core': {
                types: './dist/core.d.ts',
                import: './dist/core.js',
                default: './dist/core.js',
            },
            './density': {
                types: './dist/density.d.ts',
                import: './dist/density.js',
                default: './dist/density.js',
            },
            './experimental': {
                types: './dist/experimental.d.ts',
                import: './dist/experimental.js',
                default: './dist/experimental.js',
            },
            './widget/register': {
                types: './dist/widget/register.d.ts',
                import: './dist/widget/register.js',
                default: './dist/widget/register.js',
            },
        });
        expect(packageJson.types).toBe('./dist/index.d.ts');
        expect(packageJson.sideEffects).toEqual(['./dist/widget/register.js']);
        expect(packageJson.exports['./nobrowser']).toBeUndefined();
    });

    test('uses native-ESM-compatible relative import specifiers', async () => {
        const invalidSpecifiers = [];
        for await (const filePath of glob('src/**/*.js')) {
            if (filePath.endsWith('.test.js')) {
                continue;
            }
            const source = await readFile(filePath, 'utf8');
            const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g;
            for (const match of source.matchAll(importPattern)) {
                const specifier = match[1];
                const pathWithoutQuery = specifier.split('?')[0];
                if (specifier.startsWith('.') && !extname(pathWithoutQuery)) {
                    invalidSpecifiers.push(`${filePath}: ${specifier}`);
                }
            }
        }
        expect(invalidSpecifiers).toEqual([]);
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
