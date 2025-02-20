
/**
 * Parses a CIF value string into its numeric value and standard uncertainty (SU).
 *
 * @param {string} entryString - The CIF value string to parse.
 * @param {boolean} splitSU - Whether to split standard uncertainty values into value and SU.
 * @returns {Object} Object containing:
 *   - value {number|string}: The parsed value (number for numeric values, string for text)
 *   - su {number|NaN}: The standard uncertainty if present and splitSU=true, NaN otherwise
 *
 * @example
 * parseValue("123.456(7)", true) // Returns {value: 123.456, su: 0.007}
 * parseValue("-123(7)", true)    // Returns {value: -123, su: 7}
 * parseValue("'text'", true)     // Returns {value: "text", su: NaN}
 */

export function parseValue(entryString, splitSU = true) {
    const suPattern = /^([+-]?)(\d+\.?\d*|\.\d+)\((\d+)\)/;
    const match = entryString.match(suPattern);
    let value, su;

    if (splitSU && match) {
        const [, signString, numberString, suString] = match;
        const signMult = signString === '-' ? -1 : 1;
        if (numberString.includes('.')) {
            const decimals = numberString.split('.')[1].length;
            value = Number((signMult * parseFloat(numberString)).toFixed(decimals));
            su = Number((Math.pow(10, -decimals) * parseFloat(suString)).toFixed(decimals));
        } else {
            value = signMult * parseInt(numberString);
            su = parseInt(suString);
        }
    } else {
        if (isNaN(entryString)) {
            if (/^".*"$/.test(entryString) || /^'.*'$/.test(entryString)) {
                value = entryString.slice(1, -1).replace(/\\([^\\])/g, '$1');
            } else {
                value = entryString.replace(/\\([^\\])/g, '$1');
            }
        } else {
            value = entryString.includes('.') ? parseFloat(entryString) : parseInt(entryString);
        }
        su = NaN;
    }
    return { value, su };
}
/**
 * Parses a multiline string starting with semicolon.
 * @param {Array<string>} lines - Array of lines
 * @param {number} startIndex - Starting index of multiline value
 * @returns {Object} Object with parsed value and end index
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
