
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
