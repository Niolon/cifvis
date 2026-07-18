import { beforeEach, describe, expect, test } from 'vitest';
import defaultSettings from '../../src/lib/ortep3d/structure-settings.js';
import optionsData from '../../docs/.vitepress/data/options-data.json';
import {
    STORAGE_KEY,
    buildSettingsSchema,
    classifyChangedPaths,
    clearStoredOptions,
    deepEqual,
    deletePath,
    deserializePartial,
    filterSchema,
    getPath,
    hasPath,
    humanizeLabel,
    loadStoredOptions,
    mergedValue,
    normalizePartial,
    plainDescription,
    saveStoredOptions,
    serializePartial,
    setPath,
    validateImportedOptions,
} from './playground-settings.js';

const schema = buildSettingsSchema();
const allRows = schema.flatMap((group) => group.rows.filter((row) => !row.divider));

describe('settings schema', () => {
    test('covers every generated options row exactly once', () => {
        const generatorPaths = Object.values(optionsData).flat().map((row) => row.path);
        const schemaPaths = allRows.map((row) => row.path);
        expect(schemaPaths.sort()).toEqual([...generatorPaths].sort());
        expect(new Set(schemaPaths).size).toBe(schemaPaths.length);
    });

    test('every row resolves a typed default, label, and description', () => {
        // Tags are stripped; decoded literals like group<rank> may remain.
        const problems = allRows
            .filter((row) => row.default === undefined ||
                row.label.length === 0 ||
                row.description.length === 0 ||
                /<(code|a|em|strong)\b/i.test(row.description))
            .map((row) => row.path);
        expect(problems).toEqual([]);
    });

    test('enum row defaults are members of their value lists', () => {
        const offenders = allRows
            .filter((row) => row.control === 'select')
            .filter((row) => (row.default === null
                ? row.nullable !== true
                : !row.enumValues.includes(row.default)))
            .map((row) => row.path);
        expect(offenders).toEqual([]);
    });

    test('controls match default types', () => {
        const offenders = allRows
            .filter((row) => (typeof row.default === 'boolean' && row.control !== 'checkbox') ||
                (typeof row.default === 'number' && !['number', 'select'].includes(row.control)))
            .map((row) => row.path);
        expect(offenders).toEqual([]);
    });

    test('element section lists elements with three editable keys', () => {
        const elements = schema.find((group) => group.special === 'elements');
        expect(elements.elements).toContain('Fe');
        expect(elements.elementKeys.map((k) => k.key)).toEqual(['radius', 'atomColor', 'ringColor']);
    });
});

describe('labels', () => {
    test('humanizes camelCase paths', () => {
        expect(humanizeLabel('atomLabels.calloutColumnGap')).toBe('Callout column gap');
        expect(humanizeLabel('atomADPRingWidthFactor', ['atom'])).toContain('ADP');
        expect(humanizeLabel('hbondDashFraction', ['hbond'])).toBe('Dash fraction');
        expect(humanizeLabel('camera.fov')).toBe('Field of view');
        expect(humanizeLabel('atomLabels.loadingIndicatorDelayMs')).toBe('Loading indicator delay (ms)');
    });

    test('applies explicit overrides', () => {
        expect(humanizeLabel('renderStyle')).toBe('Render style');
        expect(humanizeLabel('hydrogenMode')).toBe('Hydrogen display');
    });

    test('strips HTML from descriptions', () => {
        expect(plainDescription('Use <code>auto-omit</code> &mdash; adaptive.')).toBe('Use auto-omit — adaptive.');
        expect(plainDescription({ type: 'Number', description: 'In &Aring;.' })).toBe('In Å.');
    });
});

describe('path helpers', () => {
    test('set/get/has round-trip', () => {
        const obj = {};
        setPath(obj, 'a.b.c', 5);
        expect(getPath(obj, 'a.b.c')).toBe(5);
        expect(hasPath(obj, 'a.b.c')).toBe(true);
        expect(hasPath(obj, 'a.b.d')).toBe(false);
        expect(getPath(obj, 'a.x.y')).toBe(undefined);
    });

    test('deletePath prunes empty parents', () => {
        const obj = { a: { b: { c: 1 }, d: 2 } };
        deletePath(obj, 'a.b.c');
        expect(obj).toEqual({ a: { d: 2 } });
        deletePath(obj, 'a.d');
        expect(obj).toEqual({});
    });
});

describe('normalize and merge', () => {
    test('drops values equal to defaults, keeps overrides', () => {
        const partial = {
            renderStyle: 'solid-3d',                 // equals default -> dropped
            bondRadius: 0.1,                          // override -> kept
            atomLabels: { fontSize: 14, haloWidth: 3 }, // fontSize default -> dropped
        };
        expect(normalizePartial(partial)).toEqual({
            bondRadius: 0.1,
            atomLabels: { haloWidth: 3 },
        });
    });

    test('compares Infinity, null, and arrays correctly', () => {
        expect(normalizePartial({ atomLabels: { maxVisible: Infinity } })).toEqual({});
        expect(normalizePartial({ contourLines: { contourStep: null } })).toEqual({});
        expect(normalizePartial({ camera: { initialPosition: [0, 0, 10] } })).toEqual({});
        expect(normalizePartial({ camera: { initialPosition: [0, 0, 12] } }))
            .toEqual({ camera: { initialPosition: [0, 0, 12] } });
        expect(deepEqual(NaN, NaN)).toBe(true);
    });

    test('mergedValue prefers stored values including null', () => {
        expect(mergedValue({ bondRadius: 0.2 }, 'bondRadius')).toBe(0.2);
        expect(mergedValue({}, 'bondRadius')).toBe(defaultSettings.bondRadius);
        expect(mergedValue({ contourLines: { lineColor: '#123456' } }, 'contourLines.lineColor')).toBe('#123456');
        expect(mergedValue({ plot2DColorLuminanceFloor: 0.4 }, 'plot2DColorLuminanceFloor')).toBe(0.4);
    });
});

