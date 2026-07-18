/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- compact cell helpers */
/** Shared tolerances for matching coordinate and reflection unit cells. */
export const CELL_MATCH_TOLERANCES = Object.freeze({
    relativeLength: 1e-3,
    angleDegrees: 0.05,
});

/** Tests whether two unit cells describe the same reflection lattice. */
export function cellsMatch(first, second, tolerances = CELL_MATCH_TOLERANCES) {
    for (const parameter of ['a', 'b', 'c']) {
        const scale = Math.max(Math.abs(second[parameter]), 1);
        if (Math.abs(first[parameter] - second[parameter]) / scale > tolerances.relativeLength) {
            return false;
        }
    }
    for (const parameter of ['alpha', 'beta', 'gamma']) {
        if (Math.abs(first[parameter] - second[parameter]) > tolerances.angleDegrees) {
            return false;
        }
    }
    return true;
}

/** Throws an informative mismatch error naming the first differing parameter. */
export function assertCellsMatch(first, second, label = 'Reflection') {
    for (const parameter of ['a', 'b', 'c']) {
        const scale = Math.max(Math.abs(second[parameter]), 1);
        if (Math.abs(first[parameter] - second[parameter]) / scale >
            CELL_MATCH_TOLERANCES.relativeLength) {
            throw new Error(`${label} unit cell does not match the structure (${parameter})`);
        }
    }
    for (const parameter of ['alpha', 'beta', 'gamma']) {
        if (Math.abs(first[parameter] - second[parameter]) > CELL_MATCH_TOLERANCES.angleDegrees) {
            throw new Error(`${label} unit cell does not match the structure (${parameter})`);
        }
    }
}
