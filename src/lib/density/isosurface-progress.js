/**
 * Normalizes an increasing progressive isosurface-resolution schedule.
 * @param {unknown} steps - Candidate resolution fractions.
 * @returns {number[]} Ordered unique fractions ending at one.
 */
export function normalizeIsosurfaceSteps(steps) {
    const valid = (Array.isArray(steps) ? steps : [1])
        .map(Number)
        .filter(step => Number.isFinite(step) && step > 0 && step <= 1)
        .sort((first, second) => first - second);
    if (!valid.includes(1)) {
        valid.push(1);
    }
    return [...new Set(valid)];
}
