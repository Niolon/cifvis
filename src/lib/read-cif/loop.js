import { parseMultiLineString, parseValue } from './helpers.js';

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
     * Creates a new CIF loop instance.
     * @class
     * @param {Array<string>} headerLines - Column header lines from the CIF
     * @param {Array<string>} dataLines - Data value lines from the CIF
     * @param {number} endIndex - Index where the loop ends in the original CIF
     * @param {boolean} splitSU - Whether to split standard uncertainties into value and uncertainty
     * @param {string} [name] - Loop name, will be auto-detected if omitted
     */
    constructor(headerLines, dataLines, endIndex, splitSU, name=null) {
        this.splitSU = splitSU;
        this.headerLines = headerLines;
        this.dataLines = dataLines;
        this.endIndex = endIndex;
        
        this.headers = null;
        this.data = null;
        this.name = null;

        // Parse headers early for findCommonStart
        if (name) {
            this.name = name;
        } else {
            this.name = this.findCommonStart();
        }
        
    }

    /**
     * Creates a CifLoop instance from raw CIF lines starting with 'loop_'.
     * @static
     * @param {Array<string>} lines - Raw CIF lines starting with 'loop_'
     * @param {boolean} splitSU - Whether to split standard uncertainties
     * @returns {CifLoop} New CifLoop instance with extracted headers and data
     */
    static fromLines(lines, splitSU) {
        let i = 1;

        // Get header section
        while (i < lines.length && lines[i].trim().startsWith('_')) {
            i++;
        }
        const headerLines = lines.slice(1, i).map(line => line.trim());

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

        const dataLines = lines.slice(i, dataEnd);
        const endIndex = dataEnd;

        return new CifLoop(headerLines, dataLines, endIndex, splitSU);
    }

    /**
     * Parses loop content into structured data.
     * Processes headers and values, handling standard uncertainties if enabled.
     * Extracts multi-line strings and populates the data property with column values.
     * @returns {void}
     * @throws {Error} If the data values cannot be evenly distributed into columns
     * @throws {Error} If the loop contains no data values
     */
    parse() {
        if (this.data !== null) {
            return;
        }

        this.headers = [...this.headerLines];
        this.data = {};

        const dataArray = this.dataLines.reduce((acc, line, i) => {
            line = line.trim();
            if (!line.length) {
                return acc;
            }

            if (line.startsWith(';')) {
                const mult = parseMultiLineString(this.dataLines, i);
                acc.push({ value: mult.value, su: NaN });
                // Skip lines consumed by multiline string
                for (let j = i; j < mult.endIndex + 1; j++) {
                    this.dataLines[j] = '';
                }
                return acc;
            }

            const matches = Array.from(line.matchAll(/'([^']*(?:'\S[^']*)*)'|"([^"]*(?:"\S[^"]*)*)"|\S+/g));
            return acc.concat(matches.map(match => parseValue(match[1] || match[2] || match[0], this.splitSU),
            ));
        }, []);

        const nEntries = this.headers.length;

        if (dataArray.length % nEntries !== 0) {
            const dataString = dataArray.map(({ value, su }) => {
                return `{value: ${value}, su: ${su}}`;
            }).join(', ');
            throw new Error(
                `Loop ${this.name}: Cannot distribute ${dataArray.length} values evenly into ${nEntries} columns\n`
                + `entries are: ${dataString}`,
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
     * Gets the common name prefix shared by all headers to identify the loop type.
     * First checks against standard loop names, then tries dot-based splitting,
     * and finally analyzes underscore segments to find common parts.
     * @param {boolean} [checkStandardNames] - Whether to check against known standard loop names
     * @returns {string} Common prefix without the trailing underscore
     */
    findCommonStart(checkStandardNames = true) {
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
            const matchCount = this.headerLines.filter(line => line.split('.')[0] === prefix,
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
            const matchCount = underscoreSegments.filter(segments => segments[i] === segment,
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
     * Gets column data for given keys, trying each key in turn.
     * @param {string|Array<string>} keys - Key or array of keys to try
     * @param {*} [defaultValue] - Value to return if none of the keys are found
     * @returns {Array} Column data for the first matching key
     * @throws {Error} If no keys found and no default value provided
     */
    get(keys, defaultValue = null) {
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
     * Gets value at specific row index for one of the given keys.
     * @param {string|Array<string>} keys - Key or array of keys to try
     * @param {number} index - Row index (0-based)
     * @param {*} [defaultValue] - Value to return if keys not found
     * @returns {*} Value at the specified index
     * @throws {Error} If index is out of bounds
     * @throws {Error} If none of the keys are found and no default value provided
     */
    getIndex(keys, index, defaultValue = null) {
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
     * Gets all column headers, parsing the loop first if needed.
     * @returns {Array<string>} Array of all header names
     */
    getHeaders() {
        if (!this.headers) {
            this.parse();
        }
        return this.headers;
    }

    /**
     * Gets the common name prefix shared by all headers.
     * @returns {string} Common prefix identifying the loop type
     */
    getName() {
        return this.name;
    }

    /**
     * Gets the line index where this loop ends in the original CIF.
     * @returns {number} Index of the last line of the loop
     */
    getEndIndex() {
        return this.endIndex;
    }
}

/**
 * Checks if an entry is a CIF loop
 * @param {object} entry - Entry to check
 * @returns {boolean} True if entry is a loop
 */
export function isLoop(entry) {
    return entry && typeof entry.getHeaders === 'function';
}

/**
 * Splits first header into tokens for comparison
 * @param {CifLoop} loop - Loop to analyze
 * @returns {string[]} Array of tokens
 * @throws {Error} If loop has no headers
 */
function tokenizeFirstHeader(loop) {
    const headers = loop.getHeaders();
    return headers[0].split('_').filter(token => token.length > 0);
}

/**
 * Resolves naming conflicts when one entry is a loop and the other is not.
 * Creates a new name for the loop by appending the next token from its header.
 * @param {object} entry1 - First entry (loop or non-loop)
 * @param {object} entry2 - Second entry (loop or non-loop)
 * @param {string} originalName - Original conflicting name
 * @returns {Array<string>} New names for both entries in original order
 */
export function resolveNonLoopConflict(entry1, entry2, originalName) {
    const loop = isLoop(entry1) ? entry1 : entry2;
    const originalTokens = originalName.split('_').filter(token => token.length > 0);
    const loopTokens = tokenizeFirstHeader(loop);
    const loopName = '_' + originalTokens.join('_') + '_' + loopTokens[originalTokens.length];
    
    // Return names in same order as original entries
    return isLoop(entry1) ? 
        [loopName, originalName] : 
        [originalName, loopName];
}

/**
 * Attempts to resolve loop naming conflict by comparing common prefixes.
 * @param {CifLoop} loop1 - First loop
 * @param {CifLoop} loop2 - Second loop
 * @returns {Array<string>|null} Array of new names or null if resolution fails
 */
export function resolveByCommonStart(loop1, loop2) {
    const shortest1 = loop1.findCommonStart(false);
    const shortest2 = loop2.findCommonStart(false);

    if (shortest1.length !== shortest2.length) {
        return [shortest1, shortest2];
    }
    return null;
}

/**
 * Resolves loop naming conflict based on header token length,
 * appending the next token from the longer header to create a unique name.
 * @param {CifLoop} loop1 - First loop
 * @param {CifLoop} loop2 - Second loop
 * @param {string} originalName - Original conflicting name
 * @returns {Array<string>} New names for both loops
 */
export function resolveByTokenLength(loop1, loop2, originalName) {
    const originalTokens = originalName.split('_').filter(token => token.length > 0);
    const header1Tokens = tokenizeFirstHeader(loop1);
    const header2Tokens = tokenizeFirstHeader(loop2);

    // Get the next tokens after the original name
    if (header1Tokens.length >= header2Tokens.length) {
        return [
            originalName + '_' + header1Tokens[originalTokens.length],
            originalName,
        ];
    } else {
        return [
            originalName,
            originalName + '_' + header2Tokens[originalTokens.length],
        ];
    }
}

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
export function resolveLoopNamingConflict(entry1, entry2, originalName) {
    let newNames;
    
    // Get new names from appropriate resolution function
    if (!isLoop(entry1) || !isLoop(entry2)) {
        newNames = resolveNonLoopConflict(entry1, entry2, originalName);
    } else {
        newNames = resolveByCommonStart(entry1, entry2) || resolveByTokenLength(entry1, entry2, originalName);
    }

    // Update loop names if applicable
    const entries = [entry1, entry2];
    entries.forEach((entry, index) => {
        if (isLoop(entry)) {
            entry.name = newNames[index];
        }
    });

    return {
        newNames,
        newEntries: entries,
    };
}