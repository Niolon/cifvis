/**
 * Normalizes a CIF site-symmetry value without resolving the operation ID.
 * Bare operation IDs use the conventional zero-translation suffix.
 * @param {string|number|null|undefined} value - CIF site-symmetry value
 * @param {Map<string, number>|Set<string>|null} [operationIds] - Available operation IDs,
 *  used to disambiguate legacy compact codes such as 2555 (operation 2, translation 555)
 * @returns {string} Normalized symmetry code or '.' for no external symmetry
 */
export function normalizeSiteSymmetry(value: string | number | null | undefined, operationIds?: Map<string, number> | Set<string> | null): string;
/**
 * Parses a symmetry position code into an operation ID and integer lattice translation.
 * Supports conventional CIF codes (e.g. 2_655), bare operation IDs, and an extended
 * internal representation (e.g. 2_[1,-6,12]).
 * @param {string|number} value - Position code to parse
 * @returns {{id: string, translation: number[]}} Parsed operation ID and translation
 */
export function decodePositionCode(value: string | number): {
    id: string;
    translation: number[];
};
/**
 * Formats an operation ID and integer lattice translation as a position code.
 * Conventional three-digit codes are retained whenever possible; translations outside
 * that range use an unambiguous extended internal form.
 * @param {string|number} id - Symmetry operation ID
 * @param {number[]} translation - Integer lattice translation [x, y, z]
 * @returns {string} Formatted position code
 */
export function encodePositionCode(id: string | number, translation: number[]): string;
//# sourceMappingURL=position-code.d.ts.map