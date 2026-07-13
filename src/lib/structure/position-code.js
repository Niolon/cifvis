/**
 * Normalizes a CIF site-symmetry value without resolving the operation ID.
 * Bare operation IDs use the conventional zero-translation suffix.
 * @param {string|number|null|undefined} value - CIF site-symmetry value
 * @returns {string} Normalized symmetry code or '.' for no external symmetry
 */
export function normalizeSiteSymmetry(value) {
    if (value === null || value === undefined || value === '.' || value === '?') {
        return '.';
    }

    const code = String(value).trim();
    if (code === '' || code === '.' || code === '?') {
        return '.';
    }
    return code.includes('_') ? code : `${code}_555`;
}

/**
 * Parses a symmetry position code into an operation ID and integer lattice translation.
 * Supports conventional CIF codes (e.g. 2_655), bare operation IDs, and an extended
 * internal representation (e.g. 2_[1,-6,12]).
 * @param {string|number} value - Position code to parse
 * @returns {{id: string, translation: number[]}} Parsed operation ID and translation
 */
export function decodePositionCode(value) {
    if (value === null || value === undefined) {
        throw new Error(`Invalid symmetry position code: ${value}`);
    }

    const code = String(value).trim();
    if (code === '') {
        throw new Error('Invalid empty symmetry position code');
    }

    const extended = code.match(/^([^_]+)_\[(-?\d+),(-?\d+),(-?\d+)\]$/);
    if (extended) {
        return {
            id: extended[1],
            translation: extended.slice(2).map(Number),
        };
    }

    const conventional = code.match(/^([^_]+)_([0-9]{3})$/);
    if (conventional) {
        return {
            id: conventional[1],
            translation: conventional[2].split('').map(digit => Number(digit) - 5),
        };
    }

    if (!code.includes('_')) {
        return { id: code, translation: [0, 0, 0] };
    }

    throw new Error(
        `Invalid symmetry position code ${code}; expected "<id>_abc" or "<id>_[x,y,z]"`,
    );
}

/**
 * Formats an operation ID and integer lattice translation as a position code.
 * Conventional three-digit codes are retained whenever possible; translations outside
 * that range use an unambiguous extended internal form.
 * @param {string|number} id - Symmetry operation ID
 * @param {number[]} translation - Integer lattice translation [x, y, z]
 * @returns {string} Formatted position code
 */
export function encodePositionCode(id, translation) {
    const stringId = String(id);
    if (!stringId || stringId.includes('_')) {
        throw new Error(`Invalid symmetry operation ID: ${id}`);
    }
    if (!Array.isArray(translation) || translation.length !== 3 ||
        !translation.every(Number.isInteger)) {
        throw new Error(`Invalid symmetry translation: ${translation}`);
    }

    const encoded = translation.map(component => component + 5);
    if (encoded.every(component => component >= 0 && component <= 9)) {
        return `${stringId}_${encoded.join('')}`;
    }
    return `${stringId}_[${translation.join(',')}]`;
}
