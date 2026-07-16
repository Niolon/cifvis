import { parseMultiLineString, parseValue } from './helpers.js';
import { CifLoop, resolveLoopNamingConflict } from './loop.js';
import { detectCifVersion, stripBom } from './version.js';
import { tokenizeCif2 } from './tokenizer.js';
import { parseCif2Value, skipCif2Value } from './cif2-values.js';

/**
 * Splits a CIF2 token stream into per-block token slices at each top-level
 * `data` token. Bracket depth is tracked so a `data`-looking token that only
 * occurs inside a list/table cannot start a new block; triple-quoted and
 * text-field content never yields a `data` token in the first place.
 * @param {Array<object>} tokens - The whole-file CIF2 token stream.
 * @returns {Array<Array<object>>} Array of block slices, each beginning with its `data` token.
 */
export function splitCif2Blocks(tokens) {
    const blocks = [];
    let current = null;
    let depth = 0;

    for (const token of tokens) {
        if (token.type === 'listOpen' || token.type === 'tableOpen') {
            depth++;
        } else if (token.type === 'listClose' || token.type === 'tableClose') {
            depth--;
        }

        if (token.type === 'data' && depth === 0) {
            current = [token];
            blocks.push(current);
        } else if (current) {
            current.push(token);
        }
    }

    return blocks;
}

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
    constructor(cifString, splitSU = true) {
        this.splitSU = splitSU;
        const cleanString = stripBom(cifString);
        this.version = detectCifVersion(cleanString);
        // CIF2 uses a token-based splitter (bracketed/triple-quoted values may contain
        // `data_`-looking text); CIF1 keeps its original, untouched line-based splitter.
        this.rawCifBlocks = this.version === 2
            ? splitCif2Blocks(tokenizeCif2(cleanString))
            : this.splitCifBlocks('\n\n' + cleanString);
        this.blocks = Array(this.rawCifBlocks.length).fill(null);
        this._blockNameMap = null;
    }
 
    /**
     * Splits CIF content into blocks, while accounting for the fact that
     * there might be data entries within a multiline string.
     * @param {string} cifText - Raw CIF content with added newlines
     * @returns {Array<string>} Array of raw block texts
     * @private
     */
    splitCifBlocks(cifText) {
        const blocks = [];
        const blockTexts = cifText
            .replaceAll('\r\n', '\n')
            .split(/\r?\ndata_/).slice(1);
        let i = 0;
        
        while (i < blockTexts.length) {
            let text = blockTexts[i];
            const multilinePattern = /\n;/g;
            const matches = text.match(multilinePattern);
            let count = matches ? matches.length : 0;
            
            while (count % 2 === 1 && i + 1 < blockTexts.length) {
                i++;
                text += '\ndata_' + blockTexts[i];
                const innerMatches = text.match(multilinePattern);
                count = innerMatches.length;
            }
            
            blocks.push(text);
            i++;
        }

        return blocks;
    }
 
    /**
     * Gets a specific CIF data block.
     * @param {number} index - Block index (default: 0)
     * @returns {CifBlock} The requested CIF block
     * @throws {Error} If index is out of range
     */
    getBlock(index = 0) {
        if (index < 0 || index >= this.rawCifBlocks.length) {
            throw new Error(`Block index ${index} out of range. This CIF has ${this.rawCifBlocks.length} block(s).`);
        }
        if (!this.blocks[index]) {
            this.blocks[index] = new CifBlock(this.rawCifBlocks[index], this.splitSU, this.version);
        }
        return this.blocks[index];
    }
 
    /**
     * Gets all parsed CIF blocks.
     * @returns {Array<CifBlock>} Array of all CIF blocks
     */
    getAllBlocks() {
        for (let i = 0; i < this.blocks.length; i++) {
            if (!this.blocks[i]) {
                this.blocks[i] = new CifBlock(this.rawCifBlocks[i], this.splitSU, this.version);
            }
        }
        return this.blocks;
    }

    _extractBlockNames() {
        if (this._blockNameMap !== null) {
            return this._blockNameMap;
        }
        
        this._blockNameMap = new Map();

        if (this.version === 2) {
            // Each CIF2 block slice starts with its `data` token, which carries the block code.
            this.rawCifBlocks.forEach((tokens, index) => {
                if (tokens[0] && tokens[0].type === 'data') {
                    this._blockNameMap.set(tokens[0].value, index);
                }
            });
            return this._blockNameMap;
        }

        // RegEx pattern to match the block name at the start of each block
        // Since the 'data_' prefix is already removed in splitCifBlocks
        const blockNameRegex = /^(\w+[\w.-]*)/;

        this.rawCifBlocks.forEach((blockText, index) => {
            const match = blockNameRegex.exec(blockText.trim());
            if (match && match[1]) {
                // Need to add 'data_' prefix back for the map key since that's how users will query
                this._blockNameMap.set(match[1], index);
            }
        });

        return this._blockNameMap;
    }

    // Get available block names
    getBlockNames() {
        return Array.from(this._extractBlockNames().keys());
    }

    // Get a block by name
    getBlockByName(name) {
        const blockNameMap = this._extractBlockNames();
        
        const index = blockNameMap.get(name);
        
        if (index === undefined) {
            throw new Error(
                `Block with name '${name}' not found. Available blocks: ${this.getBlockNames().join(', ')}`,
            );
        }
        
        return this.getBlock(index);
    }
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
    constructor(blockContent, splitSU = true, version = 1) {
        this.splitSU = splitSU;
        this.version = version;
        if (version === 2) {
            this.tokens = blockContent;
            this.rawText = null;
        } else {
            this.rawText = blockContent;
            this.tokens = null;
        }
        this.data = null;
        this.dataBlockName = null;
    }
    /**
     * Parses block content into structured data.
     * Handles single values, multiline strings, and loops.
     */
    parse() {
        if (this.data !== null) {
            return;
        }

        if (this.version === 2) {
            this.parseV2();
            return;
        }

        this.data = {};
        const lines = this.rawText
            .split('\n')
            .filter(line => !line.trim().startsWith('#'))
            .map(line => {
                const regex = / #(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/;
                return line.split(regex)[0];
            });

        this.dataBlockName = lines[0];
        let i = 1;

        while (i < lines.length) {
            if ((i + 1) < lines.length && lines[i + 1].startsWith(';')) {
                const mult = parseMultiLineString(lines, i + 1);
                this.data[lines[i]] = mult.value;
                i = mult.endIndex + 1;
                continue;
            }
            
            if (lines[i].trim().startsWith('loop_')) {
                const loop = CifLoop.fromLines(lines.slice(i), this.splitSU);
                if (!Object.prototype.hasOwnProperty.call(this.data, loop.getName())) {
                    this.data[loop.getName()] = loop;
                } else {
                    const result = resolveLoopNamingConflict(this.data[loop.getName()], loop, loop.getName());
                    this.data[result.newNames[0]] = result.newEntries[0];
                    this.data[result.newNames[1]] = result.newEntries[1];
                }
                i += loop.getEndIndex();
                continue;
            }

            const line = lines[i].trim();
            if (line.length === 0) {
                i++;
                continue;
            }

            const match = line.match(/^(_\S+)\s+(.*)$/);
            if (match) {
                const key = match[1];
                const parsedValue = parseValue(match[2], this.splitSU);
                this.data[key] = parsedValue.value;
                if (!isNaN(parsedValue.su)) {
                    this.data[key + '_su'] = parsedValue.su;
                }
            } else if (line.startsWith('_') && !lines[i+1].startsWith('_')) {
                const key = line;
                const parsedValue = parseValue(lines[i + 1].trim(), this.splitSU);
                this.data[key] = parsedValue.value;
                if (!isNaN(parsedValue.su)) {
                    this.data[key + '_su'] = parsedValue.su;
                }
                i++;
            } else {
                throw new Error('Could not parse line ' + String(i) + ': ' + lines[i]);
            }

            i++;
        }
    }

    /**
     * Parses a CIF2 block from its token slice into structured data.
     * Populates the same `this.data` model as {@link CifBlock#parse}, additionally
     * supporting CIF2 list (`Array`) and table (`Map`) values. Save frames are
     * skipped (out of scope for structure visualization).
     * @private
     */
    parseV2() {
        this.data = {};
        const tokens = this.tokens;
        this.dataBlockName = tokens[0] && tokens[0].type === 'data' ? tokens[0].value : null;

        let i = 1;
        let saveDepth = 0;
        while (i < tokens.length) {
            const token = tokens[i];

            // Skip over save frames entirely (including any nesting).
            if (token.type === 'save') {
                saveDepth++;
                i++;
                continue;
            }
            if (token.type === 'saveEnd') {
                if (saveDepth > 0) {
                    saveDepth--;
                }
                i++;
                continue;
            }
            if (saveDepth > 0 || token.type === 'global' || token.type === 'stop') {
                i++;
                continue;
            }

            if (token.type === 'tag') {
                const parsed = parseCif2Value(tokens, i + 1, this.splitSU);
                this.data[token.value] = parsed.value;
                if (!isNaN(parsed.su)) {
                    this.data[token.value + '_su'] = parsed.su;
                }
                i = parsed.nextPos;
                continue;
            }

            if (token.type === 'loop') {
                i = this.parseLoopV2(tokens, i);
                continue;
            }

            // Nothing else is valid at block level; skip to stay robust.
            i++;
        }
    }

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
    parseLoopV2(tokens, start) {
        let i = start + 1;
        const headers = [];
        while (i < tokens.length && tokens[i].type === 'tag') {
            headers.push(tokens[i].value);
            i++;
        }

        const cellTokenRanges = [];
        while (i < tokens.length
            && (tokens[i].type === 'value' || tokens[i].type === 'listOpen' || tokens[i].type === 'tableOpen')) {
            const cellStart = i;
            i = skipCif2Value(tokens, i);
            cellTokenRanges.push([cellStart, i]);
        }

        const loop = CifLoop.fromTokens(headers, tokens, cellTokenRanges, this.splitSU);
        if (!Object.prototype.hasOwnProperty.call(this.data, loop.getName())) {
            this.data[loop.getName()] = loop;
        } else {
            const result = resolveLoopNamingConflict(this.data[loop.getName()], loop, loop.getName());
            this.data[result.newNames[0]] = result.newEntries[0];
            this.data[result.newNames[1]] = result.newEntries[1];
        }
        return i;
    }

    get dataBlockName() {
        if (!this._dataBlockName) {
            this.parse();
        }
        return this._dataBlockName;
    }

    set dataBlockName(value) {
        this._dataBlockName = value;
    }

    /**
     * Gets a value from the CIF block, trying multiple possible keys.
     * @param {(string|Array<string>)} keys - Key or array of keys to try
     * @param {*} [defaultValue] - Value to return if keys not found
     * @returns {*} Found value or default value
     * @throws {Error} If no keys found and no default provided
     */
    get(keys, defaultValue=null) {
        this.parse();
        const keyArray = Array.isArray(keys) ? keys : [keys];
        
        for (const key of keyArray) {
            const value = this.data[key];
            if (value !== undefined) {
                return value;
            }
        }
        
        if (defaultValue !== null) {
            return defaultValue;
        }
        
        throw new Error(`None of the keys [${keyArray.join(', ')}] found in CIF block`);
    }
}

