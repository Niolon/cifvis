
/**
 * Format a single value with its estimated standard deviation
 * @param {number} value - The value to format
 * @param {number} esd - The estimated standard deviation
 * @param {number} noEsdDecimals - the number of decimals to round to if no esd present
 * @returns {string} Formatted string
 */
export function formatValueEsd(value, esd, noEsdDecimals=4) {
    if (!isFinite(1 / esd)) {
        return roundToDecimals(value, noEsdDecimals).toFixed(noEsdDecimals);
    }

    let order = Math.floor(Math.log10(esd));
    if (esd * Math.pow(10, -order) < 2) {
        order -= 1;
    }

    const roundedValue = roundToDecimals(value, -order);
    if (order < 0) {
        const esdVal = Math.round(esd / Math.pow(10, order));
        return `${roundedValue.toFixed(-order)}(${esdVal})`;
    }
    const esdVal = roundToDecimals(esd, order);
    return `${roundedValue}(${esdVal})`;
}

/**
 * Round a number to a specified number of decimal places
 * @param {number} value - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded number
 */
export function roundToDecimals(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Splits an atom label into its element symbol and non-element identifier.
 * @param {string} label - Raw atom label.
 * @param {boolean} [subscriptNonElement] - Whether the identifier is a subscript.
 * @returns {{element: string, nonElement: string}} Typographic label parts.
 */
export function atomLabelParts(label, subscriptNonElement = false) {
    const text = String(label ?? '');
    if (!subscriptNonElement) {
        return { element: text, nonElement: '' };
    }
    const parts = text.match(/^([A-Z][a-z]?)(.*)$/);
    if (!parts) {
        return { element: text, nonElement: '' };
    }
    return { element: parts[1], nonElement: parts[2] };
}

/**
 * Formats an atom label for display without changing its underlying CIF identity.
 * @param {string} label - Raw atom label.
 * This plain-text fallback uses Unicode subscripts where they exist. Rich DOM and
 * canvas renderers lower the complete identifier using {@link atomLabelParts}.
 * @param {boolean} [subscriptNonElement] - Whether the non-element label part is a subscript.
 * @returns {string} Display-ready atom label.
 */
export function formatAtomLabel(label, subscriptNonElement = false) {
    const text = String(label ?? '');
    if (!subscriptNonElement) {
        return text;
    }
    const parts = atomLabelParts(text, true);
    return parts.element + parts.nonElement.replace(/\d/g, digit => SUBSCRIPT_DIGITS[Number(digit)]);
}
