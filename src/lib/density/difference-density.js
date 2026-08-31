import { CIF } from '../read-cif/base.js';
import { UnitCell } from '../structure/crystal.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import * as math from '../math-lite.js';
import { createAnomalousDispersionCorrection } from './anomalous-dispersion.js';
import { createIAMStructureFactorCalculator } from './iam-structure-factors.js';
import { readReflectionIntensities } from './reflection-intensities.js';
import { createShelxlExtinctionCorrection } from './extinction-correction.js';
import { multiplyReflectionIndex, reciprocalSymmetryKernel } from './reciprocal-symmetry.js';
import { ScalarFieldGrid } from './scalar-field.js';
import { finiteNumber, loopColumn, optionalLoop } from './cif-values.js';
import { planFourierDimensions } from './fft-grid.js';
import { assertCellsMatch } from './cell-matching.js';
import {
    factorization235,
    fftLineWorkBytes,
    getFftPlan,
    mixedRadixFftLine,
    radix2FftLine,
    transformComplexAxis,
} from './fft.js';

const TWO_PI = 2 * Math.PI;
const now = () => globalThis.performance?.now?.() ?? Date.now();

/** Signals that a CIF block does not advertise explicit Fourier coefficients. */
class UnsupportedCoefficientSourceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnsupportedCoefficientSourceError';
    }
}

/** @returns {number} Index wrapped into a periodic array. */
function wrapIndex(value, size) {
    return ((value % size) + size) % size;
}

/** @returns {Array|null} First matching reflection-loop column. */
function reflectionColumn(loop, names, ...fallback) {
    try {
        return loop.get(names);
    } catch (error) {
        if (fallback.length > 0) {
            return fallback[0];
        }
        throw error;
    }
}

/** Ensures all required reflection columns contain the same row count. */
function assertSameLength(columns) {
    const lengths = columns.map(column => column.length);
    if (lengths.some(length => length !== lengths[0])) {
        throw new Error(`Reflection columns have inconsistent lengths: ${lengths.join(', ')}`);
    }
}

/** @returns {string[]} One or two explicitly named coefficient columns. */
function coefficientColumnNames(value, label) {
    const columns = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(columns) || columns.length < 1 || columns.length > 2 ||
        columns.some(column => typeof column !== 'string' || column.length === 0)) {
        throw new Error(`${label} must name one or two CIF columns`);
    }
    return columns;
}

/** @returns {Array[]} Values for explicitly named columns. */
function customColumns(loop, value, label) {
    return coefficientColumnNames(value, label).map(column => {
        try {
            return loop.get(column);
        } catch {
            throw new Error(`Custom density column not found: ${column}`);
        }
    });
}

/** @returns {object} Custom complex-coefficient reader and its source metadata. */
function customCoefficientReader(loop, columns) {
    const amplitudeNames = columns.amplitudes ?? columns.amplitudeColumns ?? columns.amplitude;
    const phaseNames = columns.phases ?? columns.phaseColumns ?? columns.phase;
    const aNames = columns.aValues ?? columns.a ?? columns.A;
    const bNames = columns.bValues ?? columns.b ?? columns.B;
    const hasAmplitudePhase = amplitudeNames !== undefined || phaseNames !== undefined;
    const hasAB = aNames !== undefined || bNames !== undefined;
    if (hasAmplitudePhase === hasAB) {
        throw new Error(
            'Custom density columns must specify either amplitudes/phases or A/B values',
        );
    }

    if (hasAB) {
        if (aNames === undefined || bNames === undefined) {
            throw new Error('Custom density A and B columns must both be specified');
        }
        const aValues = customColumns(loop, aNames, 'a');
        const bValues = customColumns(loop, bNames, 'b');
        if (aValues.length !== bValues.length) {
            throw new Error('Custom density A and B column counts must match');
        }
        assertSameLength([...aValues, ...bValues]);
        return {
            mode: aValues.length === 1 ? 'a-b' : 'a-b-difference',
            componentCount: aValues.length,
            valueColumns: [...aValues, ...bValues],
            coefficientAt(index) {
                const real = Number(aValues[0][index]) -
                    (aValues[1] ? Number(aValues[1][index]) : 0);
                const imaginary = Number(bValues[0][index]) -
                    (bValues[1] ? Number(bValues[1][index]) : 0);
                return { real, imaginary };
            },
        };
    }

    if (amplitudeNames === undefined || phaseNames === undefined) {
        throw new Error('Custom density amplitude and phase columns must both be specified');
    }
    const amplitudes = customColumns(loop, amplitudeNames, 'amplitudes');
    const phases = customColumns(loop, phaseNames, 'phases');
    if (phases.length !== 1 && phases.length !== amplitudes.length) {
        throw new Error('Use one common phase column or one phase column per amplitude');
    }
    assertSameLength([...amplitudes, ...phases]);
    const phaseScale = columns.phaseUnit === 'radians' ? 1 : Math.PI / 180;
    if (columns.phaseUnit !== undefined && !['degrees', 'radians'].includes(columns.phaseUnit)) {
        throw new Error('Custom density phaseUnit must be "degrees" or "radians"');
    }
    const splitPhases = phases.length === amplitudes.length && phases.length === 2;
    return {
        mode: amplitudes.length === 1 ? 'amplitude-phase' :
            splitPhases ? 'split-phase-difference' : 'common-phase-difference',
        componentCount: amplitudes.length,
        valueColumns: [...amplitudes, ...phases],
        coefficientAt(index) {
            if (!splitPhases) {
                const amplitude = Number(amplitudes[0][index]) -
                    (amplitudes[1] ? Number(amplitudes[1][index]) : 0);
                const phase = Number(phases[0][index]) * phaseScale;
                return {
                    real: amplitude * Math.cos(phase),
                    imaginary: amplitude * Math.sin(phase),
                };
            }
            const firstPhase = Number(phases[0][index]) * phaseScale;
            const secondPhase = Number(phases[1][index]) * phaseScale;
            return {
                real: Number(amplitudes[0][index]) * Math.cos(firstPhase) -
                    Number(amplitudes[1][index]) * Math.cos(secondPhase),
                imaginary: Number(amplitudes[0][index]) * Math.sin(firstPhase) -
                    Number(amplitudes[1][index]) * Math.sin(secondPhase),
            };
        },
    };
}

/** @returns {string|null} Raw text of a SHELXL solvent-mask FAB correction file. */
function shelxFabText(block) {
    block.parse();
    const key = Object.keys(block.data).find(name => /shelx.*fab_file/i.test(name));
    return key ? block.data[key] : null;
}

/** @returns {object|null} Per-reflection h/k/l and A/B mask corrections. */
function readShelxFabCorrections(block) {
    const text = shelxFabText(block);
    if (typeof text !== 'string') {
        return null;
    }
    const h = [];
    const k = [];
    const l = [];
    const real = [];
    const imaginary = [];
    for (const line of text.split('\n')) {
        const fields = line.trim().split(/\s+/).map(Number);
        if (fields.length < 5 || fields.slice(0, 5).some(value => !Number.isFinite(value)) ||
            !fields.slice(0, 3).every(Number.isInteger)) {
            continue;
        }
        const [hv, kv, lv, a, b] = fields;
        h.push(hv);
        k.push(kv);
        l.push(lv);
        real.push(a);
        imaginary.push(b);
    }
    return h.length > 0 ? { h, k, l, real, imaginary } : null;
}

/** @returns {object|null} Summary of smtbx/PLATON-style solvent-mask voids. */
function readSolventMaskVoidSummary(block) {
    const loop = optionalLoop(block, '_smtbx_masks_void');
    const electrons = loopColumn(loop, [
        '_smtbx_masks_void.count_electrons', '_smtbx_masks_void_count_electrons',
    ]);
    if (!electrons) {
        return null;
    }
    const totalElectrons = electrons.reduce((sum, value) => sum + (finiteNumber(value) ?? 0), 0);
    return { voidCount: electrons.length, totalElectrons };
}

