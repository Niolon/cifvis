/**
 * Converts a CIF/configuration value to a finite number or null.
 * @param {unknown} value - CIF scalar or configured value.
 * @returns {number|null} Finite numeric value.
 */
export function finiteNumber(value) {
    if (value === null || value === undefined || value === false || value === '.' || value === '?') {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * Returns the first loop found under any supported category spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string|string[]} names - Candidate category names.
 * @returns {object|null} First matching CIF loop.
 */
export function optionalLoop(block, names) {
    for (const name of typeof names === 'string' ? [names] : names) {
        try {
            const value = block.get(name, false);
            if (value && typeof value.get === 'function') {
                return value;
            }
        } catch {
            // Try the next dictionary spelling.
        }
    }
    return null;
}

/**
 * Returns a loop column or a caller-provided fallback.
 * @param {object|null} loop - Parsed CIF loop.
 * @param {string|string[]} names - Candidate column names.
 * @param {unknown} defaultValue - Value returned for a missing column.
 * @returns {unknown} Column values or the fallback.
 */
export function loopColumn(loop, names, defaultValue = null) {
    if (!loop) {
        return defaultValue;
    }
    try {
        return loop.get(names, defaultValue === null ? false : defaultValue) || defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Returns the first finite scalar found under any dictionary spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string[]} names - Candidate scalar names.
 * @returns {number|null} First finite value.
 */
export function numericScalar(block, names) {
    for (const name of names) {
        try {
            const number = finiteNumber(block.get(name));
            if (number !== null) {
                return number;
            }
        } catch {
            // Try the next dictionary spelling.
        }
    }
    return null;
}

/**
 * Returns the first non-empty text value under any dictionary spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string[]} names - Candidate scalar names.
 * @returns {string|null} First non-empty value.
 */
export function textScalar(block, names) {
    for (const name of names) {
        try {
            const value = block.get(name);
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        } catch {
            // Try the next dictionary spelling.
        }
    }
    return null;
}
