/* eslint-disable jsdoc/require-jsdoc */
import { CIF } from '../read-cif/base.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import { finiteNumber, loopColumn, optionalLoop } from './cif-values.js';
import {
    canonicalReflectionIndex,
    compareReflectionIndices,
    isGeneralPositionSystematicAbsence,
} from './reciprocal-symmetry.js';

function blockOrder(cif, selectedBlock) {
    return [selectedBlock, ...cif.getAllBlocks().filter(block => block !== selectedBlock)];
}

function validIndices(h, k, l) {
    return [h, k, l].every(value => Number.isInteger(value));
}

function rowsFromColumns(hValues, kValues, lValues, intensityValues, sigmaValues = null) {
    const lengths = [hValues, kValues, lValues, intensityValues].map(column => column?.length);
    if (lengths.some(length => length === undefined) || !lengths.every(length => length === lengths[0])) {
        throw new Error('Reflection index and intensity columns must have the same row count');
    }
    if (sigmaValues && sigmaValues.length !== lengths[0]) {
        throw new Error('Reflection intensity and uncertainty columns must have the same row count');
    }
    const rows = [];
    let invalidCount = 0;
    for (let index = 0; index < lengths[0]; index++) {
        const h = finiteNumber(hValues[index]);
        const k = finiteNumber(kValues[index]);
        const l = finiteNumber(lValues[index]);
        const intensity = finiteNumber(intensityValues[index]);
        const sigma = sigmaValues ? finiteNumber(sigmaValues[index]) : null;
        if (!validIndices(h, k, l) || intensity === null || (sigmaValues && sigma === null)) {
            invalidCount++;
            continue;
        }
        rows.push({ h, k, l, intensity, sigma, sourceIndex: index });
    }
    return { rows, invalidCount };
}

function mergedLoopRows(loop) {
    const h = loopColumn(loop, ['_refln.index_h', '_refln_index_h']);
    const k = loopColumn(loop, ['_refln.index_k', '_refln_index_k']);
    const l = loopColumn(loop, ['_refln.index_l', '_refln_index_l']);
    const intensity = loopColumn(loop, ['_refln.intensity_meas', '_refln_intensity_meas']);
    if (intensity) {
        const sigma = loopColumn(loop, [
            '_refln.intensity_sigma', '_refln_intensity_sigma',
            '_refln.intensity_meas_su', '_refln_intensity_meas_su',
        ]);
        return { ...rowsFromColumns(h, k, l, intensity, sigma), valueKind: 'intensity' };
    }
    const fSquared = loopColumn(loop, ['_refln.F_squared_meas', '_refln_F_squared_meas']);
    if (fSquared) {
        const sigma = loopColumn(loop, [
            '_refln.F_squared_sigma', '_refln_F_squared_sigma',
            '_refln.F_squared_meas_su', '_refln_F_squared_meas_su',
        ]);
        return { ...rowsFromColumns(h, k, l, fSquared, sigma), valueKind: 'F-squared' };
    }
    const amplitude = loopColumn(loop, ['_refln.F_meas', '_refln_F_meas']);
    if (amplitude) {
        const amplitudeSigma = loopColumn(loop, ['_refln.F_sigma', '_refln_F_sigma']);
        const intensityValues = amplitude.map(value => {
            const number = finiteNumber(value);
            return number === null ? null : number ** 2;
        });
        const sigmaValues = amplitudeSigma?.map((value, index) => {
            const sigma = finiteNumber(value);
            const measured = finiteNumber(amplitude[index]);
            return sigma === null || measured === null ? null : 2 * Math.abs(measured) * sigma;
        }) ?? null;
        return {
            ...rowsFromColumns(h, k, l, intensityValues, sigmaValues),
            valueKind: 'F-amplitude-squared',
        };
    }
    throw new Error('The _refln loop contains no measured intensity, F-squared, or F columns');
}

function unmergedLoopRows(loop) {
    const h = loopColumn(loop, ['_diffrn_refln.index_h', '_diffrn_refln_index_h']);
    const k = loopColumn(loop, ['_diffrn_refln.index_k', '_diffrn_refln_index_k']);
    const l = loopColumn(loop, ['_diffrn_refln.index_l', '_diffrn_refln_index_l']);
    const intensity = loopColumn(loop, [
        '_diffrn_refln.intensity_net', '_diffrn_refln_intensity_net',
        '_diffrn_refln.intensity_meas', '_diffrn_refln_intensity_meas',
    ]);
    const sigma = loopColumn(loop, [
        '_diffrn_refln.intensity_u', '_diffrn_refln_intensity_u',
        '_diffrn_refln.intensity_sigma', '_diffrn_refln_intensity_sigma',
        '_diffrn_refln.intensity_net_su', '_diffrn_refln_intensity_net_su',
    ]);
    if (!intensity) {
        throw new Error('The _diffrn_refln loop contains no net measured intensity column');
    }
    return rowsFromColumns(h, k, l, intensity, sigma);
}