describe('serialization', () => {
    test('round-trips Infinity through the sentinel on numeric paths', () => {
        const partial = { atomLabels: { maxConnectorLength: Infinity }, bondRadius: 0.08 };
        const text = serializePartial(partial);
        expect(text).toContain('"Infinity"');
        expect(deserializePartial(text)).toEqual(partial);
    });

    test('leaves the sentinel alone on non-numeric paths', () => {
        const roundTripped = deserializePartial('{"atomLabels": {"fontFamily": "Infinity"}}');
        expect(roundTripped.atomLabels.fontFamily).toBe('Infinity');
    });

    test('rejects non-object JSON', () => {
        expect(() => deserializePartial('[1, 2]')).toThrow();
        expect(() => deserializePartial('not json')).toThrow();
    });
});

describe('storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('save/load round-trip including Infinity', () => {
        saveStoredOptions({ bondRadius: 0.08, atomLabels: { maxVisible: Infinity } });
        expect(loadStoredOptions()).toEqual({ bondRadius: 0.08, atomLabels: { maxVisible: Infinity } });
    });

    test('corrupt JSON yields empty options and clears the key', () => {
        localStorage.setItem(STORAGE_KEY, '{broken');
        expect(loadStoredOptions()).toEqual({});
        expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    });

    test('version mismatch yields empty options and clears the key', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, options: { bondRadius: 1 } }));
        expect(loadStoredOptions()).toEqual({});
        expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    });

    test('clearStoredOptions removes the key', () => {
        saveStoredOptions({ bondRadius: 0.08 });
        clearStoredOptions();
        expect(localStorage.getItem(STORAGE_KEY)).toBe(null);
    });
});

describe('import validation', () => {
    test('accepts valid options including elements and plane descriptors', () => {
        const result = validateImportedOptions({
            renderStyle: 'cutout-2d',
            bondRadius: 0.08,
            elementProperties: { Fe: { atomColor: '#ff5733', radius: 1.4 } },
            contourLines: { enabled: true, plane: { atoms: ['C1', 'C2', 'O1'] } },
            differenceDensity: { reflections: { source: 'refln' } },
            atomLabels: { show: ['C1', { id: 'O1', text: 'O(carbonyl)' }] },
        }, schema);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
    });

    test('rejects unknown paths, elements, and wrong types atomically', () => {
        const result = validateImportedOptions({
            bondRadius: 'thick',
            madeUpOption: 1,
            elementProperties: { Xx: { atomColor: '#fff' }, Fe: { glow: true } },
            renderStyle: 'flat',
        }, schema);
        expect(result.ok).toBe(false);
        expect(result.errors.join('\n')).toContain('bondRadius');
        expect(result.errors.join('\n')).toContain('madeUpOption');
        expect(result.errors.join('\n')).toContain('Xx');
        expect(result.errors.join('\n')).toContain('glow');
        expect(result.errors.join('\n')).toContain('renderStyle');
        expect(result.sanitized).toEqual({});
    });

    test('nullable rows accept null, others reject it', () => {
        expect(validateImportedOptions({ plot2DColorLuminanceFloor: null }, schema).ok).toBe(true);
        expect(validateImportedOptions({ bondRadius: null }, schema).ok).toBe(false);
    });
});

describe('apply classification', () => {
    test('separates live buckets from recreation', () => {
        expect(classifyChangedPaths(['atomLabels.fontSize'])).toMatchObject({
            atomLabels: true, recreate: false,
        });
        expect(classifyChangedPaths(['isosurface.sigmaLevel', 'contourLines.enabled'])).toMatchObject({
            isosurface: true, contourLines: true, recreate: false,
        });
        expect(classifyChangedPaths(['hydrogenMode'])).toMatchObject({
            modifierModes: ['hydrogen'], recreate: false,
        });
        expect(classifyChangedPaths(['bondRadius', 'atomLabels.fontSize'])).toMatchObject({
            atomLabels: true, recreate: true,
        });
    });
});

describe('search', () => {
    test('filters rows and drops empty groups', () => {
        const filtered = filterSchema(schema, 'luminance');
        const paths = filtered.flatMap((group) => group.rows.map((row) => row.path));
        expect(paths).toContain('plot2DColorLuminanceCeiling');
        expect(paths).toContain('atomLabels.atomColorLuminanceFloor');
        expect(filtered.every((group) => group.special === 'elements' || group.rows.length > 0)).toBe(true);
        expect(filterSchema(schema, '')).toBe(schema);
    });

    test('matches paths, labels, and description text', () => {
        const byPath = filterSchema(schema, 'maxpolycount');
        expect(byPath.flatMap((g) => g.rows.map((r) => r.path))).toContain('isosurface.maxPolyCount');
        const byDescription = filterSchema(schema, 'marching');
        expect(byDescription.flatMap((g) => g.rows.map((r) => r.path)).length).toBeGreaterThan(0);
    });
});