/** @returns {number} Sign used to remove anomalous scattering from a selected operand. */
function anomalousCorrectionScale(target, componentCount) {
    const normalized = target ?? 'first';
    if (!['first', 'second', 'both', 'result'].includes(normalized)) {
        throw new Error(
            'Anomalous-dispersion target must be "first", "second", "both", or "result"',
        );
    }
    if (normalized === 'second') {
        if (componentCount < 2) {
            throw new Error('Cannot correct the second operand of a single coefficient set');
        }
        return 1;
    }
    if (normalized === 'both' && componentCount > 1) {
        return 0;
    }
    return -1;
}

/** @returns {string} Reflection-file producer relevant to anomalous correction. */
function reflectionFileGenerator(block, options) {
    if (options.generator !== undefined && options.generator !== 'auto') {
        const generator = String(options.generator).toLowerCase();
        if (!['olex', 'shelxl'].includes(generator)) {
            throw new Error('Anomalous-dispersion generator must be "auto", "olex", or "shelxl"');
        }
        return generator;
    }
    const value = name => {
        try {
            return String(block.get(name, '')).toLowerCase();
        } catch {
            return '';
        }
    };
    const refinement = value('_computing_structure_refinement');
    if (refinement.includes('olex2.refine') || refinement.includes('olex2_refine')) {
        return 'olex';
    }
    if (refinement.includes('shelxl')) {
        return 'shelxl';
    }
    const creation = value('_audit_creation_method');
    if (creation.includes('olex2.refine') || creation.includes('olex2_refine')) {
        return 'olex';
    }
    if (creation.includes('shelxl')) {
        return 'shelxl';
    }
    return 'unknown';
}

/** @returns {object} Centrosymmetric phase-conformance information. */
function centrosymmetricPhaseCheck(symmetry, h, k, l, phases, toleranceDegrees = 0.05) {
    const inversion = symmetry.symmetryOperations.find(operation =>
        operation.rotMatrix.every((row, rowIndex) => row.every((value, columnIndex) =>
            Math.abs(value - (rowIndex === columnIndex ? -1 : 0)) < 1e-8,
        )),
    );
    if (!inversion) {
        return { centrosymmetric: false, available: false };
    }
    if (!phases) {
        return { centrosymmetric: true, available: false };
    }
    let checkedCount = 0;
    let maximumDeviationDegrees = 0;
    for (let index = 0; index < phases.length; index++) {
        const phase = Number(phases[index]);
        const indices = [Number(h[index]), Number(k[index]), Number(l[index])];
        if (![phase, ...indices].every(Number.isFinite)) {
            continue;
        }
        const expected = 180 * (
            indices[0] * inversion.transVector[0] +
            indices[1] * inversion.transVector[1] +
            indices[2] * inversion.transVector[2]
        );
        const deviation = Math.abs(((phase - expected + 90) % 180 + 180) % 180 - 90);
        maximumDeviationDegrees = Math.max(maximumDeviationDegrees, deviation);
        checkedCount++;
    }
    return {
        centrosymmetric: true,
        method: 'inversion-phases',
        available: checkedCount > 0,
        checkedCount,
        toleranceDegrees,
        maximumDeviationDegrees,
        alreadyCorrected: checkedCount > 0 && maximumDeviationDegrees <= toleranceDegrees,
        needsCorrection: checkedCount > 0 && maximumDeviationDegrees > toleranceDegrees,
    };
}

/** @returns {object} Friedel-pair phase-conformance information. */
function friedelPairPhaseCheck(
    h,
    k,
    l,
    phases,
    amplitudes,
    toleranceDegrees = 0.05,
    amplitudeToleranceRelative = 1e-4,
) {
    if (!phases) {
        return { centrosymmetric: false, method: 'friedel-pair-phases', available: false };
    }
    const rows = new Map();
    let maximumAmplitude = 0;
    for (let index = 0; index < phases.length; index++) {
        const indices = [Number(h[index]), Number(k[index]), Number(l[index])];
        const phase = Number(phases[index]);
        const amplitude = amplitudes ? Number(amplitudes[index]) : null;
        if (![...indices, phase].every(Number.isFinite)) {
            continue;
        }
        if (Number.isFinite(amplitude)) {
            maximumAmplitude = Math.max(maximumAmplitude, Math.abs(amplitude));
        }
        rows.set(indices.join(','), { indices, phase, amplitude });
    }
    const visited = new Set();
    let checkedPairCount = 0;
    let maximumDeviationDegrees = 0;
    let maximumAmplitudeDeviationRelative = 0;
    const minimumAmplitude = maximumAmplitude * 1e-4;
    for (const [key, row] of rows) {
        if (visited.has(key) || row.indices.every(value => value === 0)) {
            continue;
        }
        const mateKey = row.indices.map(value => -value).join(',');
        const mate = rows.get(mateKey);
        if (!mate) {
            continue;
        }
        visited.add(key);
        visited.add(mateKey);
        if (maximumAmplitude > 0 &&
            (Math.abs(row.amplitude) < minimumAmplitude ||
                Math.abs(mate.amplitude) < minimumAmplitude)) {
            continue;
        }
        const deviation = Math.abs(((row.phase + mate.phase + 180) % 360 + 360) % 360 - 180);
        maximumDeviationDegrees = Math.max(maximumDeviationDegrees, deviation);
        if (maximumAmplitude > 0 &&
            Number.isFinite(row.amplitude) && Number.isFinite(mate.amplitude)) {
            maximumAmplitudeDeviationRelative = Math.max(
                maximumAmplitudeDeviationRelative,
                Math.abs(Math.abs(row.amplitude) - Math.abs(mate.amplitude)) / maximumAmplitude,
            );
        }
        checkedPairCount++;
    }
    const alreadyCorrected = checkedPairCount > 0 &&
        maximumDeviationDegrees <= toleranceDegrees &&
        maximumAmplitudeDeviationRelative <= amplitudeToleranceRelative;
    return {
        centrosymmetric: false,
        method: 'friedel-pair-phases',
        available: checkedPairCount > 0,
        checkedPairCount,
        toleranceDegrees,
        maximumDeviationDegrees,
        amplitudeToleranceRelative,
        maximumAmplitudeDeviationRelative,
        alreadyCorrected,
        needsCorrection: checkedPairCount > 0 && !alreadyCorrected,
    };
}

/** Accumulates one possibly symmetry-duplicated complex coefficient. */
function addCoefficient(coefficients, h, k, l, real, imaginary) {
    const key = `${h},${k},${l}`;
    const current = coefficients.get(key);
    if (current) {
        current.real += real;
        current.imaginary += imaginary;
        current.count++;
    } else {
        coefficients.set(key, { h, k, l, real, imaginary, count: 1 });
    }
}

/** Accumulates one coefficient in a canonical Friedel half-space. */
function addHermitianCoefficient(coefficients, h, k, l, real, imaginary) {
    const canonical = h > 0 || (h === 0 && (k > 0 || (k === 0 && l >= 0)));
    addCoefficient(
        coefficients,
        canonical ? h : -h,
        canonical ? k : -k,
        canonical ? l : -l,
        real,
        canonical ? imaginary : -imaginary,
    );
}

/** @returns {Map<string, object>} Symmetry- and Friedel-expanded coefficients. */
function expandReflectionCoefficients(
    hValues,
    kValues,
    lValues,
    coefficientAt,
    symmetry,
    omitF000,
    storeHermitian = false,
) {
    const coefficients = new Map();

    for (let i = 0; i < hValues.length; i++) {
        const h = Number(hValues[i]);
        const k = Number(kValues[i]);
        const l = Number(lValues[i]);
        const { real: baseReal, imaginary: baseImaginary } = coefficientAt(i);
        if (![h, k, l, baseReal, baseImaginary].every(Number.isFinite)) {
            continue;
        }

        for (const kernel of reciprocalSymmetryKernel(symmetry)) {
            const operation = kernel.operation;
            const [equivH, equivK, equivL] = multiplyReflectionIndex(
                kernel.reciprocalRotation,
                [h, k, l],
            );
            const phaseShift = TWO_PI * (
                equivH * operation.transVector[0] +
                equivK * operation.transVector[1] +
                equivL * operation.transVector[2]
            );
            const cosShift = Math.cos(phaseShift);
            const sinShift = Math.sin(phaseShift);
            const real = baseReal * cosShift - baseImaginary * sinShift;
            const imaginary = baseReal * sinShift + baseImaginary * cosShift;

            if (storeHermitian) {
                addHermitianCoefficient(coefficients, equivH, equivK, equivL, real, imaginary);
            } else {
                addCoefficient(coefficients, equivH, equivK, equivL, real, imaginary);
            }
            if (!storeHermitian && (equivH !== 0 || equivK !== 0 || equivL !== 0)) {
                addCoefficient(coefficients, -equivH, -equivK, -equivL, real, -imaginary);
            }
        }
    }

    if (omitF000) {
        coefficients.delete('0,0,0');
    }
    for (const coefficient of coefficients.values()) {
        coefficient.real /= coefficient.count;
        coefficient.imaginary /= coefficient.count;
    }
    return coefficients;
}