function fixedWidthShelxRow(line) {
    const fields = [
        line.slice(0, 4), line.slice(4, 8), line.slice(8, 12),
        line.slice(12, 20), line.slice(20, 28), line.slice(28, 32),
    ].map(value => value.trim());
    if (fields.slice(0, 5).some(value => value.length === 0)) {
        return null;
    }
    return fields;
}

function parseShelxHkl(text) {
    const rows = [];
    let invalidCount = 0;
    for (const [index, line] of String(text).split(/\r?\n/).entries()) {
        if (line.trim().length === 0) {
            continue;
        }
        const whitespaceFields = line.trim().split(/\s+/);
        let [h, k, l, intensity, sigma] = whitespaceFields.slice(0, 5).map(finiteNumber);
        if (!validIndices(h, k, l) || intensity === null || sigma === null) {
            const fixedFields = fixedWidthShelxRow(line);
            [h, k, l, intensity, sigma] = fixedFields
                ? fixedFields.slice(0, 5).map(finiteNumber)
                : [null, null, null, null, null];
        }
        if (!validIndices(h, k, l) || intensity === null || sigma === null) {
            invalidCount++;
            continue;
        }
        if (h === 0 && k === 0 && l === 0 && intensity === 0 && sigma === 0) {
            break;
        }
        rows.push({ h, k, l, intensity, sigma, sourceIndex: index });
    }
    return { rows, invalidCount };
}

function shelxHklText(block) {
    block.parse();
    const key = Object.keys(block.data).find(name => /shelx.*hkl_file/i.test(name));
    return key ? block.data[key] : null;
}

function embeddedReflectionLoops(block) {
    const result = [];
    for (const name of ['_iucr_refine_fcf_details']) {
        let text;
        try {
            text = block.get(name);
        } catch {
            continue;
        }
        if (typeof text !== 'string' || !text.includes('data_')) {
            continue;
        }
        try {
            for (const embeddedBlock of new CIF(text).getAllBlocks()) {
                const loop = optionalLoop(embeddedBlock, '_refln');
                if (loop) {
                    result.push(loop);
                }
            }
        } catch {
            // Ignore malformed optional embedded reflection text.
        }
    }
    return result;
}

/**
 * Tests whether the general-position phase sum is zero for a reflection.
 * @param {number} h - Miller h.
 * @param {number} k - Miller k.
 * @param {number} l - Miller l.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {number} tolerance - Complex phase-sum tolerance.
 * @returns {boolean} Whether the reflection is systematically absent.
 */
export function isSystematicAbsence(h, k, l, symmetry, tolerance = 1e-8) {
    return isGeneralPositionSystematicAbsence(h, k, l, symmetry, tolerance);
}

