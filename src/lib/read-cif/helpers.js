
/**
 * Parses a CIF value string into its numeric value and standard uncertainty (SU).
 * @param {string} entryString - The CIF value string to parse.
 * @param {boolean} splitSU - Whether to split standard uncertainty values into value and SU.
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
export function parseValue(entryString, splitSU = true) {
    // First try to match scientific notation with uncertainty
    const sciPattern = /^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)\((\d+)\)$/;
    const sciMatch = entryString.match(sciPattern);
    
    if (splitSU && sciMatch) {
        const [, signString, numString, expString, suString] = sciMatch;
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

    // Try regular scientific notation without uncertainty
    const plainSciPattern = /^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)$/;
    const plainSciMatch = entryString.match(plainSciPattern);
    
    if (plainSciMatch) {
        const [, signString, numString, expString] = plainSciMatch;
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

    // Try regular uncertainty notation
    const suPattern = /^([+-]?)(\d+\.?\d*|\.\d+)\((\d+)\)$/;
    const match = entryString.match(suPattern);

    if (splitSU && match) {
        const [, signString, numberString, suString] = match;
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
        if (/^".*"$/.test(entryString) || /^'.*'$/.test(entryString)) {
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

/**
 *
 * @param lines
 * @param startIndex
 */
export function parseMultiLineString(lines, startIndex) {
    const line1 = [lines[startIndex].slice(1)];

    const slice1 = lines.slice(startIndex + 1);
    const sliceEnd = slice1.findIndex(line => line.startsWith(';'));
    const result = line1.concat(slice1.slice(0, sliceEnd));

    const nonEmptySliceStart = result.findIndex(line => line.trim() !== '');
    const nonEmptySliceEnd = result.findLastIndex(line => line.trim !== '');

    return {
        value: result.slice(nonEmptySliceStart, nonEmptySliceEnd + 1).join('\n'),
        endIndex: startIndex + sliceEnd + 1,
    };
}
