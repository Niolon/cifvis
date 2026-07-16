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
 * @returns {{value: (string|number|Array|Map), su: number, nextPos: number}} The parsed value, its
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
export function skipCif2Value(tokens, pos) {
    const token = tokens[pos];
    if (!token) {
        throw new Error('Unexpected end of CIF2 value stream');
    }

    switch (token.type) {
        case 'value':
            return pos + 1;
        case 'listOpen':
        case 'tableOpen': {
            // Both containers are flat bracket-depth scans at the token
            // level: nesting is handled by tracking a stack of open
            // container types, without recursing into or interpreting entry
            // values. A stack (rather than a plain depth counter) is
            // required so mismatched nesting like `[ ... }` is rejected
            // instead of being accepted as balanced.
            const CLOSE_FOR_OPEN = { listOpen: 'listClose', tableOpen: 'tableClose' };
            const stack = [token.type];
            let i = pos + 1;
            while (i < tokens.length && stack.length > 0) {
                const type = tokens[i].type;
                if (type === 'listOpen' || type === 'tableOpen') {
                    stack.push(type);
                } else if (type === 'listClose' || type === 'tableClose') {
                    const expected = CLOSE_FOR_OPEN[stack[stack.length - 1]];
                    if (type !== expected) {
                        throw new Error(
                            `Mismatched CIF2 container: expected '${expected}' but found '${type}'`,
                        );
                    }
                    stack.pop();
                }
                i++;
            }
            if (stack.length > 0) {
                throw new Error(
                    token.type === 'listOpen' ? 'Unterminated CIF2 list value' : 'Unterminated CIF2 table value',
                );
            }
            return i;
        }
        default:
            throw new Error(`Unexpected token '${token.type}' where a CIF2 value was expected`);
    }
}
