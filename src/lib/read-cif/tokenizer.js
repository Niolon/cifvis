/**
 * Character-scanning lexer for CIF2 syntax.
 *
 * CIF2 introduces constructs the line-based CIF1 parser cannot handle:
 * triple-quoted strings, list values (`[ ... ]`), table values (`{ 'k':v }`),
 * and stricter quoting rules. This module converts a raw CIF2 string into a
 * flat stream of tokens; a separate assembler turns that stream into the
 * block/loop/value data model. It is only used on the CIF2 path - CIF1 files
 * never reach this code.
 *
 * Emitted token types:
 *   - `data`       : a `data_<name>` block header (value = block code)
 *   - `save`       : a `save_<name>` frame header (value = frame code)
 *   - `saveEnd`    : a bare `save_` frame terminator
 *   - `loop`       : the `loop_` keyword
 *   - `global`     : the `global_` keyword
 *   - `stop`       : the `stop_` keyword
 *   - `tag`        : a data name, e.g. `_cell_length_a` (value = name)
 *   - `value`      : a data value (value = text, `quoted` flags delimited values)
 *   - `listOpen` / `listClose`   : `[` / `]`
 *   - `tableOpen` / `tableClose` : `{` / `}`
 *   - `colon`      : the `:` separating a table key from its value
 */

const WHITESPACE = new Set([' ', '\t', '\r', '\n']);
const STRUCTURAL = new Set(['[', ']', '{', '}']);

/**
 * Reads a quoted string (single, double, or triple delimited) beginning at the
 * opening delimiter. In CIF2 a single/double quoted string ends at the next
 * matching delimiter and may not span lines or contain the delimiter; a
 * triple-quoted string ends at the next run of three delimiters and may span
 * lines and contain up to two consecutive delimiter characters.
 * @param {string} text - The full CIF2 text.
 * @param {number} start - Index of the opening delimiter.
 * @param {string} delim - The delimiter character (`'` or `"`).
 * @param {number} line - Current 1-based line number, for error messages.
 * @returns {{value: string, next: number, newlines: number}} Parsed content,
 *   the index just past the closing delimiter, and the number of newlines consumed.
 * @throws {Error} If the string is not terminated.
 */
function readQuoted(text, start, delim, line) {
    const triple = text[start + 1] === delim && text[start + 2] === delim;

    if (triple) {
        const marker = delim + delim + delim;
        const close = text.indexOf(marker, start + 3);
        if (close === -1) {
            throw new Error(`Unterminated triple-quoted string starting on line ${line}`);
        }
        const value = text.slice(start + 3, close);
        return { value, next: close + 3, newlines: countNewlines(value) };
    }

    const close = text.indexOf(delim, start + 1);
    const newline = text.indexOf('\n', start + 1);
    if (close === -1 || (newline !== -1 && newline < close)) {
        throw new Error(`Unterminated quoted string starting on line ${line}`);
    }
    return { value: text.slice(start + 1, close), next: close + 1, newlines: 0 };
}

/**
 * Reads a semicolon-delimited text field that opens with `;` at the start of a
 * line and closes at the next line that begins with `;`. The newline that
 * follows the opening `;` is treated as a separator and stripped from the value;
 * text after the closing `;` on its line is left for subsequent tokenizing.
 * @param {string} text - The full CIF2 text.
 * @param {number} start - Index of the opening `;`.
 * @param {number} line - Current 1-based line number, for error messages.
 * @returns {{value: string, next: number, newlines: number}} Field content, the
 *   index just past the closing `;`, and the number of newlines consumed.
 * @throws {Error} If the text field is not terminated.
 */
function readTextField(text, start, line) {
    const terminator = text.indexOf('\n;', start);
    if (terminator === -1) {
        throw new Error(`Unterminated text field starting on line ${line}`);
    }
    let value = text.slice(start + 1, terminator);
    if (value.startsWith('\n')) {
        value = value.slice(1);
    }
    // Advance past the closing "\n;"; anything after the ";" stays on the stream.
    return { value, next: terminator + 2, newlines: countNewlines(text.slice(start, terminator + 2)) };
}

/**
 * Counts the newline characters in a string.
 * @param {string} str - The string to scan.
 * @returns {number} Number of `\n` characters.
 */
function countNewlines(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\n') {
            count++;
        }
    }
    return count;
}

/**
 * Classifies an unquoted bareword into a reserved-word, tag, or value token.
 * CIF reserved words are matched case-insensitively; data/save codes preserve
 * their original case.
 * @param {string} word - The bareword text.
 * @param {number} line - Current 1-based line number.
 * @returns {object} The token object for this bareword.
 */
function classifyBareword(word, line) {
    const lower = word.toLowerCase();
    if (lower === 'loop_') {
        return { type: 'loop', line };
    }
    if (lower === 'save_') {
        return { type: 'saveEnd', line };
    }
    if (lower === 'global_') {
        return { type: 'global', line };
    }
    if (lower === 'stop_') {
        return { type: 'stop', line };
    }
    if (lower.startsWith('data_')) {
        return { type: 'data', value: word.slice(5), line };
    }
    if (lower.startsWith('save_')) {
        return { type: 'save', value: word.slice(5), line };
    }
    if (word[0] === '_') {
        return { type: 'tag', value: word, line };
    }
    return { type: 'value', value: word, quoted: false, line };
}

/**
 * Tokenizes a CIF2 string into a flat array of tokens.
 * @param {string} rawText - Raw CIF2 content (BOM already stripped).
 * @returns {Array<object>} The token stream (see module docs for token types).
 * @throws {Error} On unterminated strings or text fields.
 */
export function tokenizeCif2(rawText) {
    // Normalize all line terminators (CRLF and lone CR) to LF.
    const text = rawText.replace(/\r\n?/g, '\n');
    const tokens = [];
    const n = text.length;
    let i = 0;
    let line = 1;
    let atLineStart = true;

    while (i < n) {
        const c = text[i];

        if (c === '\n') {
            i++;
            line++;
            atLineStart = true;
            continue;
        }
        if (WHITESPACE.has(c)) {
            i++;
            atLineStart = false;
            continue;
        }
        if (c === '#') {
            while (i < n && text[i] !== '\n') {
                i++;
            }
            continue;
        }
        if (c === ';' && atLineStart) {
            const field = readTextField(text, i, line);
            tokens.push({ type: 'value', value: field.value, quoted: true, line });
            i = field.next;
            line += field.newlines;
            atLineStart = false;
            continue;
        }
        if (STRUCTURAL.has(c)) {
            const type = { '[': 'listOpen', ']': 'listClose', '{': 'tableOpen', '}': 'tableClose' }[c];
            tokens.push({ type, line });
            i++;
            atLineStart = false;
            continue;
        }
        if (c === '\'' || c === '"') {
            const quoted = readQuoted(text, i, c, line);
            tokens.push({ type: 'value', value: quoted.value, quoted: true, line });
            i = quoted.next;
            line += quoted.newlines;
            atLineStart = false;
            // A table key is a quoted string immediately followed by a colon.
            if (text[i] === ':') {
                tokens.push({ type: 'colon', line });
                i++;
            }
            continue;
        }

        // Unquoted bareword: runs until whitespace or a structural delimiter.
        const start = i;
        while (i < n && !WHITESPACE.has(text[i]) && !STRUCTURAL.has(text[i])) {
            i++;
        }
        tokens.push(classifyBareword(text.slice(start, i), line));
        atLineStart = false;
    }

    return tokens;
}
