/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
import { createStructureFactorModel } from './structure-factor-model.js';
import { finiteNumber, loopColumn, optionalLoop } from './cif-values.js';

const ELEMENTS = (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni ' +
    'Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe ' +
    'Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg ' +
    'Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf'
).split(' ');

// Complete neutral-atom H-Cf values from the IUCr core dictionary. These are
// deliberately discrete Cu Kalpha and Mo Kalpha tables: interpolating f' and
// f'' between sparse wavelengths is invalid close to absorption edges.
const INTERNAL_TABLE_DATA = {
    mo: {
        wavelength: 0.71073,
        real: (
            '0 0 0 0 0 .002 .004 .008 .014 .021 .03 .042 .056 .072 .09 .11 .132 .155 .179 .203 ' +
            '.226 .248 .267 .284 .295 .301 .299 .285 .263 .222 .163 .081 -.03 -.178 -.374 -.652 ' +
            '-1.044 -1.657 -2.951 -2.965 -2.197 -1.825 -1.59 -1.42 -1.287 -1.177 -1.085 -1.005 ' +
            '-.936 -.873 -.816 -.772 -.726 -.684 -.644 -.613 -.588 -.564 -.53 -.535 -.53 -.533 ' +
            '-.542 -.564 -.591 -.619 -.666 -.723 -.795 -.884 -.988 -1.118 -1.258 -1.421 -1.598 ' +
            '-1.816 -2.066 -2.352 -2.688 -3.084 -3.556 -4.133 -4.861 -5.924 -7.444 -8.862 ' +
            '-7.912 -7.62 -7.725 -8.127 -8.96 -10.673 -11.158 -9.725 -8.926 -8.416 -7.99 -7.683'
        ),
        imaginary: (
            '0 0 0 0 .001 .002 .003 .006 .01 .016 .025 .036 .052 .071 .095 .124 .159 .201 .25 ' +
            '.306 .372 .446 .53 .624 .729 .845 .973 1.113 1.266 1.431 1.609 1.801 2.007 2.223 ' +
            '2.456 2.713 2.973 3.264 3.542 .56 .621 .688 .759 .836 .919 1.007 1.101 1.202 1.31 ' +
            '1.424 1.546 1.675 1.812 1.958 2.119 2.282 2.452 2.632 2.845 3.018 3.225 3.442 ' +
            '3.669 3.904 4.151 4.41 4.678 4.958 5.248 5.548 5.858 6.185 6.523 6.872 7.232 ' +
            '7.605 7.99 8.388 8.798 9.223 9.659 10.102 10.559 11.042 9.961 10.403 7.754 ' +
            '8.105 8.472 8.87 9.284 9.654 4.148 4.33 4.511 4.697 4.908 5.107'
        ),
    },
    cu: {
        wavelength: 1.54184,
        real: (
            '0 0 .001 .003 .008 .017 .029 .047 .069 .097 .129 .165 .204 .244 .283 .319 .348 ' +
            '.366 .365 .341 .285 .189 .035 -.198 -.568 -1.179 -2.464 -2.956 -2.019 -1.612 -1.354 ' +
            '-1.163 -1.011 -.879 -.767 -.665 -.574 -.465 -.386 -.314 -.248 -.191 -.145 -.105 ' +
            '-.077 -.059 -.06 -.079 -.126 -.194 -.287 -.418 -.579 -.783 -1.022 -1.334 -1.716 ' +
            '-2.17 -2.939 -3.431 -4.357 -5.696 -7.718 -9.242 -9.498 -10.423 -12.255 -9.733 ' +
            '-8.488 -7.701 -7.133 -6.715 -6.351 -6.048 -5.79 -5.581 -5.391 -5.233 -5.096 -4.99 ' +
            '-4.883 -4.818 -4.776 -4.756 -4.772 -4.787 -4.833 -4.898 -4.994 -5.091 -5.216 ' +
            '-5.359 -5.529 -5.712 -5.93 -6.176 -6.498 -6.798'
        ),
        imaginary: (
            '0 0 0 .001 .004 .009 .018 .032 .053 .083 .124 .177 .246 .33 .434 .557 .702 .872 ' +
            '1.066 1.286 1.533 1.807 2.11 2.443 2.808 3.204 3.608 .509 .589 .678 .777 .886 ' +
            '1.006 1.139 1.283 1.439 1.608 1.82 2.025 2.245 2.482 2.735 3.005 3.296 3.605 ' +
            '3.934 4.282 4.653 5.045 5.459 5.894 6.352 6.835 7.348 7.904 8.46 9.036 9.648 ' +
            '10.535 10.933 11.614 12.32 11.276 11.946 9.242 9.748 3.704 3.937 4.181 4.432 ' +
            '4.693 4.977 5.271 5.577 5.891 6.221 6.566 6.925 7.297 7.686 8.089 8.505 8.93 ' +
            '9.383 9.843 10.317 10.803 11.296 11.799 12.33 12.868 13.409 13.967 14.536 ' +
            '15.087 15.634 16.317 16.93'
        ),
    },
};

const INTERNAL_TABLES = Object.fromEntries(Object.entries(INTERNAL_TABLE_DATA).map(([key, data]) => {
    const real = data.real.trim().split(/\s+/).map(Number);
    const imaginary = data.imaginary.trim().split(/\s+/).map(Number);
    if (real.length !== ELEMENTS.length || imaginary.length !== ELEMENTS.length) {
        throw new Error(`Invalid internal anomalous-dispersion table: ${key}`);
    }
    return [key, {
        wavelength: data.wavelength,
        values: new Map(ELEMENTS.map((element, index) => [element, {
            real: real[index],
            imaginary: imaginary[index],
        }])),
    }];
}));

