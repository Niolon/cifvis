/**
 * Parses a CIF value string into its numeric value and standard uncertainty (SU).
 * @param {string} entryString - The CIF value string to parse.
 * @param {boolean} splitSU - Whether to split standard uncertainty values into value and SU.
 * @param {number} [cifVersion] - CIF format version (1 or 2). For CIF2 the token has already been
 *   unquoted by the tokenizer, so quote-stripping and CIF1 backslash de-escaping are skipped.
 * @returns {object} Object containing:
 *   - value {number|string}: The parsed value (number for numeric values, string for text)
 *   - su {number|NaN}: The standard uncertainty if present and splitSU=true, NaN otherwise
 * @example
 * parseValue("123.456(7)", true)     // Returns {value: 123.456, su: 0.007}
 * parseValue("-123(7)", true)        // Returns {value: -123, su: 7}
 * parseValue("'text'", true)         // Returns {value: "text", su: NaN}
 * parseValue("1.23E4(5)", true)      // Returns {value: 12300, su: 50}
 * parseValue("1.23e-4(2)", true)     // Returns {value: 0.000123, su: 0.0000002}
 */
export function parseValue(entryString: string, splitSU?: boolean, cifVersion?: number): object;
/**
 * Parses a multiline string starting with semicolon.
 * @param {Array<string>} lines - Array of lines
 * @param {number} startIndex - Starting index of multiline value
 * @returns {object} Object with parsed value and end index
 */
export function parseMultiLineString(lines: Array<string>, startIndex: number): object;
//# sourceMappingURL=helpers.d.ts.map