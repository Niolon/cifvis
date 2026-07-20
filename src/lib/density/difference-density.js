/* eslint-disable jsdoc/require-param -- private numerical helpers keep compact documentation */
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

const TWO_PI = 2 * Math.PI;

/** Signals that a CIF block does not advertise explicit Fourier coefficients. */
class UnsupportedCoefficientSourceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnsupportedCoefficientSourceError';
    }
}

/** @returns {number} Smallest power of two not less than value. */
function nextPowerOfTwo(value) {
    let result = 1;
    while (result < value) {
        result *= 2;
    }
    return Math.max(2, result);
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
        if (fields.length < 5 || fields.slice(0, 5).some(value => !Number.isFinite(value))) {
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

/** @returns {Map<string, object>} Symmetry- and Friedel-expanded coefficients. */
function expandReflectionCoefficients(
    hValues,
    kValues,
    lValues,
    coefficientAt,
    symmetry,
    omitF000,
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

            addCoefficient(coefficients, equivH, equivK, equivL, real, imaginary);
            if (equivH !== 0 || equivK !== 0 || equivL !== 0) {
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
        const calculatedSquared = calculated[index].amplitude ** 2 * extinctionFactors[index] ** 2;
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
    const cif = new CIF(cifText);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const cell = UnitCell.fromCIF(block);
    const symmetry = CellSymmetry.fromCIF(block);
    // Difference-electron densities default to normal scattering. If anomalous
    // IAM terms are explicitly requested, retain unmerged Friedel observations
    // unless the caller deliberately selects another policy.
    const iamOptions = { includeAnomalous: false, ...options.iam };
    const reflectionOptions = { ...options.reflections };
    if (reflectionOptions.mergeFriedel === undefined) {
        reflectionOptions.mergeFriedel = iamOptions.includeAnomalous === false;
    }
    const observed = readReflectionIntensities(cifText, cifBlock, reflectionOptions);
    const coordinateCifText = options.coordinateCifText ?? cifText;
    const coordinateCifBlock = options.coordinateCifBlock ?? cifBlock;
    const calculator = createIAMStructureFactorCalculator(
        coordinateCifText,
        coordinateCifBlock,
        { ...iamOptions, expectedCell: cell, structureModel: options.structureModel },
    );
    const calculated = calculator.calculate(observed.reflections);
    const coordinateCif = coordinateCifText === cifText ? cif : new CIF(coordinateCifText);
    const coordinateBlock = typeof coordinateCifBlock === 'number'
        ? coordinateCif.getBlock(coordinateCifBlock)
        : coordinateCif.getBlockByName(coordinateCifBlock);
    const requestedSolventMask = options.solventMaskCorrection ?? 'auto';
    if (![true, false, 'auto'].includes(requestedSolventMask)) {
        throw new Error('solventMaskCorrection must be "auto", true, or false');
    }
    const fab = requestedSolventMask !== false ? readShelxFabCorrections(coordinateBlock) : null;
    let maskCorrectedCalculated = calculated;
    let solventMaskAppliedCount = 0;
    if (fab) {
        const maskCoefficients = expandReflectionCoefficients(
            fab.h,
            fab.k,
            fab.l,
            i => ({ real: fab.real[i], imaginary: fab.imaginary[i] }),
            symmetry,
            false,
        );
        maskCorrectedCalculated = calculated.map((entry, index) => {
            const observation = observed.reflections[index];
            const correction = maskCoefficients.get(
                `${observation.h},${observation.k},${observation.l}`,
            );
            if (!correction) {
                return entry;
            }
            solventMaskAppliedCount++;
            const real = entry.real + correction.real;
            const imaginary = entry.imaginary + correction.imaginary;
            return {
                ...entry,
                real,
                imaginary,
                amplitude: Math.hypot(real, imaginary),
                phase: Math.atan2(imaginary, real) * 180 / Math.PI,
            };
        });
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
    const fitted = fitObservedIntensityScale(
        observed.reflections,
        maskCorrectedCalculated,
        options.intensityScale,
        extinction.factors,
    );
    let negativeIntensityCount = 0;
    let scaleResidualNumerator = 0;
    let scaleResidualDenominator = 0;
    const coefficientAt = index => {
        const observation = observed.reflections[index];
        const fCalculated = maskCorrectedCalculated[index];
        const scaledIntensity = fitted.scale * observation.intensity /
            extinction.factors[index] ** 2;
        if (scaledIntensity < 0) {
            negativeIntensityCount++;
        }
        const observedAmplitude = Math.sqrt(Math.max(0, scaledIntensity));
        const differenceAmplitude = observedAmplitude - fCalculated.amplitude;
        const phase = Math.atan2(fCalculated.imaginary, fCalculated.real);
        scaleResidualNumerator += Math.abs(scaledIntensity - fCalculated.amplitude ** 2);
        scaleResidualDenominator += fCalculated.amplitude ** 2;
        return {
            real: differenceAmplitude * Math.cos(phase),
            imaginary: differenceAmplitude * Math.sin(phase),
        };
    };
    const h = observed.reflections.map(reflection => reflection.h);
    const k = observed.reflections.map(reflection => reflection.k);
    const l = observed.reflections.map(reflection => reflection.l);
    const coefficients = expandReflectionCoefficients(h, k, l, coefficientAt, symmetry, true);
    return finalizeDifferenceDensityDataset({
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
        fieldKind: 'difference-density',
        intensityScale: fitted.scale,
        intensityScaleExplicit: fitted.explicit,
        scaleFittedReflectionCount: fitted.fittedReflectionCount,
        scaleR1: scaleResidualDenominator > 0
            ? scaleResidualNumerator / scaleResidualDenominator
            : null,
        negativeIntensityCount,
        observations: observed.metadata,
        iam: calculator.metadata,
        solventMaskCorrection,
        reflectionPolicy: {
            mergeFriedel: observed.metadata.mergeFriedel,
            includeAnomalous: calculator.metadata.includeAnomalous,
        },
        extinctionCorrection: extinction.metadata,
    }, symmetry);
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
    const inputMode = options.inputMode ?? 'auto';
    if (!['auto', 'fcf', 'cif-iam'].includes(inputMode)) {
        throw new Error('Difference-density inputMode must be "auto", "fcf", or "cif-iam"');
    }
    const coefficientColumns = options.coefficientColumns ??
        selfDescribedCoefficientColumns(text, block);
    if (inputMode !== 'cif-iam') {
        try {
            return parseDifferenceDensityDataset(
                text,
                block,
                coefficientColumns,
                options.anomalousDispersion ?? null,
            );
        } catch (error) {
            if (
                inputMode === 'fcf' || coefficientColumns ||
                !(error instanceof UnsupportedCoefficientSourceError)
            ) {
                throw error;
            }
        }
    }
    return createCifDifferenceDensityDataset(text, block, options);
}

/** Performs an in-place radix-2 complex FFT on one line. */
function fftLine(real, imaginary, inverse = false) {
    const length = real.length;
    for (let i = 1, j = 0; i < length; i++) {
        let bit = length >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
            [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
        }
    }

    const sign = inverse ? 1 : -1;
    for (let width = 2; width <= length; width *= 2) {
        const angle = sign * TWO_PI / width;
        const rootReal = Math.cos(angle);
        const rootImaginary = Math.sin(angle);
        for (let start = 0; start < length; start += width) {
            let twiddleReal = 1;
            let twiddleImaginary = 0;
            const half = width / 2;
            for (let offset = 0; offset < half; offset++) {
                const evenIndex = start + offset;
                const oddIndex = evenIndex + half;
                const oddReal = real[oddIndex] * twiddleReal - imaginary[oddIndex] * twiddleImaginary;
                const oddImaginary = real[oddIndex] * twiddleImaginary + imaginary[oddIndex] * twiddleReal;
                const evenReal = real[evenIndex];
                const evenImaginary = imaginary[evenIndex];

                real[evenIndex] = evenReal + oddReal;
                imaginary[evenIndex] = evenImaginary + oddImaginary;
                real[oddIndex] = evenReal - oddReal;
                imaginary[oddIndex] = evenImaginary - oddImaginary;

                const nextReal = twiddleReal * rootReal - twiddleImaginary * rootImaginary;
                twiddleImaginary = twiddleReal * rootImaginary + twiddleImaginary * rootReal;
                twiddleReal = nextReal;
            }
        }
    }

    if (inverse) {
        for (let i = 0; i < length; i++) {
            real[i] /= length;
            imaginary[i] /= length;
        }
    }
}

/** Applies the forward FFT along one dimension of a 3D array. */
function transformAxis(realGrid, imaginaryGrid, dimensions, axis) {
    const [nx, ny, nz] = dimensions;
    const lineLength = dimensions[axis];
    const lineReal = new Float64Array(lineLength);
    const lineImaginary = new Float64Array(lineLength);

    const transformLine = (indexAt) => {
        for (let i = 0; i < lineLength; i++) {
            const index = indexAt(i);
            lineReal[i] = realGrid[index];
            lineImaginary[i] = imaginaryGrid[index];
        }
        fftLine(lineReal, lineImaginary);
        for (let i = 0; i < lineLength; i++) {
            const index = indexAt(i);
            realGrid[index] = lineReal[i];
            imaginaryGrid[index] = lineImaginary[i];
        }
    };

    if (axis === 0) {
        for (let z = 0; z < nz; z++) {
            for (let y = 0; y < ny; y++) {
                const offset = (z * ny + y) * nx;
                transformLine(x => offset + x);
            }
        }
    } else if (axis === 1) {
        for (let z = 0; z < nz; z++) {
            for (let x = 0; x < nx; x++) {
                transformLine(y => (z * ny + y) * nx + x);
            }
        }
    } else {
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                transformLine(z => (z * ny + y) * nx + x);
            }
        }
    }
}

/** @returns {number} Unit-cell volume in cubic Angstrom. */
function calculateCellVolume(cell) {
    return Math.abs(math.det(cell.fractToCartMatrix));
}

/** @returns {object} Difference density and statistics on a periodic FFT grid. */
function fourierGrid(coefficients, cell, gridOversampling = 1) {
    let maxH = 0;
    let maxK = 0;
    let maxL = 0;
    for (const { h, k, l } of coefficients.values()) {
        maxH = Math.max(maxH, Math.abs(h));
        maxK = Math.max(maxK, Math.abs(k));
        maxL = Math.max(maxL, Math.abs(l));
    }

    const minimumDimensions = [
        nextPowerOfTwo(2 * maxH + 1),
        nextPowerOfTwo(2 * maxK + 1),
        nextPowerOfTwo(2 * maxL + 1),
    ];
    const dimensions = minimumDimensions.map(dimension =>
        nextPowerOfTwo(dimension * Math.max(1, gridOversampling)),
    );
    const [nx, ny] = dimensions;
    const size = dimensions[0] * dimensions[1] * dimensions[2];
    const realGrid = new Float64Array(size);
    const imaginaryGrid = new Float64Array(size);

    for (const { h, k, l, real, imaginary } of coefficients.values()) {
        const index = (wrapIndex(l, dimensions[2]) * ny + wrapIndex(k, ny)) * nx + wrapIndex(h, nx);
        realGrid[index] = real;
        imaginaryGrid[index] = imaginary;
    }

    // The crystallographic inverse transform uses exp(-2*pi*i*h.x), which is
    // the forward FFT sign convention. It is normalized only by cell volume.
    transformAxis(realGrid, imaginaryGrid, dimensions, 0);
    transformAxis(realGrid, imaginaryGrid, dimensions, 1);
    transformAxis(realGrid, imaginaryGrid, dimensions, 2);

    const volume = calculateCellVolume(cell);
    const values = new Float32Array(size);
    let sum = 0;
    let minimum = Infinity;
    let maximum = -Infinity;
    let maxImaginary = 0;
    for (let i = 0; i < size; i++) {
        const value = realGrid[i] / volume;
        values[i] = value;
        sum += value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        maxImaginary = Math.max(maxImaginary, Math.abs(imaginaryGrid[i] / volume));
    }
    const mean = sum / size;
    let variance = 0;
    for (const value of values) {
        variance += (value - mean) ** 2;
    }

    return {
        dimensions,
        values,
        mean,
        sigma: Math.sqrt(variance / size),
        minimum,
        maximum,
        maxImaginary,
        volume,
    };
}

/**
 * Parses and symmetry-expands an FCF once so multiple resolution shells can
 * reuse the expensive text/reflection work.
 * @param {string} fcfText - LIST 6/8-style FCF text.
 * @param {number|string} [cifBlock] - FCF block index or name.
 * @param {object|null} [coefficientColumns] - Custom Fourier coefficient columns.
 * @param {boolean|object|null} [anomalousDispersion] - Anomalous correction and coordinate CIF.
 * @returns {object} Parsed progressive-density dataset.
 */
export function parseDifferenceDensityDataset(
    fcfText,
    cifBlock = 0,
    coefficientColumns = null,
    anomalousDispersion = null,
) {
    // Custom coefficient loops may live in a full coordinate CIF whose cell
    // parameters carry standard uncertainties. Keep normal CIF SU splitting
    // so UnitCell receives numeric values rather than strings such as 5.9(1).
    const cif = new CIF(fcfText);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const cell = UnitCell.fromCIF(block);
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
    );
    return finalizeDifferenceDensityDataset({
        cell,
        coefficients,
        reflectionCount: h.length,
        coefficientMode: coefficientReader.mode,
        omitF000,
        anomalousDispersion: anomalousMetadata,
        sourceType: 'fcf',
        fieldKind: coefficientColumns ? 'deformation-density' : 'difference-density',
    }, symmetry);
}

/**
 * Calculates one resolution shell from a previously parsed FCF dataset.
 * @param {object} dataset - Result of parseDifferenceDensityDataset().
 * @param {number} [resolutionFraction] - Fraction of the maximum reciprocal resolution.
 * @param {number} [gridOversampling] - Real-space FFT grid oversampling factor.
 * @returns {ScalarFieldGrid} Periodic difference-density grid.
 */
export function calculateDifferenceDensityMap(dataset, resolutionFraction = 1, gridOversampling = 1) {
    if (!(Number.isFinite(resolutionFraction) && resolutionFraction > 0 && resolutionFraction <= 1)) {
        throw new Error('Difference-density resolution fraction must be in the interval (0, 1]');
    }
    const cutoff = dataset.maximumReciprocalLength * resolutionFraction;
    let coefficients = resolutionFraction === 1
        ? dataset.coefficients
        : new Map(Array.from(dataset.coefficients.entries()).filter(([, coefficient]) =>
            coefficient.reciprocalLength <= cutoff + 1e-12,
        ));
    if (coefficients.size === 0) {
        const minimumLength = Math.min(...Array.from(dataset.coefficients.values()).map(
            coefficient => coefficient.reciprocalLength,
        ));
        coefficients = new Map(Array.from(dataset.coefficients.entries()).filter(([, coefficient]) =>
            coefficient.reciprocalLength <= minimumLength + 1e-12,
        ));
    }
    if (!(Number.isFinite(gridOversampling) && gridOversampling >= 1)) {
        throw new Error('Difference-density grid oversampling must be at least 1');
    }
    const grid = fourierGrid(coefficients, dataset.cell, gridOversampling);
    return new ScalarFieldGrid(dataset.cell, grid.dimensions, grid.values, {
        reflectionCount: dataset.reflectionCount,
        coefficientCount: coefficients.size,
        fullCoefficientCount: dataset.coefficients.size,
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
    });
}