/** @returns {object} Dataset with reciprocal lengths and common metadata. */
function finalizeDifferenceDensityDataset(dataset, symmetry) {
    if (dataset.coefficients.size === 0) {
        throw new Error('Reflection source contains no usable difference-map coefficients');
    }
    const reciprocalTransform = math.transpose(math.inv(dataset.cell.fractToCartMatrix));
    let maximumReciprocalLength = 0;
    for (const coefficient of dataset.coefficients.values()) {
        const reciprocal = math.multiply(
            reciprocalTransform,
            [coefficient.h, coefficient.k, coefficient.l],
        );
        coefficient.reciprocalLength = math.norm(reciprocal);
        maximumReciprocalLength = Math.max(maximumReciprocalLength, coefficient.reciprocalLength);
    }
    return {
        ...dataset,
        maximumReciprocalLength,
        symmetryOperations: symmetry.symmetryOperations.map(operation => ({
            rotation: operation.rotMatrix.map(row => [...row]),
            translation: [...operation.transVector],
        })),
    };
}

/** @returns {object} Positive scale fit and fit diagnostics. */
function fitObservedIntensityScale(
    observations,
    calculated,
    configuredScale,
    extinctionFactors,
) {
    const explicit = Number(configuredScale);
    if (Number.isFinite(explicit) && explicit > 0) {
        return { scale: explicit, fittedReflectionCount: 0, explicit: true };
    }
    let numerator = 0;
    let denominator = 0;
    let fittedReflectionCount = 0;
    for (let index = 0; index < observations.length; index++) {
        const observation = observations[index];
        const calculatedSquared = calculated.fSquared[index] * extinctionFactors[index] ** 2;
        if (!(observation.intensity > 0 && calculatedSquared > 0)) {
            continue;
        }
        const weight = observation.sigma > 0 ? 1 / observation.sigma ** 2 : 1;
        numerator += weight * observation.intensity * calculatedSquared;
        denominator += weight * observation.intensity ** 2;
        fittedReflectionCount++;
    }
    const scale = numerator / denominator;
    if (!(Number.isFinite(scale) && scale > 0 && fittedReflectionCount > 0)) {
        throw new Error('Could not fit a positive intensity scale against the IAM calculation');
    }
    return { scale, fittedReflectionCount, explicit: false };
}

/**
 * Creates Fo-Fc coefficients from any supported observed-reflection source and
 * an IAM calculation from the coordinate CIF.
 * @param {string} cifText - CIF containing the observed reflections.
 * @param {number|string} cifBlock - Reflection cell/symmetry block.
 * @param {object} options - IAM, reflection-reading, and scale options.
 * @returns {object} Difference-density dataset.
 */
