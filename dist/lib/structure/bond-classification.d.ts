/**
 * Determines whether a CIF `_geom_bond` row is suitable as an edge in the
 * chemical connectivity graph.
 *
 * Unknown lengths and metal coordination bonds are retained conservatively;
 * clearly non-covalent non-metal contacts and implausibly long entries are not.
 * @param {object} structure - Owning structure
 * @param {object} bond - Bond/contact to classify
 * @returns {boolean} Whether the row should define chemical connectivity
 */
export function isChemicalBond(structure: object, bond: object): boolean;
/**
 * Returns the subset of CIF bond rows that define chemical connectivity.
 * @param {object} structure - Owning structure
 * @param {object[]} [bonds] - Rows to classify
 * @returns {object[]} Chemical graph edges
 */
export function chemicalBonds(structure: object, bonds?: object[]): object[];
//# sourceMappingURL=bond-classification.d.ts.map