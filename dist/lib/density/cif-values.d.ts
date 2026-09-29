/**
 * Converts a CIF/configuration value to a finite number or null.
 * @param {unknown} value - CIF scalar or configured value.
 * @returns {number|null} Finite numeric value.
 */
export function finiteNumber(value: unknown): number | null;
/**
 * Returns the first loop found under any supported category spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string|string[]} names - Candidate category names.
 * @returns {object|null} First matching CIF loop.
 */
export function optionalLoop(block: object, names: string | string[]): object | null;
/**
 * Returns a loop column or a caller-provided fallback.
 * @param {object|null} loop - Parsed CIF loop.
 * @param {string|string[]} names - Candidate column names.
 * @param {unknown} defaultValue - Value returned for a missing column.
 * @returns {unknown} Column values or the fallback.
 */
export function loopColumn(loop: object | null, names: string | string[], defaultValue?: unknown): unknown;
/**
 * Returns the first finite scalar found under any dictionary spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string[]} names - Candidate scalar names.
 * @returns {number|null} First finite value.
 */
export function numericScalar(block: object, names: string[]): number | null;
/**
 * Returns the first non-empty text value under any dictionary spelling.
 * @param {object} block - Parsed CIF block.
 * @param {string[]} names - Candidate scalar names.
 * @returns {string|null} First non-empty value.
 */
export function textScalar(block: object, names: string[]): string | null;
//# sourceMappingURL=cif-values.d.ts.map