/**
 * Pure logic behind the playground settings overlay.
 *
 * Builds a curated, searchable editor schema over the full CrystalViewer
 * options surface by combining three existing sources of truth:
 * - typed default values from the library defaults object,
 * - grouping/order metadata generated for the docs options reference,
 * - the hand-written option descriptions from the docs.
 *
 * Also owns the derived-state logic: minimal non-default diffs, JSON
 * serialization (with an "Infinity" sentinel), localStorage persistence,
 * import validation, and live-vs-recreate classification of changes.
 * Everything here is side-effect-free except the localStorage helpers.
 */
import defaultSettings from '../../src/lib/ortep3d/structure-settings.js';
import {
    VALID_ATOM_LABEL_CALLOUT_PLACEMENTS,
    VALID_ATOM_LABEL_COLOR_MODES,
    VALID_ATOM_LABEL_PLACEMENT_MODES,
    VALID_BOND_COLOR_MODES,
    VALID_CAMERA_TYPES,
    VALID_HYDROGEN_MODES,
    VALID_RENDER_MODES,
    VALID_RENDER_STYLES,
    VALID_SELECTION_MODES,
    VALID_SYMMETRY_MODES,
} from '../../src/lib/ortep3d/option-enums.js';
import optionsData from '../../docs/.vitepress/data/options-data.json';
import { descriptions } from '../../docs/.vitepress/data/option-descriptions.js';

export const STORAGE_KEY = 'cifvis-playground-options';
const STORAGE_VERSION = 1;

// ---------------------------------------------------------------------------
// Dotted-path helpers
// ---------------------------------------------------------------------------

/**
 * Reads a dotted path from a nested object.
 * @param {object} obj - Source object
 * @param {string} path - Dotted path, e.g. "atomLabels.fontSize"
 * @returns {unknown} The value, or undefined when any segment is absent
 */
export function getPath(obj, path) {
    let current = obj;
    for (const segment of path.split('.')) {
        if (current === null || typeof current !== 'object') {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}

/**
 * Checks whether a dotted path exists in a nested object.
 * @param {object} obj - Source object
 * @param {string} path - Dotted path
 * @returns {boolean} True when every segment exists
 */
export function hasPath(obj, path) {
    let current = obj;
    for (const segment of path.split('.')) {
        if (current === null || typeof current !== 'object' || !(segment in current)) {
            return false;
        }
        current = current[segment];
    }
    return true;
}

/**
 * Writes a dotted path into a nested object, creating parents as needed.
 * @param {object} obj - Target object (mutated)
 * @param {string} path - Dotted path
 * @param {unknown} value - Value to store
 */
export function setPath(obj, path, value) {
    const segments = path.split('.');
    let current = obj;
    for (const segment of segments.slice(0, -1)) {
        if (current[segment] === null || typeof current[segment] !== 'object') {
            current[segment] = {};
        }
        current = current[segment];
    }
    current[segments[segments.length - 1]] = value;
}

/**
 * Deletes a dotted path from a nested object, pruning now-empty parents.
 * @param {object} obj - Target object (mutated)
 * @param {string} path - Dotted path
 */
export function deletePath(obj, path) {
    const segments = path.split('.');
    const parents = [];
    let current = obj;
    for (const segment of segments.slice(0, -1)) {
        if (current === null || typeof current !== 'object') {
            return;
        }
        parents.push([current, segment]);
        current = current[segment];
    }
    if (current === null || typeof current !== 'object') {
        return;
    }
    delete current[segments[segments.length - 1]];
    for (let i = parents.length - 1; i >= 0; i--) {
        const [parent, key] = parents[i];
        if (parent[key] !== null && typeof parent[key] === 'object' && Object.keys(parent[key]).length === 0) {
            delete parent[key];
        }
    }
}

/**
 * Deep equality for option values (primitives, arrays, plain objects).
 * Uses Object.is so Infinity, NaN, and signed zero compare correctly.
 * @param {unknown} a - First value
 * @param {unknown} b - Second value
 * @returns {boolean} Whether the values are deeply equal
 */
export function deepEqual(a, b) {
    if (Object.is(a, b)) {
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
    }
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' &&
        !Array.isArray(a) && !Array.isArray(b)) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        return keysA.length === keysB.length && keysA.every((key) => deepEqual(a[key], b[key]));
    }
    return false;
}

