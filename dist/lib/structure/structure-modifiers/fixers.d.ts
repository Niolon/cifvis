/**
 * Filter that removes specified atoms and their connected bonds from a structure,
 * supporting both individual labels and ranges with the ">" syntax
 * @augments BaseFilter
 */
export class AtomLabelFilter extends BaseFilter {
    static MODES: Readonly<{
        ON: "on";
        OFF: "off";
    }>;
    /**
     * Creates a new atom label filter
     * @param {string[]|string} [filteredLabels] - Array of atom labels or comma-separated string to filter
     * @param {AtomLabelFilter.MODES} [mode] - Initial filter mode
     */
    constructor(filteredLabels?: string[] | string, mode?: Readonly<{
        ON: "on";
        OFF: "off";
    }>);
    /**
     * Parses a range expression (e.g., "A1>A10") and returns all labels in the range
     * @param {string} rangeExpr - Range expression in the format "start>end"
     * @param {string[]} allLabels - All available atom labels to filter the range against
     * @returns {string[]} Array of labels in the range
     * @private
     */
    private _parseRangeExpression;
    /**
     * Updates the list of filtered atom labels
     * @param {string[]|string} labels - New array of atom labels or comma-separated string to filter
     */
    setFilteredLabels(labels: string[] | string): void;
    filteredLabels: Set<any> | undefined;
    /**
     * Expands any range expressions in the filtered labels using available atom labels
     * @param {CrystalStructure} structure - Structure to filter
     * @returns {Set<string>} - set of expanded labels for the range
     * @private
     */
    private _expandRanges;
    /**
     * Gets applicable modes - both modes are always available
     * @returns {Array<string>} Array containing both ON and OFF modes
     */
    getApplicableModes(): Array<string>;
}
/**
 * Generates bonds between atoms based on their atomic radii and positions
 * @augments BaseFilter
 */
export class BondGenerator extends BaseFilter {
    static MODES: Readonly<{
        KEEP: "keep";
        ADD: "add";
        REPLACE: "replace";
        CREATE: "create";
        IGNORE: "ignore";
    }>;
    static PREFERRED_FALLBACK_ORDER: ("add" | "keep" | "replace" | "create" | "ignore")[];
    /**
     * Creates a new bond generator to generate bonds between atoms based on their atomic radii
     * @class
     * @param {object} elementProperties - Element properties containing atomic radii from structure-settings.js
     * @param {number} tolerance - Additive tolerance in Angstroms added to the sum of atomic radii
     * @param {BondGenerator.MODES} [mode] - Initial operation mode
     */
    constructor(elementProperties: object, tolerance: number, mode?: Readonly<{
        KEEP: "keep";
        ADD: "add";
        REPLACE: "replace";
        CREATE: "create";
        IGNORE: "ignore";
    }>);
    elementProperties: object;
    tolerance: number;
    /**
     * Gets the additive tolerance for a pair of elements. Group 1/2 (s-block)
     * elements form predominantly ionic bonds whose lengths deviate further
     * from a simple covalent-radius sum, so CCDC/Mercury-style practice
     * applies a tighter tolerance to them.
     * @param {string} element1 - First element symbol
     * @param {string} element2 - Second element symbol
     * @returns {number} Additive tolerance in Angstroms
     */
    getTolerance(element1: string, element2: string): number;
    /**
     * Gets the maximum allowed bond distance between two atoms
     * @param {string} element1 - First element symbol
     * @param {string} element2 - Second element symbol
     * @param {object} elementProperties - Element property definitions
     * @returns {number} Maximum allowed bond distance
     */
    getMaxBondDistance(element1: string, element2: string, elementProperties: object): number;
    /**
     * Generates bonds between atoms based on their distances. Candidate pairs
     * are limited via a spatial grid (cell size = the largest possible bond
     * distance among elements present) so only atoms in the same or
     * neighboring cells are ever compared, instead of every pair in the
     * structure.
     * @private
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {object} elementProperties - Element property definitions
     * @returns {Set<Bond>} Set of generated bonds
     */
    private generateBonds;
    /**
     * Adds bonds to symmetry-equivalent positions to an existing set of generated
     * bonds. The Cartesian pass in {@link BondGenerator#generateBonds} only bonds
     * atoms materialised in the same cell, so for structures whose bonds cross a
     * symmetry element - ionic/extended solids, or moieties on special positions -
     * the asymmetric unit contains no in-range pair and those bonds are found only
     * by testing symmetry images of the atoms.
     *
     * Each such bond is emitted once, anchored on the lower-indexed atom (atom1 in
     * the home cell, 1_555), carrying a position code that points at the symmetry
     * equivalent of atom2. The partner atom is not materialised here: the renderer
     * skips a bond until both endpoints exist, and the symmetry growers materialise
     * the partner and resolve the code when the user grows the structure.
     * Performance: like the intra-cell pass, this uses a uniform spatial grid so
     * only same/neighbouring-cell candidates are compared, rather than every
     * atom/operation/translation triple. Every symmetry image of every atom is
     * wrapped into the home cell (plus boundary copies so periodic neighbours land
     * in adjacent grid cells) and bucketed once; each home atom then queries only
     * its 27 neighbouring cells. Cost is roughly linear in atoms x operations
     * instead of quadratic in atoms.
     * @private
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {object} elementProperties - Element property definitions
     * @param {Map<string, string>} elementMap - Resolved element symbol per atomType
     * @param {number} maxPossibleDistance - Largest possible bond distance among elements present
     * @param {Set<Bond>} generatedBonds - Set to add generated bonds to
     */
    private generateSymmetryBonds;
}
/**
 * Structure modifier that fixes isolated hydrogen atoms by creating
 * bonds to nearby potential bonding partners.
 * @augments BaseFilter
 */
