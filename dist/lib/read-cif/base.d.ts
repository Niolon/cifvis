/**
 * Splits a CIF2 token stream into per-block token slices at each top-level
 * `data` token. Bracket depth is tracked so a `data`-looking token that only
 * occurs inside a list/table cannot start a new block; triple-quoted and
 * text-field content never yields a `data` token in the first place.
 * @param {Array<object>} tokens - The whole-file CIF2 token stream.
 * @returns {Array<Array<object>>} Array of block slices, each beginning with its `data` token.
 */
export function splitCif2Blocks(tokens: Array<object>): Array<Array<object>>;
/**
 * Represents a CIF (Crystallographic Information File) parser.
 * @property {string} rawCifBlocks - Raw CIF blocks after initial multiline merging
 * @property {boolean} splitSU - Whether to split standard uncertainties into value and SU
 * @property {number} version - Detected CIF format version (1 or 2)
 * @property {Array<CifBlock>|null} blocks - Parsed CIF blocks, created lazily when accessed
 */
export class CIF {
    /**
     * Creates a new CIF parser instance.
     * @class
     * @param {string} cifString - Raw CIF file content
     * @param {boolean} [splitSU] - Whether to split standard uncertainties
     */
    constructor(cifString: string, splitSU?: boolean);
    splitSU: boolean;
    version: number;
    rawCifBlocks: string[] | object[][];
    blocks: any[];
    _blockNameMap: Map<any, any> | null;
    /**
     * Splits CIF content into blocks, while accounting for the fact that
     * there might be data entries within a multiline string.
     * @param {string} cifText - Raw CIF content with added newlines
     * @returns {Array<string>} Array of raw block texts
     * @private
     */
    private splitCifBlocks;
    /**
     * Gets a specific CIF data block.
     * @param {number} index - Block index (default: 0)
     * @returns {CifBlock} The requested CIF block
     * @throws {Error} If index is out of range
     */
    getBlock(index?: number): CifBlock;
    /**
     * Gets all parsed CIF blocks.
     * @returns {Array<CifBlock>} Array of all CIF blocks
     */
    getAllBlocks(): Array<CifBlock>;
    _extractBlockNames(): Map<any, any>;
    getBlockNames(): any[];
    getBlockByName(name: any): CifBlock;
}
/**
 * Represents a single data block within a CIF file.
 * @property {string|null} rawText - Raw text content of this block (CIF1 blocks only)
 * @property {Array<object>|null} tokens - CIF2 token slice for this block (CIF2 blocks only)
 * @property {boolean} splitSU - Whether to split standard uncertainties
 * @property {object | null} data - Parsed key-value pairs and loops, null until parse() is called.
 *   Values are numbers, strings or {@link CifLoop} instances for CIF1 blocks; CIF2 blocks may
 *   additionally hold `Array` values (CIF2 lists) and `Map` values (CIF2 tables), possibly nested.
 * @property {number} version - CIF format version of this block (1 or 2)
 * @property {string|null} dataBlockName - Name of the data block (e.g., "data_crystal1")
 */
export class CifBlock {
    /**
     * Creates a new CIF block instance.
     * @class
     * @param {string|Array<object>} blockContent - Raw block text (CIF1) or a CIF2 token slice (CIF2)
     * @param {boolean} [splitSU] - Whether to split standard uncertainties
     * @param {number} [version] - CIF format version (1 or 2); defaults to 1 (CIF1)
     */
    constructor(blockContent: string | Array<object>, splitSU?: boolean, version?: number);
    splitSU: boolean;
    version: number;
    tokens: string | object[] | null;
    rawText: string | object[] | null;
    data: {} | null;
    set dataBlockName(value: any);
    get dataBlockName(): any;
    /**
     * Parses block content into structured data.
     * Handles single values, multiline strings, and loops.
     */
    parse(): void;
    /**
     * Parses a CIF2 block from its token slice into structured data.
     * Populates the same `this.data` model as {@link CifBlock#parse}, additionally
     * supporting CIF2 list (`Array`) and table (`Map`) values. Save frames are
     * skipped (out of scope for structure visualization).
     * @private
     */
    private parseV2;
    /**
     * Parses a single CIF2 `loop_` starting at the loop keyword and stores it,
     * reusing the shared loop-naming and conflict-resolution logic. Cell
     * values are only located (via {@link skipCif2Value}, a structural scan
     * with no value interpretation), not parsed - actual parsing happens
     * lazily in CifLoop.parse() on first .get()/.getIndex(), so a loop this
     * caller never queries never pays {@link parseCif2Value}'s cost. This
     * mirrors the CIF1 path, where CifLoop.fromLines() also defers value
     * parsing until first access.
     * @param {Array<object>} tokens - The block's token slice.
     * @param {number} start - Index of the `loop` token.
     * @returns {number} Index of the first token after the loop.
     * @private
     */
    private parseLoopV2;
    _dataBlockName: any;
    /**
     * Gets a value from the CIF block, trying multiple possible keys.
     * @param {(string|Array<string>)} keys - Key or array of keys to try
     * @param {(string|number|CifLoop)} [defaultValue] - Value to return if keys not found
     * @returns {(string|number|CifLoop)} Found value or default value
     * @throws {Error} If no keys found and no default provided
     */
    get(keys: (string | Array<string>), defaultValue?: (string | number | CifLoop)): (string | number | CifLoop);
}
import { CifLoop } from './loop.js';
//# sourceMappingURL=base.d.ts.map