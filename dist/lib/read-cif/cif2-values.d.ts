/**
 * Recursive-descent assembler that turns a CIF2 token stream (produced by
 * `tokenizeCif2`) into JavaScript values. Scalars reuse the shared
 * {@link parseValue} semantics (numbers, standard uncertainties, text); CIF2
 * lists become `Array`s and CIF2 tables become `Map`s, with nesting handled
 * naturally by the recursion.
 */
/**
 * Parses a single CIF2 value starting at the given token position.
 * @param {Array<object>} tokens - The CIF2 token stream.
 * @param {number} pos - Index of the first token of the value.
 * @param {boolean} splitSU - Whether to split standard uncertainties.
 * @returns {{value: (string|number|Array|Map), su: number, nextPos: number}} The parsed value, its
 *   standard uncertainty (`NaN` for non-scalars or when absent), and the index
 *   of the first token after the value.
 * @throws {Error} If the token at `pos` cannot start a value.
 */
export function parseCif2Value(tokens: Array<object>, pos: number, splitSU: boolean): {
    value: (string | number | any[] | Map<any, any>);
    su: number;
    nextPos: number;
};
/**
 * Finds the end of a single CIF2 value's tokens (scalar, list, or table)
 * without interpreting its content - no {@link parseValue} calls, no
 * standard-uncertainty parsing, no Array/Map construction. Used to walk past
 * loop cells whose value is never actually read, so that cost is paid lazily
 * (inside {@link parseCif2Value}, called from CifLoop.parse()) only for
 * loops a caller actually queries via .get()/.getIndex(), mirroring CIF1's
 * existing lazy CifLoop behavior.
 * @param {Array<object>} tokens - The CIF2 token stream.
 * @param {number} pos - Index of the first token of the value.
 * @returns {number} The index of the first token after the value.
 * @throws {Error} If the token at `pos` cannot start a value, or a list/table is unterminated.
 */
export function skipCif2Value(tokens: Array<object>, pos: number): number;
//# sourceMappingURL=cif2-values.d.ts.map