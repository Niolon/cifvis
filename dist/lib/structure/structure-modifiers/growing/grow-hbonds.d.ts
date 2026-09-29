/**
 * Finds every position code that places an atom at the same absolute fractional
 * position as a requested code. Atoms on special positions can have several
 * such codes, and each inverse can correspond to a distinct reciprocal donor.
 * @param {CrystalStructure} structure - Structure providing the symmetry group
 * @param {object} atom - Asymmetric-unit atom to transform
 * @param {string} positionCode - Requested absolute position code
 * @returns {string[]} Equivalent absolute position codes
 */
export function equivalentPositionCodes(structure: CrystalStructure, atom: object, positionCode: string): string[];
/**
 * Keeps chemically plausible bonds whose displayed endpoints reproduce the CIF distance.
 * Unresolved external metadata is retained but does not participate in connectivity.
 * @param {CrystalStructure} structure - Structure providing atoms and cell
 * @param {Bond[]} bonds - Bonds to validate
 * @returns {Bond[]} Geometry-compatible bonds
 */
export function filterBondsByGeometry(structure: CrystalStructure, bonds: Bond[]): Bond[];
/**
 * Selects the displayed periodic images that reproduce each CIF H-bond geometry.
 * Component centring can change atom IDs and leave stale pre-centred interactions;
 * the crystallographic distances provide an unambiguous final reconciliation.
 * @param {CrystalStructure} structure - Structure containing grown periodic images
 * @returns {CrystalStructure} Structure with geometry-compatible H-bonds
 */
export function reconcileHBondsByGeometry(structure: CrystalStructure): CrystalStructure;
/**
 * Grows external hydrogen bonds (HBonds) in a crystal structure by applying symmetry operations
 * to connected groups and generating new atoms, bonds, and HBonds as needed.
 *
 * This function identifies HBonds that cross symmetry boundaries (i.e., those with a non-'.'
 * acceptorAtomSymmetry), applies the corresponding symmetry operation to the connected group,
 * and adds the resulting atoms, bonds, and HBonds to the structure. It ensures that each group
 * is only grown once per symmetry operation to avoid duplication.
 * @param {CrystalStructure} structure - The crystal structure to grow HBonds for.
 * @param {Map<string, string>} [specialPositionAtoms] - Symmetry atom IDs mapped to their
 * canonical special-position atom IDs during preceding fragment growth.
 * @returns {CrystalStructure} A new CrystalStructure instance with the grown atoms, bonds, and HBonds.
 * @throws {Error} If an HBond references a non-existing acceptor atom.
 */
export function growExternalHBonds(structure: CrystalStructure, specialPositionAtoms?: Map<string, string>): CrystalStructure;
import { CrystalStructure } from '../../crystal.js';
import { Bond } from '../../bonds.js';
//# sourceMappingURL=grow-hbonds.d.ts.map