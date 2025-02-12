import { create, all } from 'mathjs';

import { uCifToUCart, adpToMatrix } from './fract-to-cart.js';

const math = create(all, {});

/**
* Represents isotropic atomic displacement parameters
*/
export class UIsoADP {
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
        const uijMatrix = adpToMatrix(this.getUCart(unitCell));
        const { eigenvectors: eigenvectors_obj } = math.eigs(uijMatrix);
        const eigenvectors = math.transpose(math.matrix(eigenvectors_obj.map(entry => entry.vector)));

        const eigenvalues = math.matrix(eigenvectors_obj.map(entry => entry.value));
        const det = math.det(eigenvectors);
        const sqrtEigenvalues = math.diag(eigenvalues.map(Math.sqrt));

        let transformationMatrix;
        // make sure it is a rotation -> no vertice direction inverted
        if (math.abs(det - 1) > 1e-10) {
            const normalizedEigenvectors = math.multiply(eigenvectors, 1/det);
            transformationMatrix = math.multiply(normalizedEigenvectors, sqrtEigenvalues);
        } else {
            transformationMatrix = math.multiply(eigenvectors, sqrtEigenvalues);
        }

        return math.matrix(transformationMatrix);
    }
}/**
 * Factory class for creating appropriate ADP objects from CIF data
 */
export class ADPFactory {
    /**
     * Creates the appropriate ADP object based on available CIF data
     * @param {CifBlock} cifBlock - The CIF data block
     * @param {number} atomIndex - Index in atom_site loop
     * @returns {(UIsoADP|UAnisoADP|null)} The appropriate ADP object or null if no valid data
     */
    static createADP(cifBlock, atomIndex) {
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
     * Creates ADP from explicitly specified type
     * @private
     */
    static createFromExplicitType(cifBlock, atomIndex, label, type) {
        switch (type.toLowerCase()) {
        case 'uani':
            return ADPFactory.createUani(cifBlock, label);
        case 'bani':
            return ADPFactory.createBani(cifBlock, label);
        case 'uiso':
            return ADPFactory.createUiso(cifBlock, atomIndex);
        case 'biso':
            return ADPFactory.createBiso(cifBlock, atomIndex);
        default:
            return null;
        }
    }

    /**
     * Checks if an atom is present in the anisotropic data loop
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
     * Creates anisotropic U-based ADP
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
        0;
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
     * Creates anisotropic B-based ADP
     * @private
     */
    static createBani(cifBlock, label) {
        const anisoSite = cifBlock.get('_atom_site_aniso');
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
     * Creates isotropic U-based ADP
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
     * Creates isotropic B-based ADP
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