export class IsolatedHydrogenFixer extends BaseFilter {
    static MODES: Readonly<{
        ON: "on";
        OFF: "off";
    }>;
    static PREFERRED_FALLBACK_ORDER: ("on" | "off")[];
    /**
     * Creates a new isolated hydrogen fixer
     * @param {IsolatedHydrogenFixer.MODES} [mode] - Initial filter mode
     * @param {number} [maxBondDistance] - Maximum distance in Angstroms to consider for hydrogen bonds
     */
    constructor(mode?: Readonly<{
        ON: "on";
        OFF: "off";
    }>, maxBondDistance?: number);
    maxBondDistance: number;
    /**
     * Finds hydrogen atoms that are in connected groups of size one
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {Array<object>} Array of isolated hydrogen atoms with their indices
     */
    findIsolatedHydrogenAtoms(structure: CrystalStructure): Array<object>;
    /**
     * Creates bonds for isolated hydrogen atoms to nearby potential bonding partners
     * @param {CrystalStructure} structure - Structure to analyze
     * @param {Array<object>} isolatedHydrogenAtoms - Array of isolated hydrogen atoms with their indices
     * @returns {Array<Bond>} Array of new bonds
     */
    createBondsForIsolatedHydrogens(structure: CrystalStructure, isolatedHydrogenAtoms: Array<object>): Array<Bond>;
}
/**
 * Structure modifier that reconciles bonds whose stated length contradicts the
 * structure's own coordinates and site-symmetry codes.
 *
 * A `_geom_bond` entry carries the two atom labels, a site-symmetry code and a distance,
 * and a file can state all three inconsistently. The distance is the one independently
 * meaningful piece - it is what was measured - so the code is re-derived from it
 * wherever some symmetry image reproduces it. Leaving such a bond alone draws it between
 * the wrong pair of atoms, typically whole unit cells apart.
 * @augments BaseFilter
 */
export class BondGeometryFixer extends BaseFilter {
    static MODES: Readonly<{
        ON: "on";
        OFF: "off";
    }>;
    static PREFERRED_FALLBACK_ORDER: ("on" | "off")[];
    /**
     * Creates a new bond geometry fixer.
     * @param {BondGeometryFixer.MODES} [mode] - Initial mode.
     * @param {object} [options] - Overrides passed to the repair.
     * @param {number} [options.tolerance] - Maximum accepted length deviation in Å.
     * @param {number} [options.maxPlausibleBond] - Longest distance accepted from coordinates alone.
     */
    constructor(mode?: Readonly<{
        ON: "on";
        OFF: "off";
    }>, options?: {
        tolerance?: number | undefined;
        maxPlausibleBond?: number | undefined;
    });
    options: {
        tolerance?: number | undefined;
        maxPlausibleBond?: number | undefined;
    };
    lastRepairs: import("./bond-geometry.js").BondGeometryRepairs | null;
}
import { BaseFilter } from './base.js';
import { CrystalStructure } from '../crystal.js';
import { Bond } from '../bonds.js';
//# sourceMappingURL=fixers.d.ts.map