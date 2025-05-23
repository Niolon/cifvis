import { Atom, CrystalStructure } from '../crystal.js';
import { BaseFilter } from './base.js';
import { UAnisoADP } from '../adp.js';

import { create, all } from 'mathjs';
import { growFragment } from './growing/grow-fragment.js';
import { growCell } from './growing/grow-cell.js';
import { growExternalHBonds } from './growing/grow-hbonds.js';
export const math = create(all);

/**
 * Filters atoms, bonds, and H-bonds involving hydrogen atoms from a structure.
 * Supports displaying no hydrogens, hydrogens without ADPs, or hydrogens with anisotropic ADPs.
 * @augments BaseFilter
 */

export class HydrogenFilter extends BaseFilter {
    static MODES = Object.freeze({
        NONE: 'none',
        CONSTANT: 'constant',
        ANISOTROPIC: 'anisotropic',
    });

    static PREFERRED_FALLBACK_ORDER = [
        HydrogenFilter.MODES.ANISOTROPIC,
        HydrogenFilter.MODES.CONSTANT,
        HydrogenFilter.MODES.NONE,
    ];

    /**
     * Creates a new hydrogen filter
     * @param {HydrogenFilter.MODES} [mode] - Initial filter mode
     */
    constructor(mode = HydrogenFilter.MODES.NONE) {
        super(HydrogenFilter.MODES, mode, 'HydrogenFilter', HydrogenFilter.PREFERRED_FALLBACK_ORDER);
    }

    /**
     * Applies hydrogen filtering according to current mode
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with filtered hydrogens
     */
    apply(structure) {
        this.ensureValidMode(structure);

        const filteredAtoms = structure.atoms
            .filter(atom => atom.atomType !== 'H' || this.mode !== HydrogenFilter.MODES.NONE)
            .map(atom => (new Atom(
                atom.label,
                atom.atomType,
                atom.position,
                atom.atomType === 'H' && this.mode === HydrogenFilter.MODES.CONSTANT ?
                    null : atom.adp,
                atom.disorderGroup,
            )));

        const filteredBonds = structure.bonds
            .filter(bond => {
                if (this.mode === HydrogenFilter.MODES.NONE) {
                    const atom1 = structure.getAtomByLabel(bond.atom1Label);
                    const atom2 = structure.getAtomByLabel(bond.atom2Label);
                    return !(atom1.atomType === 'H' || atom2.atomType === 'H');
                }
                return true;
            });

        const filteredHBonds = this.mode === HydrogenFilter.MODES.NONE ?
            [] : structure.hBonds;

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes based on presence of hydrogens and their ADPs
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const modes = [HydrogenFilter.MODES.NONE];
        const hasHydrogens = structure.atoms.some(atom => atom.atomType === 'H');

        if (!hasHydrogens) {
            return modes;
        }

        modes.push(HydrogenFilter.MODES.CONSTANT);

        const hasAnisoHydrogens = structure.atoms.some(
            atom => atom.atomType === 'H' && atom.adp instanceof UAnisoADP,
        );

        if (hasAnisoHydrogens) {
            modes.push(HydrogenFilter.MODES.ANISOTROPIC);
        }
        return modes;
    }
}
/**
 * Filters atoms, bonds, and h-bonds based on their disorder groups.
 * Can show all atoms, only disorder group 1, or only disorder groups > 1.
 * @augments BaseFilter
 */

export class DisorderFilter extends BaseFilter {
    static MODES = Object.freeze({
        ALL: 'all',
        GROUP1: 'group1',
        GROUP2: 'group2',
    });

    static PREFERRED_FALLBACK_ORDER = [
        DisorderFilter.MODES.ALL,
        DisorderFilter.MODES.GROUP1,
        DisorderFilter.MODES.GROUP2,
    ];

    /**
     * Creates a new disorder filter
     * @param {DisorderFilter.MODES} [mode] - Initial filter mode
     */
    constructor(mode = DisorderFilter.MODES.ALL) {
        super(DisorderFilter.MODES, mode, 'DisorderFilter', DisorderFilter.PREFERRED_FALLBACK_ORDER);
    }

