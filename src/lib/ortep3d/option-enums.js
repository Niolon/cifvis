/**
 * Enumerated values of string-valued viewer options.
 *
 * Single source of truth shared by CrystalViewer validation and option
 * editors such as the playground settings overlay.
 */

export const VALID_RENDER_MODES = Object.freeze(['constant', 'onDemand']);

export const VALID_RENDER_STYLES = Object.freeze(['solid-3d', 'cutout-3d', 'cutout-2d']);

export const VALID_BOND_COLOR_MODES = Object.freeze(['uniform', 'split']);

export const VALID_ATOM_LABEL_PLACEMENT_MODES = Object.freeze([
    'auto-omit',
    'quality-omit',
    'performance-omit',
    'maximum-coverage',
]);

export const VALID_ATOM_LABEL_CALLOUT_PLACEMENTS = Object.freeze(['structure', 'viewport']);

export const VALID_ATOM_LABEL_COLOR_MODES = Object.freeze(['uniform', 'atom']);

export const VALID_SELECTION_MODES = Object.freeze(['single', 'multiple']);

export const VALID_CAMERA_TYPES = Object.freeze(['orthographic', 'perspective']);

export const VALID_HYDROGEN_MODES = Object.freeze(['none', 'constant', 'anisotropic']);

export const VALID_SYMMETRY_MODES = Object.freeze([
    'none',
    'hbonds',
    'fragment',
    'fragment-hbonds',
    'cell',
    'fragment-cell',
]);