export function createCifDifferenceDensityDataset(cifText, cifBlock = 0, options = {}) {
    const debugTimings = options.debugTimings === true;
    const datasetStarted = debugTimings ? now() : null;
    let stageStarted = datasetStarted;
    const stageTime = () => {
        if (!debugTimings) {
            return null;
        }
        const completed = now();
        const elapsed = completed - stageStarted;
        stageStarted = completed;
        return elapsed;
    };
    const cif = new CIF(cifText);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const datasetSourceSetupMs = stageTime();
    const coordinateCifText = options.coordinateCifText ?? cifText;
    const coordinateCifBlock = options.coordinateCifBlock ?? cifBlock;
    const coordinateCif = coordinateCifText === cifText ? cif : new CIF(coordinateCifText);
    const coordinateBlock = typeof coordinateCifBlock === 'number'
        ? coordinateCif.getBlock(coordinateCifBlock)
        : coordinateCif.getBlockByName(coordinateCifBlock);
    const datasetCoordinateSetupMs = stageTime();
    let cell;
    let cellSource = 'reflection';
    try {
        cell = UnitCell.fromCIF(block);
    } catch (reflectionCellError) {
        if (!/Unit cell parameter entries missing in CIF/.test(reflectionCellError.message)) {
            throw reflectionCellError;
        }
        if (coordinateCifText === cifText && coordinateCifBlock === cifBlock) {
            throw new Error(
                'Reflection CIF does not contain a complete unit cell and no separate coordinate CIF ' +
                `was supplied: ${reflectionCellError.message}`,
                { cause: reflectionCellError },
            );
        }
        try {
            cell = UnitCell.fromCIF(coordinateBlock);
            cellSource = 'coordinate-fallback';
        } catch (coordinateCellError) {
            throw new Error(
                'Reflection CIF does not contain a complete unit cell and the coordinate CIF fallback ' +
                `could not provide one: ${coordinateCellError.message}`,
                { cause: coordinateCellError },
            );
        }
    }
    const symmetry = CellSymmetry.fromCIF(block);
    const datasetCellSymmetrySetupMs = stageTime();
    // Difference-electron densities default to normal scattering. If anomalous
    // IAM terms are explicitly requested, retain unmerged Friedel observations
    // unless the caller deliberately selects another policy.
    const iamOptions = { includeAnomalous: false, ...options.iam };
    const reflectionOptions = { ...options.reflections };
    if (reflectionOptions.mergeFriedel === undefined) {
        reflectionOptions.mergeFriedel = iamOptions.includeAnomalous === false;
    }
    // A worker may parse and symmetry-merge the reflection loop before the
    // coordinate model is available. Keep that prepared value internal to the
    // worker pipeline; ordinary callers retain the single-stage API.
    const observed = options.preparedObservations ??
        readReflectionIntensities(cifText, cifBlock, reflectionOptions);
    if (observed.reflections.length === 0) {
        throw new Error(
            'Difference density was not created because the reflection source contains no usable ' +
            'observed intensities. Check the reflection value/sigma columns and missing-value markers.',
        );
    }
    const datasetObservationSetupMs = stageTime();
    const iamModelStarted = now();
    const calculator = createIAMStructureFactorCalculator(
        coordinateCifText,
        coordinateCifBlock,
        { ...iamOptions, expectedCell: cell, structureModel: options.structureModel },
    );
    const iamModelBuildTimeMs = now() - iamModelStarted;
    const datasetIamModelBuildMs = stageTime();
    const iamCalculationStarted = now();
    const calculated = calculator.calculatePrepared(observed.reflections);
    if (calculated.diagnostics.expandedAtomCount === 0) {
        throw new Error(
            'Difference density was not created because the coordinate CIF contains no usable atom sites ' +
            'for the IAM structure-factor calculation.',
        );
    }
    const iamCalculationTimeMs = now() - iamCalculationStarted;
    const datasetFcalcMs = stageTime();
    const requestedSolventMask = options.solventMaskCorrection ?? 'auto';
    if (![true, false, 'auto'].includes(requestedSolventMask)) {
        throw new Error('solventMaskCorrection must be "auto", true, or false');
    }
    const fab = requestedSolventMask !== false ? readShelxFabCorrections(coordinateBlock) : null;
    const datasetSolventMaskDiscoveryDecodeMs = stageTime();
    let maskCorrectedCalculated = calculated;
    let solventMaskAppliedCount = 0;
    let datasetSolventMaskSymmetryExpansionMs = 0;
    let datasetSolventMaskCopyApplicationMs = 0;
    if (fab) {
        const maskCoefficients = expandReflectionCoefficients(
            fab.h,
            fab.k,
            fab.l,
            i => ({ real: fab.real[i], imaginary: fab.imaginary[i] }),
            symmetry,
            false,
        );
        const maskExpansionCompletedMs = stageTime();
        maskCorrectedCalculated = {
            ...calculated,
            real: calculated.real.slice(),
            imaginary: calculated.imaginary.slice(),
            fSquared: calculated.fSquared.slice(),
        };
        for (let index = 0; index < observed.reflections.length; index++) {
            const observation = observed.reflections[index];
            const correction = maskCoefficients.get(
                `${observation.h},${observation.k},${observation.l}`,
            );
            if (!correction) {
                continue;
            }
            solventMaskAppliedCount++;
            const real = calculated.real[index] + correction.real;
            const imaginary = calculated.imaginary[index] + correction.imaginary;
            maskCorrectedCalculated.real[index] = real;
            maskCorrectedCalculated.imaginary[index] = imaginary;
            maskCorrectedCalculated.fSquared[index] = real ** 2 + imaginary ** 2;
        }
        datasetSolventMaskSymmetryExpansionMs = maskExpansionCompletedMs;
        datasetSolventMaskCopyApplicationMs = stageTime();
    } else if (requestedSolventMask === true) {
        throw new Error('solventMaskCorrection was requested but no _shelx_fab_file was found');
    }
    const solventMaskCorrection = {
        enabled: Boolean(fab),
        requested: requestedSolventMask,
        source: 'shelx-fab-file',
        fabReflectionCount: fab?.h.length ?? 0,
        appliedReflectionCount: solventMaskAppliedCount,
        ...readSolventMaskVoidSummary(coordinateBlock),
    };
    const datasetSolventMaskMetadataMs = stageTime();
    const requestedExtinction = options.extinctionCorrection ?? 'auto';
    if (!['auto', true, false].includes(requestedExtinction) &&
        typeof requestedExtinction !== 'number' &&
        (typeof requestedExtinction !== 'object' || requestedExtinction === null ||
            Array.isArray(requestedExtinction))) {
        throw new Error(
            'extinctionCorrection must be "auto", true, false, a coefficient, or an object',
        );
    }
    const embeddedFcfAlreadyCorrected = requestedExtinction === 'auto' &&
        observed.metadata.source === 'embedded-refln';
    const extinction = createShelxlExtinctionCorrection(
        coordinateBlock,
        cell,
        calculator.metadata.wavelength,
        observed.reflections,
        maskCorrectedCalculated,
        embeddedFcfAlreadyCorrected ? false :
            requestedExtinction === 'auto' ? true : requestedExtinction,
    );
    if (embeddedFcfAlreadyCorrected) {
        extinction.metadata.reason = 'embedded-fcf-already-corrected';
    }
    const datasetExtinctionMs = stageTime();
    const fitted = fitObservedIntensityScale(
        observed.reflections,
        maskCorrectedCalculated,
        options.intensityScale,
        extinction.factors,
    );
    const datasetScaleFitMs = stageTime();
    let negativeIntensityCount = 0;
    let scaleResidualNumerator = 0;
    let scaleResidualDenominator = 0;
    const coefficientAt = index => {
        const observation = observed.reflections[index];
        const calculatedReal = maskCorrectedCalculated.real[index];
        const calculatedImaginary = maskCorrectedCalculated.imaginary[index];
        const calculatedSquared = maskCorrectedCalculated.fSquared[index];
        const calculatedAmplitude = Math.sqrt(calculatedSquared);
        const scaledIntensity = fitted.scale * observation.intensity /
            extinction.factors[index] ** 2;
        if (scaledIntensity < 0) {
            negativeIntensityCount++;
        }
        const observedAmplitude = Math.sqrt(Math.max(0, scaledIntensity));
        const differenceAmplitude = observedAmplitude - calculatedAmplitude;
        scaleResidualNumerator += Math.abs(scaledIntensity - calculatedSquared);
        scaleResidualDenominator += calculatedSquared;
        if (calculatedAmplitude === 0) {
            return { real: differenceAmplitude, imaginary: 0 };
        }
        return {
            real: differenceAmplitude * calculatedReal / calculatedAmplitude,
            imaginary: differenceAmplitude * calculatedImaginary / calculatedAmplitude,
        };
    };
    const h = observed.reflections.map(reflection => reflection.h);
    const k = observed.reflections.map(reflection => reflection.k);
    const l = observed.reflections.map(reflection => reflection.l);
    const datasetCoefficientInputSetupMs = stageTime();
    const coefficients = expandReflectionCoefficients(h, k, l, coefficientAt, symmetry, true, true);
    const datasetCoefficientExpansionMs = stageTime();
    const datasetPreparationTimings = debugTimings ? {
        datasetSourceSetupMs,
        datasetCellSymmetrySetupMs,
        datasetObservationSetupMs,
        datasetIamModelBuildMs,
        datasetFcalcMs,
        datasetCoordinateSetupMs,
        datasetSolventMaskDiscoveryDecodeMs,
        datasetSolventMaskSymmetryExpansionMs,
        datasetSolventMaskCopyApplicationMs,
        datasetSolventMaskMetadataMs,
        datasetExtinctionMs,
        datasetScaleFitMs,
        datasetCoefficientInputSetupMs,
        datasetCoefficientExpansionMs,
    } : undefined;
    const result = finalizeDifferenceDensityDataset({
        cell,
        coefficients,
        reflectionCount: observed.reflections.length,
        coefficientMode: 'fo-fc-iam-phase',
        omitF000: true,
        anomalousDispersion: {
            enabled: calculator.metadata.includeAnomalous,
            target: 'both',
            source: 'iam',
        },
        sourceType: 'cif-iam',
        cellSource,
        fieldKind: 'difference-density',
        intensityScale: fitted.scale,
        intensityScaleExplicit: fitted.explicit,
        scaleFittedReflectionCount: fitted.fittedReflectionCount,
        scaleR1: scaleResidualDenominator > 0
            ? scaleResidualNumerator / scaleResidualDenominator
            : null,
        negativeIntensityCount,
        observations: observed.metadata,
        iam: {
            ...calculator.metadata,
            modelBuildTimeMs: iamModelBuildTimeMs,
            calculation: {
                ...calculated.diagnostics,
                timeMs: iamCalculationTimeMs,
            },
        },
        solventMaskCorrection,
        datasetPreparationTimings,
        reflectionPolicy: {
            mergeFriedel: observed.metadata.mergeFriedel,
            includeAnomalous: calculator.metadata.includeAnomalous,
        },
        extinctionCorrection: extinction.metadata,
        friedelImplicit: true,
    }, symmetry);
    if (debugTimings) {
        result.datasetPreparationTimings.datasetFinalizationMs = stageTime();
        result.datasetPreparationTimings.datasetInstrumentedTotalMs =
            now() - datasetStarted;
    }
    return result;
}

/** @returns {object|null} Self-described cifvis custom coefficient columns. */
function selfDescribedCoefficientColumns(text, blockSelector) {
    try {
        const cif = new CIF(text);
        const block = typeof blockSelector === 'number'
            ? cif.getBlock(blockSelector)
            : cif.getBlockByName(blockSelector);
        const value = name => block.get(name, null);
        const loop = value('_cifvis_difference_density_loop');
        const h = value('_cifvis_difference_density_h');
        const k = value('_cifvis_difference_density_k');
        const l = value('_cifvis_difference_density_l');
        const a = value('_cifvis_difference_density_a');
        const b = value('_cifvis_difference_density_b');
        if ([loop, h, k, l, a, b].every(item => typeof item === 'string' && item.length > 0)) {
            return {
                loop,
                h,
                k,
                l,
                a,
                b,
                omitF000: false,
                fieldKind: 'deformation-density',
            };
        }
    } catch {
        // Ordinary CIFs have no cifvis self-description; use normal source detection.
    }
    return null;
}