/**
 * Deep-clones a JSON-compatible option value (Infinity survives).
 * @param {unknown} value - Value to clone
 * @returns {unknown} Structural copy
 */
function clone(value) {
    if (Array.isArray(value)) {
        return value.map(clone);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
    }
    return value;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TOKEN_MAP = {
    adp: 'ADP',
    fov: 'field of view',
    hbond: 'H-bond',
    cif: 'CIF',
    ms: '(ms)',
    iam: 'IAM',
};

const LABEL_OVERRIDES = {
    'renderStyle': 'Render style',
    'renderMode': 'Render scheduling',
    'fixCifErrors': 'Fix common CIF errors',
    'plot2DColorLuminanceCeiling': 'Colour luminance ceiling',
    'plot2DColorLuminanceFloor': 'Colour luminance floor (dark backgrounds)',
    'plot2DOpenBondInnerScale': 'Open (PART 2) bond inner width',
    'hydrogenMode': 'Hydrogen display',
    'disorderMode': 'Disorder display',
    'symmetryMode': 'Symmetry display',
    'packingCutoff': 'Cell packing cutoff',
    'atomLabels.show': 'Show labels for',
    'atomLabels.placementMode': 'Placement strategy',
    'atomLabels.text': 'Text overrides (JSON)',
    'atomLabels.colorMode': 'Label colour source',
    'atomLabels.atomColorLuminanceCeiling': 'Colour luminance ceiling',
    'atomLabels.atomColorLuminanceFloor': 'Colour luminance floor (dark backgrounds)',
    'atomLabels.maxConnectorLength': 'Longest allowed connector (px)',
    'atomLabels.maxVisible': 'Maximum visible labels',
    'atomDetail': 'Geometry detail (1-5)',
    'atomConstantRadiusMultiplier': 'Constant-radius sphere size',
    'atomCutawayHysteresis': 'Cutaway direction hysteresis',
    'bondGrowTolerance': 'Bond detection tolerance (Å)',
    'bondColorMode': 'Bond colour source',
    'selection.mode': 'Selection mode',
    'selection.markerMult': 'Atom marker size ×',
    'selection.bondMarkerMult': 'Bond marker size ×',
    'selection.highlightEmissive': 'Highlight emissive colour (hex number)',
    'selection.markerColors': 'Marker colour cycle (JSON)',
    'camera.initialPosition': 'Initial position [x, y, z]',
    'camera.type': 'Projection',
    'differenceDensity.autoLoad': 'Auto-load density from CIF',
    'differenceDensity.inputMode': 'Coefficient source',
    'differenceDensity.reflections': 'Reflection reader (JSON)',
    'differenceDensity.iam': 'IAM configuration (JSON)',
    'differenceDensity.coefficientColumns': 'Custom coefficient columns (JSON)',
    'differenceDensity.anomalousDispersion': 'Anomalous correction (JSON)',
    'differenceDensity.extinctionCorrection': 'Extinction correction (JSON)',
    'scalarField.useWorker': 'Calculate in a Web Worker',
    'isosurface.useSymmetry': 'Reuse symmetry-equivalent surfaces',
    'isosurface.sigmaLevel': 'Contour level (σ)',
    'isosurface.radius': 'Clipping radius around atoms (Å)',
    'contourLines.enabled': 'Planar contour lines instead of 3D surface',
    'contourLines.plane': 'Contour plane (JSON)',
    'contourLines.sign': 'Drawn signs',
    'contourLines.levels': 'Explicit levels (JSON)',
    'cell.boxLineWidth': 'Box line width',
    'cell.arrowColorA': 'a axis arrow colour',
    'cell.arrowColorB': 'b axis arrow colour',
    'cell.arrowColorC': 'c axis arrow colour',
};

/**
 * Derives a human-readable label from an option path.
 * @param {string} path - Dotted option path
 * @param {string[]} [stripPrefixes] - Leading lowercase prefixes to drop
 * @returns {string} Sentence-case label
 */
export function humanizeLabel(path, stripPrefixes = []) {
    if (LABEL_OVERRIDES[path]) {
        return LABEL_OVERRIDES[path];
    }
    let segment = path.split('.').pop();
    for (const prefix of stripPrefixes) {
        if (segment.startsWith(prefix) && segment.length > prefix.length) {
            segment = segment.slice(prefix.length);
            break;
        }
    }
    const words = segment
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(' ')
        .map((word) => TOKEN_MAP[word.toLowerCase()] ?? word.toLowerCase());
    const sentence = words.join(' ');
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const HTML_ENTITIES = {
    '&mdash;': '—', '&ndash;': '–', '&Aring;': 'Å', '&aring;': 'å',
    '&sigma;': 'σ', '&Delta;': 'Δ', '&rho;': 'ρ', '&sup3;': '³',
    '&prime;': '′', '&Prime;': '″', '&ouml;': 'ö', '&deg;': '°',
    '&lt;': '<', '&gt;': '>', '&amp;': '&', '&#39;': '\'', '&quot;': '"',
};

/**
 * Strips HTML markup and entities from a docs description string.
 * @param {string|object|undefined} entry - descriptions[] entry
 * @returns {string} Plain-text description
 */
export function plainDescription(entry) {
    const html = typeof entry === 'string' ? entry : entry?.description ?? '';
    let text = html.replace(/<[^>]+>/g, '');
    for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
        text = text.split(entity).join(replacement);
    }
    return text.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ENUM_VALUES = {
    'renderMode': VALID_RENDER_MODES,
    'renderStyle': VALID_RENDER_STYLES,
    'bondColorMode': VALID_BOND_COLOR_MODES,
    'hydrogenMode': VALID_HYDROGEN_MODES,
    'symmetryMode': VALID_SYMMETRY_MODES,
    'selection.mode': VALID_SELECTION_MODES,
    'camera.type': VALID_CAMERA_TYPES,
    'atomLabels.show': ['none', 'all', 'non-hydrogen'],
    'atomLabels.placementMode': VALID_ATOM_LABEL_PLACEMENT_MODES,
    'atomLabels.calloutPlacement': VALID_ATOM_LABEL_CALLOUT_PLACEMENTS,
    'atomLabels.colorMode': VALID_ATOM_LABEL_COLOR_MODES,
    'atomLabels.leaderLines': ['auto', 'none'],
    'differenceDensity.inputMode': ['auto', 'fcf', 'cif-iam'],
    'contourLines.interpolation': ['tricubic', 'linear'],
    'contourLines.sign': ['positive', 'negative', 'both'],
};

/** Numeric input constraints: path → {min, max, step}. */
const NUMBER_CONSTRAINTS = {
    'atomDetail': { min: 1, max: 5, step: 1 },
    'plot2DColorLuminanceCeiling': { min: 0, max: 1, step: 0.01 },
    'plot2DColorLuminanceFloor': { min: 0, max: 1, step: 0.01 },
    'atomLabels.atomColorLuminanceCeiling': { min: 0, max: 1, step: 0.01 },
    'atomLabels.atomColorLuminanceFloor': { min: 0, max: 1, step: 0.01 },
    'atomColorRoughness': { min: 0, max: 1, step: 0.05 },
    'atomColorMetalness': { min: 0, max: 1, step: 0.05 },
    'bondColorRoughness': { min: 0, max: 1, step: 0.05 },
    'bondColorMetalness': { min: 0, max: 1, step: 0.05 },
    'hbondColorRoughness': { min: 0, max: 1, step: 0.05 },
    'hbondColorMetalness': { min: 0, max: 1, step: 0.05 },
    'hbondDashFraction': { min: 0, max: 1, step: 0.05 },
    'isosurface.opacity': { min: 0, max: 1, step: 0.05 },
    'contourLines.opacity': { min: 0, max: 1, step: 0.05 },
    'cell.boxOpacity': { min: 0, max: 1, step: 0.05 },
    'differenceDensity.reciprocalResolution': { min: 0.05, max: 1, step: 0.05 },
    'atomLabels.fontSize': { min: 6, max: 48, step: 1 },
    'atomLabels.fontWeight': { min: 100, max: 900, step: 100 },
    'packingCutoff': { min: 1, max: 1.5, step: 0.001 },
};

/** Numeric rows where an empty input means Infinity. */
const INFINITY_PATHS = new Set(['atomLabels.maxConnectorLength', 'atomLabels.maxVisible']);

/** Rows whose null default represents a nullable number in (0, 1). */
const NULLABLE_NUMBER_PATHS = new Set([
    'plot2DColorLuminanceFloor',
    'atomLabels.atomColorLuminanceFloor',
    'contourLines.contourStep',
    'differenceDensity.intensityScale',
]);

/** Rows with a null default that hold a plain string when set. */
const NULLABLE_TEXT_PATHS = new Set(['contourLines.lineColor']);

/**
 * Presentation groups, most-used first. `source` pulls whole generator
 * groups from options-data.json; `pull`/`exclude` fine-tune membership and
 * `first` fixes the leading row order. `dividerAfter` inserts a sub-heading
 * before the named path.
 */
const CURATED_GROUPS = [
    {
        id: 'style', title: 'Style', source: ['rendering'],
        exclude: ['renderMode', 'fixCifErrors'],
        first: ['renderStyle'],
        stripPrefixes: ['plot2D'],
        dividers: { 'plot2DBackground': '2D publication style' },
    },
    {
        id: 'display-modes', title: 'Display modes', source: ['display-modes'],
    },
    {
        id: 'atom-labels', title: 'Atom labels', source: ['atom-labels'],
        first: [
            'atomLabels.show', 'atomLabels.placementMode', 'atomLabels.fontSize',
            'atomLabels.fontWeight', 'atomLabels.fontFamily', 'atomLabels.colorMode',
            'atomLabels.color', 'atomLabels.atomColorLuminanceCeiling',
            'atomLabels.atomColorLuminanceFloor', 'atomLabels.haloColor', 'atomLabels.haloWidth',
            'atomLabels.leaderLines', 'atomLabels.leaderColor', 'atomLabels.leaderWidth',
            'atomLabels.calloutPlacement', 'atomLabels.calloutGap', 'atomLabels.calloutColumns',
        ],
        dividers: { 'atomLabels.calloutPlacement': 'Callouts', 'atomLabels.text': 'Advanced layout' },
    },
    {
        id: 'atoms', title: 'Atoms', source: ['atom-visualization'], stripPrefixes: ['atom'],
    },
    {
        id: 'bonds', title: 'Bonds', source: ['bonds'], stripPrefixes: ['bond'],
        first: ['bondRadius', 'bondColor', 'bondColorMode'],
    },
    {
        id: 'hbonds', title: 'Hydrogen bonds', source: ['hydrogen-bonds'], stripPrefixes: ['hbond'],
    },
    {
        id: 'elements', title: 'Element colours & radii', special: 'elements',
    },
    {
        id: 'density', title: 'Density & contours', source: ['density'],
        dividers: {
            'differenceDensity.autoLoad': 'Difference density',
            'isosurface.useSymmetry': 'Isosurface',
            'contourLines.enabled': 'Contour lines',
        },
    },
    {
        id: 'cell', title: 'Unit cell', source: ['cell'],
    },
    {
        id: 'selection', title: 'Selection', source: ['selection'],
    },
    {
        id: 'camera', title: 'Camera', source: ['camera'],
    },
    {
        id: 'advanced', title: 'Advanced', source: ['interaction'],
        pull: ['renderMode', 'fixCifErrors'],
    },
];

/**
 * Infers the control descriptor for one option row.
 * @param {string} path - Dotted option path
 * @param {unknown} defaultValue - Typed default from the library defaults
 * @returns {object} Partial row: control plus constraints
 */
function inferControl(path, defaultValue) {
    if (ENUM_VALUES[path]) {
        const nullable = defaultValue === null;
        return { control: 'select', enumValues: [...ENUM_VALUES[path]], nullable };
    }
    if (typeof defaultValue === 'boolean') {
        return { control: 'checkbox' };
    }
    if (typeof defaultValue === 'number' || NULLABLE_NUMBER_PATHS.has(path)) {
        return {
            control: 'number',
            ...NUMBER_CONSTRAINTS[path],
            nullable: NULLABLE_NUMBER_PATHS.has(path),
            allowsInfinity: INFINITY_PATHS.has(path),
        };
    }
    if (typeof defaultValue === 'string') {
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(defaultValue)) {
            return { control: 'color' };
        }
        return { control: 'text' };
    }
    if (NULLABLE_TEXT_PATHS.has(path)) {
        return { control: 'text', nullable: true };
    }
    // Arrays, plain objects, and remaining nullable rows are edited as JSON.
    return { control: 'json', nullable: defaultValue === null };
}

/**
 * Builds the complete curated settings schema.
 * @returns {Array<object>} Groups: {id, title, special?, rows, elements?}
 * where rows are option rows or {divider, label} sub-headings
 */
export function buildSettingsSchema() {
    const rowsByGroup = new Map();
    for (const [group, rows] of Object.entries(optionsData)) {
        rowsByGroup.set(group, rows.map((row) => row.path));
    }

    const makeRow = (path, stripPrefixes) => {
        const defaultValue = getPath(defaultSettings, path);
        const label = humanizeLabel(path, stripPrefixes);
        const description = plainDescription(descriptions[path]);
        const row = {
            path,
            label,
            description,
            default: clone(defaultValue),
            ...inferControl(path, defaultValue),
        };
        row.searchText = `${path} ${label} ${description}`.toLowerCase();
        return row;
    };

    return CURATED_GROUPS.map((group) => {
        if (group.special === 'elements') {
            return {
                id: group.id,
                title: group.title,
                special: 'elements',
                rows: [],
                elements: Object.keys(defaultSettings.elementProperties),
                elementKeys: [
                    { key: 'radius', label: 'Covalent radius (Å)', control: 'number', step: 0.01 },
                    { key: 'atomColor', label: 'Atom colour', control: 'color' },
                    { key: 'ringColor', label: 'ADP ring colour', control: 'color' },
                ],
                searchText: 'elementproperties element colours radii atom colour ring colour radius',
            };
        }
        const paths = [];
        for (const source of group.source ?? []) {
            paths.push(...(rowsByGroup.get(source) ?? []));
        }
        paths.push(...(group.pull ?? []));
        const excluded = new Set([...(group.exclude ?? []), ...collectPulledPaths(group.id)]);
        const ordered = [
            ...(group.first ?? []).filter((path) => paths.includes(path)),
            ...paths.filter((path) => !(group.first ?? []).includes(path)),
        ].filter((path) => !excluded.has(path));

        const rows = [];
        for (const path of ordered) {
            const dividerLabel = group.dividers?.[path];
            if (dividerLabel) {
                rows.push({ divider: true, label: dividerLabel });
            }
            rows.push(makeRow(path, group.stripPrefixes ?? []));
        }
        return { id: group.id, title: group.title, rows };
    });
}

/**
 * Collects paths pulled into other groups so their source group skips them.
 * @param {string} groupId - Group being built
 * @returns {string[]} Paths claimed by other groups' `pull` lists
 */
function collectPulledPaths(groupId) {
    return CURATED_GROUPS
        .filter((group) => group.id !== groupId)
        .flatMap((group) => group.pull ?? []);
}

/**
 * Filters schema groups by a search query over path, label, and description.
 * Divider rows are dropped while a query is active.
 * @param {Array<object>} schema - Result of buildSettingsSchema()
 * @param {string} query - Search text; empty returns the schema unchanged
 * @returns {Array<object>} Groups with matching rows only (empty groups removed)
 */
export function filterSchema(schema, query) {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return schema;
    }
    return schema
        .map((group) => {
            if (group.special === 'elements') {
                return group.searchText.includes(needle) ? group : { ...group, hidden: true };
            }
            const rows = group.rows.filter((row) => !row.divider && row.searchText.includes(needle));
            return { ...group, rows, hidden: rows.length === 0 };
        })
        .filter((group) => !group.hidden);
}

