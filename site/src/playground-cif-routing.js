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
 * Resolves the playground's optional external-CIF query parameter.
 * @param {string} search - Location search string, including an optional leading `?`.
 * @param {string} baseUrl - Current page URL used to resolve relative sources.
 * @returns {{url:string, fileName:string}|null} Fetch URL and display/export filename.
 * @throws {Error} When the source is malformed or does not use HTTP(S).
 */
export function resolvePlaygroundFromUrl(search, baseUrl) {
    const value = new URLSearchParams(search).get('from-url');
    if (!value) {
        return null;
    }
    let url;
    try {
        url = new URL(value, baseUrl);
    } catch {
        throw new Error('The from-url parameter is not a valid URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('The from-url parameter must use HTTP or HTTPS.');
    }
    const encodedName = url.pathname.split('/').filter(Boolean).at(-1) || 'external.cif';
    let fileName = encodedName;
    try {
        fileName = decodeURIComponent(encodedName);
    } catch {
        // Keep the encoded path component when it contains malformed escapes.
    }
    return { url: url.href, fileName };
}

/**
 * Builds an actionable browser-fetch error for an external playground source.
 * A rejected cross-origin fetch cannot reliably distinguish CORS from network
 * failure, so the message identifies CORS as the usual cause rather than certainty.
 * @param {{url:string, fileName:string}} source - Resolved external CIF source.
 * @param {string} pageUrl - Current playground URL.
 * @returns {string} User-facing failure message.
 */
export function externalCifFetchErrorMessage(source, pageUrl) {
    const sourceUrl = new URL(source.url);
    const page = new URL(pageUrl);
    if (sourceUrl.origin !== page.origin) {
        return `Could not fetch ${source.fileName} from ${sourceUrl.host}. ` +
            'The browser blocked or could not reach this cross-origin URL. This is usually a CORS ' +
            'restriction: the source server must send an Access-Control-Allow-Origin header. ' +
            'Download the CIF and use the Upload button, or use a CORS-enabled source.';
    }
    return `Could not fetch ${source.fileName}. Check that the URL is reachable.`;
}

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
