/**
 * @typedef {object} BondGeometryRepairs
 * @property {number} recoded - Bonds whose site-symmetry code was corrected.
 * @property {number} lengthCorrected - Bonds whose stated length was replaced by the real distance.
 * @property {number} dropped - Bonds that could not be reconciled either way.
 * @property {string[]} details - Human-readable description of each repair.
 */
/**
 * Repairs bonds whose stated length contradicts the structure's own coordinates and
 * site-symmetry codes.
 *
 * A `_geom_bond` entry carries three pieces of information - the two atom labels, a
 * site-symmetry code, and a distance - and a file can state all three inconsistently.
 * The distance is then the only one of the three that is independently meaningful: it
 * is what the depositor measured. So the code is re-derived from it wherever some
 * symmetry image reproduces it, which is the common case by a wide margin; across the
 * COD problem corpus 4235 of 4262 inconsistent bonds are repairable this way.
 *
 * Correcting the length instead would satisfy any consistency check while leaving the
 * bond drawn between the wrong pair of atoms - typically whole unit cells apart - so it
 * is used only where no image reproduces the stated distance and the coordinates
 * themselves still describe a chemically plausible bond.
 * @param {CrystalStructure} structure - Structure to repair.
 * @param {object} [options] - Overrides.
 * @param {number} [options.tolerance] - Maximum accepted length deviation in Å.
 * @param {number} [options.maxPlausibleBond] - Longest distance accepted from coordinates alone.
 * @returns {{structure: CrystalStructure, repairs: BondGeometryRepairs}} Repaired structure
 *  and a description of what was changed. The input is left untouched.
 */
export function repairBondGeometry(structure: CrystalStructure, options?: {
    tolerance?: number | undefined;
    maxPlausibleBond?: number | undefined;
}): {
    structure: CrystalStructure;
    repairs: BondGeometryRepairs;
};
/**
 * Largest deviation, in Ångström, between a stated bond length and the distance the
 * structure's own coordinates span before the bond counts as inconsistent. Published
 * distances are commonly rounded to two decimals, so this sits just above that.
 */
export const BOND_GEOMETRY_TOLERANCE: 0.05;
/** Longest distance still accepted as a real bond when falling back to the coordinates. */
export const MAX_PLAUSIBLE_BOND: 4;
export type BondGeometryRepairs = {
    /**
     * - Bonds whose site-symmetry code was corrected.
     */
    recoded: number;
    /**
     * - Bonds whose stated length was replaced by the real distance.
     */
    lengthCorrected: number;
    /**
     * - Bonds that could not be reconciled either way.
     */
    dropped: number;
    /**
     * - Human-readable description of each repair.
     */
    details: string[];
};
import { CrystalStructure } from '../crystal.js';
//# sourceMappingURL=bond-geometry.d.ts.map