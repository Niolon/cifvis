/**
 * Tests whether the general-position phase sum is zero for a reflection.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {number} tolerance - Complex phase-sum tolerance.
 * @returns {boolean} Whether the reflection is systematically absent.
 */
export function isSystematicAbsence(h: number, k: number, l: number, symmetry: CellSymmetry, tolerance?: number): boolean;
/**
 * Removes systematic absences and merges symmetry-equivalent intensities.
 * Positive uncertainties use inverse-variance weighting; data without usable
 * uncertainties use an arithmetic mean.
 * @param {object[]} reflections - Unmerged observations.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensitiesLegacy(reflections: object[], symmetry: CellSymmetry, options?: object): {
    reflections: object[];
    systematicAbsenceCount: number;
};
/**
 * Typed, allocation-conscious reflection merge implementation. Its output is
 * deliberately identical to the legacy object/orbit implementation.
 * @param {object[]|object} input - Object rows or typed structure-of-arrays.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging and diagnostic options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensitiesPrepared(input: object[] | object, symmetry: CellSymmetry, options?: object): {
    reflections: object[];
    systematicAbsenceCount: number;
};
/**
 * Merges reflections through the prepared structure-of-arrays implementation.
 * @param {object[]|object} reflections - Object rows or typed observations.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensities(reflections: object[] | object, symmetry: CellSymmetry, options?: object): {
    reflections: object[];
    systematicAbsenceCount: number;
};
/**
 * Reads observed intensities, preferring an already merged `_refln` loop and
 * otherwise merging `_diffrn_refln` or `_shelx_hkl_file` observations.
 * @param {string} cifText - CIF containing coordinates and reflections.
 * @param {number|string} cifBlock - Coordinate/symmetry block index or name.
 * @param {object} options - Source and merging options.
 * @returns {{reflections:object[], metadata:object}} Normalized observations.
 */
export function readReflectionIntensities(cifText: string, cifBlock?: number | string, options?: object): {
    reflections: object[];
    metadata: object;
};
import { CellSymmetry } from '../structure/cell-symmetry.js';
//# sourceMappingURL=reflection-intensities.d.ts.map