/**
 * Parses an explicit FCF coefficient source or falls back to CIF observations
 * plus IAM Fcalc when no usable coefficient loop exists.
 * @param {string} text - FCF or coordinate/reflection CIF text.
 * @param {number|string} block - CIF block.
 * @param {object} options - Source selection and parser options.
 * @returns {object} Difference-density dataset.
 */
export function parseDifferenceDensitySource(text, block = 0, options = {}) {
    const debugTimings = options.debugTimings === true;
    const sourceDispatchStarted = debugTimings ? now() : null;
    const inputMode = options.inputMode ?? 'auto';
    if (!['auto', 'fcf', 'cif-iam'].includes(inputMode)) {
        throw new Error('Difference-density inputMode must be "auto", "fcf", or "cif-iam"');
    }
    if (options.preparedSource?.mode === 'cif-iam') {
        const dataset = createCifDifferenceDensityDataset(text, block, {
            ...options,
            preparedObservations: options.preparedSource.observations,
        });
        if (debugTimings) {
            Object.assign(dataset.datasetPreparationTimings, {
                datasetSelfDescriptionDetectionMs: 0,
                datasetExplicitCoefficientAttemptMs: 0,
                datasetSourceDispatchTotalMs: now() - sourceDispatchStarted,
            });
        }
        return dataset;
    }
    const coefficientColumns = options.coefficientColumns ??
        selfDescribedCoefficientColumns(text, block);
    const datasetSelfDescriptionDetectionMs = debugTimings
        ? now() - sourceDispatchStarted
        : null;
    let datasetExplicitCoefficientAttemptMs = 0;
    if (inputMode !== 'cif-iam') {
        const coefficientAttemptStarted = debugTimings ? now() : null;
        try {
            return parseDifferenceDensityDataset(
                text,
                block,
                coefficientColumns,
                options.anomalousDispersion ?? null,
                options,
            );
        } catch (error) {
            if (debugTimings) {
                datasetExplicitCoefficientAttemptMs = now() - coefficientAttemptStarted;
            }
            if (
                inputMode === 'fcf' || coefficientColumns ||
                !(error instanceof UnsupportedCoefficientSourceError)
            ) {
                throw error;
            }
        }
    }
    const dataset = createCifDifferenceDensityDataset(text, block, options);
    if (debugTimings) {
        Object.assign(dataset.datasetPreparationTimings, {
            datasetSelfDescriptionDetectionMs,
            datasetExplicitCoefficientAttemptMs,
            datasetSourceDispatchTotalMs: now() - sourceDispatchStarted,
        });
    }
    return dataset;
}

/** @returns {number} Unit-cell volume in cubic Angstrom. */
function calculateCellVolume(cell) {
    return Math.abs(math.det(cell.fractToCartMatrix));
}

/** @returns {object} Common real-grid statistics and Float32 storage. */
function gridStatistics(realValues, volume, maxImaginary = 0) {
    const values = new Float32Array(realValues.length);
    let sum = 0;
    let sumSquared = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let index = 0; index < realValues.length; index++) {
        const value = realValues[index] / volume;
        values[index] = value;
        sum += value;
        sumSquared += value * value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }
    const mean = sum / values.length;
    const variance = Math.max(0, sumSquared / values.length - mean * mean);
    return {
        values, mean, sigma: Math.sqrt(variance),
        minimum, maximum, maxImaginary,
    };
}

/** @returns {object} Statistics for values already stored as Float32 density. */
function storedGridStatistics(values, maxImaginary = 0, prepared = null) {
    let sum = prepared?.sum ?? 0;
    let sumSquared = prepared?.sumSquared ?? 0;
    let minimum = prepared?.minimum ?? Infinity;
    let maximum = prepared?.maximum ?? -Infinity;
    if (!prepared) {
        for (const value of values) {
            sum += value;
            sumSquared += value * value;
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
        }
    }
    const mean = sum / values.length;
    const variance = Math.max(0, sumSquared / values.length - mean * mean);
    return {
        values, mean, sigma: Math.sqrt(variance),
        minimum, maximum, maxImaginary,
    };
}

/**
 * Measures the Hermitian invariant F(-h)=conj(F(h)) before selecting the real transform.
 * @param {Map} coefficients - Complex coefficients keyed by signed Miller index.
 * @param {boolean} friedelImplicit - Whether absent mates are logically implied.
 * @returns {{absolute:number, relative:number}} Largest residual and scale-normalized residual.
 */
function hermitianResidual(coefficients, friedelImplicit = false) {
    if (friedelImplicit) {
        return { absolute: 0, relative: 0 };
    }
    let maximum = 0;
    let scale = 0;
    for (const coefficient of coefficients.values()) {
        const mate = coefficients.get(`${-coefficient.h},${-coefficient.k},${-coefficient.l}`);
        scale = Math.max(scale, Math.hypot(coefficient.real, coefficient.imaginary));
        if (!mate) {
            return { absolute: Infinity, relative: Infinity };
        }
        maximum = Math.max(maximum,
            Math.hypot(coefficient.real - mate.real, coefficient.imaginary + mate.imaginary));
    }
    return { absolute: maximum, relative: maximum / Math.max(scale, Number.EPSILON) };
}

/**
 * Executes the correctness fallback on full x-fastest split-complex storage.
 * It uses the crystallographic forward sign exp(-2πih·x), normalizes by cell
 * volume rather than grid size, and returns Float32 density values.
 * @param {Map} coefficients - Complex reciprocal coefficients.
 * @param {object} cell - Unit cell defining the density normalization volume.
 * @param {number[]} dimensions - Full [nx,ny,nz] periodic dimensions.
 * @param {string} axisKernel - Per-axis FFT kernel selection.
 * @param {object} planMetadata - Grid compatibility and Friedel metadata.
 * @returns {object} Scalar values, statistics, allocation data, and FFT diagnostics.
 */
function complexFourierGrid(coefficients, cell, dimensions, axisKernel, planMetadata) {
    const allocationStarted = now();
    const [nx, ny] = dimensions;
    const size = dimensions[0] * dimensions[1] * dimensions[2];
    const realGrid = new Float64Array(size);
    const imaginaryGrid = new Float64Array(size);
    const allocationTimeMs = now() - allocationStarted;

    const placementStarted = now();
    for (const { h, k, l, real, imaginary } of coefficients.values()) {
        const index = (wrapIndex(l, dimensions[2]) * ny + wrapIndex(k, ny)) * nx + wrapIndex(h, nx);
        realGrid[index] = real;
        imaginaryGrid[index] = imaginary;
        if (planMetadata.friedelImplicit && (h !== 0 || k !== 0 || l !== 0)) {
            const mate = (wrapIndex(-l, dimensions[2]) * ny + wrapIndex(-k, ny)) * nx +
                wrapIndex(-h, nx);
            realGrid[mate] = real;
            imaginaryGrid[mate] = -imaginary;
        }
    }
    const coefficientPlacementTimeMs = now() - placementStarted;

    // The crystallographic inverse transform uses exp(-2*pi*i*h.x), which is
    // the forward FFT sign convention. It is normalized only by cell volume.
    const transformStarted = now();
    const axisStatistics = [0, 1, 2].map(axis => transformComplexAxis(
        realGrid, imaginaryGrid, dimensions, axis, axisKernel,
    ));
    const transformTimeMs = now() - transformStarted;

    const statisticsStarted = now();
    const volume = calculateCellVolume(cell);
    let maxImaginary = 0;
    for (const value of imaginaryGrid) {
        maxImaginary = Math.max(maxImaginary, Math.abs(value / volume));
    }
    const workBufferBytes = Math.max(...dimensions.map(length =>
        fftLineWorkBytes(length, axisKernel)));
    axisStatistics.forEach(statistics => {
        statistics.factorization = factorization235(statistics.length);
    });
    const kernels = [...new Set(axisStatistics.map(statistics => statistics.kernel))];
    const statistics = gridStatistics(realGrid, volume, maxImaginary);
    const statisticsTimeMs = now() - statisticsStarted;
    return {
        dimensions,
        ...statistics,
        volume,
        fftBackend: kernels.length === 1 ? kernels[0] : 'hybrid',
        fftAxisKernel: axisKernel,
        fftAxisStatistics: axisStatistics,
        fftPlanSetupTimeMs: axisStatistics.reduce(
            (sum, statistics) => sum + statistics.planSetupTimeMs, 0,
        ),
        realTransform: false,
        storedCoefficientCount: coefficients.size,
        workBufferBytes,
        allocatedBytes: realGrid.byteLength + imaginaryGrid.byteLength + size * 4 +
            workBufferBytes,
        fftAllocationTimeMs: allocationTimeMs,
        fftCoefficientPlacementTimeMs: coefficientPlacementTimeMs,
        fftTransformTimeMs: transformTimeMs,
        fftStatisticsTimeMs: statisticsTimeMs,
        symmetryCompatibleGrid: planMetadata.symmetryCompatible,
        fftGridPlanner: planMetadata.gridPlanner,
        gridFallbackReason: planMetadata.fallbackReason,
    };
}