// ---------------------------------------------------------------------------
// Partial-options handling (diff, merge, serialization)
// ---------------------------------------------------------------------------

/**
 * Drops every stored value that deep-equals the library default, pruning
 * empty parents, so the partial stays the minimal diff from defaults.
 * @param {object} partial - Partial options object
 * @returns {object} New minimal partial
 */
export function normalizePartial(partial) {
    const prune = (value, defaults) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value) ||
            defaults === null || typeof defaults !== 'object' || Array.isArray(defaults)) {
            return deepEqual(value, defaults) ? undefined : clone(value);
        }
        const result = {};
        for (const [key, child] of Object.entries(value)) {
            const kept = prune(child, defaults[key]);
            if (kept !== undefined) {
                result[key] = kept;
            }
        }
        return Object.keys(result).length > 0 ? result : undefined;
    };
    return prune(partial, defaultSettings) ?? {};
}

/**
 * Returns the effective value for a path: stored override or library default.
 * @param {object} partial - Partial options object
 * @param {string} path - Dotted option path
 * @returns {unknown} Effective value
 */
export function mergedValue(partial, path) {
    return hasPath(partial, path) ? getPath(partial, path) : clone(getPath(defaultSettings, path));
}

/**
 * Replaces Infinity numbers with the string sentinel "Infinity" for JSON.
 * @param {unknown} value - Option value tree
 * @returns {unknown} JSON-safe copy
 */
