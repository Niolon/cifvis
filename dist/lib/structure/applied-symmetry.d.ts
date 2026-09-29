export class AppliedSymmetry {
    /**
     * Creates an AppliedSymmetry instance from a symmetry string (e.g. "1_555")
     * @param {string} symmString - The symmetry string to parse
     * @returns {AppliedSymmetry} New AppliedSymmetry instance
     */
    static fromString(symmString: string): AppliedSymmetry;
    /**
     * @param {string} id - The symmetry operation ID (e.g. "1")
     * @param {number[]} translation - The translation vector [x, y, z] (integers)
     */
    constructor(id: string, translation: number[]);
    id: string;
    translation: number[];
    _updateKey(): void;
    key: string | undefined;
    /**
     * Converts to internal symmetry string format (e.g. "1_555")
     * @returns {string} Symmetry string
     */
    toString(): string;
    /**
     * Creates an independent copy.
     * @returns {AppliedSymmetry} Copied symmetry
     */
    copy(): AppliedSymmetry;
    /**
     * Generates standard Jones-Faithful notation (e.g. "1-x,1/2+y,z")
     * @param {object} cellSymmetry - The crystal's symmetry object
     * @returns {string} Jones-Faithful symmetry string
     */
    toJonesFaithful(cellSymmetry: object): string;
    /**
     * Combines this symmetry with another (this applied first, then other)
     * @param {AppliedSymmetry} other - The outer symmetry operation
     * @param {object} cellSymmetry - The crystal's symmetry object
     * @returns {AppliedSymmetry} Combined symmetry
     */
    combine(other: AppliedSymmetry, cellSymmetry: object): AppliedSymmetry;
}
//# sourceMappingURL=applied-symmetry.d.ts.map