/**
 * Transforms a nonnegative-h half-spectrum and reconstructs its conjugate x axis per line.
 * Y and z remain complex transforms; final density is Float32 and volume-normalized.
 * @param {Map} coefficients - Hermitian reciprocal coefficients.
 * @param {object} cell - Unit cell defining the density normalization volume.
 * @param {number[]} dimensions - Full [nx,ny,nz] periodic dimensions.
 * @param {string} axisKernel - Per-axis FFT kernel selection.
 * @param {object} planMetadata - Grid compatibility and implicit-Friedel metadata.
 * @param {object} residual - Prevalidated Hermitian residual.
 * @returns {object} Scalar values, statistics, allocation data, and FFT diagnostics.
 */
function hermitianFourierGrid(coefficients, cell, dimensions, axisKernel, planMetadata, residual) {
    const [nx, ny, nz] = dimensions;
    const halfX = Math.floor(nx / 2) + 1;
    const halfDimensions = [halfX, ny, nz];
    const halfSize = halfX * ny * nz;
    const allocationStarted = now();
    const realGrid = new Float64Array(halfSize);
    const imaginaryGrid = new Float64Array(halfSize);
    const values = new Float32Array(nx * ny * nz);
    const allocationTimeMs = now() - allocationStarted;
    let storedCoefficientCount = 0;
    const placementStarted = now();
    for (const { h, k, l, real, imaginary } of coefficients.values()) {
        if (h < 0) {
            continue;
        }
        const index = (wrapIndex(l, nz) * ny + wrapIndex(k, ny)) * halfX + h;
        realGrid[index] = real;
        imaginaryGrid[index] = imaginary;
        storedCoefficientCount++;
        if (planMetadata.friedelImplicit && h === 0 && (k !== 0 || l !== 0)) {
            const mate = (wrapIndex(-l, nz) * ny + wrapIndex(-k, ny)) * halfX;
            realGrid[mate] = real;
            imaginaryGrid[mate] = -imaginary;
        }
    }
    const coefficientPlacementTimeMs = now() - placementStarted;
    const transformStarted = now();
    const axisStatistics = [1, 2].map(axis => transformComplexAxis(
        realGrid, imaginaryGrid, halfDimensions, axis, axisKernel,
    ));

    const lineReal = new Float64Array(nx);
    const lineImaginary = new Float64Array(nx);
    const xStarted = now();
    const xPlan = getFftPlan(nx, axisKernel);
    const xKernelStarted = now();
    const volume = calculateCellVolume(cell);
    const inverseVolume = 1 / volume;
    let maxImaginary = 0;
    let sum = 0;
    let sumSquared = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    for (let z = 0; z < nz; z++) {
        for (let y = 0; y < ny; y++) {
            const halfOffset = (z * ny + y) * halfX;
            for (let h = 0; h < halfX; h++) {
                lineReal[h] = realGrid[halfOffset + h];
                lineImaginary[h] = imaginaryGrid[halfOffset + h];
            }
            for (let h = halfX; h < nx; h++) {
                lineReal[h] = lineReal[nx - h];
                lineImaginary[h] = -lineImaginary[nx - h];
            }
            if (xPlan.kernel === 'mixed-radix') {
                mixedRadixFftLine(lineReal, lineImaginary, xPlan.plan);
            } else {
                radix2FftLine(lineReal, lineImaginary, false, xPlan.plan);
            }
            const outputOffset = (z * ny + y) * nx;
            for (let x = 0; x < nx; x++) {
                const value = Math.fround(lineReal[x] * inverseVolume);
                values[outputOffset + x] = value;
                sum += value;
                sumSquared += value * value;
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
                maxImaginary = Math.max(maxImaginary, Math.abs(lineImaginary[x]));
            }
        }
    }
    const xFinished = now();
    const transformTimeMs = xFinished - transformStarted;
    axisStatistics.unshift({
        axis: 0,
        length: nx,
        lineCount: ny * nz,
        kernel: xPlan.kernel,
        planCacheHit: xPlan.cacheHit,
        planSetupTimeMs: xPlan.setupTimeMs,
        kernelTimeMs: xFinished - xKernelStarted,
        totalTimeMs: xFinished - xStarted,
    });
    axisStatistics.forEach(statistics => {
        statistics.factorization = factorization235(statistics.length);
    });
    const workBufferBytes = Math.max(...dimensions.map(length =>
        fftLineWorkBytes(length, axisKernel)));
    const kernels = [...new Set(axisStatistics.map(statistics => statistics.kernel))];
    const statisticsStarted = now();
    const statistics = storedGridStatistics(values, maxImaginary * inverseVolume, {
        sum,
        sumSquared,
        minimum,
        maximum,
    });
    const statisticsTimeMs = now() - statisticsStarted;
    return {
        dimensions,
        ...statistics,
        volume,
        fftBackend: kernels.length === 1 ? kernels[0] : 'hybrid',
        fftAxisKernel: axisKernel,
        fftAxisStatistics: axisStatistics,
        fftPlanSetupTimeMs: axisStatistics.reduce(
            (sum, statistics) => sum + statistics.planSetupTimeMs, 0,
        ),
        realTransform: true,
        storedCoefficientCount,
        hermitianResidual: residual.relative,
        workBufferBytes,
        allocatedBytes: realGrid.byteLength + imaginaryGrid.byteLength + values.byteLength +
            workBufferBytes,
        fftAllocationTimeMs: allocationTimeMs,
        fftCoefficientPlacementTimeMs: coefficientPlacementTimeMs,
        fftTransformTimeMs: transformTimeMs,
        fftStatisticsTimeMs: statisticsTimeMs,
        symmetryCompatibleGrid: planMetadata.symmetryCompatible,
        fftGridPlanner: planMetadata.gridPlanner,
        gridFallbackReason: planMetadata.fallbackReason,
    };
}

/**
 * Plans and evaluates the production periodic Fourier grid.
 * Hermitian data use half-spectrum storage; invalid conjugacy falls back to the
 * full complex transform without changing sign, normalization, or output type.
 * @param {Map} coefficients - Complex reciprocal coefficients.
 * @param {object} cell - Unit cell associated with the coefficients.
 * @param {number} gridOversampling - Minimum real-space oversampling factor.
 * @param {object} options - Symmetry operations and implicit-Friedel metadata.
 * @returns {object} Density values and numerical/backend diagnostics.
 */
function fourierGrid(coefficients, cell, gridOversampling = 1, options = {}) {
    const totalStarted = now();
    const gridPlanner = 'smooth';
    const axisKernel = 'auto';
    const planningStarted = now();
    const plan = planFourierDimensions(coefficients, gridOversampling, {
        backend: gridPlanner === 'radix-2' ? 'radix-2' : 'mixed-radix',
        symmetryOperations: options.symmetryOperations,
    });
    const gridPlanningTimeMs = now() - planningStarted;
    plan.gridPlanner = gridPlanner;
    plan.friedelImplicit = options.friedelImplicit === true;
    const hermitianStarted = now();
    const residual = hermitianResidual(coefficients, plan.friedelImplicit);
    const hermitianValidationTimeMs = now() - hermitianStarted;
    let result;
    if (residual.relative <= 1e-10) {
        result = hermitianFourierGrid(
            coefficients, cell, plan.dimensions, axisKernel, plan, residual,
        );
    } else {
        result = complexFourierGrid(coefficients, cell, plan.dimensions, axisKernel, plan);
        result.fftFallbackReason = 'non-hermitian-coefficients';
        result.hermitianResidual = residual.relative;
    }
    result.fftGridPlanningTimeMs = gridPlanningTimeMs;
    result.fftHermitianValidationTimeMs = hermitianValidationTimeMs;
    result.fftTotalTimeMs = now() - totalStarted;
    return result;
}

