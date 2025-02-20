import { parseMultiLineString, parseValue } from './helpers';

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
    * @param {*} [defaultValue=null] - Value to return if keys not found
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
     * @param {*} [defaultValue=null] - Value to return if keys not found
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
export const STANDART_LOOP_NAMES = [
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

