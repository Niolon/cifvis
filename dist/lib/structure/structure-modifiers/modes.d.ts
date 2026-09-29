/**
 * Filters atoms, bonds, and H-bonds involving hydrogen atoms from a structure.
 * Supports displaying no hydrogens, hydrogens without ADPs, or hydrogens with anisotropic ADPs.
 * @augments BaseFilter
 */
export class HydrogenFilter extends BaseFilter {
    static MODES: Readonly<{
        NONE: "none";
        CONSTANT: "constant";
        ANISOTROPIC: "anisotropic";
    }>;
    static PREFERRED_FALLBACK_ORDER: ("none" | "constant" | "anisotropic")[];
    /**
     * Creates a new hydrogen filter
     * @param {HydrogenFilter.MODES} [mode] - Initial filter mode
     */
    constructor(mode?: Readonly<{
        NONE: "none";
        CONSTANT: "constant";
        ANISOTROPIC: "anisotropic";
    }>);
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
    static MODES: Readonly<{
        ALL: "all";
    }>;
    static PREFERRED_FALLBACK_ORDER: "all"[];
    /**
     * Builds the mode string for a disorder group at a given rank
     * @param {number} rank - 1-based position of the group among all groups present
     * @param {number} total - Total number of disorder groups present
     * @returns {string} Mode string, e.g. "group1of2"
     */
    static modeForGroup(rank: number, total: number): string;
    /**
     * Extracts the rank and total encoded in a mode string
     * @param {string} mode - Mode string
     * @returns {{rank: number, total: number}|null} Parsed mode, or null if not a group mode
     */
    static parseGroupMode(mode: string): {
        rank: number;
        total: number;
    } | null;
    /**
     * Creates a new disorder filter
     * @param {string} [mode] - Initial filter mode
     */
    constructor(mode?: string);
    _groupValuesByRank: any[];
}
export class SymmetryGrower extends BaseFilter {
    static MODES: Readonly<{
        NONE: "none";
        HBONDS: "hbonds";
        FRAGMENT: "fragment";
        FRAGMENT_HBONDS: "fragment-hbonds";
        CELL: "cell";
        FRAGMENT_CELL: "fragment-cell";
    }>;
    static PREFERRED_FALLBACK_ORDER: ("fragment" | "cell")[];
    /**
     * Creates a new symmetry grower
     * @param {SymmetryGrower.MODES} [mode] - Initial mode for growing symmetry
     * @param {number} [packingCutoff] - Upper fractional bound for cell membership in the cell modes.
     *  1.001 (default) closes all three pairs of cell faces; 1.0 wraps far-face atoms in
     *  for a canonical, Z-correct cell.
     */
    constructor(mode?: Readonly<{
        NONE: "none";
        HBONDS: "hbonds";
        FRAGMENT: "fragment";
        FRAGMENT_HBONDS: "fragment-hbonds";
        CELL: "cell";
        FRAGMENT_CELL: "fragment-cell";
    }>, packingCutoff?: number);
    packingCutoff: number;
}
import { BaseFilter } from './base.js';
//# sourceMappingURL=modes.d.ts.map