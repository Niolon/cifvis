import * as math from '../math-lite.js';
import { uCifToUCart, adpToMatrix } from './fract-to-cart.js';
import { UnitCell } from './crystal.js';
import { CifBlock } from '../read-cif/base.js';

/**
 * Represents isotropic atomic displacement parameters
 */
export class UIsoADP {
    /**
     * Creates an isotropic atomic displacement parameter instance.
     * @param {number} uiso - Isotropic U value in Å²
     */
    constructor(uiso) {
        this.uiso = uiso;
    }

    /**
     * Creates a UIsoADP instance from a B value
     * @param {number} biso - Isotropic B value in Å²
     * @returns {UIsoADP} New UIsoADP instance
     */
    static fromBiso(biso) {
        return new UIsoADP(biso / (8 * Math.PI * Math.PI));
    }
}

/**
 * Represents anisotropic atomic displacement parameters
 */
export class UAnisoADP {
    /**
     * @param {number} u11 - U11 component in Å²
     * @param {number} u22 - U22 component in Å²
     * @param {number} u33 - U33 component in Å²
     * @param {number} u12 - U12 component in Å²
     * @param {number} u13 - U13 component in Å²
     * @param {number} u23 - U23 component in Å² 
     */
    constructor(u11, u22, u33, u12, u13, u23) {
        this.u11 = u11;
        this.u22 = u22;
        this.u33 = u33;
        this.u12 = u12;
        this.u13 = u13;
        this.u23 = u23;
    }

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
    static fromBani(b11, b22, b33, b12, b13, b23) {
        const factor = 1 / (8 * Math.PI * Math.PI);
        return new UAnisoADP(
            b11 * factor,
            b22 * factor,
            b33 * factor,
            b12 * factor,
            b13 * factor,
            b23 * factor,
        );
    }

    /**
     * Converts ADPs to Cartesian coordinate system
     * @param {UnitCell} unitCell - Cell parameters for transformation
     * @returns {number[]} ADPs in Cartesian coordinates [U11, U22, U33, U12, U13, U23]
     */
    getUCart(unitCell) {
        return uCifToUCart(
            unitCell.fractToCartMatrix,
            [this.u11, this.u22, this.u33, this.u12, this.u13, this.u23],
        );
    }

    /**
     * Generates the transformation matrix to transform a sphere already scaled for probability
     * to an ORTEP ellipsoid
     * @param {UnitCell} unitCell - unitCell object for the unit cell information
     * @returns {math.Matrix} transformation matrix, is normalised to never invert coordinates
     */
    getEllipsoidMatrix(unitCell) {
        const frame = getADPPrincipalFrame(this, unitCell);
        if (!frame.valid) {
            return math.matrix([
                [NaN, NaN, NaN],
                [NaN, NaN, NaN],
                [NaN, NaN, NaN],
            ]);
        }
        return math.matrix(math.multiply(
            frame.rotation,
            math.diag(frame.eigenvalues.map(Math.sqrt)),
        ));
    }
}

/**
 * Computes a deterministic, right-handed Cartesian principal frame for an
 * anisotropic displacement tensor. Eigenvalues are ordered from largest to
 * smallest and columns of `rotation` are the corresponding eigenvectors.
 * @param {UAnisoADP} adp - Anisotropic displacement parameters
 * @param {UnitCell} unitCell - Unit cell used to convert CIF Uij to Cartesian U
 * @returns {{eigenvalues:number[], rotation:number[][], valid:boolean, tolerance:number}}
 * Principal-frame description
 */