/**
 * Parses and symmetry-expands an FCF once so multiple resolution shells can
 * reuse the expensive text/reflection work.
 * @param {string} fcfText - LIST 6/8-style FCF text.
 * @param {number|string} [cifBlock] - FCF block index or name.
 * @param {object|null} [coefficientColumns] - Custom Fourier coefficient columns.
 * @param {boolean|object|null} [anomalousDispersion] - Anomalous correction and coordinate CIF.
 * @param {object} [options] - Dataset options, including an optional coordinate CIF cell fallback.
 * @returns {object} Parsed progressive-density dataset.
 */
export function parseDifferenceDensityDataset(
    fcfText,
    cifBlock = 0,
    coefficientColumns = null,
    anomalousDispersion = null,
    options = {},
) {
    // Custom coefficient loops may live in a full coordinate CIF whose cell
    // parameters carry standard uncertainties. Keep normal CIF SU splitting
    // so UnitCell receives numeric values rather than strings such as 5.9(1).
    const cif = new CIF(fcfText);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    let cell;
    let cellSource = 'reflection';
    const coordinateCifText = options.coordinateCifText;
    const hasCoordinateFallback = typeof coordinateCifText === 'string' &&
        coordinateCifText.length > 0;
    let coordinateCell = null;
    const getCoordinateCell = () => {
        if (!hasCoordinateFallback) {
            return null;
        }
        if (coordinateCell === null) {
            const coordinateCif = coordinateCifText === fcfText ? cif : new CIF(coordinateCifText);
            const coordinateCifBlock = options.coordinateCifBlock ?? cifBlock;
            const coordinateBlock = typeof coordinateCifBlock === 'number'
                ? coordinateCif.getBlock(coordinateCifBlock)
                : coordinateCif.getBlockByName(coordinateCifBlock);
            coordinateCell = UnitCell.fromCIF(coordinateBlock);
        }
        return coordinateCell;
    };
    try {
        cell = UnitCell.fromCIF(block);
    } catch (reflectionCellError) {
        if (!/Unit cell parameter entries missing in CIF/.test(reflectionCellError.message) ||
            !hasCoordinateFallback) {
            throw reflectionCellError;
        }
        try {
            cell = getCoordinateCell();
            cellSource = 'coordinate-fallback';
        } catch (coordinateCellError) {
            throw new Error(
                'Reflection CIF does not contain a complete unit cell and the coordinate CIF fallback ' +
                `could not provide one: ${coordinateCellError.message}`,
                { cause: coordinateCellError },
            );
        }
    }
    if (cellSource === 'reflection' && hasCoordinateFallback) {
        assertCellsMatch(cell, getCoordinateCell(), 'Reflection');
    }
    const symmetry = CellSymmetry.fromCIF(block);
    let loop;
    try {
        loop = block.get(coefficientColumns?.loop ?? '_refln');
    } catch (error) {
        if (!coefficientColumns) {
            throw new UnsupportedCoefficientSourceError(error.message);
        }
        throw error;
    }

    const h = reflectionColumn(
        loop,
        coefficientColumns?.h ?? ['_refln.index_h', '_refln_index_h'],
    );
    const k = reflectionColumn(
        loop,
        coefficientColumns?.k ?? ['_refln.index_k', '_refln_index_k'],
    );
    const l = reflectionColumn(
        loop,
        coefficientColumns?.l ?? ['_refln.index_l', '_refln_index_l'],
    );
    const calculatedPhases = reflectionColumn(
        loop,
        ['_refln.phase_calc', '_refln_phase_calc'],
        null,
    );
    const phaseCheckCalculated = reflectionColumn(
        loop,
        ['_refln.F_calc', '_refln_F_calc'],
        null,
    );
    const phaseCheckCalculatedSquared = phaseCheckCalculated === null
        ? reflectionColumn(loop, ['_refln.F_squared_calc', '_refln_F_squared_calc'], null)
        : null;
    const phaseCheckAmplitudes = phaseCheckCalculated ?? phaseCheckCalculatedSquared?.map(value =>
        Math.sqrt(Math.max(0, Number(value))),
    );

    let coefficientReader;
    let omitF000;
    if (coefficientColumns) {
        coefficientReader = customCoefficientReader(loop, coefficientColumns);
        // Custom coefficients may represent an absolute or deformation density;
        // retain their mean term unless the caller explicitly requests omission.
        omitF000 = coefficientColumns.omitF000 ?? false;
    } else {
        if (calculatedPhases === null) {
            throw new UnsupportedCoefficientSourceError(
                'None of the keys [_refln.phase_calc, _refln_phase_calc] found in CIF loop',
            );
        }
        const phase = calculatedPhases;
        const measuredSquared = reflectionColumn(
            loop,
            ['_refln.F_squared_meas', '_refln_F_squared_meas'],
            null,
        );
        const measured = measuredSquared === null
            ? reflectionColumn(loop, ['_refln.F_meas', '_refln_F_meas'], null)
            : null;
        const calculated = reflectionColumn(loop, ['_refln.F_calc', '_refln_F_calc'], null);
        const calculatedSquared = calculated === null
            ? reflectionColumn(loop, ['_refln.F_squared_calc', '_refln_F_squared_calc'], null)
            : null;

        if (measuredSquared === null && measured === null) {
            throw new UnsupportedCoefficientSourceError(
                'FCF contains neither measured F nor measured F-squared values',
            );
        }
        if (calculated === null && calculatedSquared === null) {
            throw new UnsupportedCoefficientSourceError(
                'FCF contains neither calculated F nor calculated F-squared values',
            );
        }
        coefficientReader = {
            mode: 'fo-fc-common-phase',
            componentCount: 2,
            defaultAnomalousTarget: measuredSquared !== null && calculatedSquared !== null
                ? 'both'
                : 'first',
            valueColumns: [phase, measuredSquared ?? measured, calculated ?? calculatedSquared],
            coefficientAt(index) {
                const observedAmplitude = measuredSquared !== null
                    ? Math.sqrt(Math.max(0, Number(measuredSquared[index])))
                    : Math.max(0, Number(measured[index]));
                const calculatedAmplitude = calculatedSquared !== null
                    ? Math.sqrt(Math.max(0, Number(calculatedSquared[index])))
                    : Math.abs(Number(calculated[index]));
                const phaseRadians = Number(phase[index]) * Math.PI / 180;
                const amplitude = observedAmplitude - calculatedAmplitude;
                return {
                    real: amplitude * Math.cos(phaseRadians),
                    imaginary: amplitude * Math.sin(phaseRadians),
                };
            },
        };
        omitF000 = true;
    }

    assertSameLength([h, k, l, ...coefficientReader.valueColumns]);
    let coefficientAt = coefficientReader.coefficientAt;
    let anomalousMetadata = { enabled: false, requested: Boolean(anomalousDispersion) };
    if (anomalousDispersion) {
        const options = anomalousDispersion === true ? {} : anomalousDispersion;
        if (typeof options !== 'object') {
            throw new Error('Anomalous-dispersion options must be true or an object');
        }
        const generator = reflectionFileGenerator(block, options);
        let phaseCheck;
        if (options.phaseDetection === false) {
            phaseCheck = { available: false, disabled: true };
        } else {
            const centrosymmetricCheck = centrosymmetricPhaseCheck(
                symmetry,
                h,
                k,
                l,
                calculatedPhases,
                Number(options.phaseToleranceDegrees) || 0.05,
            );
            phaseCheck = centrosymmetricCheck.centrosymmetric
                ? centrosymmetricCheck
                : friedelPairPhaseCheck(
                    h,
                    k,
                    l,
                    calculatedPhases,
                    phaseCheckAmplitudes,
                    Number(options.phaseToleranceDegrees) || 0.05,
                    Number(options.friedelAmplitudeToleranceRelative) || 1e-4,
                );
        }
        const skipReason = phaseCheck.disabled
            ? 'phase-detection-disabled'
            : phaseCheck.alreadyCorrected
                ? 'phases-already-corrected'
                : !phaseCheck.available && generator !== 'olex'
                    ? 'exact-test-unavailable'
                    : null;
        if (skipReason) {
            anomalousMetadata = {
                enabled: false,
                requested: true,
                generator,
                reason: skipReason,
                phaseCheck,
            };
        } else {
            const correctionTarget = options.target ?? coefficientReader.defaultAnomalousTarget ?? 'first';
            const correction = createAnomalousDispersionCorrection(
                options.cifText,
                options.cifBlock ?? 0,
                options,
                cell,
            );
            const scale = anomalousCorrectionScale(correctionTarget, coefficientReader.componentCount);
            coefficientAt = index => {
                const coefficient = coefficientReader.coefficientAt(index);
                const anomalous = correction.coefficientAt(
                    Number(h[index]),
                    Number(k[index]),
                    Number(l[index]),
                );
                return {
                    real: coefficient.real + scale * anomalous.real,
                    imaginary: coefficient.imaginary + scale * anomalous.imaginary,
                };
            };
            anomalousMetadata = {
                ...correction.metadata,
                requested: true,
                generator,
                phaseCheck,
                target: correctionTarget,
                correctionScale: scale,
            };
        }
    }
    const coefficients = expandReflectionCoefficients(
        h,
        k,
        l,
        coefficientAt,
        symmetry,
        omitF000,
        true,
    );
    return finalizeDifferenceDensityDataset({
        cell,
        coefficients,
        reflectionCount: h.length,
        coefficientMode: coefficientReader.mode,
        omitF000,
        anomalousDispersion: anomalousMetadata,
        sourceType: 'fcf',
        cellSource,
        fieldKind: coefficientColumns ? 'deformation-density' : 'difference-density',
        friedelImplicit: true,
    }, symmetry);
}

