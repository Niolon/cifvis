import { CifLoop } from '../read-cif/loop.js';

/**
 * Attempts to guess and normalize a symmetry operation string from various formats.
 * Returns original string if format cannot be recognized.
 * 
 * Known input formats:
 * - Standard: "2_555", "12_565"
 * - Space/dash separated: "2 555", "m1-565", "-2x 555"
 * - Encoded integers: "20555" (-> "2_555"), "565012" (-> "12_565")
 * @param {string|number} symOpString - The input symmetry operation string/code
 * @returns {string} Normalized symmetry operation string in format "id_xyz" or original string if not recognized
 */
export function guessSymmetryOperation(symOpString) {
    if (!symOpString || symOpString === '.') {
        return '.';
    }

    const input = String(symOpString).trim();

    if (/^\d+_\d{3}$/.test(input)) {
        return input;
    }

    const separatorMatch = input.match(/^-?([^\s\-_.]+)[\s-.](\d{3})$/);
    if (separatorMatch) {
        const id = separatorMatch[1];
        const translation = separatorMatch[2];
        return separatorMatch[0].startsWith('-') ? `-${id}_${translation}` : `${id}_${translation}`;
    }

    if (/^\d{5,6}$/.test(input)) {
        const firstThree = input.slice(0, 3);
        const lastThree = input.slice(-3);
        // Choose translation code based on closeness to "555"
        const firstThreeSum = Array.from(firstThree)
            .map(digit => Math.abs(parseInt(digit) - 5))
            .reduce((a, b) => a + b, 0);
        const lastThreeSum = Array.from(lastThree)
            .map(digit => Math.abs(parseInt(digit) - 5))
            .reduce((a, b) => a + b, 0);

        if (firstThreeSum < lastThreeSum) {
            // format is 55502
            const id = parseInt(input.slice(3));
            return `${id}_${firstThree}`;
        } else {
            const id = parseInt(input.slice(0, -4));
            return `${id}_${lastThree}`;
        }
    }

    return symOpString;
}

/**
 * Reconciles symmetry operation strings in a loop column by trying to guess and normalize their format
 * @param {CifLoop} loop - CIF loop containing the column to reconcile
 * @param {string} columnToReconcile - Name of column containing symmetry operations to reconcile
 */
export function reconcileSymmetryOperations(loop, columnToReconcile) {
    const originalValues = loop.get(columnToReconcile);
    const reconciledValues = originalValues.map(value => guessSymmetryOperation(value));
    loop.data[columnToReconcile] = reconciledValues;
}
