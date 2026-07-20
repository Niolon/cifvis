import { Atom, CrystalStructure } from '../crystal.js';
import { BaseFilter } from './base.js';
import { UAnisoADP } from '../adp.js';

import { growFragment } from './growing/grow-fragment.js';
import { growCell, addPackingBorderAtoms } from './growing/grow-cell.js';
import { chemicalBonds } from '../bond-classification.js';
import {
    filterBondsByGeometry,
    growExternalHBonds,
    reconcileHBondsByGeometry,
} from './growing/grow-hbonds.js';

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

        if (this.mode === HydrogenFilter.MODES.ANISOTROPIC) {
            return structure;
        }

        const filteredAtoms = structure.atoms
            .filter(atom => atom.atomType !== 'H' || this.mode !== HydrogenFilter.MODES.NONE)
            .map(atom => (new Atom(
                atom.label,
                atom.atomType,
                atom.position,
                atom.atomType === 'H' && this.mode === HydrogenFilter.MODES.CONSTANT ?
                    null : atom.adp,
                atom.disorderGroup,
                atom.appliedSymmetry, // Preserve symmetry info for correct uniqueId
            )));

        const filteredBonds = structure.bonds
            .filter(bond => {
                if (this.mode === HydrogenFilter.MODES.NONE) {
                    if (bond.atom2SiteSymmetry !== '.') {
                        try {
                            // With cell growing the base atoms might not be present 
                            // anymore, so we need to handle that gracefully
                            // anymore, so we need to handle that gracefully
                            const atom1 = structure.getAtomById(bond.atom1Id);
                            const atom2 = structure.getAtomById(bond.atom2Id);
                            return !(atom1.atomType === 'H' || atom2.atomType === 'H');
                        } catch {
                            return true; // Keep bond if there's an error
                        }
                    }
                    try {
                        const atom1 = structure.getAtomById(bond.atom1Id);
                        const atom2 = structure.getAtomById(bond.atom2Id);
                        return !(atom1.atomType === 'H' || atom2.atomType === 'H');
                    } catch {
                        return true;
                    }
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
 * Can show all atoms, or restrict the view to a single disorder group (plus
 * any non-disordered atoms). The set of selectable groups is derived from the
 * disorder groups actually present in a given structure, so any number of
 * groups is supported.
 *
 * Group modes are named by rank and total count, e.g. "group1of3", rather
 * than by the raw CIF disorder_group number. This keeps mode names (and the
 * icons chosen for them) stable positionally: "group1of2"/"group2of2" always
 * refer to the two-tone dedicated artwork, regardless of which disorder_group
 * numbers actually appear in the CIF file.
 * @augments BaseFilter
 */

export class DisorderFilter extends BaseFilter {
    static MODES = Object.freeze({
        ALL: 'all',
    });

    static PREFERRED_FALLBACK_ORDER = [DisorderFilter.MODES.ALL];

    /**
     * Builds the mode string for a disorder group at a given rank
     * @param {number} rank - 1-based position of the group among all groups present
     * @param {number} total - Total number of disorder groups present
     * @returns {string} Mode string, e.g. "group1of2"
     */
    static modeForGroup(rank, total) {
        return `group${rank}of${total}`;
    }

    /**
     * Extracts the rank and total encoded in a mode string
     * @param {string} mode - Mode string
     * @returns {{rank: number, total: number}|null} Parsed mode, or null if not a group mode
     */
    static parseGroupMode(mode) {
        const match = /^group(\d+)of(\d+)$/.exec(mode);
        return match ? { rank: Number(match[1]), total: Number(match[2]) } : null;
    }

    /**
     * Creates a new disorder filter
     * @param {string} [mode] - Initial filter mode
     */
    constructor(mode = DisorderFilter.MODES.ALL) {
        super(DisorderFilter.MODES, mode, 'DisorderFilter', DisorderFilter.PREFERRED_FALLBACK_ORDER);
        this._groupValuesByRank = [];
    }

    /**
     * Gets the current mode
     * @returns {string} Current mode
     */
    get mode() {
        return this._mode;
    }

    /**
     * Sets the current mode. Unlike the fixed-mode filters, the set of valid
     * group modes depends on the structure last analyzed by getApplicableModes,
     * so only the mode syntax ("all" or "group<rank>of<total>") is validated here.
     * @param {string} value - New mode to set
     * @throws {Error} If mode syntax is invalid
     */
    set mode(value) {
        const usedMode = value.toLowerCase().replace(/_/g, '-');
        if (usedMode !== DisorderFilter.MODES.ALL && DisorderFilter.parseGroupMode(usedMode) === null) {
            throw new Error(
                `Invalid DisorderFilter mode: "${value}". ` +
                'Valid modes are: "all" or "group<rank>of<total>" (e.g. "group1of2").',
            );
        }
        this._mode = usedMode;
    }

    /**
     * Applies disorder filtering according to current mode
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {CrystalStructure} New structure with filtered disorder groups
     */
    apply(structure) {
        this.ensureValidMode(structure);

        const parsedMode = DisorderFilter.parseGroupMode(this.mode);
        const selectedGroup = parsedMode ? this._groupValuesByRank[parsedMode.rank - 1] : null;
        // Non-disordered atoms (group 0) are always shown alongside the selected group.
        const isVisible = atom => selectedGroup === null ||
            Number(atom.disorderGroup) === 0 || Number(atom.disorderGroup) === selectedGroup;

        // External bond endpoints identify symmetry images that are not present yet.
        // Disorder membership is a property of the asymmetric-unit atom and is unchanged
        // by symmetry, so resolve all references through their base labels here.
        const getAsymmetricAtom = atomId => structure.getAtomByLabel(atomId.split('|')[0]);

        const filteredAtoms = structure.atoms.filter(isVisible);

        const filteredBonds = structure.bonds.filter(bond => {
            try {
                const atom1 = getAsymmetricAtom(bond.atom1Id);
                const atom2 = getAsymmetricAtom(bond.atom2Id);
                return isVisible(atom1) && isVisible(atom2);
            } catch {
                // Do not retain dangling connections after their atoms have been removed.
                return false;
            }
        });

        const filteredHBonds = structure.hBonds.filter(hbond => {
            try {
                const donor = getAsymmetricAtom(hbond.donorAtomId);
                const hydrogen = getAsymmetricAtom(hbond.hydrogenAtomId);
                const acceptor = getAsymmetricAtom(hbond.acceptorAtomId);
                return isVisible(donor) && isVisible(hydrogen) && isVisible(acceptor);
            } catch {
                return false;
            }
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
     * Gets applicable modes based on the disorder groups present in the structure.
     * As a side effect, refreshes this.MODES and the rank-to-group-value mapping
     * to reflect those groups.
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const groups = [...new Set(
            structure.atoms
                .map(atom => Number(atom.disorderGroup))
                .filter(group => group > 0),
        )].sort((groupA, groupB) => groupA - groupB);

        this._groupValuesByRank = groups;

        const modes = { ALL: DisorderFilter.MODES.ALL };
        groups.forEach((_group, index) => {
            modes[`GROUP${index + 1}`] = DisorderFilter.modeForGroup(index + 1, groups.length);
        });
        this.MODES = Object.freeze(modes);

        return Object.values(this.MODES);
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
     * @param {number} [packingCutoff] - Upper fractional bound for cell membership in the cell modes.
     *  1.0 (default) wraps far-face atoms in for a correct Z; a slightly larger value (e.g. 1.001)
     *  keeps atoms sitting on the upper cell border.
     */
    constructor(mode = SymmetryGrower.MODES.NONE, packingCutoff = 1) {
        super(SymmetryGrower.MODES, mode, 'SymmetryGrower', SymmetryGrower.PREFERRED_FALLBACK_ORDER);
        this.packingCutoff = packingCutoff;
    }

    get requiresCameraUpdate() {
        return true;
    }

    get drawCell() {
        return this.mode === SymmetryGrower.MODES.CELL || this.mode === SymmetryGrower.MODES.FRAGMENT_CELL;
    }

    /**
     * Applies symmetry growth according to current mode
     * @param {CrystalStructure} structure - Structure to grow
     * @returns {CrystalStructure} New structure with grown symmetry
     */
    apply(structure) {
        this.ensureValidMode(structure);
        // NONE is the faithful raw-CIF view. Every growth mode operates on one
        // shared chemical graph, excluding publication contacts that may also be
        // present in `_geom_bond`.
        let workStructure = this.mode === SymmetryGrower.MODES.NONE
            ? structure
            : new CrystalStructure(
                structure.cell,
                structure.atoms,
                chemicalBonds(structure),
                structure.hBonds,
                structure.symmetry,
            );
        let specialPositionAtoms = new Map();
        if (this.mode === SymmetryGrower.MODES.FRAGMENT || this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
            const growthResult = growFragment(workStructure);
            workStructure = growthResult.grownStructure;
            specialPositionAtoms = growthResult.specialPositionAtoms;
        }
        if (this.mode === SymmetryGrower.MODES.CELL) {
            workStructure = addPackingBorderAtoms(growCell(workStructure), this.packingCutoff);
        } else if (this.mode === SymmetryGrower.MODES.FRAGMENT_CELL) {
            const growthResult = growFragment(workStructure);
            specialPositionAtoms = growthResult.specialPositionAtoms;
            workStructure = addPackingBorderAtoms(
                growCell(growthResult.grownStructure, false, specialPositionAtoms),
                this.packingCutoff,
            );
            // Fragment-cell contains only complete components centred in the unit
            // cell. Periodic H-bond partner shells belong to fragment-hbonds mode.
            workStructure = reconcileHBondsByGeometry(workStructure);
        }

        if (this.mode === SymmetryGrower.MODES.HBONDS || this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
            if (this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
                workStructure = new CrystalStructure(
                    workStructure.cell,
                    workStructure.atoms,
                    filterBondsByGeometry(workStructure, workStructure.bonds),
                    workStructure.hBonds,
                    workStructure.symmetry,
                );
            }
            workStructure = growExternalHBonds(workStructure, specialPositionAtoms);
            if (this.mode === SymmetryGrower.MODES.FRAGMENT_HBONDS) {
                workStructure = new CrystalStructure(
                    workStructure.cell,
                    workStructure.atoms,
                    filterBondsByGeometry(workStructure, workStructure.bonds),
                    workStructure.hBonds,
                    workStructure.symmetry,
                );
                workStructure = reconcileHBondsByGeometry(workStructure);
            }
        }

        return workStructure;
    }

    /**
     * Gets applicable modes based on structure symmetry and bonds
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<string>} Array of applicable mode names
     */
    getApplicableModes(structure) {
        const modes = [SymmetryGrower.MODES.NONE, SymmetryGrower.MODES.CELL, SymmetryGrower.MODES.FRAGMENT_CELL];
        const hasSymmetry = structure.symmetry && structure.symmetry.symmetryOperations.length > 0;

        if (!hasSymmetry) {
            return modes;
        }

        const hasGrowableBonds = structure.bonds.some(bond => bond.atom2SiteSymmetry !== '.');
        if (hasGrowableBonds) {
            modes.push(SymmetryGrower.MODES.FRAGMENT);
        }

        const hasGrowableHBonds = structure.hBonds.some(hbond => hbond.acceptorAtomSymmetry !== '.');

        if (hasGrowableHBonds) {
            if (hasGrowableBonds) {
                modes.push(SymmetryGrower.MODES.FRAGMENT_HBONDS);
            } else {
                modes.push(SymmetryGrower.MODES.HBONDS);
            }
        }

        return modes;
    }
}