/**
 * Calculates one resolution shell from a previously parsed FCF dataset.
 * @param {object} dataset - Result of parseDifferenceDensityDataset().
 * @param {number} [resolutionFraction] - Fraction of the maximum reciprocal resolution.
 * @param {number} [gridOversampling] - Real-space FFT grid oversampling factor.
 * @returns {ScalarFieldGrid} Periodic difference-density grid.
 */
export function calculateDifferenceDensityMap(
    dataset,
    resolutionFraction = 1,
    gridOversampling = 1,
) {
    const mapStarted = now();
    if (!(Number.isFinite(resolutionFraction) && resolutionFraction > 0 && resolutionFraction <= 1)) {
        throw new Error('Difference-density resolution fraction must be in the interval (0, 1]');
    }
    const coefficientSelectionStarted = now();
    const cutoff = dataset.maximumReciprocalLength * resolutionFraction;
    let coefficients = resolutionFraction === 1
        ? dataset.coefficients
        : new Map(Array.from(dataset.coefficients.entries()).filter(([, coefficient]) =>
            coefficient.reciprocalLength <= cutoff + 1e-12,
        ));
    if (coefficients.size === 0) {
        let minimumLength = Infinity;
        for (const coefficient of dataset.coefficients.values()) {
            minimumLength = Math.min(minimumLength, coefficient.reciprocalLength);
        }
        coefficients = new Map();
        for (const [key, coefficient] of dataset.coefficients) {
            if (coefficient.reciprocalLength <= minimumLength + 1e-12) {
                coefficients.set(key, coefficient);
            }
        }
    }
    const coefficientSelectionTimeMs = now() - coefficientSelectionStarted;
    if (!(Number.isFinite(gridOversampling) && gridOversampling >= 1)) {
        throw new Error('Difference-density grid oversampling must be at least 1');
    }
    const grid = fourierGrid(coefficients, dataset.cell, gridOversampling, {
        symmetryOperations: dataset.symmetryOperations,
        friedelImplicit: dataset.friedelImplicit,
    });
    const mapAssemblyStarted = now();
    let nonOriginCoefficientCount = 0;
    for (const coefficient of coefficients.values()) {
        if (coefficient.h !== 0 || coefficient.k !== 0 || coefficient.l !== 0) {
            nonOriginCoefficientCount++;
        }
    }
    const logicalCoefficientCount = coefficients.size + nonOriginCoefficientCount;
    const map = new ScalarFieldGrid(dataset.cell, grid.dimensions, grid.values, {
        reflectionCount: dataset.reflectionCount,
        coefficientCount: dataset.friedelImplicit ? logicalCoefficientCount : coefficients.size,
        fullCoefficientCount: dataset.friedelImplicit
            ? dataset.coefficients.size * 2 - (dataset.coefficients.has('0,0,0') ? 1 : 0)
            : dataset.coefficients.size,
        coefficientMode: dataset.coefficientMode,
        omitF000: dataset.omitF000,
        anomalousDispersion: dataset.anomalousDispersion,
        sourceType: dataset.sourceType,
        fieldKind: dataset.fieldKind,
        contourMode: 'sigma',
        displayLabel: 'Δρ/eÅ⁻³',
        quantityName: dataset.fieldKind === 'deformation-density'
            ? 'deformation density'
            : 'difference density',
        valueUnit: 'e/angstrom^3',
        surfaceSign: 'both',
        boundaryMode: 'periodic',
        intensityScale: dataset.intensityScale,
        intensityScaleExplicit: dataset.intensityScaleExplicit,
        scaleFittedReflectionCount: dataset.scaleFittedReflectionCount,
        scaleR1: dataset.scaleR1,
        negativeIntensityCount: dataset.negativeIntensityCount,
        observations: dataset.observations,
        iam: dataset.iam,
        reflectionPolicy: dataset.reflectionPolicy,
        extinctionCorrection: dataset.extinctionCorrection,
        solventMaskCorrection: dataset.solventMaskCorrection,
        symmetryOperations: dataset.symmetryOperations,
        resolutionFraction,
        gridOversampling,
        mean: grid.mean,
        sigma: grid.sigma,
        minimum: grid.minimum,
        maximum: grid.maximum,
        maxImaginary: grid.maxImaginary,
        volume: grid.volume,
        fftBackend: grid.fftBackend,
        fftGridPlanner: grid.fftGridPlanner,
        fftAxisKernel: grid.fftAxisKernel,
        fftAxisStatistics: grid.fftAxisStatistics,
        fftPlanSetupTimeMs: grid.fftPlanSetupTimeMs,
        fftGridPlanningTimeMs: grid.fftGridPlanningTimeMs,
        fftHermitianValidationTimeMs: grid.fftHermitianValidationTimeMs,
        fftAllocationTimeMs: grid.fftAllocationTimeMs,
        fftCoefficientPlacementTimeMs: grid.fftCoefficientPlacementTimeMs,
        fftTransformTimeMs: grid.fftTransformTimeMs,
        fftStatisticsTimeMs: grid.fftStatisticsTimeMs,
        fftTotalTimeMs: grid.fftTotalTimeMs,
        densityCoefficientSelectionTimeMs: coefficientSelectionTimeMs,
        realTransform: grid.realTransform,
        storedCoefficientCount: grid.storedCoefficientCount,
        hermitianResidual: grid.hermitianResidual ?? null,
        fftAllocatedBytes: grid.allocatedBytes,
        fftWorkBufferBytes: grid.workBufferBytes,
        symmetryCompatibleGrid: grid.symmetryCompatibleGrid,
        fftFallbackReason: grid.fftFallbackReason ?? grid.gridFallbackReason ?? null,
    });
    map.densityMapAssemblyTimeMs = now() - mapAssemblyStarted;
    map.densityMapTotalTimeMs = now() - mapStarted;
    return map;
}