function encodeSentinels(value) {
    if (value === Infinity) {
        return 'Infinity';
    }
    if (value === -Infinity) {
        return '-Infinity';
    }
    if (Array.isArray(value)) {
        return value.map(encodeSentinels);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeSentinels(v)]));
    }
    return value;
}

/**
 * Converts sentinel strings back to Infinity, but only on numeric paths.
 * @param {unknown} value - Parsed JSON tree
 * @param {string[]} pathSegments - Current dotted-path segments
 * @returns {unknown} Decoded tree
 */
function decodeSentinels(value, pathSegments = []) {
    if (value === 'Infinity' || value === '-Infinity') {
        const path = pathSegments.join('.');
        const defaultValue = getPath(defaultSettings, path);
        if (typeof defaultValue === 'number' || INFINITY_PATHS.has(path)) {
            return value === 'Infinity' ? Infinity : -Infinity;
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => decodeSentinels(item, pathSegments));
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .map(([k, v]) => [k, decodeSentinels(v, [...pathSegments, k])]));
    }
    return value;
}

/**
 * Serializes a partial options object to pretty JSON with the Infinity
 * sentinel, ready for the clipboard or storage.
 * @param {object} partial - Partial options object
 * @returns {string} JSON text
 */
export function serializePartial(partial) {
    return JSON.stringify(encodeSentinels(partial), null, 2);
}

