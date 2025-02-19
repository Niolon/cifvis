const STANDART_LOOP_NAMES = [
    '_space_group_symop_ssg',
    '_space_group_symop',
    '_symmetry_equiv',
    '_geom_bond',
    '_geom_hbond',
    '_geom_angle',
    '_geom_torsion',
    '_diffrn_refln',
    '_refln',
    '_atom_site_fourier_wave_vector',
    '_atom_site_moment_fourier_param',
    '_atom_site_moment_special_func',
    '_atom_site_moment',
    '_atom_site_rotation',
    '_atom_site_displace_Fourier',
    '_atom_site_displace_special_func',
    '_atom_site_occ_Fourier',
    '_atom_site_occ_special_func',
    '_atom_site_phason',
    '_atom_site_rot_Fourier_param',
    '_atom_site_rot_Fourier',
    '_atom_site_rot_special_func',
    '_atom_site_U_Fourier',
    '_atom_site_anharm_gc_c',
    '_atom_site_anharm_gc_d',
    '_atom_site_aniso',
    '_atom_site',
];

/**
 * Parses a CIF value string into its numeric value and standard uncertainty (SU).
 * 
 * @param {string} entryString - The CIF value string to parse.
 * @param {boolean} splitSU - Whether to split standard uncertainty values into value and SU.
 * @returns {Object} Object containing:
 *   - value {number|string}: The parsed value (number for numeric values, string for text)
 *   - su {number|NaN}: The standard uncertainty if present and splitSU=true, NaN otherwise
 * 
 * @example
 * parseValue("123.456(7)", true) // Returns {value: 123.456, su: 0.007}
 * parseValue("-123(7)", true)    // Returns {value: -123, su: 7}
 * parseValue("'text'", true)     // Returns {value: "text", su: NaN}
 */
export function parseValue(entryString, splitSU = true) {
    const suPattern = /([+-]?)(\d+\.?\d*|\.\d+)\((\d+)\)/;
    const match = entryString.match(suPattern);
    let value, su;
 
    if (splitSU && match) {
        const [, signString, numberString, suString] = match;
        const signMult = signString === '-' ? -1 : 1;
        if (numberString.includes('.')) {
            const decimals = numberString.split('.')[1].length;
            value = Number((signMult * parseFloat(numberString)).toFixed(decimals));
            su = Number((Math.pow(10, -decimals) * parseFloat(suString)).toFixed(decimals));
        } else {
            value = signMult * parseInt(numberString);
            su = parseInt(suString);
        }
    } else {
        if (isNaN(entryString)) {
            if (/^".*"$/.test(entryString) || /^'.*'$/.test(entryString)) {
                value = entryString.slice(1, -1).replace(/\\([^\\])/g, '$1');
            } else {
                value = entryString.replace(/\\([^\\])/g, '$1');
            }
        } else {
            value = entryString.includes('.') ? parseFloat(entryString) : parseInt(entryString);
        }
        su = NaN;
    }
    return { value, su };
}

/**
 * Parses a multiline string starting with semicolon.
 * @param {Array<string>} lines - Array of lines 
 * @param {number} startIndex - Starting index of multiline value
 * @returns {Object} Object with parsed value and end index
 */
export function parseMultiLineString(lines, startIndex) {
    const line1 = [lines[startIndex].slice(1)];

    const slice1 = lines.slice(startIndex + 1);
    const sliceEnd = slice1.findIndex(line => line.startsWith(';'));
    const result = line1.concat(slice1.slice(0, sliceEnd));
    
    const nonEmptySliceStart = result.findIndex(line => line.trim() !== '');
    const nonEmptySliceEnd = result.findLastIndex(line => line.trim !== '');

    return {
        value: result.slice(nonEmptySliceStart, nonEmptySliceEnd + 1).join('\n'),
        endIndex: startIndex + sliceEnd + 1,
    };
}

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
 * Resolves naming conflicts between two CIF loops by assigning the longer common prefix
 * to the loop that naturally has it.
 * 
 * @param {CifLoop} loop1 - First loop, typically the existing one in the block
 * @param {CifLoop} loop2 - Second loop, typically the new one being added
 * @returns {[CifLoop, CifLoop]} Array containing both loops with resolved names
 * @throws {Error} If both loops have the same shortest common prefix length
 * 
 */