    /**
     * Applies disorder filtering according to current mode
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with filtered disorder groups
     */
    apply(structure) {
        this.ensureValidMode(structure);

        const filteredAtoms = structure.atoms.filter(atom => {
            if (this.mode === DisorderFilter.MODES.GROUP1 && atom.disorderGroup > 1) {
                return false;
            }
            if (this.mode === DisorderFilter.MODES.GROUP2 && atom.disorderGroup === 1) {
                return false;
            }
            return true;
        });

        const filteredBonds = structure.bonds.filter(bond => {
            const atom1 = structure.getAtomByLabel(bond.atom1Label);
            const atom2 = structure.getAtomByLabel(bond.atom2Label);

            if (this.mode === DisorderFilter.MODES.GROUP1 &&
                (atom1.disorderGroup > 1 || atom2.disorderGroup > 1)) {
                return false;
            }

            if (this.mode === DisorderFilter.MODES.GROUP2 &&
                (atom1.disorderGroup === 1 || atom2.disorderGroup === 1)) {
                return false;
            }

            return true;
        });

        const filteredHBonds = structure.hBonds.filter(hbond => {
            const donor = structure.getAtomByLabel(hbond.donorAtomLabel);
            const hydrogen = structure.getAtomByLabel(hbond.hydrogenAtomLabel);
            const acceptor = structure.getAtomByLabel(hbond.acceptorAtomLabel);

            if (this.mode === DisorderFilter.MODES.GROUP1 &&
                (donor.disorderGroup > 1 || hydrogen.disorderGroup > 1 ||
                    acceptor.disorderGroup > 1)) {
                return false;
            }

            if (this.mode === DisorderFilter.MODES.GROUP2 &&
                (donor.disorderGroup === 1 || hydrogen.disorderGroup === 1 ||
                    acceptor.disorderGroup === 1)) {
                return false;
            }

            return true;
        });

        return new CrystalStructure(
            structure.cell,
            filteredAtoms,
            filteredBonds,
            filteredHBonds,
            structure.symmetry,
        );
    }

    /**
     * Gets applicable modes based on presence of disorder groups
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const modes = [DisorderFilter.MODES.ALL];
        const hasDisorder = structure.atoms.some(atom => atom.disorderGroup > 0);

        if (!hasDisorder) {
            return modes;
        }

        if (structure.atoms.some(atom => atom.disorderGroup === 1)) {
            modes.push(DisorderFilter.MODES.GROUP1);
        }
        if (structure.atoms.some(atom => atom.disorderGroup > 1)) {
            modes.push(DisorderFilter.MODES.GROUP2);
        }

        return modes;
    }
}

export class SymmetryGrower extends BaseFilter {
    static MODES = Object.freeze({
        NONE: 'none',
        HBONDS: 'hbonds',
        FRAGMENT: 'fragment',
        FRAGMENT_HBONDS: 'fragment-hbonds',
        CELL: 'cell',
        FRAGMENT_CELL: 'fragment-cell',
    });

    static PREFERRED_FALLBACK_ORDER = [
        SymmetryGrower.MODES.FRAGMENT,
        SymmetryGrower.MODES.CELL,
    ];

    /**
     * Creates a new symmetry grower
     * @param {SymmetryGrower.MODES} [mode] - Initial mode for growing symmetry
     */
    constructor(mode = SymmetryGrower.MODES.NONE) {
        super(SymmetryGrower.MODES, mode, 'SymmetryGrower', SymmetryGrower.PREFERRED_FALLBACK_ORDER);
    }

    get requiresCameraUpdate() {
        return true;
    }

    apply(structure) {
        this.ensureValidMode(structure);
        let workStructure = structure;
        if (this.mode === SymmetryGrower.MODES.FRAGMENT || this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
            workStructure = growFragment(structure);
        }
        if (this.mode === SymmetryGrower.MODES.CELL || this.mode === SymmetryGrower.MODES.FRAGMENT_CELL) {
            workStructure = growCell(structure);
        }

        if (this.mode === SymmetryGrower.MODES.HBONDS || this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
            workStructure = growExternalHBonds(workStructure);
        }

        return workStructure;
    }

    getApplicableModes(structure) {
        const modes = [SymmetryGrower.MODES.NONE, SymmetryGrower.MODES.CELL];
        const hasSymmetry = structure.symmetry && structure.symmetry.operations.length > 0;

        if (!hasSymmetry) {
            return modes;
        }

        const hasGrowableBonds = structure.bonds.some(bond => bond.atom2SiteSymmetry !== '.');
        if (hasGrowableBonds) {
            modes.push(SymmetryGrower.MODES.FRAGMENT);
            modes.push(SymmetryGrower.MODES.FRAGMENT_CELL);
        }

        const hasGrowableHBonds = structure.hBonds.some(hbond => hbond.acceptorAtomSymmetry !== '.');
        
        if (hasGrowableHBonds) {
            modes.push(SymmetryGrower.MODES.HBONDS);
            if (hasGrowableBonds) {
                modes.push(SymmetryGrower.MODES.FRAGMENT_HBONDS);
            }
        }

        return modes;
    }
}