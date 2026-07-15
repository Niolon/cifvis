import { parseValue } from './helpers.js';

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
 * @returns {{value: *, su: number, nextPos: number}} The parsed value, its
 *   standard uncertainty (`NaN` for non-scalars or when absent), and the index
 *   of the first token after the value.
 * @throws {Error} If the token at `pos` cannot start a value.
 */
export function parseCif2Value(tokens, pos, splitSU) {
    const token = tokens[pos];
    if (!token) {
        throw new Error('Unexpected end of CIF2 value stream');
    }

    switch (token.type) {
        case 'value': {
            if (token.quoted) {
                // Quoted / text-field values are always literal strings.
                return { value: token.value, su: NaN, nextPos: pos + 1 };
            }
            const parsed = parseValue(token.value, splitSU, 2);
            return { value: parsed.value, su: parsed.su, nextPos: pos + 1 };
        }
        case 'listOpen':
            return parseList(tokens, pos, splitSU);
        case 'tableOpen':
            return parseTable(tokens, pos, splitSU);
        default:
            throw new Error(`Unexpected token '${token.type}' where a CIF2 value was expected`);
    }
}

/**
 * Parses a CIF2 list value `[ ... ]` into a JavaScript Array.
 * @param {Array<object>} tokens - The CIF2 token stream.
 * @param {number} pos - Index of the opening `listOpen` token.
 * @param {boolean} splitSU - Whether to split standard uncertainties.
 * @returns {{value: Array, su: number, nextPos: number}} The array value and next position.
 * @throws {Error} If the list is not terminated.
 */
function parseList(tokens, pos, splitSU) {
    const values = [];
    let i = pos + 1;
    while (tokens[i] && tokens[i].type !== 'listClose') {
        const entry = parseCif2Value(tokens, i, splitSU);
        values.push(entry.value);
        i = entry.nextPos;
    }
    if (!tokens[i]) {
        throw new Error('Unterminated CIF2 list value');
    }
    return { value: values, su: NaN, nextPos: i + 1 };
}

/**
 * Parses a CIF2 table value `{ 'key':value ... }` into a JavaScript Map,
 * preserving key insertion order.
 * @param {Array<object>} tokens - The CIF2 token stream.
 * @param {number} pos - Index of the opening `tableOpen` token.
 * @param {boolean} splitSU - Whether to split standard uncertainties.
 * @returns {{value: Map, su: number, nextPos: number}} The map value and next position.
 * @throws {Error} If a key/colon is missing or the table is not terminated.
 */
function parseTable(tokens, pos, splitSU) {
    const table = new Map();
    let i = pos + 1;
    while (tokens[i] && tokens[i].type !== 'tableClose') {
        const keyToken = tokens[i];
        if (keyToken.type !== 'value') {
            throw new Error('CIF2 table key must be a quoted string');
        }
        if (!tokens[i + 1] || tokens[i + 1].type !== 'colon') {
            throw new Error(`CIF2 table entry for key '${keyToken.value}' is missing its colon`);
        }
        const entry = parseCif2Value(tokens, i + 2, splitSU);
        table.set(keyToken.value, entry.value);
        i = entry.nextPos;
    }
    if (!tokens[i]) {
        throw new Error('Unterminated CIF2 table value');
    }
    return { value: table, su: NaN, nextPos: i + 1 };
}
