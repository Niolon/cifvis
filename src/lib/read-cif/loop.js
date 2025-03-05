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
 * Represents a loop construct within a CIF block.
 * @property {Array<string>} rawLines - Raw lines of the loop
 * @property {boolean} splitSU - Whether to split standard uncertainties
 * @property {Array<string>|null} headers - Column headers, null until parsed
 * @property {object | null} data - Parsed loop data, null until parsed
 * @property {number|null} endIndex - Index of loop end, null until parsed
 * @property {string|null} name - Common prefix of headers, null until parsed
 */

export class CifLoop {
    /**
     * Creates a new CIF loop instance.
     * @class
     * @param {Array<string>} lines - Raw lines of the loop construct
     * @param headerLines
     * @param dataLines
     * @param endIndex
     * @param name
     * @param {boolean} [splitSU] - Whether to split standard uncertainties
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
     * Gets the common name prefix shared by all headers.
     * @param checkStandardNames
     * @returns {string} Common prefix without the trailing underscore
     * @private
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
     * Gets column data for given keys.
     * @param {(string|string[])} keys - Key or array of keys to try
     * @param {*} [defaultValue] - Value to return if keys not found
     * @returns {Array} Column data
     * @throws {Error} If no keys found and no default provided
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
     * Gets value at specific index for one of given keys.
     * @param {(string|string[])} keys - Key or array of keys to try
     * @param {number} index - Row index
     * @param {*} [defaultValue] - Value to return if keys not found
     * @returns {*} Value at index
     * @throws {Error} If index out of bounds or keys not found
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
 *
 * @param entry1
 * @param entry2
 * @param originalName
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
 *
 * @param loop1
 * @param loop2
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
 *
 * @param loop1
 * @param loop2
 * @param originalName
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
 *
 * @param entry1
 * @param entry2
 * @param originalName
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