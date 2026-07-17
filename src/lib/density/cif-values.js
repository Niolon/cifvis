/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact shared CIF helpers */
/** Converts a CIF/configuration value to a finite number or null. */
export function finiteNumber(value) {
    if (value === null || value === undefined || value === false || value === '.' || value === '?') {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/** Returns the first loop found under any supported category spelling. */
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

/** Returns a loop column or a caller-provided fallback. */
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

/** Returns the first finite scalar found under any dictionary spelling. */
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

/** Returns the first non-empty text value under any dictionary spelling. */
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
