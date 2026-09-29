/**
 * Measures an ordered atom selection. With 5+ atoms, all but the last define
 * a least-squares mean plane and the last atom is the distance probe.
 * @param {object[]} atoms - Selected atoms in selection order.
 * @param {object} cell - Unit cell used to convert fractional coordinates.
 * @returns {object} Measurement type, value, unit, and atom labels.
 */
export function measureAtoms(atoms: object[], cell: object): object;
/**
 * @param {object} measurement - Measurement to format.
 * @param {object} [options] - Display formatting options.
 * @param {boolean} [options.subscriptNonElement] - Whether numeric non-element parts use subscripts.
 * @returns {string} Compact human-readable result.
 */
export function formatMeasurement(measurement: object, options?: {
    subscriptNonElement?: boolean | undefined;
}): string;
/**
 * @param {number} atomCount - Number of selected atoms.
 * @returns {{enabled: boolean, symbol: string, title: string}} Button presentation.
 */
export function measurementAction(atomCount: number): {
    enabled: boolean;
    symbol: string;
    title: string;
};
//# sourceMappingURL=measurements.d.ts.map