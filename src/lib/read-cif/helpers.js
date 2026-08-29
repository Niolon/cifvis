
/**
 * Scans a CIF numeric token, including optional exponent and standard uncertainty.
 * @param {string} text - Complete token text.
 * @returns {{signString: string, numString: string, expString: string|null, suString: string|null}|null}
 * Parsed parts, or null when the complete token does not match CIF numeric syntax.
 */
function scanNumericToken(text) {
    let index = 0;
    let signString = '';
    if (text[index] === '+' || text[index] === '-') {
        signString = text[index++];
    }

    const mantissaStart = index;
    let digitCount = 0;
    while (text[index] >= '0' && text[index] <= '9') {
        index++;
        digitCount++;
    }
    if (text[index] === '.') {
        index++;
        while (text[index] >= '0' && text[index] <= '9') {
            index++;
            digitCount++;
        }
    }
    if (digitCount === 0) {
        return null;
    }
    const numString = text.slice(mantissaStart, index);

    let expString = null;
    if (text[index] === 'e' || text[index] === 'E') {
        index++;
        const exponentStart = index;
        if (text[index] === '+' || text[index] === '-') {
            index++;
        }
        const exponentDigitsStart = index;
        while (text[index] >= '0' && text[index] <= '9') {
            index++;
        }
        if (index === exponentDigitsStart) {
            return null;
        }
        expString = text.slice(exponentStart, index);
    }

    let suString = null;
    if (text[index] === '(') {
        index++;
        const uncertaintyStart = index;
        while (text[index] >= '0' && text[index] <= '9') {
            index++;
        }
        if (index === uncertaintyStart || text[index] !== ')') {
            return null;
        }
        suString = text.slice(uncertaintyStart, index);
        index++;
    }

    return index === text.length ? { signString, numString, expString, suString } : null;
}

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
export function parseValue(entryString, splitSU = true, cifVersion = 1) {
    const numericToken = scanNumericToken(entryString);
    
    if (splitSU && numericToken && numericToken.expString !== null && numericToken.suString !== null) {
        const { signString, numString, expString, suString } = numericToken;
        const signMult = signString === '-' ? -1 : 1;
        const base = parseFloat(numString);
        const exp = parseInt(expString);
        
        // Calculate mantissa decimals for proper rounding
        const mantissaDecimals = numString.includes('.') ? numString.split('.')[1].length : 0;
        
        // Convert to standard decimal form for consistent rounding
        const value = Number((signMult * base * Math.pow(10, exp)));
        
        // Calculate SU with same decimal places as the final value
        const suExp = exp - mantissaDecimals;
        const su = Number((parseInt(suString) * Math.pow(10, suExp)));
        if ((mantissaDecimals - exp) >= 0 && (mantissaDecimals - exp) <= 100) {
            return {
                value: Number(value.toFixed(mantissaDecimals - exp)),
                su: Number(su.toFixed(mantissaDecimals - exp)),
            };
        }
        return { value, su };
    }

    if (numericToken && numericToken.expString !== null && numericToken.suString === null) {
        const { signString, numString, expString } = numericToken;
        const signMult = signString === '-' ? -1 : 1;
        const mantissaDecimals = numString.includes('.') ? numString.split('.')[1].length : 0;
        const exp = parseInt(expString);
        const value = Number(signMult * parseFloat(numString) * Math.pow(10, exp));
        if ((mantissaDecimals - exp) >= 0 && (mantissaDecimals - exp) <= 100) {
            return {
                value: Number(value.toFixed(mantissaDecimals - exp)),
                su: NaN,
            };
        }
        return { value, su: NaN };
    }

    if (splitSU && numericToken && numericToken.expString === null && numericToken.suString !== null) {
        const { signString, numString: numberString, suString } = numericToken;
        const signMult = signString === '-' ? -1 : 1;
        if (numberString.includes('.')) {
            const decimals = numberString.split('.')[1].length;
            const value = Number((signMult * parseFloat(numberString)).toFixed(decimals));
            const su = Number((Math.pow(10, -decimals) * parseFloat(suString)).toFixed(decimals));
            return { value, su };
        } else {
            const value = signMult * parseInt(numberString);
            const su = parseInt(suString);
            return { value, su };
        }
    }

    // Handle regular numbers and text
    if (isNaN(entryString)) {
        if (cifVersion === 2) {
            // CIF2 tokens arrive already unquoted; CIF2 has no backslash escaping.
            return { value: entryString, su: NaN };
        }
        const quote = entryString[0];
        if ((quote === '"' || quote === '\'') && entryString.at(-1) === quote) {
            return { value: entryString.slice(1, -1).replace(/\\([^\\])/g, '$1'), su: NaN };
        } else {
            return { value: entryString.replace(/\\([^\\])/g, '$1'), su: NaN };
        }
    } else {
        const value = entryString.includes('.') ? parseFloat(entryString) : parseInt(entryString);
        return { value, su: NaN };
    }
}

/**
 * Parses a multiline string starting with semicolon.
 * @param {Array<string>} lines - Array of lines
 * @param {number} startIndex - Starting index of multiline value
 * @returns {object} Object with parsed value and end index
 */
export function parseMultiLineString(lines, startIndex) {
    const line1 = [lines[startIndex].slice(1)];

    const slice1 = lines.slice(startIndex + 1);
    const sliceEnd = slice1.findIndex(line => line.startsWith(';'));
    // Some SHELX-generated CIFs leave a final _shelx_hkl_file text field open
    // at EOF. Treat EOF as its terminator so the coordinate block remains
    // usable and the reflection reader can consume the complete HKL payload.
    if (sliceEnd === -1) {
        console.warn(
            `Unterminated CIF multiline text field starting at input line ${startIndex + 1}; ` +
            'treating end of file as the closing semicolon.',
        );
    }
    const contentEnd = sliceEnd === -1 ? slice1.length : sliceEnd;
    const result = line1.concat(slice1.slice(0, contentEnd));

    const nonEmptySliceStart = result.findIndex(line => line.trim() !== '');
    const nonEmptySliceEnd = result.findLastIndex(line => line.trim() !== '');

    return {
        value: nonEmptySliceStart === -1
            ? ''
            : result.slice(nonEmptySliceStart, nonEmptySliceEnd + 1).join('\n'),
        endIndex: sliceEnd === -1 ? lines.length - 1 : startIndex + sliceEnd + 1,
    };
}