export function resolveConflictingLoops(loop1, loop2) {
    const originalName = loop1.name;

    const shortest1 = loop1.findCommonStart(false);
    const shortest2 = loop2.findCommonStart(false);

    if (shortest1.length === shortest2.length) {
        throw new Error(`Non-resolvable conflict, where ${originalName} seems to be the root name of multiple loops`);
    }

    if (shortest1.length > shortest2.length) {
        loop1.name = shortest1;
    } else {
        loop2.name = shortest2;
    }
    return [loop1, loop2];
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
                const loop = new CifLoop(lines.slice(i), this.splitSU);
                if (!Object.prototype.hasOwnProperty.call(this.data, loop.getName())) {
                    this.data[loop.getName()] = loop;
                } else {
                    const [loop1, loop2] = resolveConflictingLoops(this.data[loop.getName()], loop);
                    this.data[loop1.getName()] = loop1;
                    this.data[loop2.getName()] = loop2;
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

/**
* Represents a loop construct within a CIF block.
* 
* @property {Array<string>} rawLines - Raw lines of the loop
* @property {boolean} splitSU - Whether to split standard uncertainties 
* @property {Array<string>|null} headers - Column headers, null until parsed
* @property {Object|null} data - Parsed loop data, null until parsed
* @property {number|null} endIndex - Index of loop end, null until parsed
* @property {string|null} name - Common prefix of headers, null until parsed
*/
export class CifLoop {
    /**
    * Creates a new CIF loop instance.
    * @constructor
    * @param {Array<string>} lines - Raw lines of the loop construct
    * @param {boolean} [splitSU=true] - Whether to split standard uncertainties
    */
    constructor(lines, splitSU) {
        this.splitSU = splitSU;
        let i = 1;
        
        // Get header section
        while (i < lines.length && lines[i].trim().startsWith('_')) {
            i++;
        }
        this.headerLines = lines.slice(1, i).map(line => line.trim());
        
        let dataEnd = i;
        let inMultiline = false;
        // Get data section
        while (dataEnd < lines.length && ((!lines[dataEnd].trim().startsWith('_') && 
               !lines[dataEnd].trim().startsWith('loop_')) || inMultiline)) {
            if (lines[dataEnd].startsWith(';')) {
                inMultiline = !inMultiline;
            }
            dataEnd++;
        }
        
        this.dataLines = lines.slice(i, dataEnd);
        this.endIndex = dataEnd;
        this.headers = null;
        this.data = null;
        this.name = null;
        
        // Parse headers early for findCommonStart
        this.name = this.findCommonStart();
    }

    /**
    * Parses loop content into structured data.
    * Processes headers and values, handling standard uncertainties if enabled.
    */
    parse() {
        if (this.data !== null) {
            return; 
        }
    
        this.headers = [...this.headerLines];
        this.data = {};
    
        const dataArray = [];
        let i = 0;
        while (i < this.dataLines.length) {
            const line = this.dataLines[i].trim();

            if (line.length === 0) {
                i++;
                continue;
            }
        
            if (line.startsWith(';')) {
                const mult = parseMultiLineString(this.dataLines, i);
                dataArray.push(parseValue(mult.value, this.splitSU));
                i = mult.endIndex + 1;
                continue;
            }
    
            const tokenRegex = /'([^']*(?:(?<! )'[^']*)*)'|"([^"]*(?:(?<! )"[^"]*)*)"|\S+/g;
            let match;
    
            while ((match = tokenRegex.exec(line)) !== null) {
                // If it was a quoted string, use the captured group (1 or 2), otherwise use full match
                const value = match[1] || match[2] || match[0];
                dataArray.push(parseValue(value, this.splitSU));
            }
    
            i++;
        }
    
        const nEntries = this.headers.length;
    
        if (dataArray.length % nEntries !== 0) {
            throw new Error(
                `Loop ${this.name}: Cannot distribute ${dataArray.length} values evenly into ${nEntries} columns`,
            );
        } else if (dataArray.length === 0) {
            throw new Error(`Loop ${this.name} has no data values.`);
        }
        for (let j = 0; j < nEntries; j++) {
            const header = this.headers[j];
            const headerValues = dataArray.slice(j).filter((_, index) => index % nEntries === 0);
            const hasSU = headerValues.some(value => !isNaN(value.su));
            
            if (hasSU) {
                this.data[header] = headerValues.map(value => value.value);
                this.data[header + '_su'] = headerValues.map(value => value.su);
                this.headers.push(header + '_su');
            } else {
                this.data[header] = headerValues.map(value => value.value);
            }
        }
    }

    /**
    * Gets the common name prefix shared by all headers.
    * @returns {string} Common prefix without the trailing underscore
    * @private
    */
    findCommonStart(checkStandardNames=true) {   
        // Check for standard loop names first
        if (checkStandardNames) {
            for (const baseName of STANDART_LOOP_NAMES) {
                const hits = this.headerLines.filter(header => header.toLowerCase().startsWith(baseName.toLowerCase()));
                if (hits.length >= (this.headerLines.length / 2)) {
                    return baseName;
                }
            }
        }

        // Try dot-based splitting first
        const dotSegments = this.headerLines.map(line => line.split('.'));
        if (dotSegments[0].length > 1) {
            const prefix = dotSegments[0][0];
            const matchCount = this.headerLines.filter(line => 
                line.split('.')[0] === prefix,
            ).length;
            
            if (matchCount >= this.headerLines.length / 2) {
                return prefix;
            }
        }

        const underscoreSegments = this.headerLines.map(line => line.split(/[_.]/).filter(s => s));
        const minSegments = Math.min(...underscoreSegments.map(segments => segments.length));

        let commonPrefix = '';
        for (let i = 0; i < minSegments; i++) {
            const segment = underscoreSegments[0][i];
            const matchCount = underscoreSegments.filter(segments => 
                segments[i] === segment
            ).length;
            
            if (this.headerLines.length === 2) {
                // For two headers, we require exact match
                if (matchCount === 2) {
                    commonPrefix += '_' + segment;
                } else {
                    break;
                }
            } else if (matchCount >= this.headerLines.length / 2) {
                commonPrefix += '_' + segment;
            } else {
                break;
            }
        }

        return commonPrefix;
    }

    /**
    * Gets column data for given keys.
    * @param {(string|string[])} keys - Key or array of keys to try
    * @param {*} [defaultValue=null] - Value to return if keys not found
    * @returns {Array} Column data
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
        
        throw new Error(`None of the keys [${keyArray.join(', ')}] found in CIF loop ${this.name}`);
    }

    /**
     * Gets value at specific index for one of given keys.
     * @param {(string|string[])} keys - Key or array of keys to try
     * @param {number} index - Row index
     * @param {*} [defaultValue=null] - Value to return if keys not found
     * @returns {*} Value at index
     * @throws {Error} If index out of bounds or keys not found
     */
    getIndex(keys, index, defaultValue=null) {
        this.parse();
        const keyArray = Array.isArray(keys) ? keys : [keys];

        if (!keyArray.some(key => this.headers.includes(key))) {
            if (defaultValue !== null) {
                return defaultValue; 
            }
            throw new Error(`None of the keys [${keyArray.join(', ')}] found in CIF loop ${this.name}`);
        }

        const column = this.get(keyArray);
        if (index < column.length) {
            return column[index];
        }
        throw new Error(
            `Tried to look up value of index ${index} in ${this.name}, but length is only ${column.length}`,
        );
    }

    /**
    * Gets all column headers.
    * @returns {Array<string>} Array of header names
    */
    getHeaders() {
        if (!this.headers) {
            this.parse();
        }
        return this.headers;
    }

    /**
    * Gets the common name prefix shared by all headers.
    * @returns {string} Common prefix without the trailing underscore
    */
    getName() {
        return this.name;
    }

    /**
    * Gets the line index where this loop ends.
    * @returns {number} Index of the last line of the loop
    */
    getEndIndex() {
        return this.endIndex;
    }
}