/**
 * Parses JSON text into a partial options object, decoding the Infinity
 * sentinel on numeric paths.
 * @param {string} text - JSON text
 * @returns {object} Parsed partial (throws SyntaxError on invalid JSON)
 */
export function deserializePartial(text) {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new SyntaxError('Options must be a JSON object');
    }
    return decodeSentinels(parsed);
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

/**
 * Loads the stored partial options, or {} when absent/corrupt/mismatched.
 * @returns {object} Partial options object
 */
export function loadStoredOptions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const envelope = JSON.parse(raw);
        if (envelope?.version !== STORAGE_VERSION || typeof envelope.options !== 'object') {
            localStorage.removeItem(STORAGE_KEY);
            return {};
        }
        return decodeSentinels(envelope.options);
    } catch {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* storage unavailable */ }
        return {};
    }
}

/**
 * Persists the partial options object (already normalized by the caller).
 * @param {object} partial - Partial options object
 */
export function saveStoredOptions(partial) {
    try {
        const envelope = { version: STORAGE_VERSION, options: encodeSentinels(partial) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch { /* storage unavailable (private mode) */ }
}

/** Removes the stored options entirely. */
export function clearStoredOptions() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// Import validation
// ---------------------------------------------------------------------------

/**
 * Validates an imported partial options object against the schema.
 * Rejection is atomic: any error rejects the whole import.
 * @param {object} imported - Parsed candidate object
 * @param {Array<object>} schema - Result of buildSettingsSchema()
 * @returns {{ok: boolean, errors: string[], sanitized: object}} Result
 */
export function validateImportedOptions(imported, schema) {
    const rowsByPath = new Map();
    for (const group of schema) {
        for (const row of group.rows) {
            if (!row.divider) {
                rowsByPath.set(row.path, row);
            }
        }
    }
    const jsonRowPaths = [...rowsByPath.values()]
        .filter((row) => row.control === 'json')
        .map((row) => row.path);
    const knownElements = new Set(Object.keys(defaultSettings.elementProperties));
    const elementKeys = new Set(['radius', 'atomColor', 'ringColor']);
    const errors = [];

    const checkLeaf = (path, value) => {
        const row = rowsByPath.get(path);
        if (!row) {
            errors.push(`Unknown option: ${path}`);
            return;
        }
        if (value === null) {
            if (!row.nullable) {
                errors.push(`${path}: null is not allowed`);
            }
            return;
        }
        if (row.control === 'select') {
            const extra = path === 'atomLabels.show' && Array.isArray(value);
            if (!extra && !row.enumValues.includes(value)) {
                errors.push(`${path}: "${value}" is not one of ${row.enumValues.join(', ')}`);
            }
            return;
        }
        if (row.control === 'checkbox' && typeof value !== 'boolean') {
            errors.push(`${path}: expected true or false`);
            return;
        }
        if (row.control === 'number' && typeof value !== 'number') {
            errors.push(`${path}: expected a number`);
            return;
        }
        if ((row.control === 'color' || row.control === 'text') && typeof value !== 'string') {
            errors.push(`${path}: expected a string`);
        }
        // control 'json' accepts any array/object/primitive shape.
    };

    const visit = (value, segments) => {
        const path = segments.join('.');
        if (segments[0] === 'elementProperties') {
            if (segments.length === 1) {
                if (value === null || typeof value !== 'object') {
                    errors.push('elementProperties: expected an object');
                    return;
                }
                for (const [element, props] of Object.entries(value)) {
                    visit(props, ['elementProperties', element]);
                }
                return;
            }
            if (!knownElements.has(segments[1])) {
                errors.push(`Unknown element: elementProperties.${segments[1]}`);
                return;
            }
            if (segments.length === 2) {
                for (const [key, propValue] of Object.entries(value ?? {})) {
                    if (!elementKeys.has(key)) {
                        errors.push(`Unknown element property: ${path}.${key}`);
                    } else if (key === 'radius' ? typeof propValue !== 'number' : typeof propValue !== 'string') {
                        errors.push(`${path}.${key}: wrong type`);
                    }
                }
            }
            return;
        }
        if (rowsByPath.has(path) || value === null || typeof value !== 'object' || Array.isArray(value)) {
            // Exact row, or a leaf value: validate here. Paths strictly under a
            // JSON-typed row are accepted wholesale.
            if (!rowsByPath.has(path) && jsonRowPaths.some((p) => path.startsWith(`${p}.`))) {
                return;
            }
            checkLeaf(path, value);
            return;
        }
        for (const [key, child] of Object.entries(value)) {
            visit(child, [...segments, key]);
        }
    };

    for (const [key, child] of Object.entries(imported)) {
        visit(child, [key]);
    }
    return { ok: errors.length === 0, errors, sanitized: errors.length === 0 ? normalizePartial(imported) : {} };
}

// ---------------------------------------------------------------------------
// Apply classification
// ---------------------------------------------------------------------------

/**
 * Classifies changed option paths into live-appliable buckets versus a full
 * viewer recreation.
 * @param {Iterable<string>} paths - Dotted paths that changed
 * @returns {{atomLabels: boolean, isosurface: boolean, contourLines: boolean,
 *  modifierModes: string[], recreate: boolean}} Buckets
 */
export function classifyChangedPaths(paths) {
    const result = {
        atomLabels: false,
        isosurface: false,
        contourLines: false,
        modifierModes: [],
        recreate: false,
    };
    const modeMap = { hydrogenMode: 'hydrogen', disorderMode: 'disorder', symmetryMode: 'symmetry' };
    for (const path of paths) {
        if (path.startsWith('atomLabels.')) {
            result.atomLabels = true;
        } else if (path.startsWith('isosurface.')) {
            result.isosurface = true;
        } else if (path.startsWith('contourLines.')) {
            result.contourLines = true;
        } else if (modeMap[path]) {
            result.modifierModes.push(modeMap[path]);
        } else {
            result.recreate = true;
        }
    }
    return result;
}
