/* eslint-disable jsdoc/require-jsdoc */
import { evaluateCromerMann, lookupCromerMann } from './cromer-mann.js';
import { lookupAnomalousDispersion } from './anomalous-dispersion.js';
import { createStructureFactorModel, finiteNumber } from './structure-factor-model.js';

const ELEMENTS = (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni ' +
    'Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe ' +
    'Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg ' +
    'Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf'
).split(' ');

const CROMER_MANN_COLUMNS = [
    'a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'c',
];

function normalizeElement(typeSymbol) {
    const match = String(typeSymbol).trim().match(/^([A-Za-z]{1,2})/);
    if (!match) {
        return null;
    }
    if (match[1].toUpperCase() === 'D') {
        return 'H';
    }
    const element = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    return ELEMENTS.includes(element) ? element : null;
}

function optionalLoop(block, names) {
    for (const name of names) {
        try {
            const value = block.get(name);
            if (value && typeof value.get === 'function') {
                return value;
            }
        } catch {
            // Try the next category alias.
        }
    }
    return null;
}

function loopColumn(loop, names, defaultValue = null) {
    if (!loop) {
        return defaultValue;
    }
    try {
        return loop.get(names, defaultValue);
    } catch {
        return defaultValue;
    }
}

function coefficientsByType(block) {
    const loop = optionalLoop(block, ['_atom_type', '_atom_type_scat']);
    const symbols = loopColumn(loop, ['_atom_type.symbol', '_atom_type_symbol']);
    const columns = CROMER_MANN_COLUMNS.map(name => loopColumn(loop, [
        `_atom_type_scat.Cromer_Mann_${name}`,
        `_atom_type_scat_Cromer_Mann_${name}`,
        `_atom_type.scat_Cromer_Mann_${name}`,
    ]));
    const result = new Map();
    if (!symbols || columns.some(column => !column)) {
        return result;
    }
    for (let row = 0; row < symbols.length; row++) {
        const coefficients = columns.map(column => finiteNumber(column[row]));
        if (coefficients.every(value => value !== null)) {
            const symbol = String(symbols[row]);
            result.set(symbol, coefficients);
            const element = normalizeElement(symbol);
            if (element && !result.has(element)) {
                result.set(element, coefficients);
            }
        }
    }
    return result;
}

function dispersionByLabel(block, categoryNames, labelNames) {
    const loop = optionalLoop(block, categoryNames);
    const labels = loopColumn(loop, labelNames);
    const real = loopColumn(loop, [
        '_atom_site_dispersion.real', '_atom_site_dispersion_real',
        '_atom_type_scat.dispersion_real', '_atom_type_scat_dispersion_real',
    ]);
    const imaginary = loopColumn(loop, [
        '_atom_site_dispersion.imag', '_atom_site_dispersion_imag',
        '_atom_type_scat.dispersion_imag', '_atom_type_scat_dispersion_imag',
    ]);
    const result = new Map();
    if (!labels || (!real && !imaginary)) {
        return result;
    }
    for (let row = 0; row < labels.length; row++) {
        result.set(String(labels[row]), {
            real: real ? finiteNumber(real[row]) : null,
            imaginary: imaginary ? finiteNumber(imaginary[row]) : null,
        });
    }
    return result;
}

function configuredCoefficients(options, typeSymbol, element) {
    const value = options.cromerMann?.[typeSymbol] ?? options.cromerMann?.[element];
    if (!Array.isArray(value) || value.length !== 9) {
        return null;
    }
    const coefficients = value.map(finiteNumber);
    return coefficients.every(coefficient => coefficient !== null) ? coefficients : null;
}

function configuredDispersion(options, typeSymbol, element) {
    const value = options.dispersionValues?.[typeSymbol] ?? options.dispersionValues?.[element];
    if (Array.isArray(value)) {
        return { real: finiteNumber(value[0]), imaginary: finiteNumber(value[1]) };
    }
    if (value && typeof value === 'object') {
        return {
            real: finiteNumber(value.real ?? value.fPrime),
            imaginary: finiteNumber(value.imaginary ?? value.fDoublePrime),
        };
    }
    return null;
}

