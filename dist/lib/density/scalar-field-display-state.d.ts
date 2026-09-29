/** @returns {object} UI-owned state derived exclusively from public density events. */
export function createScalarFieldDisplayState(): object;
/**
 * Reduces one public CrystalViewer density event into compact UI state.
 * Deliberately copies only presentation fields, never renderer objects or map payloads.
 * @param {object} state - Previous display state.
 * @param {object} event - Public scalar-field event.
 * @returns {object} Next display state.
 */
export function reduceScalarFieldDisplayState(state: object, event: object): object;
//# sourceMappingURL=scalar-field-display-state.d.ts.map