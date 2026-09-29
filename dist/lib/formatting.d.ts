/**
 * Format a single value with its estimated standard deviation
 * @param {number} value - The value to format
 * @param {number} esd - The estimated standard deviation
 * @param {number} noEsdDecimals - the number of decimals to round to if no esd present
 * @returns {string} Formatted string
 */
export function formatValueEsd(value: number, esd: number, noEsdDecimals?: number): string;
/**
 * Round a number to a specified number of decimal places
 * @param {number} value - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded number
 */
export function roundToDecimals(value: number, decimals: number): number;
/**
 * Splits an atom label into its element symbol and non-element identifier.
 * @param {string} label - Raw atom label.
 * @param {boolean} [subscriptNonElement] - Whether the identifier is a subscript.
 * @returns {{element: string, nonElement: string}} Typographic label parts.
 */
export function atomLabelParts(label: string, subscriptNonElement?: boolean): {
    element: string;
    nonElement: string;
};
/**
 * Formats an atom label for display without changing its underlying CIF identity.
 * @param {string} label - Raw atom label.
 * This plain-text fallback uses Unicode subscripts where they exist. Rich DOM and
 * canvas renderers lower the complete identifier using {@link atomLabelParts}.
 * @param {boolean} [subscriptNonElement] - Whether the non-element label part is a subscript.
 * @returns {string} Display-ready atom label.
 */
export function formatAtomLabel(label: string, subscriptNonElement?: boolean): string;
//# sourceMappingURL=formatting.d.ts.map