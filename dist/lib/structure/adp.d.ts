/**
 * Computes a deterministic, right-handed Cartesian principal frame for an
 * anisotropic displacement tensor. Eigenvalues are ordered from largest to
 * smallest and columns of `rotation` are the corresponding eigenvectors.
 * @param {UAnisoADP} adp - Anisotropic displacement parameters
 * @param {UnitCell} unitCell - Unit cell used to convert CIF Uij to Cartesian U
 * @returns {{eigenvalues:number[], rotation:number[][], valid:boolean, tolerance:number}}
 * Principal-frame description
 */
export function getADPPrincipalFrame(adp: UAnisoADP, unitCell: UnitCell): {
    eigenvalues: number[];
    rotation: number[][];
    valid: boolean;
    tolerance: number;
};
/**
 * Describes an RMSD PEANUT radial surface in structure-Cartesian coordinates.
 * @param {UAnisoADP} adp - Anisotropic displacement parameters
 * @param {UnitCell} unitCell - Unit cell used for Cartesian conversion
 * @param {number} scale - Visual RMSD multiplier
 * @returns {{kind:string, eigenvalues:number[], rotation:number[][], maxScale:number,
 * normalizedShape:number[], complementaryShape:number[], components:object[],
 * boundingRadius:number, valid:boolean,
 * localRadialScale:function(number[]):number, localNormal:function(number[]):number[],
 * surfaceDistanceAlong:function(number[]):number}}
 * Surface description
 */
export function createRMSDPeanutSurface(adp: UAnisoADP, unitCell: UnitCell, scale: number): {
    kind: string;
    eigenvalues: number[];
    rotation: number[][];
    maxScale: number;
    normalizedShape: number[];
    complementaryShape: number[];
    components: object[];
    boundingRadius: number;
    valid: boolean;
    localRadialScale: (arg0: number[]) => number;
    localNormal: (arg0: number[]) => number[];
    surfaceDistanceAlong: (arg0: number[]) => number;
};
/**
 * Converts a target ellipsoid display probability into the RMS-ellipsoid
 * scale factor k (applied to the sqrt(eigenvalue) semi-axes from
 * {@link UAnisoADP#getEllipsoidMatrix}), so that a sphere of radius k drawn
 * around an atom with these displacement parameters encloses the requested
 * fraction of the atom's positional probability density. k^2 is the
 * chi-squared(3) quantile at that probability; found by bisection on the
 * closed-form chi-squared(3) CDF, since it has no elementary inverse.
 * @param {number} probability - Target probability in (0, 1); 0.5 gives the
 *  conventional 50% probability ellipsoid (k &approx; 1.5382).
 * @returns {number} RMS-ellipsoid scale factor k
 */
export function ellipsoidProbabilityScale(probability: number): number;
/**
 * Represents isotropic atomic displacement parameters
 */
export class UIsoADP {
    /**
     * Creates a UIsoADP instance from a B value
     * @param {number} biso - Isotropic B value in Å²
     * @returns {UIsoADP} New UIsoADP instance
     */
    static fromBiso(biso: number): UIsoADP;
    /**
     * Creates an isotropic atomic displacement parameter instance.
     * @param {number} uiso - Isotropic U value in Å²
     */
    constructor(uiso: number);
    uiso: number;
}
/**
 * Represents anisotropic atomic displacement parameters
 */