/**
 * Removes systematic absences and merges symmetry-equivalent intensities.
 * Positive uncertainties use inverse-variance weighting; data without usable
 * uncertainties use an arithmetic mean.
 * @param {object[]} reflections - Unmerged observations.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensities(reflections, symmetry, options = {}) {
    const mergeFriedel = options.mergeFriedel !== false;
    const removeSystematicAbsences = options.removeSystematicAbsences !== false;
    const groups = new Map();
    const absenceCache = new Map();
    const canonicalCache = new Map();
    let systematicAbsenceCount = 0;
    for (const reflection of reflections) {
        const inputKey = `${reflection.h},${reflection.k},${reflection.l}`;
        let absent = absenceCache.get(inputKey);
        if (absent === undefined) {
            absent = removeSystematicAbsences && isSystematicAbsence(
                reflection.h,
                reflection.k,
                reflection.l,
                symmetry,
                options.absenceTolerance,
            );
            absenceCache.set(inputKey, absent);
        }
        if (absent) {
            systematicAbsenceCount++;
            continue;
        }
        let canonical = canonicalCache.get(inputKey);
        if (!canonical) {
            canonical = canonicalReflectionIndex(
                reflection.h,
                reflection.k,
                reflection.l,
                symmetry,
                mergeFriedel,
            );
            canonicalCache.set(inputKey, canonical);
        }
        const [h, k, l] = canonical;
        const key = `${h},${k},${l}`;
        if (!groups.has(key)) {
            groups.set(key, { h, k, l, observations: [] });
        }
        groups.get(key).observations.push(reflection);
    }
    const merged = [...groups.values()].map(group => {
        const weighted = group.observations.every(observation => observation.sigma > 0);
        let intensity;
        let sigma;
        if (weighted) {
            const weight = group.observations.reduce(
                (sum, observation) => sum + 1 / observation.sigma ** 2,
                0,
            );
            intensity = group.observations.reduce(
                (sum, observation) => sum + observation.intensity / observation.sigma ** 2,
                0,
            ) / weight;
            sigma = Math.sqrt(1 / weight);
        } else {
            intensity = group.observations.reduce((sum, observation) => sum + observation.intensity, 0) /
                group.observations.length;
            sigma = group.observations.every(observation => observation.sigma !== null)
                ? Math.sqrt(group.observations.reduce(
                    (sum, observation) => sum + observation.sigma ** 2,
                    0,
                )) / group.observations.length
                : null;
        }
        return {
            h: group.h,
            k: group.k,
            l: group.l,
            intensity,
            sigma,
            multiplicity: group.observations.length,
        };
    });
    merged.sort((first, second) => compareReflectionIndices(
        [first.h, first.k, first.l],
        [second.h, second.k, second.l],
    ));
    return { reflections: merged, systematicAbsenceCount };
}

/**
 * Reads observed intensities, preferring an already merged `_refln` loop and
 * otherwise merging `_diffrn_refln` or `_shelx_hkl_file` observations.
 * @param {string} cifText - CIF containing coordinates and reflections.
 * @param {number|string} cifBlock - Coordinate/symmetry block index or name.
 * @param {object} options - Source and merging options.
 * @returns {{reflections:object[], metadata:object}} Normalized observations.
 */
export function readReflectionIntensities(cifText, cifBlock = 0, options = {}) {
    const cif = new CIF(cifText);
    const selectedBlock = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const blocks = blockOrder(cif, selectedBlock);
    const requestedSource = options.source ?? 'auto';
    const allowSource = source => requestedSource === 'auto' || requestedSource === source;

    if (allowSource('refln')) {
        const candidates = [
            ...blocks.map(block => optionalLoop(block, '_refln')).filter(Boolean).map(loop => ({
                loop,
                source: 'refln',
            })),
            ...blocks.flatMap(embeddedReflectionLoops).map(loop => ({
                loop,
                source: 'embedded-refln',
            })),
        ];
        let unsupportedError = null;
        for (const candidate of candidates) {
            try {
                const parsed = mergedLoopRows(candidate.loop);
                return {
                    reflections: parsed.rows.map(row => ({ ...row, multiplicity: 1 })),
                    metadata: {
                        source: candidate.source,
                        valueKind: parsed.valueKind,
                        alreadyMerged: true,
                        inputCount: parsed.rows.length + parsed.invalidCount,
                        outputCount: parsed.rows.length,
                        invalidCount: parsed.invalidCount,
                        systematicAbsenceCount: 0,
                        mergeFriedel: null,
                    },
                };
            } catch (error) {
                if (!error.message.includes('contains no measured')) {
                    throw error;
                }
                unsupportedError = error;
            }
        }
        if (requestedSource === 'refln' && unsupportedError) {
            throw unsupportedError;
        }
    }

    let parsed;
    let source;
    if (allowSource('diffrn_refln')) {
        const loop = blocks.map(block => optionalLoop(block, '_diffrn_refln')).find(Boolean);
        if (loop) {
            parsed = unmergedLoopRows(loop);
            source = 'diffrn_refln';
        }
    }
    if (!parsed && allowSource('shelx_hkl_file')) {
        const text = blocks.map(shelxHklText).find(value => typeof value === 'string');
        if (text) {
            parsed = parseShelxHkl(text);
            source = 'shelx_hkl_file';
        }
    }
    if (!parsed) {
        throw new Error(`No usable reflection intensities found for source "${requestedSource}"`);
    }

    const symmetry = CellSymmetry.fromCIF(selectedBlock);
    const merged = mergeReflectionIntensities(parsed.rows, symmetry, options);
    return {
        reflections: merged.reflections,
        metadata: {
            source,
            valueKind: 'intensity',
            alreadyMerged: false,
            inputCount: parsed.rows.length + parsed.invalidCount,
            outputCount: merged.reflections.length,
            invalidCount: parsed.invalidCount,
            systematicAbsenceCount: merged.systematicAbsenceCount,
            mergeFriedel: options.mergeFriedel !== false,
        },
    };
}
