/**
 * Generates the machine-readable options reference consumed by the docs.
 *
 * Imports the real default option objects (structure-settings.js plus the
 * DEFAULT_* density objects it spreads in), flattens them to dotted paths,
 * and writes docs/.vitepress/data/options-data.json grouped by reference
 * page. Because the values are imported rather than copied, the reference
 * tables cannot drift from the code.
 *
 * Hand-written descriptions live separately in
 * docs/.vitepress/data/option-descriptions.js.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import defaultSettings from '../src/lib/ortep3d/structure-settings.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'docs/.vitepress/data/options-data.json');

/**
 * Object-valued options documented as a single row instead of per leaf.
 */
const DESCRIPTOR_PATHS = new Set(['contourLines.plane']);

/**
 * Maps a dotted option path to its reference page group.
 * @param {string} path - Dotted option path, e.g. "camera.minDistance".
 * @returns {string|null} Group slug, or null when the path is excluded.
 */
function groupFor(path) {
    const inside = (name) => path === name || path.startsWith(`${name}.`);
    if (inside('elementProperties')) {
        // Per-element map (~100 elements x 3 keys); documented schematically
        // on the elements reference page instead of one row per leaf.
        return null;
    }
    if (inside('camera')) {
        return 'camera';
    }
    if (inside('selection')) {
        return 'selection';
    }
    if (inside('interaction')) {
        return 'interaction';
    }
    if (inside('atomLabels')) {
        return 'atom-labels';
    }
    if (
        inside('differenceDensity') || inside('scalarField') ||
        inside('isosurface') || inside('contourLines')
    ) {
        return 'density';
    }
    if (inside('cell')) {
        return 'cell';
    }
    if (['hydrogenMode', 'disorderMode', 'symmetryMode'].includes(path)) {
        return 'display-modes';
    }
    if (
        ['renderMode', 'renderStyle', 'fixCifErrors', 'sealCutoutCavity'].includes(path) ||
        path.startsWith('plot2D')
    ) {
        return 'rendering';
    }
    if (path.startsWith('hbond')) {
        return 'hydrogen-bonds';
    }
    if (path.startsWith('bond')) {
        return 'bonds';
    }
    if (path.startsWith('atom')) {
        return 'atom-visualization';
    }
    throw new Error(`No reference group defined for option path: ${path}`);
}

/**
 * Formats a default value for display in the reference tables.
 * @param {string|number|boolean|object|null} value - The default value.
 * @returns {string} Display string.
 */
function formatDefault(value) {
    if (value === Infinity) {
        return 'Infinity';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return `"${value}"`;
    }
    if (Array.isArray(value)) {
        return `[${value.map(formatDefault).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value).map(([k, v]) => `${k}: ${formatDefault(v)}`);
        return `{${entries.join(', ')}}`;
    }
    return String(value);
}

/**
 * Infers a coarse display type for a default value.
 * @param {string|number|boolean|object|null} value - The default value.
 * @returns {string} Display type.
 */
function inferType(value) {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'Array';
    }
    if (typeof value === 'string') {
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) || value.startsWith('rgba(')) {
            return 'Color';
        }
        return 'String';
    }
    if (typeof value === 'number') {
        return 'Number';
    }
    if (typeof value === 'boolean') {
        return 'Boolean';
    }
    return 'Object';
}

/**
 * Flattens the defaults object into ordered rows grouped by reference page.
 * @returns {{[group: string]: Array<{path: string, type: string, default: string}>}} Grouped rows.
 */
export function buildOptionsData() {
    const groups = {};

    const emit = (value, dotted) => {
        const group = groupFor(dotted);
        if (group === null) {
            return;
        }
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push({
            path: dotted,
            type: inferType(value),
            default: formatDefault(value),
        });
    };

    const visit = (value, path) => {
        const dotted = path.join('.');
        if (path.length > 0 && groupFor(dotted) === null) {
            return;
        }
        const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value);
        const descend = isPlainObject &&
            Object.keys(value).length > 0 &&
            !DESCRIPTOR_PATHS.has(dotted);
        if (path.length > 0 && !descend) {
            emit(value, dotted);
            return;
        }
        for (const [key, child] of Object.entries(value)) {
            visit(child, [...path, key]);
        }
    };

    visit(defaultSettings, []);
    return groups;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const data = buildOptionsData();
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
    const total = Object.values(data).reduce((n, rows) => n + rows.length, 0);
    console.log(`Wrote ${total} option rows in ${Object.keys(data).length} groups to ${outputPath}`);
}
