/**
 * Base class for structure filters that implement mode-based behavior
 */
export class BaseFilter {
    /**
     * Creates a new filter
     * @param {object} modes - Dictionary of valid modes
     * @param {string} defaultMode - Initial mode to use
     * @param {string} filterName - Name of the filter for error messages
     * @param {Array<string>} fallBackOrder - Ordering of modes that are tried out if the current one is invalid
     */
    constructor(modes: object, defaultMode: string, filterName: string, fallBackOrder?: Array<string>);
    MODES: object;
    PREFERRED_FALLBACK_ORDER: readonly string[];
    filterName: string;
    _mode: string | null;
    /**
     * Sets the current mode with validation
     * @param {string} value - New mode to set
     * @throws {Error} If mode is invalid
     */
    set mode(value: string);
    /**
     * Gets the current mode
     * @returns {string} Current mode
     */
    get mode(): string;
    get requiresCameraUpdate(): boolean;
    get drawCell(): boolean;
    ensureValidMode(structure: any): void;
    /**
     * Abstract method: Applies the filter to a structure
     * @abstract
     * @param {CrystalStructure} _structure - Structure to filter
     * @returns {CrystalStructure} Filtered structure
     * @throws {Error} If not implemented by subclass
     */
    apply(_structure: CrystalStructure): CrystalStructure;
    /**
     * Abstract method: Gets modes applicable to the given structure
     * @abstract
     * @param {CrystalStructure} _structure - Structure to analyze
     * @returns {string[]} Array of applicable mode names
     * @throws {Error} If not implemented by subclass
     */
    getApplicableModes(_structure: CrystalStructure): string[];
    /**
     * Cycles to the next applicable mode for the given structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {string} New mode after cycling
     */
    cycleMode(structure: CrystalStructure): string;
}
import { CrystalStructure } from '../crystal.js';
//# sourceMappingURL=base.d.ts.map