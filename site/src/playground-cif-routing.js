import { CIF } from '../../src/lib/read-cif/base.js';

const ATOM_COORDINATE_DATA = /^_atom_site[._](?:fract_x|cartn_x)$/i;
const SUPPORTED_REFLECTION_DATA = new RegExp([
    '^_refln[._](?:intensity_meas|f_squared_meas|f_meas)$',
    '^_diffrn_refln[._](?:intensity_net|intensity_meas)$',
    '^_shelx[^\\s]*hkl_file$',
    '^_iucr_refine_fcf_details$',
    '^_cifvis_difference_density_loop$',
].join('|'), 'i');

/**
 * Returns the data names advertised by one block without parsing loop values.
 * @param {object} block - Lazy CIF block.
 * @returns {Array<string>} CIF data names.
 */
function getBlockDataNames(block) {
    if (block.rawText !== null) {
        return Array.from(
            block.rawText.matchAll(/(?:^|\s)(_\S+)/g),
            match => match[1],
        );
    }
    return block.tokens
        .filter(token => token.type === 'tag')
        .map(token => token.value);
}

/**
 * Resolves a block index/name and tests its data names.
 * @param {CIF} cif - Parsed CIF container.
 * @param {number|string} blockSelector - Block index or name.
 * @param {RegExp} pattern - Data-name pattern.
 * @returns {boolean} Whether the block contains a matching data name.
 */
function blockHasDataName(cif, blockSelector, pattern) {
    const block = typeof blockSelector === 'number'
        ? cif.getBlock(blockSelector)
        : cif.getBlockByName(blockSelector);
    return getBlockDataNames(block).some(name => pattern.test(name));
}

/**
 * Tests whether a selected CIF block has a supported reflection source.
 * @param {string} cifText - CIF/FCF text to inspect.
 * @param {number|string} [blockSelector] - Block index or name.
 * @returns {boolean} Whether automatic difference-density loading is supported.
 */
export function hasSupportedReflectionData(cifText, blockSelector = 0) {
    return blockHasDataName(
        new CIF(cifText),
        blockSelector,
        SUPPORTED_REFLECTION_DATA,
    );
}

/**
 * Finds the first coordinate and reflection blocks in a dropped CIF-style file.
 * Coordinate data deliberately requires an actual position column: atom-type or
 * scattering-factor metadata alone must not turn an FCF into a structure load.
 * @param {string} cifText - Dropped CIF/FCF text.
 * @returns {{blockCount: number, coordinateBlock: number|null, reflectionBlock: number|null}}
 * Routing information for the playground.
 */
export function classifyPlaygroundCif(cifText) {
    const cif = new CIF(cifText);
    let coordinateBlock = null;
    let reflectionBlock = null;

    for (let index = 0; index < cif.rawCifBlocks.length; index++) {
        if (coordinateBlock === null && blockHasDataName(cif, index, ATOM_COORDINATE_DATA)) {
            coordinateBlock = index;
        }
        if (reflectionBlock === null && blockHasDataName(cif, index, SUPPORTED_REFLECTION_DATA)) {
            reflectionBlock = index;
        }
    }

    return {
        blockCount: cif.rawCifBlocks.length,
        coordinateBlock,
        reflectionBlock,
    };
}
