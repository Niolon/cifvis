/**
 * Checks if an entry is a CIF loop
 * @param {object} entry - Entry to check
 * @returns {boolean} True if entry is a loop
 */
export function isLoop(entry: object): boolean;
/**
 * Resolves naming conflicts when one entry is a loop and the other is not.
 * Creates a new name for the loop by appending the next token from its header.
 * @param {object} entry1 - First entry (loop or non-loop)
 * @param {object} entry2 - Second entry (loop or non-loop)
 * @param {string} originalName - Original conflicting name
 * @returns {Array<string>} New names for both entries in original order
 */
export function resolveNonLoopConflict(entry1: object, entry2: object, originalName: string): Array<string>;
/**
 * Attempts to resolve loop naming conflict by comparing common prefixes.
 * @param {CifLoop} loop1 - First loop
 * @param {CifLoop} loop2 - Second loop
 * @returns {Array<string>|null} Array of new names or null if resolution fails
 */
export function resolveByCommonStart(loop1: CifLoop, loop2: CifLoop): Array<string> | null;
/**
 * Resolves loop naming conflict based on header token length,
 * appending the next token from the longer header to create a unique name.
 * @param {CifLoop} loop1 - First loop
 * @param {CifLoop} loop2 - Second loop
 * @param {string} originalName - Original conflicting name
 * @returns {Array<string>} New names for both loops
 */
export function resolveByTokenLength(loop1: CifLoop, loop2: CifLoop, originalName: string): Array<string>;
/**
 * Resolves naming conflicts between two entries with the same name.
 * Updates loop names in place and returns the new names and entries.
 * @param {object} entry1 - First entry (loop or non-loop)
 * @param {object} entry2 - Second entry (loop or non-loop)
 * @param {string} originalName - Original conflicting name
 * @returns {object} Object containing new names and entries
 * @property {Array<string>} newNames - New unique names
 * @property {Array<object>} newEntries - Updated entries
 */
export function resolveLoopNamingConflict(entry1: object, entry2: object, originalName: string): object;
/**
 * Represents a loop construct within a CIF block, handling structured tabular data.
 * @class
 * @property {Array<string>} headerLines - Column header lines defining the data structure
 * @property {Array<string>} dataLines - Raw lines containing the loop's data values
 * @property {number} endIndex - Index of the line where this loop ends in the original CIF
 * @property {boolean} splitSU - Whether to split standard uncertainties into value and uncertainty
 * @property {Array<string>|null} headers - Processed column headers, null until parsed
 * @property {object|null} data - Parsed loop data as key-value pairs, null until parsed
 * @property {string|null} name - Common prefix shared by headers, identifying the loop type
 */
export class CifLoop {
    /**
     * Creates a CifLoop instance from raw CIF lines starting with 'loop_'.
     * @static
     * @param {Array<string>} lines - Raw CIF lines starting with 'loop_'
     * @param {boolean} splitSU - Whether to split standard uncertainties
     * @returns {CifLoop} New CifLoop instance with extracted headers and data
     */
    static fromLines(lines: Array<string>, splitSU: boolean): CifLoop;
    /**
     * Creates a CifLoop from a CIF2 token stream. Cell values are located but
     * not interpreted yet - `cellTokenRanges` only records each cell's
     * `[start, end)` token range (see `skipCif2Value` in cif2-values.js),
     * bypassing the line-based CIF1 tokenizing while still deferring the
     * actual value parsing to `parse()`, on first `.get()`/`.getIndex()`,
     * exactly like the CIF1 path does.
     * @static
     * @param {Array<string>} headers - Column header names (data names).
     * @param {Array<object>} tokens - The full CIF2 token stream `cellTokenRanges` indexes into.
     * @param {Array<Array<number>>} cellTokenRanges - Row-major `[start, end)` ranges.
     * @param {boolean} splitSU - Whether to split standard uncertainties.
     * @returns {CifLoop} New CifLoop instance backed by the unparsed cell token ranges.
     */
    static fromTokens(headers: Array<string>, tokens: Array<object>, cellTokenRanges: Array<Array<number>>, splitSU: boolean): CifLoop;
    /**
     * Creates a new CIF loop instance.
     * @class
     * @param {Array<string>} headerLines - Column header lines from the CIF
     * @param {Array<string>} dataLines - Data value lines from the CIF
     * @param {number} endIndex - Index where the loop ends in the original CIF
     * @param {boolean} splitSU - Whether to split standard uncertainties into value and uncertainty
     * @param {string} [name] - Loop name, will be auto-detected if omitted
     */
    constructor(headerLines: Array<string>, dataLines: Array<string>, endIndex: number, splitSU: boolean, name?: string);
    splitSU: boolean;
    headerLines: string[];
    dataLines: string[];
    endIndex: number;
    headers: string[] | null;
    data: {} | null;
    name: string;
    /**
     * Parses loop content into structured data.
     * Processes headers and values, handling standard uncertainties if enabled.
     * Extracts multi-line strings and populates the data property with column values.
     * @returns {void}
     * @throws {Error} If the data values cannot be evenly distributed into columns
     * @throws {Error} If the loop contains no data values
     */
    parse(): void;
    /**
     * Gets the common name prefix shared by all headers to identify the loop type.
     * First checks against standard loop names, then tries dot-based splitting,
     * and finally analyzes underscore segments to find common parts.
     * @param {boolean} [checkStandardNames] - Whether to check against known standard loop names
     * @returns {string} Common prefix without the trailing underscore
     */
    findCommonStart(checkStandardNames?: boolean): string;
    /**
     * Gets column data for given keys, trying each key in turn.
     * @param {string|Array<string>} keys - Key or array of keys to try
     * @param {Array<string|number>} [defaultValue] - Value to return if none of the keys are found
     * @returns {Array<string|number>} Column data for the first matching key
     * @throws {Error} If no keys found and no default value provided
     */
    get(keys: string | Array<string>, defaultValue?: Array<string | number>): Array<string | number>;
    /**
     * Gets value at specific row index for one of the given keys.
     * @param {string|Array<string>} keys - Key or array of keys to try
     * @param {number} index - Row index (0-based)
     * @param {string|number} [defaultValue] - Value to return if keys not found
     * @returns {string|number} Value at the specified index
     * @throws {Error} If index is out of bounds
     * @throws {Error} If none of the keys are found and no default value provided
     */
    getIndex(keys: string | Array<string>, index: number, defaultValue?: string | number): string | number;
    /**
     * Gets all column headers, parsing the loop first if needed.
     * @returns {Array<string>} Array of all header names
     */
    getHeaders(): Array<string>;
    /**
     * Gets the common name prefix shared by all headers.
     * @returns {string} Common prefix identifying the loop type
     */
    getName(): string;
    /**
     * Gets the line index where this loop ends in the original CIF.
     * @returns {number} Index of the last line of the loop
     */
    getEndIndex(): number;
}
//# sourceMappingURL=loop.d.ts.map