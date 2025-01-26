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
function parseValue(entryString, splitSU = true) {
    const suPattern = /([+-]?)(\d+\.?\d*)\((\d{1,2})\)/;
    const match = entryString.match(suPattern);
    let value, su;

    if (splitSU && match) {
        const [_, signString, numberString, suString] = match;
        const signMult = signString === "-" ? -1 : 1;
        if (numberString.includes(".")) {
            value = signMult * parseFloat(numberString);
            su = Math.pow(10, -1 * numberString.split(".")[1].length) * parseFloat(suString);
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
            value = entryString.includes(".") ? parseFloat(entryString) : parseInt(entryString);
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
function parseMultiLineString(lines, startIndex) {
    let result = '';
    let i = startIndex + 1;
    
    while (i < lines.length && lines[i] !== ';') {
        result += lines[i].replace(/\\([^\\])/g, '$1') + '\n';
        i++;
    }
    
    return {
        value: result.trim(),
        endIndex: i
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
        this.rawCifBlocks = this.splitCifBlocks("\n\n" + cifString);
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
        const blockTexts = cifText.split(/\ndata_/).slice(1);
        let i = 0;
        
        while (i < blockTexts.length) {
            let text = blockTexts[i];
            const multilinePattern = /^\s*;[\s\w]*$/gm;
            const matches = text.match(multilinePattern);
            let count = matches ? matches.length : 0;
            
            while (count % 2 === 1 && i + 1 < blockTexts.length) {
                i++;
                text += "\ndata_" + blockTexts[i];
                const matches = text.match(multilinePattern);
                count = matches ? matches.length : 0;
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
        if (this.data !== null) return;

        this.data = {};
        const lines = this.rawText.replace(/\n;([^\n^\s])/, "\n;\n$1") // Make multiline strings clean
            .split("\n")
            .map(line => {
                const regex = /#(?=(?:[^"]*"[^"]*")*[^"]*$)(?=(?:[^']*'[^']*')*[^']*$)/;
                return line.split(regex)[0];
            })
            .map(line => line.trim())
            .filter(line => line.length > 0);

        this.dataBlockName = lines[0];
        let i = 1;

        while (i < lines.length) {
            if (lines[i + 1] === ";") {
                const mult = parseMultiLineString(lines, i + 1);
                this.data[lines[i]] = mult.value;
                i = mult.endIndex + 1;
                continue;
            }
            
            if (lines[i].startsWith("loop_")) {
                const loop = new CifLoop(lines.slice(i), this.splitSU);
                this.data[loop.getName()] = loop;
                i += loop.getEndIndex();
                continue;
            }

            const match = lines[i].match(/^(\S+)\s+(.*)$/);
            if (match) {
                const key = match[1];
                const parsedValue = parseValue(match[2], this.splitSU);
                this.data[key] = parsedValue.value;
                if (!isNaN(parsedValue.su)) {
                    this.data[key + "_su"] = parsedValue.su;
                }
            } else if (lines[i].startsWith("_") && !lines[i+1].startsWith("_")) {
                const key = lines[i];
                const parsedValue = parseValue(lines[i + 1], this.splitSU);
                this.data[key] = parsedValue.value;
                if (!isNaN(parsedValue.su)) {
                    this.data[key + "_su"] = parsedValue.su;
                }
                i++;
            } else {
                throw new Error('Could not parse line ' + String(i) + ": " + lines[i]);
            }

            i++;
        }
    }
    get dataBlockName() {
        if (!this._dataBlockName) {
            this.parse();
        }
        return this._dataBlockName
    }

    set dataBlockName(value) {
        this._dataBlockName = value;
    }

    /**
     * Gets the value associated with a key in this block.
     * @param {string} key - The key to look up
     * @returns {*} The value associated with the key
     */
    get(key) {
        this.parse();
        return this.data[key];
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
    constructor(lines, splitSU = true) {
        this.splitSU = splitSU;
        let i = (lines[0].startsWith("loop_")) ? 1 : 0;
        
        // Get header section
        while (i < lines.length && lines[i].startsWith("_")) {
            i++;
        }
        this.headerLines = lines.slice(1, i);
        
        let dataEnd = i;
        // Get data section
        while (dataEnd < lines.length && !lines[dataEnd].startsWith("_") && 
               !lines[dataEnd].startsWith("loop_") && !lines[dataEnd].startsWith("data_")) {
            dataEnd++;
        }
        
        this.dataLines = lines.slice(i, dataEnd);
        this.endIndex = dataEnd + this.headerLines.length;
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
        if (this.data !== null) return;
    
        this.headers = [...this.headerLines]; // Copy to preserve originals
        this.data = {};
    
        const dataArray = [];
        for (const line of this.dataLines) {
            if (line === ";") {
                const mult = parseMultiLineString(this.dataLines, this.dataLines.indexOf(line));
                dataArray.push(parseValue(mult.value, this.splitSU));
                continue;
            }
    
            const regex = /('[^']+'|"[^"]+"|[^\s'"]+)/g;
            const matches = line.match(regex);
            if (matches) {
                for (const match of matches) {
                    dataArray.push(parseValue(match, this.splitSU));
                }
            }
        }
    
        const nEntries = this.headers.length;
        for (let j = 0; j < nEntries; j++) {
            const header = this.headers[j];
            const headerValues = dataArray.slice(j).filter((_, index) => index % nEntries === 0);
            const hasSU = headerValues.some(value => !isNaN(value.su));
            
            if (hasSU) {
                this.data[header] = headerValues.map(value => value.value);
                this.data[header + "_su"] = headerValues.map(value => value.su);
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
    findCommonStart() {
        if (!this.headerLines || this.headerLines.length === 0) return '';
        
        const firstStr = this.headerLines[0];
        const matchStart = "_" + firstStr.split(/[\.\_]/)[1];
        const matchingStrings = this.headerLines.filter(str => str.startsWith(matchStart));
        
        let commonPrefix = '';
        for (let i = 0; i < firstStr.length; i++) {
            const char = firstStr[i];
            if (matchingStrings.every(str => str[i] === char)) {
                commonPrefix += char;
            } else {
                break;
            }
        }
        
        return commonPrefix.slice(0, -1);
    }

    /**
    * Gets a column of values by header name.
    * @param {string} header - The header/column name
    * @returns {Array} Values for the specified column
    */
    get(header) {
        this.parse();
        return this.data[header];
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
        if (!this.name) {
            if (!this.headers) {
                this.parse();
            } else {
                this.name = this.findCommonStart().slice(0, -1);
            }
        }
        return this.name;
    }

    /**
    * Gets the line index where this loop ends.
    * @returns {number} Index of the last line of the loop
    */
    getEndIndex() {
        if (this.endIndex === null) {
            this.parse();
        }
        return this.endIndex;
    }
}