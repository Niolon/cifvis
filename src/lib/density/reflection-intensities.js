/* eslint-disable jsdoc/require-jsdoc */
import { CIF } from '../read-cif/base.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import { finiteNumber, loopColumn, optionalLoop } from './cif-values.js';
import {
    canonicalReflectionIndex,
    canonicalReflectionIndexLegacy,
    compareReflectionIndices,
    compiledReciprocalSymmetryKernel,
    isGeneralPositionSystematicAbsence,
    isGeneralPositionSystematicAbsenceLegacy,
} from './reciprocal-symmetry.js';

const now = () => performance.now();

function emptyReflectionDiagnostics() {
    return {
        reflectionSourceDiscoveryMs: 0,
        reflectionSourceParseMs: 0,
        reflectionRowDecodeMs: 0,
        reflectionSymmetrySetupMs: 0,
        reflectionAbsenceMs: 0,
        reflectionCanonicalizationMs: 0,
        reflectionMergeAccumulationMs: 0,
        reflectionMergeFinalizationMs: 0,
        reflectionMergeSortMs: 0,
        reflectionPreparationTotalMs: 0,
        rawReflectionCount: 0,
        validReflectionCount: 0,
        invalidReflectionCount: 0,
        distinctInputHklCount: 0,
        systematicAbsenceCount: 0,
        mergedReflectionCount: 0,
        symmetryOperationCount: 0,
        absenceCacheHitCount: 0,
        absenceCacheMissCount: 0,
        canonicalCacheHitCount: 0,
        canonicalCacheMissCount: 0,
        shelxContainerExtractionMs: 0,
        shelxFixedWidthDecodeMs: 0,
        shelxFallbackDecodeCount: 0,
    };
}

function preparedObservations(h, k, l, intensity, sigma, sourceIndex, invalidCount, rawCount) {
    return { h, k, l, intensity, sigma, sourceIndex, count: h.length, invalidCount, rawCount };
}

function materializeObservations(observations, multiplicity = false) {
    const rows = new Array(observations.count);
    for (let index = 0; index < observations.count; index++) {
        rows[index] = {
            h: observations.h[index],
            k: observations.k[index],
            l: observations.l[index],
            intensity: observations.intensity[index],
            sigma: Number.isNaN(observations.sigma[index]) ? null : observations.sigma[index],
            sourceIndex: observations.sourceIndex[index],
            ...(multiplicity ? { multiplicity: 1 } : {}),
        };
    }
    return rows;
}

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
    const hOutput = [];
    const kOutput = [];
    const lOutput = [];
    const intensityOutput = [];
    const sigmaOutput = [];
    const sourceIndexOutput = [];
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
        hOutput.push(h);
        kOutput.push(k);
        lOutput.push(l);
        intensityOutput.push(intensity);
        sigmaOutput.push(sigma ?? Number.NaN);
        sourceIndexOutput.push(index);
    }
    return preparedObservations(
        Int32Array.from(hOutput),
        Int32Array.from(kOutput),
        Int32Array.from(lOutput),
        Float64Array.from(intensityOutput),
        Float64Array.from(sigmaOutput),
        Uint32Array.from(sourceIndexOutput),
        invalidCount,
        lengths[0],
    );
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