export function getADPPrincipalFrame(adp, unitCell) {
    const invalid = {
        eigenvalues: [NaN, NaN, NaN],
        rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        valid: false,
        tolerance: NaN,
    };
    try {
        const uijMatrix = adpToMatrix(adp.getUCart(unitCell));
        const { eigenvectors } = math.eigs(uijMatrix);
        const entries = eigenvectors
            .map(entry => ({
                value: Number(entry.value),
                vector: (entry.vector.toArray?.() || entry.vector).map(Number),
            }))
            .sort((a, b) => b.value - a.value);
        if (entries.length !== 3 || entries.some(entry =>
            !Number.isFinite(entry.value) || entry.vector.some(value => !Number.isFinite(value)))) {
            return invalid;
        }

        // Remove the otherwise arbitrary +/- sign of each eigenvector.
        for (const entry of entries) {
            let pivot = 0;
            for (let i = 1; i < 3; i++) {
                if (Math.abs(entry.vector[i]) > Math.abs(entry.vector[pivot])) {
                    pivot = i;
                }
            }
            if (entry.vector[pivot] < 0) {
                entry.vector = entry.vector.map(value => -value);
            }
        }

        const rotation = math.transpose(entries.map(entry => entry.vector));
        if (math.det(rotation) < 0) {
            // Flipping the final column preserves the two most significant
            // deterministic axes while making the complete frame a rotation.
            for (let row = 0; row < 3; row++) {
                rotation[row][2] *= -1;
            }
        }
        const eigenvalues = entries.map(entry => entry.value);
        const lambdaMax = eigenvalues[0];
        const tolerance = Math.max(1e-12, Math.abs(lambdaMax) * 1e-10);
        const valid = Number.isFinite(lambdaMax) &&
            eigenvalues.every(value => Number.isFinite(value) && value > tolerance);
        return { eigenvalues, rotation, valid, tolerance };
    } catch {
        return invalid;
    }
}

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
export function createRMSDPeanutSurface(adp, unitCell, scale) {
    const frame = getADPPrincipalFrame(adp, unitCell);
    const validScale = Number.isFinite(scale) && scale > 0;
    const maxAbsEigenvalue = Math.max(...frame.eigenvalues.map(Math.abs));
    const tolerance = Math.max(1e-12, maxAbsEigenvalue * 1e-10);
    const validTensor = frame.eigenvalues.every(Number.isFinite) &&
        Number.isFinite(maxAbsEigenvalue) && maxAbsEigenvalue > tolerance;
    const normalizedShape = validTensor
        ? frame.eigenvalues.map(value => value / maxAbsEigenvalue)
        : [NaN, NaN, NaN];
    const complementaryShape = normalizedShape.map(value => -value);
    const maxScale = validTensor && validScale ? Math.sqrt(maxAbsEigenvalue) : NaN;
    const components = validTensor ? [
        frame.eigenvalues.some(value => value > tolerance) && {
            sign: 'positive',
            normalizedShape,
        },
        frame.eigenvalues.some(value => value < -tolerance) && {
            sign: 'negative',
            normalizedShape: complementaryShape,
        },
    ].filter(Boolean) : [];
    const rotationTranspose = math.transpose(frame.rotation);
    const normalizedDirection = direction => {
        if (!Array.isArray(direction) || direction.length !== 3) {
            return null;
        }
        const length = Math.hypot(direction[0], direction[1], direction[2]);
        return length > 0 ? direction.map(value => value / length) : null;
    };
    const localRadialScale = direction => {
        const n = normalizedDirection(direction);
        if (!validTensor || !n) {
            return 0;
        }
        return Math.sqrt(Math.abs(normalizedShape.reduce(
            (sum, value, index) => sum + value * n[index] * n[index],
            0,
        )));
    };
    const localNormal = direction => {
        const n = normalizedDirection(direction);
        if (!validTensor || !n) {
            return [0, 0, 0];
        }
        const signedQ = normalizedShape.reduce(
            (sum, value, index) => sum + value * n[index] * n[index],
            0,
        );
        const q = Math.abs(signedQ);
        const activeShape = signedQ >= 0 ? normalizedShape : complementaryShape;
        const normal = n.map((value, index) =>
            2 * q * value - activeShape[index] * value);
        const length = Math.hypot(...normal);
        return length > 0 ? normal.map(value => value / length) : [0, 0, 0];
    };
    const surfaceDistanceAlong = direction => {
        const unit = normalizedDirection(direction);
        if (!validTensor || !validScale || !unit) {
            return 0;
        }
        const local = math.multiply(rotationTranspose, unit);
        const variance = frame.eigenvalues.reduce(
            (sum, value, index) => sum + value * local[index] * local[index],
            0,
        );
        return scale * Math.sqrt(Math.abs(variance));
    };
    return {
        kind: 'rmsd-peanut',
        eigenvalues: frame.eigenvalues,
        rotation: frame.rotation,
        maxScale,
        normalizedShape,
        complementaryShape,
        components,
        boundingRadius: validTensor && validScale ? scale * maxScale : 0,
        valid: validTensor && validScale,
        localRadialScale,
        localNormal,
        surfaceDistanceAlong,
    };
}

/**
 * @param {number} x - Input value
 * @returns {number} erf(x) via the Abramowitz & Stegun 7.1.26 rational approximation.
 */
function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * absX);
    const polynomial = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
    return sign * (1 - polynomial * Math.exp(-absX * absX));
}

/**
 * @param {number} x - Point at which to evaluate the CDF
 * @returns {number} CDF of the chi-squared distribution with 3 degrees of freedom at x.
 */
