/**
 * Returns every tabulated setting matching a declared symbol. This is useful
 * when a caller must distinguish an unambiguous setting declaration from a
 * name shared by multiple operation sets.
 * @param {string} symbol - Hall or Hermann-Mauguin symbol
 * @returns {object[]} Matching table entries
 */
export function lookupSpaceGroupCandidates(symbol: string): object[];
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
export function lookupSpaceGroup({ number, name, fullName, hall }?: {
    number?: string | number | undefined;
    name?: string | undefined;
    fullName?: string | undefined;
    hall?: string | undefined;
}): {
    number: number;
    symbol_cif: string;
    symbol_hm_short: string;
    operations: string[];
} | null;
//# sourceMappingURL=space-group-lookup.d.ts.map