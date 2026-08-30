import { SPACE_GROUP_TABLE } from './space-group-table.js';

/**
 * Normalizes a Hermann-Mauguin space-group symbol for tolerant matching by
 * removing all whitespace and underscores and lower-casing the result.
 * @param {string} symbol - Space-group symbol in any spacing/case
 * @returns {string} Normalized symbol key
 */
function normalizeSymbol(symbol) {
    return String(symbol).replace(/[\s_]+/g, '').toLowerCase();
}

// Index by number and by normalized name for O(1) lookup. A space-group number
// identifies a type, not a setting, so the number index deliberately contains
// only the standard setting. Hall and universal H-M symbols retain enough
// information to select alternative axes and origin choices.
const byNumber = new Map();
const byName = new Map();
for (const entry of SPACE_GROUP_TABLE) {
    if (entry.is_standard || !byNumber.has(entry.number)) {
        byNumber.set(entry.number, entry);
    }
    for (const symbol of [
        entry.symbol_cif,
        entry.symbol_hm_short,
        entry.hall_symbol,
        entry.universal_h_m,
    ]) {
        const key = normalizeSymbol(symbol);
        if (!byName.has(key)) {
            byName.set(key, entry);
        }
    }
}

/**
 * Looks up the standard-setting general-position operators for a space group by
 * its Hall symbol, full/alternative Hermann-Mauguin name, and/or International
 * Tables number. Setting-specific symbols are preferred when they agree with
 * the declared group type; the number selects the standard setting otherwise.
 *
 * The returned operators assume the standard International Tables setting (see
 * space-group-table.js). They must only be used when a CIF omits its own
 * symmetry-operation loop, never to override operations the CIF provides.
 * @param {object} options - Lookup keys
 * @param {number|string} [options.number] - Space-group IT number
 * @param {string} [options.name] - Hermann-Mauguin symbol in any spacing/case
 * @param {string} [options.fullName] - Full or universal Hermann-Mauguin symbol
 * @param {string} [options.hall] - Hall symbol
 * @returns {?{number: number, symbol_cif: string, symbol_hm_short: string,
 *  operations: string[]}} Matching table entry, or null if no match is found
 */
export function lookupSpaceGroup({ number, name, fullName, hall } = {}) {
    const numberText = typeof number === 'string' ? number.trim() : number;
    const parsedNumber = typeof numberText === 'string' && /^\d+$/.test(numberText)
        ? Number(numberText)
        : numberText;
    const numberedEntry = Number.isInteger(parsedNumber) ? byNumber.get(parsedNumber) : null;

    for (const symbol of [hall, fullName, name]) {
        if (!symbol || symbol === 'Unknown') {
            continue;
        }
        const entry = byName.get(normalizeSymbol(symbol));
        if (entry && (!numberedEntry || entry.number === parsedNumber)) {
            return entry;
        }
    }

    return numberedEntry || null;
}