function chiSquare3CDF(x) {
    if (x <= 0) {
        return 0;
    }
    return erf(Math.sqrt(x / 2)) - Math.sqrt(2 * x / Math.PI) * Math.exp(-x / 2);
}

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
export function ellipsoidProbabilityScale(probability) {
    if (!(Number.isFinite(probability) && probability > 0 && probability < 1)) {
        throw new Error('Ellipsoid probability must be a finite number between 0 and 1');
    }
    let low = 0;
    let high = 100;
    for (let iteration = 0; iteration < 100; iteration++) {
        const mid = (low + high) / 2;
        if (chiSquare3CDF(mid) < probability) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return Math.sqrt((low + high) / 2);
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
    static fromCIF(cifBlock, atomIndex) {
        const atomSite = cifBlock.get('_atom_site');
        const label = atomSite.getIndex(['_atom_site.label', '_atom_site_label'], atomIndex);

        // Check for explicit ADP type
        const explicitType = atomSite.getIndex(
            ['_atom_site.adp_type', '_atom_site_adp_type', 
                '_atom_site.thermal_displace_type', '_atom_site_thermal_displace_type'],
            atomIndex,
            false,
        );

        // If explicit type given, try that first
        if (explicitType) {
            const adp = ADPFactory.createFromExplicitType(cifBlock, atomIndex, label, explicitType);
            return adp;
        }

        // Check if atom is in anisotropic data
        const hasAniso = ADPFactory.isInAnisoLoop(cifBlock, label);
        if (hasAniso) {
            // Try Uani first, then Bani
            const uaniADP = ADPFactory.createUani(cifBlock, label);
            if (uaniADP !== null) {
                return uaniADP;
            }

            const baniADP = ADPFactory.createBani(cifBlock, label);
            if (baniADP !== null) {
                return baniADP;
            }
        }

        // Try isotropic values in order of preference
        const uisoADP = ADPFactory.createUiso(cifBlock, atomIndex);
        if (uisoADP !== null) {
            return uisoADP;
        }

        const bisoADP = ADPFactory.createBiso(cifBlock, atomIndex);
        if (bisoADP !== null) {
            return bisoADP;
        }

        return null;
    }

    /**
     * Creates ADP from explicitly specified type in the CIF file.
     * @param {CifBlock} cifBlock - The CIF data block containing atomic parameters
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @param {string} label - Atom label for identifying the atom in anisotropic data
     * @param {string} type - Explicit ADP type specified in the CIF (e.g., 'Uani', 'Biso')
     * @returns {(UIsoADP|UAnisoADP|null)} The appropriate ADP object or null if creation fails
     * @private
     */
    static createFromExplicitType(cifBlock, atomIndex, label, type) {
        switch (type.toLowerCase()) {
            case 'uani':
                return ADPFactory.createUani(cifBlock, label);
            case 'aniso':
                return ADPFactory.createUani(cifBlock, label);
            case 'bani':
                return ADPFactory.createBani(cifBlock, label);
            case 'uiso':
                return ADPFactory.createUiso(cifBlock, atomIndex);
            case 'iso':
                return ADPFactory.createUiso(cifBlock, atomIndex);
            case 'biso':
                return ADPFactory.createBiso(cifBlock, atomIndex);
            default:
                return null;
        }
    }

    /**
     * Checks if an atom is present in the anisotropic displacement parameter loop.
     * @param {CifBlock} cifBlock - The CIF data block to check
     * @param {string} label - Atom label to search for
     * @returns {boolean} True if the atom has anisotropic data, false otherwise
     * @private
     */
    static isInAnisoLoop(cifBlock, label) {
        try {
            const anisoSite = cifBlock.get('_atom_site_aniso');
            const anisoLabels = anisoSite.get(['_atom_site_aniso.label', '_atom_site_aniso_label']);
            return anisoLabels.includes(label);
        } catch {
            return false;
        }
    }

    /**
     * Creates anisotropic ADP from U(cif) convention data in the atom_site_aniso loop.
     * @param {CifBlock} cifBlock - The CIF data block containing anisotropic data
     * @param {string} label - Atom label to find in the anisotropic data
     * @returns {UAnisoADP|null} New UAnisoADP instance or null if data is invalid
     * @throws {Error} If the atom has a Uani type but no anisotropic data is found
     * @private
     */
    static createUani(cifBlock, label) {
        let anisoSite;
        try {
            anisoSite = cifBlock.get('_atom_site_aniso');
        } catch {
            throw new Error(`Atom ${label} had ADP type UAni, but no atom_site_aniso loop was found`);
        }
        const anisoLabels = anisoSite.get(['_atom_site_aniso.label', '_atom_site_aniso_label']);
        const anisoIndex = anisoLabels.indexOf(label);
        if (anisoIndex === -1) {
            throw new Error(`Atom ${label} has ADP type Uani, but was not found in atom_site_aniso.label`);
        }

        // Try to get all required U values
        const u11 = anisoSite.getIndex(['_atom_site_aniso.u_11', '_atom_site_aniso_U_11'], anisoIndex, NaN);
        const u22 = anisoSite.getIndex(['_atom_site_aniso.u_22', '_atom_site_aniso_U_22'], anisoIndex, NaN);
        const u33 = anisoSite.getIndex(['_atom_site_aniso.u_33', '_atom_site_aniso_U_33'], anisoIndex, NaN);
        const u12 = anisoSite.getIndex(['_atom_site_aniso.u_12', '_atom_site_aniso_U_12'], anisoIndex, NaN);
        const u13 = anisoSite.getIndex(['_atom_site_aniso.u_13', '_atom_site_aniso_U_13'], anisoIndex, NaN);
        const u23 = anisoSite.getIndex(['_atom_site_aniso.u_23', '_atom_site_aniso_U_23'], anisoIndex, NaN);

        // Check if all values are valid numbers
        if ([u11, u22, u33, u12, u13, u23].some(isNaN)) {
            return null;
        }

        return new UAnisoADP(u11, u22, u33, u12, u13, u23);
    }

    /**
     * Creates anisotropic ADP from B conventation data in the atom_site_aniso loop.
     * @param {CifBlock} cifBlock - The CIF data block containing anisotropic data
     * @param {string} label - Atom label to find in the anisotropic data
     * @returns {UAnisoADP|null} New UAnisoADP instance or null if data is invalid
     * @throws {Error} If the atom has a Bani type but no anisotropic data is found
     * @private
     */
    static createBani(cifBlock, label) {
        let anisoSite;
        try {
            anisoSite = cifBlock.get('_atom_site_aniso');
        } catch {
            throw new Error(`Atom ${label} had ADP type BAni, but no atom_site_aniso loop was found`);
        }
        const anisoLabels = anisoSite.get(['_atom_site_aniso.label', '_atom_site_aniso_label']);
        const anisoIndex = anisoLabels.indexOf(label);

        if (anisoIndex === -1) {
            throw new Error(`Atom ${label} has ADP type Bani, but was not found in atom_site_aniso.label`);
        }

        // Try to get all required B values
        const b11 = anisoSite.getIndex(['_atom_site_aniso.b_11', '_atom_site_aniso_B_11'], anisoIndex, NaN);
        const b22 = anisoSite.getIndex(['_atom_site_aniso.b_22', '_atom_site_aniso_B_22'], anisoIndex, NaN);
        const b33 = anisoSite.getIndex(['_atom_site_aniso.b_33', '_atom_site_aniso_B_33'], anisoIndex, NaN);
        const b12 = anisoSite.getIndex(['_atom_site_aniso.b_12', '_atom_site_aniso_B_12'], anisoIndex, NaN);
        const b13 = anisoSite.getIndex(['_atom_site_aniso.b_13', '_atom_site_aniso_B_13'], anisoIndex, NaN);
        const b23 = anisoSite.getIndex(['_atom_site_aniso.b_23', '_atom_site_aniso_B_23'], anisoIndex, NaN);

        // Check if all values are valid numbers
        if ([b11, b22, b33, b12, b13, b23].some(isNaN)) {
            return null;
        }

        return UAnisoADP.fromBani(b11, b22, b33, b12, b13, b23);
    }

    /**
     * Creates isotropic ADP from Uiso data in the atom_site loop.
     * @param {CifBlock} cifBlock - The CIF data block containing atom data
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @returns {UIsoADP|null} New UIsoADP instance or null if data is invalid
     * @private
     */
    static createUiso(cifBlock, atomIndex) {
        try {
            const atomSite = cifBlock.get('_atom_site');
            const uiso = atomSite.getIndex(
                ['_atom_site.u_iso_or_equiv', '_atom_site_U_iso_or_equiv'],
                atomIndex,
                NaN,
            );

            if (isNaN(uiso)) {
                return null;
            }

            return new UIsoADP(uiso);
        } catch {
            return null;
        }
    }

    /**
     * Creates isotropic ADP from B conventation data in the atom_site loop.
     * @param {CifBlock} cifBlock - The CIF data block containing atom data
     * @param {number} atomIndex - Index of the atom in the atom_site loop
     * @returns {UIsoADP|null} New UIsoADP instance or null if data is invalid
     * @private
     */
    static createBiso(cifBlock, atomIndex) {
        try {
            const atomSite = cifBlock.get('_atom_site');
            const biso = atomSite.getIndex(
                ['_atom_site.b_iso_or_equiv', '_atom_site_B_iso_or_equiv'],
                atomIndex,
                NaN,
            );

            if (isNaN(biso)) {
                return null;
            }

            return UIsoADP.fromBiso(biso);
        } catch {
            return null;
        }
    }
}