function parseShelxHkl(text, diagnostics = null) {
    const hOutput = [];
    const kOutput = [];
    const lOutput = [];
    const intensityOutput = [];
    const sigmaOutput = [];
    const sourceIndexOutput = [];
    let invalidCount = 0;
    let rawCount = 0;
    const lines = String(text).split(/\r?\n/);
    const fixedWidthStarted = diagnostics ? now() : 0;
    for (const [index, line] of lines.entries()) {
        if (line.trim().length === 0) {
            continue;
        }
        rawCount++;
        // SHELX HKL records are fixed width (3I4, 2F8.2, I4). In particular,
        // a positive l index can touch a large positive intensity, e.g.
        // `   0   2   313079.00`, which a whitespace-first parser mistakes for
        // l = 313079. Prefer the defined column widths and retain free-format
        // whitespace parsing only as a compatibility fallback.
        const fixedFields = [
            line.slice(0, 4).trim(), line.slice(4, 8).trim(), line.slice(8, 12).trim(),
            line.slice(12, 20).trim(), line.slice(20, 28).trim(),
        ];
        let [h, k, l, intensity, sigma] = fixedFields.map(Number);
        const fixedWidthValid = line.length >= 28 && fixedFields.every(Boolean) && validIndices(h, k, l) &&
            Number.isFinite(intensity) && Number.isFinite(sigma);
        if (!fixedWidthValid) {
            const whitespaceFields = line.trim().split(/\s+/);
            [h, k, l, intensity, sigma] = whitespaceFields.slice(0, 5).map(finiteNumber);
            if (diagnostics) {
                diagnostics.shelxFallbackDecodeCount++;
            }
        }
        if (!validIndices(h, k, l) || !Number.isFinite(intensity) || !Number.isFinite(sigma)) {
            invalidCount++;
            continue;
        }
        if (h === 0 && k === 0 && l === 0 && intensity === 0 && sigma === 0) {
            rawCount--;
            break;
        }
        hOutput.push(h);
        kOutput.push(k);
        lOutput.push(l);
        intensityOutput.push(intensity);
        sigmaOutput.push(sigma);
        sourceIndexOutput.push(index);
    }
    if (diagnostics) {
        diagnostics.shelxFixedWidthDecodeMs += now() - fixedWidthStarted;
    }
    return preparedObservations(
        Int32Array.from(hOutput),
        Int32Array.from(kOutput),
        Int32Array.from(lOutput),
        Float64Array.from(intensityOutput),
        Float64Array.from(sigmaOutput),
        Uint32Array.from(sourceIndexOutput),
        invalidCount,
        rawCount,
    );
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

function resolvedDifferenceDensityInputMode(block, options) {
    const requested = options.differenceDensityInputMode ?? 'auto';
    if (requested !== 'auto') {
        return requested;
    }
    if (options.differenceDensityCoefficientColumns) {
        return 'fcf';
    }
    const selfDescription = [
        '_cifvis_difference_density_loop',
        '_cifvis_difference_density_h',
        '_cifvis_difference_density_k',
        '_cifvis_difference_density_l',
        '_cifvis_difference_density_a',
        '_cifvis_difference_density_b',
    ].map(name => block.get(name, false));
    if (selfDescription.every(value => typeof value === 'string' && value.length > 0)) {
        return 'fcf';
    }
    const loop = optionalLoop(block, '_refln');
    if (!loop) {
        return 'cif-iam';
    }
    const hasColumn = names => loopColumn(loop, names, null) !== null;
    const hasPhase = hasColumn(['_refln.phase_calc', '_refln_phase_calc']);
    const hasMeasured = hasColumn([
        '_refln.F_squared_meas', '_refln_F_squared_meas',
        '_refln.F_meas', '_refln_F_meas',
    ]);
    const hasCalculated = hasColumn([
        '_refln.F_calc', '_refln_F_calc',
        '_refln.F_squared_calc', '_refln_F_squared_calc',
    ]);
    return hasPhase && hasMeasured && hasCalculated ? 'fcf' : 'cif-iam';
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
export function mergeReflectionIntensitiesLegacy(reflections, symmetry, options = {}) {
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
            absent = removeSystematicAbsences && isGeneralPositionSystematicAbsenceLegacy(
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
            canonical = canonicalReflectionIndexLegacy(
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

function prepareObjectObservations(reflections) {
    const count = reflections.length;
    const h = new Int32Array(count);
    const k = new Int32Array(count);
    const l = new Int32Array(count);
    const intensity = new Float64Array(count);
    const sigma = new Float64Array(count);
    const sourceIndex = new Uint32Array(count);
    for (let index = 0; index < count; index++) {
        const reflection = reflections[index];
        h[index] = reflection.h;
        k[index] = reflection.k;
        l[index] = reflection.l;
        intensity[index] = reflection.intensity;
        sigma[index] = reflection.sigma === null || reflection.sigma === undefined
            ? Number.NaN
            : reflection.sigma;
        sourceIndex[index] = reflection.sourceIndex ?? index;
    }
    return preparedObservations(h, k, l, intensity, sigma, sourceIndex, 0, count);
}

function keyEncoder(minH, maxH, minK, maxK, minL, maxL) {
    const widthK = maxK - minK + 1;
    const widthL = maxL - minL + 1;
    const span = (maxH - minH + 1) * widthK * widthL;
    if (Number.isSafeInteger(span)) {
        return (h, k, l) => ((h - minH) * widthK + (k - minK)) * widthL + (l - minL);
    }
    return (h, k, l) => `${h},${k},${l}`;
}

function observationKeyEncoder(observations) {
    let minH = Infinity;
    let maxH = -Infinity;
    let minK = Infinity;
    let maxK = -Infinity;
    let minL = Infinity;
    let maxL = -Infinity;
    for (let index = 0; index < observations.count; index++) {
        minH = Math.min(minH, observations.h[index]);
        maxH = Math.max(maxH, observations.h[index]);
        minK = Math.min(minK, observations.k[index]);
        maxK = Math.max(maxK, observations.k[index]);
        minL = Math.min(minL, observations.l[index]);
        maxL = Math.max(maxL, observations.l[index]);
    }
    return observations.count === 0 ? () => 0 : keyEncoder(minH, maxH, minK, maxK, minL, maxL);
}

function compareMergedReflections(first, second) {
    return first.h - second.h || first.k - second.k || first.l - second.l;
}

/**
 * Typed, allocation-conscious reflection merge implementation. Its output is
 * deliberately identical to the legacy object/orbit implementation.
 * @param {object[]|object} input - Object rows or typed structure-of-arrays.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging and diagnostic options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensitiesPrepared(input, symmetry, options = {}) {
    const debug = options.debug === true;
    const diagnostics = debug ? options.diagnostics ?? emptyReflectionDiagnostics() : null;
    const observations = input?.h instanceof Int32Array ? input : prepareObjectObservations(input);
    const mergeFriedel = options.mergeFriedel !== false;
    const removeSystematicAbsences = options.removeSystematicAbsences !== false;
    const count = observations.count;
    const rawKey = observationKeyEncoder(observations);
    const absentFlags = new Uint8Array(count);
    const absenceCache = new Map();
    let systematicAbsenceCount = 0;

    const symmetryStarted = debug ? now() : 0;
    const symmetryKernel = compiledReciprocalSymmetryKernel(symmetry);
    if (debug) {
        diagnostics.reflectionSymmetrySetupMs += now() - symmetryStarted;
        diagnostics.symmetryOperationCount = symmetryKernel.operationCount;
    }

    const absenceStarted = debug ? now() : 0;
    for (let index = 0; index < count; index++) {
        const h = observations.h[index];
        const k = observations.k[index];
        const l = observations.l[index];
        const key = rawKey(h, k, l);
        let absent = absenceCache.get(key);
        if (absent === undefined) {
            absent = removeSystematicAbsences && isSystematicAbsence(
                h, k, l, symmetry, options.absenceTolerance,
            );
            absenceCache.set(key, absent);
            if (debug) {
                diagnostics.absenceCacheMissCount++;
            }
        } else if (debug) {
            diagnostics.absenceCacheHitCount++;
        }
        if (absent) {
            absentFlags[index] = 1;
            systematicAbsenceCount++;
        }
    }
    if (debug) {
        diagnostics.reflectionAbsenceMs += now() - absenceStarted;
    }

    const canonicalH = new Int32Array(count);
    const canonicalK = new Int32Array(count);
    const canonicalL = new Int32Array(count);
    const canonicalCache = new Map();
    let minH = Infinity;
    let maxH = -Infinity;
    let minK = Infinity;
    let maxK = -Infinity;
    let minL = Infinity;
    let maxL = -Infinity;
    const canonicalStarted = debug ? now() : 0;
    for (let index = 0; index < count; index++) {
        if (absentFlags[index]) {
            continue;
        }
        const h = observations.h[index];
        const k = observations.k[index];
        const l = observations.l[index];
        const key = rawKey(h, k, l);
        let canonical = canonicalCache.get(key);
        if (canonical === undefined) {
            canonical = canonicalReflectionIndex(h, k, l, symmetry, mergeFriedel);
            canonicalCache.set(key, canonical);
            if (debug) {
                diagnostics.canonicalCacheMissCount++;
            }
        } else if (debug) {
            diagnostics.canonicalCacheHitCount++;
        }
        const [resultH, resultK, resultL] = canonical;
        canonicalH[index] = resultH;
        canonicalK[index] = resultK;
        canonicalL[index] = resultL;
        minH = Math.min(minH, resultH);
        maxH = Math.max(maxH, resultH);
        minK = Math.min(minK, resultK);
        maxK = Math.max(maxK, resultK);
        minL = Math.min(minL, resultL);
        maxL = Math.max(maxL, resultL);
    }
    if (debug) {
        diagnostics.reflectionCanonicalizationMs += now() - canonicalStarted;
    }

    const canonicalKey = canonicalCache.size === 0
        ? () => 0
        : keyEncoder(minH, maxH, minK, maxK, minL, maxL);
    const groups = new Map();
    const accumulationStarted = debug ? now() : 0;
    for (let index = 0; index < count; index++) {
        if (absentFlags[index]) {
            continue;
        }
        const h = canonicalH[index];
        const k = canonicalK[index];
        const l = canonicalL[index];
        const key = canonicalKey(h, k, l);
        let group = groups.get(key);
        if (group === undefined) {
            group = {
                h, k, l, count: 0,
                allPositiveSigma: true,
                allSigmaPresent: true,
                intensitySum: 0,
                sigmaSquaredSum: 0,
                weightSum: 0,
                weightedIntensitySum: 0,
            };
            groups.set(key, group);
        }
        const intensity = observations.intensity[index];
        const sigma = observations.sigma[index];
        group.count++;
        group.intensitySum += intensity;
        if (Number.isNaN(sigma)) {
            group.allPositiveSigma = false;
            group.allSigmaPresent = false;
        } else {
            group.sigmaSquaredSum += sigma ** 2;
            if (sigma > 0) {
                const weight = 1 / sigma ** 2;
                group.weightSum += weight;
                group.weightedIntensitySum += intensity / sigma ** 2;
            } else {
                group.allPositiveSigma = false;
            }
        }
    }
    if (debug) {
        diagnostics.reflectionMergeAccumulationMs += now() - accumulationStarted;
    }

    const finalizationStarted = debug ? now() : 0;
    const reflections = new Array(groups.size);
    let outputIndex = 0;
    for (const group of groups.values()) {
        reflections[outputIndex++] = {
            h: group.h,
            k: group.k,
            l: group.l,
            intensity: group.allPositiveSigma
                ? group.weightedIntensitySum / group.weightSum
                : group.intensitySum / group.count,
            sigma: group.allPositiveSigma
                ? Math.sqrt(1 / group.weightSum)
                : group.allSigmaPresent ? Math.sqrt(group.sigmaSquaredSum) / group.count : null,
            multiplicity: group.count,
        };
    }
    if (debug) {
        diagnostics.reflectionMergeFinalizationMs += now() - finalizationStarted;
    }
    const sortStarted = debug ? now() : 0;
    reflections.sort(compareMergedReflections);
    if (debug) {
        diagnostics.reflectionMergeSortMs += now() - sortStarted;
        diagnostics.distinctInputHklCount = absenceCache.size;
        diagnostics.systematicAbsenceCount = systematicAbsenceCount;
        diagnostics.mergedReflectionCount = reflections.length;
    }
    return {
        reflections,
        systematicAbsenceCount,
        ...(debug ? { diagnostics } : {}),
    };
}

/**
 * Selects the production prepared merger, with a legacy validation backend.
 * @param {object[]|object} reflections - Object rows or typed observations.
 * @param {CellSymmetry} symmetry - Full space-group operations.
 * @param {object} options - Merging options.
 * @returns {{reflections:object[], systematicAbsenceCount:number}} Merge result.
 */
export function mergeReflectionIntensities(reflections, symmetry, options = {}) {
    if (options.mergeBackend === 'legacy') {
        const input = reflections?.h instanceof Int32Array
            ? materializeObservations(reflections)
            : reflections;
        return mergeReflectionIntensitiesLegacy(input, symmetry, options);
    }
    return mergeReflectionIntensitiesPrepared(reflections, symmetry, options);
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
    const debug = options.debug === true;
    const preparationStarted = debug ? now() : 0;
    const diagnostics = debug ? emptyReflectionDiagnostics() : null;
    const sourceParseStarted = debug ? now() : 0;
    const cif = new CIF(cifText);
    const selectedBlock = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const blocks = blockOrder(cif, selectedBlock);
    const resolvedInputMode = options.resolveDifferenceDensityInputMode === true
        ? resolvedDifferenceDensityInputMode(selectedBlock, options)
        : null;
    if (debug) {
        diagnostics.reflectionSourceParseMs += now() - sourceParseStarted;
    }
    const requestedSource = options.source ?? 'auto';
    const allowSource = source => requestedSource === 'auto' || requestedSource === source;
    const mergedResult = (candidate, parsed) => {
        const reflections = materializeObservations(parsed, true);
        if (debug) {
            diagnostics.rawReflectionCount = parsed.rawCount;
            diagnostics.validReflectionCount = parsed.count;
            diagnostics.invalidReflectionCount = parsed.invalidCount;
            diagnostics.distinctInputHklCount = new Set(
                reflections.map(reflection => `${reflection.h},${reflection.k},${reflection.l}`),
            ).size;
            diagnostics.mergedReflectionCount = reflections.length;
            diagnostics.reflectionPreparationTotalMs = now() - preparationStarted;
        }
        return {
            reflections,
            metadata: {
                source: candidate.source,
                valueKind: parsed.valueKind,
                alreadyMerged: true,
                inputCount: parsed.rawCount,
                outputCount: parsed.count,
                invalidCount: parsed.invalidCount,
                systematicAbsenceCount: 0,
                mergeFriedel: null,
                ...(resolvedInputMode ? {
                    resolvedDifferenceDensityInputMode: resolvedInputMode,
                } : {}),
            },
            ...(debug ? { diagnostics } : {}),
        };
    };

    const discoveryStarted = debug ? now() : 0;
    if (allowSource('refln')) {
        const directCandidates = blocks.map(block => optionalLoop(block, '_refln'))
            .filter(Boolean).map(loop => ({
                loop,
                source: 'refln',
            }));
        if (debug) {
            diagnostics.reflectionSourceDiscoveryMs += now() - discoveryStarted;
        }
        let unsupportedError = null;
        for (let candidateGroup = 0; candidateGroup < 2; candidateGroup++) {
            let candidates = directCandidates;
            if (candidateGroup === 1) {
                const embeddedDiscoveryStarted = debug ? now() : 0;
                candidates = blocks.flatMap(embeddedReflectionLoops).map(loop => ({
                    loop,
                    source: 'embedded-refln',
                }));
                if (debug) {
                    diagnostics.reflectionSourceDiscoveryMs += now() - embeddedDiscoveryStarted;
                }
            }
            for (const candidate of candidates) {
                try {
                    const decodeStarted = debug ? now() : 0;
                    const parsed = mergedLoopRows(candidate.loop);
                    if (debug) {
                        diagnostics.reflectionRowDecodeMs += now() - decodeStarted;
                    }
                    return mergedResult(candidate, parsed);
                } catch (error) {
                    if (!error.message.includes('contains no measured')) {
                        throw error;
                    }
                    unsupportedError = error;
                }
            }
        }
        if (requestedSource === 'refln' && unsupportedError) {
            throw unsupportedError;
        }
    } else if (debug) {
        diagnostics.reflectionSourceDiscoveryMs += now() - discoveryStarted;
    }

    let parsed;
    let source;
    const rawDiscoveryStarted = debug ? now() : 0;
    if (allowSource('diffrn_refln')) {
        const loop = blocks.map(block => optionalLoop(block, '_diffrn_refln')).find(Boolean);
        if (loop) {
            const decodeStarted = debug ? now() : 0;
            parsed = unmergedLoopRows(loop);
            if (debug) {
                diagnostics.reflectionRowDecodeMs += now() - decodeStarted;
            }
            source = 'diffrn_refln';
        }
    }
    if (!parsed && allowSource('shelx_hkl_file')) {
        const extractionStarted = debug ? now() : 0;
        const text = blocks.map(shelxHklText).find(value => typeof value === 'string');
        if (debug) {
            diagnostics.shelxContainerExtractionMs += now() - extractionStarted;
        }
        if (text) {
            const decodeStarted = debug ? now() : 0;
            parsed = parseShelxHkl(text, diagnostics);
            if (debug) {
                diagnostics.reflectionRowDecodeMs += now() - decodeStarted;
            }
            source = 'shelx_hkl_file';
        }
    }
    if (debug) {
        diagnostics.reflectionSourceDiscoveryMs += now() - rawDiscoveryStarted;
    }
    if (!parsed) {
        throw new Error(`No usable reflection intensities found for source "${requestedSource}"`);
    }

    const symmetryStarted = debug ? now() : 0;
    const symmetry = CellSymmetry.fromCIF(selectedBlock);
    if (debug) {
        diagnostics.reflectionSymmetrySetupMs += now() - symmetryStarted;
    }
    const merged = mergeReflectionIntensities(parsed, symmetry, {
        ...options,
        ...(debug ? { diagnostics } : {}),
    });
    if (debug) {
        diagnostics.rawReflectionCount = parsed.rawCount;
        diagnostics.validReflectionCount = parsed.count;
        diagnostics.invalidReflectionCount = parsed.invalidCount;
        diagnostics.systematicAbsenceCount = merged.systematicAbsenceCount;
        diagnostics.mergedReflectionCount = merged.reflections.length;
        diagnostics.reflectionPreparationTotalMs = now() - preparationStarted;
    }
    return {
        reflections: merged.reflections,
        metadata: {
            source,
            valueKind: 'intensity',
            alreadyMerged: false,
            inputCount: parsed.rawCount,
            outputCount: merged.reflections.length,
            invalidCount: parsed.invalidCount,
            systematicAbsenceCount: merged.systematicAbsenceCount,
            mergeFriedel: options.mergeFriedel !== false,
            ...(resolvedInputMode ? {
                resolvedDifferenceDensityInputMode: resolvedInputMode,
            } : {}),
        },
        ...(debug ? { diagnostics } : {}),
    };
}
