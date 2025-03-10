
import { CrystalStructure } from '../crystal.js';

/**
 * Base class for structure filters that implement mode-based behavior
 */
export class BaseFilter {
    /**
     * Creates a new filter
     * @param {[key: string]} modes - Dictionary of valid modes
     * @param {string} defaultMode - Initial mode to use
     * @param {string} filterName - Name of the filter for error messages
     * @param {Array<string>} fallBackOrder - Ordering of modes that are tried out if the current one is invalid
     */
    constructor(modes, defaultMode, filterName, fallBackOrder = []) {
        if (new.target === BaseFilter) {
            throw new TypeError('Cannot instantiate BaseFilter directly');
        }

        this.MODES = Object.freeze(modes);
        this.PREFERRED_FALLBACK_ORDER = Object.freeze(fallBackOrder);
        this.filterName = filterName;
        this._mode = null;
        this.mode = defaultMode;
    }

    get requiresCameraUpdate() {
        return false;
    }

    /**
     * Gets the current mode
     * @returns {string} Current mode
     */
    get mode() {
        return this._mode;
    }

    /**
     * Sets the current mode with validation
     * @param {string} value - New mode to set
     * @throws {Error} If mode is invalid
     */
    set mode(value) {
        const usedMode = value.toLowerCase().replace(/_/g, '-');
        const validModes = Object.values(this.MODES);
        if (!validModes.includes(usedMode)) {
            throw new Error(
                `Invalid ${this.filterName} mode: "${value}". ` +
                `Valid modes are: ${validModes.join(', ')}`,
            );
        }
        this._mode = usedMode;
    }

    ensureValidMode(structure) {
        const validModes = this.getApplicableModes(structure);
        if (!validModes.includes(this.mode)) {
            this.mode = this.PREFERRED_FALLBACK_ORDER.find(mode => validModes.includes(mode)) || validModes[0];
        }
    }

    /**
     * Abstract method: Applies the filter to a structure
     * @abstract
     * @param {CrystalStructure} _structure - Structure to filter
     * @returns {CrystalStructure} Filtered structure
     * @throws {Error} If not implemented by subclass
     */
    apply(_structure) {
        throw new Error('Method "apply" must be implemented by subclass');
    }

    /**
     * Abstract method: Gets modes applicable to the given structure
     * @abstract
     * @param {CrystalStructure} _structure - Structure to analyze
     * @returns {string[]} Array of applicable mode names
     * @throws {Error} If not implemented by subclass
     */
    getApplicableModes(_structure) {
        throw new Error('Method "getApplicableModes" must be implemented by subclass');
    }

    /**
     * Cycles to the next applicable mode for the given structure
     * @param {CrystalStructure} structure - Structure to analyze
     * @returns {string} New mode after cycling
     */
    cycleMode(structure) {
        const modes = this.getApplicableModes(structure);

        this.ensureValidMode(structure);

        const currentIndex = modes.indexOf(this._mode);
        this._mode = modes[(currentIndex + 1) % modes.length];
        return this._mode;
    }
}
