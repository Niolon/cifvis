/**
 * Utilities for detecting the CIF format version of a raw CIF string.
 *
 * CIF2 files are identified by a magic code on the very first line:
 * `#\#CIF_2.0` (optionally preceded by a UTF-8 byte-order mark). Any file
 * that does not carry this exact magic code - including CIF1 files that
 * start with `#\#CIF_1.1` or carry no version comment at all - is treated
 * as CIF1 so that the existing CIF1 parsing path is used unchanged.
 */

/**
 * Removes a single leading UTF-8 byte-order mark (U+FEFF) from a string.
 * When Node reads a UTF-8 file that begins with a BOM, the decoded string
 * starts with the U+FEFF code point; this strips it so downstream parsing
 * sees clean content.
 * @param {string} cifString - Raw CIF file content.
 * @returns {string} The content with any leading BOM removed.
 */
export function stripBom(cifString) {
    if (cifString.charCodeAt(0) === 0xFEFF) {
        return cifString.slice(1);
    }
    return cifString;
}

/**
 * Detects the CIF format version from the magic code on the first line.
 * Only the first line is inspected, so this is cheap and never triggers
 * tokenization of the whole file.
 * @param {string} cifString - Raw CIF file content (BOM allowed).
 * @returns {number} `2` if the CIF2 magic code is present, otherwise `1`.
 */
export function detectCifVersion(cifString) {
    const withoutBom = stripBom(cifString);
    // Match the literal magic code `#\#CIF_2.0` at the very start of the file.
    if (/^#\\#CIF_2\.0/.test(withoutBom)) {
        return 2;
    }
    return 1;
}