export class UAnisoADP {
    /**
     * Creates a UAnisoADP instance from B values
     * @param {number} b11 - B11 component in Å²
     * @param {number} b22 - B22 component in Å²
     * @param {number} b33 - B33 component in Å²
     * @param {number} b12 - B12 component in Å²
     * @param {number} b13 - B13 component in Å²
     * @param {number} b23 - B23 component in Å²
     * @returns {UAnisoADP} New UAnisoADP instance
     */
    static fromBani(b11: number, b22: number, b33: number, b12: number, b13: number, b23: number): UAnisoADP;
    /**
     * @param {number} u11 - U11 component in Å²
     * @param {number} u22 - U22 component in Å²
     * @param {number} u33 - U33 component in Å²
     * @param {number} u12 - U12 component in Å²
     * @param {number} u13 - U13 component in Å²
     * @param {number} u23 - U23 component in Å²
     */
    constructor(u11: number, u22: number, u33: number, u12: number, u13: number, u23: number);
    u11: number;
    u22: number;
    u33: number;
    u12: number;
    u13: number;
    u23: number;
    /**
     * Converts ADPs to Cartesian coordinate system
     * @param {UnitCell} unitCell - Cell parameters for transformation
     * @returns {number[]} ADPs in Cartesian coordinates [U11, U22, U33, U12, U13, U23]
     */
    getUCart(unitCell: UnitCell): number[];
    /**
     * Generates the transformation matrix to transform a sphere already scaled for probability
     * to an ORTEP ellipsoid
     * @param {UnitCell} unitCell - unitCell object for the unit cell information
     * @returns {math.Matrix} transformation matrix, is normalised to never invert coordinates
     */
    getEllipsoidMatrix(unitCell: UnitCell): math.Matrix;
}
/**
 * Factory class for creating appropriate ADP objects from CIF data.
 * Handles both isotropic and anisotropic displacement parameters in various formats.
 */
export class ADPFactory {
    /**
     * Creates the appropriate ADP object based on available CIF data.
     * Tries multiple possible sources for displacement parameters in order of preference.
     * @param {CifBlock} cifBlock - The CIF data block containing atomic parameters
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @returns {(UIsoADP|UAnisoADP|null)} The appropriate ADP object or null if no valid data
     */
    static fromCIF(cifBlock: CifBlock, atomIndex: number): (UIsoADP | UAnisoADP | null);
    /**
     * Creates ADP from explicitly specified type in the CIF file.
     * @param {CifBlock} cifBlock - The CIF data block containing atomic parameters
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @param {string} label - Atom label for identifying the atom in anisotropic data
     * @param {string} type - Explicit ADP type specified in the CIF (e.g., 'Uani', 'Biso')
     * @returns {(UIsoADP|UAnisoADP|null)} The appropriate ADP object or null if creation fails
     * @private
     */
    private static createFromExplicitType;
    /**
     * Checks if an atom is present in the anisotropic displacement parameter loop.
     * @param {CifBlock} cifBlock - The CIF data block to check
     * @param {string} label - Atom label to search for
     * @returns {boolean} True if the atom has anisotropic data, false otherwise
     * @private
     */
    private static isInAnisoLoop;
    /**
     * Creates anisotropic ADP from U(cif) convention data in the atom_site_aniso loop.
     * @param {CifBlock} cifBlock - The CIF data block containing anisotropic data
     * @param {string} label - Atom label to find in the anisotropic data
     * @returns {UAnisoADP|null} New UAnisoADP instance or null if data is invalid
     * @throws {Error} If the atom has a Uani type but no anisotropic data is found
     * @private
     */
    private static createUani;
    /**
     * Creates anisotropic ADP from B conventation data in the atom_site_aniso loop.
     * @param {CifBlock} cifBlock - The CIF data block containing anisotropic data
     * @param {string} label - Atom label to find in the anisotropic data
     * @returns {UAnisoADP|null} New UAnisoADP instance or null if data is invalid
     * @throws {Error} If the atom has a Bani type but no anisotropic data is found
     * @private
     */
    private static createBani;
    /**
     * Creates isotropic ADP from Uiso data in the atom_site loop.
     * @param {CifBlock} cifBlock - The CIF data block containing atom data
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @returns {UIsoADP|null} New UIsoADP instance or null if data is invalid
     * @private
     */
    private static createUiso;
    /**
     * Creates isotropic ADP from B conventation data in the atom_site loop.
     * @param {CifBlock} cifBlock - The CIF data block containing atom data
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @returns {UIsoADP|null} New UIsoADP instance or null if data is invalid
     * @private
     */
    private static createBiso;
}
import { UnitCell } from './crystal.js';
import * as math from '../math-lite.js';
import { CifBlock } from '../read-cif/base.js';
//# sourceMappingURL=adp.d.ts.map