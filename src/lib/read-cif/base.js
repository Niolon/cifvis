import { parseMultiLineString, parseValue } from './helpers.js';
import { CifLoop, resolveLoopNamingConflict } from './loop.js';

/**
* Represents a CIF (Crystallographic Information File) parser.
* 
* @property {string} rawCifBlocks - Raw CIF blocks after initial multiline merging
* @property {boolean} splitSU - Whether to split standard uncertainties into value and SU
* @property {Array<CifBlock>|null} blocks - Parsed CIF blocks, created lazily when accessed
*/
export class CIF {
    /**
     * Creates a new CIF parser instance.
     * @constructor
     * @param {string} cifString - Raw CIF file content
     * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
     */
    constructor(cifString, splitSU = true) {
        this.splitSU = splitSU;
        this.rawCifBlocks = this.splitCifBlocks('\n\n' + cifString);
        this.blocks = Array(this.rawCifBlocks.length).fill(null);
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
                count = innerMatches ? innerMatches.length : 0;
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
     */
    getBlock(index = 0) {
        if (!this.blocks[index]) {
            this.blocks[index] = new CifBlock(this.rawCifBlocks[index], this.splitSU);
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
                this.blocks[i] = new CifBlock(this.rawCifBlocks[i], this.splitSU);
            }
        }
        return this.blocks;
    }
}

/**
 * Represents a single data block within a CIF file.
 * 
 * @property {string} rawText - Raw text content of this block
 * @property {boolean} splitSU - Whether to split standard uncertainties
 * @property {Object|null} data - Parsed key-value pairs and loops, null until parse() is called
 * @property {string|null} dataBlockName - Name of the data block (e.g., "data_crystal1")
 */
export class CifBlock {
    /**
     * Creates a new CIF block instance.
     * @constructor
     * @param {string} blockText - Raw text of the CIF block
     * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
     */
    constructor(blockText, splitSU = true) {
        this.rawText = blockText;
        this.splitSU = splitSU;
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
     * @param {*} [defaultValue=null] - Value to return if keys not found
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

