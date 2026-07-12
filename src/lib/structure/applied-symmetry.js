/** @typedef {import('./cell-symmetry.js').CellSymmetry} CellSymmetry */

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
        const x = this.translation[0] + 5;
        const y = this.translation[1] + 5;
        const z = this.translation[2] + 5;
        this.key = `${this.id}_${x}${y}${z}`;
    }

    /**
     * Creates an AppliedSymmetry instance from a symmetry string (e.g. "1_555")
     * @param {string} symmString - The symmetry string to parse
     * @returns {AppliedSymmetry} New AppliedSymmetry instance
     */
    static fromString(symmString) {
        const [symId, encodedTranslation] = symmString.split('_');
        let transString = encodedTranslation;
        if (!transString) {
            transString = '555';
        }

        const x = parseInt(transString[0]) - 5;
        const y = parseInt(transString[1]) - 5;
        const z = parseInt(transString[2]) - 5;

        return new AppliedSymmetry(symId, [x, y, z]);
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
