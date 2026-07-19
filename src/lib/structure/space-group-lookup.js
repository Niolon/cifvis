import { SPACE_GROUP_TABLE } from './space-group-table.js';

/**
 * Normalizes a Hermann-Mauguin space-group symbol for tolerant matching by
 * removing all whitespace and underscores and lower-casing the result. This
 * collapses the various CIF spellings of the same symbol (e.g. "P 21/c",
 * "P21/c", "P 1 21/c 1") onto a common key.
 * @param {string} symbol - Space-group symbol in any spacing/case
 * @returns {string} Normalized symbol key
 */
function normalizeSymbol(symbol) {
    return String(symbol).replace(/[\s_]+/g, '').toLowerCase();
}

// Index by number and by normalized name for O(1) lookup. Both the CIF-style
// and short Hermann-Mauguin symbols are registered so either spelling matches.
const byNumber = new Map();
const byName = new Map();
for (const entry of SPACE_GROUP_TABLE) {
    byNumber.set(entry.number, entry);
    for (const symbol of [entry.symbol_cif, entry.symbol_hm_short, entry.hall_symbol]) {
        const key = normalizeSymbol(symbol);
        if (!byName.has(key)) {
            byName.set(key, entry);
        }
    }
}

/**
 * Looks up the standard-setting general-position operators for a space group by
 * its International Tables number and/or Hermann-Mauguin name. The number is
 * tried first because it is unambiguous; the name is used only as a fallback.
 *
 * The returned operators assume the standard International Tables setting (see
 * space-group-table.js). They must only be used when a CIF omits its own
 * symmetry-operation loop, never to override operations the CIF provides.
 * @param {object} options - Lookup keys
 * @param {number|string} [options.number] - Space-group IT number
 * @param {string} [options.name] - Hermann-Mauguin symbol in any spacing/case
 * @returns {?{number: number, symbol_cif: string, symbol_hm_short: string,
 *  operations: string[]}} Matching table entry, or null if no match is found
 */
export function lookupSpaceGroup({ number, name } = {}) {
    const parsedNumber = typeof number === 'string' ? parseInt(number, 10) : number;
    if (Number.isInteger(parsedNumber) && byNumber.has(parsedNumber)) {
        return byNumber.get(parsedNumber);
    }

    if (name && name !== 'Unknown') {
        const entry = byName.get(normalizeSymbol(name));
        if (entry) {
            return entry;
        }
    }

    return null;
}