function completeDispersion(value) {
    return value?.real !== null && value?.real !== undefined &&
        value?.imaginary !== null && value?.imaginary !== undefined;
}

function mergeDispersion(primary, secondary) {
    return {
        real: primary?.real ?? secondary?.real ?? null,
        imaginary: primary?.imaginary ?? secondary?.imaginary ?? null,
    };
}

/**
 * Creates an independent-atom-model X-ray structure-factor calculator.
 * CIF Cromer-Mann and dispersion values take precedence over configured and
 * internal neutral-atom values. Missing anomalous terms are treated as zero.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {number|string} cifBlock - CIF block index or name.
 * @param {object} options - Calculation options.
 * @returns {object} Calculator with coefficientAt() and calculate().
 */
export function createIAMStructureFactorCalculator(cifText, cifBlock = 0, options = {}) {
    let cromerMannValues;
    let typeDispersion;
    let siteDispersion;
    const includeAnomalous = options.includeAnomalous !== false;
    const model = createStructureFactorModel(cifText, cifBlock, {
        expectedCell: options.expectedCell,
        wavelength: options.wavelength,
        resolveAtom({ atom, block, wavelength }) {
            cromerMannValues ??= coefficientsByType(block);
            typeDispersion ??= dispersionByLabel(
                block,
                ['_atom_type', '_atom_type_scat'],
                ['_atom_type.symbol', '_atom_type_symbol'],
            );
            siteDispersion ??= dispersionByLabel(
                block,
                ['_atom_site_dispersion'],
                ['_atom_site_dispersion.label', '_atom_site_dispersion_label'],
            );
            const element = normalizeElement(atom.atomType);
            const cifCoefficients = cromerMannValues.get(atom.atomType) ?? cromerMannValues.get(element);
            const configured = configuredCoefficients(options, atom.atomType, element);
            const coefficients = cifCoefficients ?? configured ?? lookupCromerMann(element);
            if (!coefficients) {
                throw new Error(`No Cromer-Mann coefficients for atom ${atom.label} (${atom.atomType})`);
            }

            let dispersion = { real: 0, imaginary: 0 };
            let dispersionSource = 'disabled';
            if (includeAnomalous) {
                const siteValue = siteDispersion.get(atom.label);
                const typeValue = typeDispersion.get(atom.atomType) ?? typeDispersion.get(element);
                const optionValue = configuredDispersion(options, atom.atomType, element);
                const internal = lookupAnomalousDispersion(element, wavelength, options.anomalous ?? {});
                const selected = mergeDispersion(
                    siteValue,
                    mergeDispersion(typeValue, mergeDispersion(optionValue, internal)),
                );
                if (completeDispersion(selected)) {
                    dispersion = selected;
                    dispersionSource = siteValue ? 'site-cif' :
                        typeValue ? 'type-cif' : optionValue ? 'configured' : 'internal';
                } else {
                    dispersionSource = 'zero';
                }
            }
            const coefficientSource = cifCoefficients ? 'cif' : configured ? 'configured' : 'internal';
            return {
                source: `${coefficientSource}/${dispersionSource}`,
                scatteringAt(sSquared) {
                    return {
                        real: evaluateCromerMann(coefficients, sSquared) + dispersion.real,
                        imaginary: dispersion.imaginary,
                    };
                },
            };
        },
    });
    return {
        ...model,
        metadata: {
            ...model.metadata,
            model: 'IAM',
            includeAnomalous,
        },
    };
}

/**
 * Convenience calculation for a collection of hkl arrays or objects.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {Array} reflections - Reflection indices.
 * @param {object} options - Calculator options, including cifBlock.
 * @returns {object[]} Calculated complex structure factors.
 */
export function calculateIAMStructureFactors(cifText, reflections, options = {}) {
    const calculator = createIAMStructureFactorCalculator(
        cifText,
        options.cifBlock ?? 0,
        options,
    );
    return calculator.calculate(reflections);
}

export { evaluateCromerMann, lookupCromerMann };