function normalizeElement(typeSymbol) {
    const match = String(typeSymbol).trim().match(/^([A-Za-z]{1,2})/);
    if (!match) {
        return null;
    }
    if (match[1].toUpperCase() === 'D') {
        return 'H';
    }
    const normalized = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    return ELEMENTS.includes(normalized) ? normalized : null;
}

function configuredTable(options, wavelength) {
    if (options.table !== undefined) {
        const key = String(options.table).toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
        const table = INTERNAL_TABLES[key];
        if (!table) {
            throw new Error('Anomalous-dispersion table must be "Cu" or "Mo"');
        }
        return { key, ...table };
    }
    if (!Number.isFinite(wavelength)) {
        return null;
    }
    const tolerance = finiteNumber(options.wavelengthTolerance) ?? 0.005;
    const match = Object.entries(INTERNAL_TABLES).find(([, table]) =>
        Math.abs(table.wavelength - wavelength) <= tolerance,
    );
    return match ? { key: match[0], ...match[1] } : null;
}

/**
 * Looks up neutral-atom anomalous dispersion factors from the internal IUCr
 * Cu Kalpha or Mo Kalpha tables.
 * @returns {{real:number, imaginary:number, table:string, wavelength:number}|null} Table value.
 */
export function lookupAnomalousDispersion(typeSymbol, wavelength, options = {}) {
    const element = normalizeElement(typeSymbol);
    const table = configuredTable(options, finiteNumber(wavelength));
    const value = element && table?.values.get(element);
    return value ? { ...value, table: table.key, wavelength: table.wavelength } : null;
}

function dispersionRows(block, categoryNames, labelNames) {
    const loop = optionalLoop(block, categoryNames);
    const labels = loopColumn(loop, labelNames);
    const real = loopColumn(loop, [
        '_atom_site_dispersion.real',
        '_atom_site_dispersion_real',
        '_atom_type_scat.dispersion_real',
        '_atom_type_scat_dispersion_real',
    ]);
    const imaginary = loopColumn(loop, [
        '_atom_site_dispersion.imag',
        '_atom_site_dispersion_imag',
        '_atom_type_scat.dispersion_imag',
        '_atom_type_scat_dispersion_imag',
    ]);
    const result = new Map();
    if (!labels || (!real && !imaginary)) {
        return result;
    }
    for (let index = 0; index < labels.length; index++) {
        result.set(String(labels[index]), {
            real: real ? finiteNumber(real[index]) : null,
            imaginary: imaginary ? finiteNumber(imaginary[index]) : null,
        });
    }
    return result;
}

function configuredValue(options, typeSymbol, element) {
    const values = options.values ?? options.fallbackValues;
    if (!values) {
        return null;
    }
    const value = values[typeSymbol] ?? values[element];
    if (Array.isArray(value)) {
        return { real: finiteNumber(value[0]), imaginary: finiteNumber(value[1]) };
    }
    return value && typeof value === 'object' ? {
        real: finiteNumber(value.real ?? value.fPrime),
        imaginary: finiteNumber(value.imaginary ?? value.fDoublePrime),
    } : null;
}

function mergeValue(primary, secondary) {
    if (!primary && !secondary) {
        return null;
    }
    return {
        real: primary?.real ?? secondary?.real ?? null,
        imaginary: primary?.imaginary ?? secondary?.imaginary ?? null,
    };
}

function resolveDispersion(typeSymbol, label, siteValues, typeValues, internal, options) {
    const element = normalizeElement(typeSymbol);
    const configured = configuredValue(options, typeSymbol, element);
    const internalValue = element ? internal?.values.get(element) : null;
    const fallback = mergeValue(configured, internalValue);
    const typeValue = typeValues.get(String(typeSymbol)) ?? typeValues.get(element);
    const value = mergeValue(siteValues.get(String(label)), mergeValue(typeValue, fallback));
    if (!value || value.real === null || value.imaginary === null) {
        throw new Error(
            `No complete anomalous-dispersion factors for atom ${label} (${typeSymbol}); ` +
            'provide them in the CIF or select a supported internal table',
        );
    }
    const source = siteValues.has(String(label)) ? 'site-cif' :
        typeValue ? 'type-cif' : configured ? 'configured' : 'internal';
    return { real: value.real, imaginary: value.imaginary, source };
}

/**
 * Builds the model anomalous structure-factor contribution for each hkl.
 * CIF site values override CIF atom-type values, configured fallbacks, and
 * finally the internal complete Cu/Mo tables.
 * @returns {{coefficientAt:function(number,number,number):object, metadata:object}} Correction model.
 */
export function createAnomalousDispersionCorrection(cifText, cifBlock = 0, options = {}, expectedCell = null) {
    let internal;
    let siteValues;
    let typeValues;
    const model = createStructureFactorModel(cifText, cifBlock, {
        expectedCell,
        wavelength: options.wavelength,
        structureModel: options.structureModel,
        resolveAtom({ atom, block, wavelength }) {
            internal ??= configuredTable(options, wavelength);
            siteValues ??= dispersionRows(
                block,
                ['_atom_site_dispersion'],
                ['_atom_site_dispersion.label', '_atom_site_dispersion_label'],
            );
            typeValues ??= dispersionRows(
                block,
                ['_atom_type', '_atom_type_scat'],
                ['_atom_type.symbol', '_atom_type_symbol'],
            );
            const dispersion = resolveDispersion(
                atom.atomType,
                atom.label,
                siteValues,
                typeValues,
                internal,
                options,
            );
            return {
                source: dispersion.source,
                scatteringAt() {
                    return { real: dispersion.real, imaginary: dispersion.imaginary };
                },
            };
        },
    });
    return {
        ...model,
        metadata: {
            ...model.metadata,
            enabled: true,
            internalTable: internal?.key ?? null,
        },
    };
}
