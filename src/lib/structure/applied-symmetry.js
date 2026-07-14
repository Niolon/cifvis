/** @typedef {import('./cell-symmetry.js').CellSymmetry} CellSymmetry */
import { decodePositionCode, encodePositionCode } from './position-code.js';

export class AppliedSymmetry {
    /**
     * @param {string} id - The symmetry operation ID (e.g. "1")
     * @param {number[]} translation - The translation vector [x, y, z] (integers)
     */
    constructor(id, translation) {
        this.id = id;
        this.translation = [...translation];
        this._updateKey();
    }

    _updateKey() {
        // Cache the string representation for efficient comparison
        this.key = encodePositionCode(this.id, this.translation);
    }

    /**
     * Creates an AppliedSymmetry instance from a symmetry string (e.g. "1_555")
     * @param {string} symmString - The symmetry string to parse
     * @returns {AppliedSymmetry} New AppliedSymmetry instance
     */
    static fromString(symmString) {
        const { id, translation } = decodePositionCode(symmString);
        return new AppliedSymmetry(id, translation);
    }

    /**
     * Converts to internal symmetry string format (e.g. "1_555")
     * @returns {string} Symmetry string
     */
    toString() {
        return this.key;
    }

    /**
     * Creates an independent copy.
     * @returns {AppliedSymmetry} Copied symmetry
     */
    copy() {
        return new AppliedSymmetry(this.id, this.translation);
    }

    /**
     * Generates standard Jones-Faithful notation (e.g. "1-x,1/2+y,z")
     * @param {CellSymmetry} cellSymmetry - The crystal's symmetry object
     * @returns {string} Jones-Faithful symmetry string
     */
    toJonesFaithful(cellSymmetry) {
        // Find the operation index using the ID map
        const opIndex = cellSymmetry.operationIds.get(this.id);
        if (opIndex === undefined) {
            throw new Error(`Invalid symmetry ID: ${this.id}`);
        }

        const symOp = cellSymmetry.symmetryOperations[opIndex];
        return symOp.toSymmetryString(this.translation);
    }

    /**
     * Combines this symmetry with another (this applied first, then other)
     * @param {AppliedSymmetry} other - The outer symmetry operation
     * @param {CellSymmetry} cellSymmetry - The crystal's symmetry object
     * @returns {AppliedSymmetry} Combined symmetry
     */
    combine(other, cellSymmetry) {
        const combinedString = cellSymmetry.combineSymmetryCodes(other.key, this.key);
        return AppliedSymmetry.fromString(combinedString);
    }
}
