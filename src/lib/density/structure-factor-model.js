/* eslint-disable jsdoc/require-jsdoc */
import { CIF } from '../read-cif/base.js';
import { Atom, UnitCell } from '../structure/crystal.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import { FractPosition } from '../structure/position.js';
import * as math from '../math-lite.js';

const TWO_PI = 2 * Math.PI;

export function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function cellMatches(first, second) {
    for (const parameter of ['a', 'b', 'c']) {
        if (Math.abs(first[parameter] - second[parameter]) / Math.max(1, first[parameter]) > 1e-3) {
            return false;
        }
    }
    for (const parameter of ['alpha', 'beta', 'gamma']) {
        if (Math.abs(first[parameter] - second[parameter]) > 1e-2) {
            return false;
        }
    }
    return true;
}

function scalar(block, names) {
    for (const name of names) {
        try {
            const number = finiteNumber(block.get(name, null));
            if (number !== null) {
                return number;
            }
        } catch {
            // Try the next spelling.
        }
    }
    return null;
}

function displacementParameters(atom, cell, cartesianRotation) {
    if (atom.adp instanceof UIsoADP) {
        return { isotropic: atom.adp.uiso };
    }
    if (atom.adp instanceof UAnisoADP) {
        const [u11, u22, u33, u12, u13, u23] = atom.adp.getUCart(cell);
        const uCartesian = [
            [u11, u12, u13],
            [u12, u22, u23],
            [u13, u23, u33],
        ];
        const transformed = math.multiply(
            math.multiply(cartesianRotation, uCartesian),
            math.transpose(cartesianRotation),
        );
        return { anisotropic: [
            transformed[0][0], transformed[1][1], transformed[2][2],
            transformed[0][1], transformed[0][2], transformed[1][2],
        ] };
    }
    return null;
}

function displacementFactor(parameters, reciprocal, reciprocalLengthSquared) {
    if (!parameters) {
        return 1;
    }
    if (parameters.isotropic !== undefined) {
        return Math.exp(-2 * Math.PI ** 2 * parameters.isotropic * reciprocalLengthSquared);
    }
    const [u11, u22, u33, u12, u13, u23] = parameters.anisotropic;
    const [x, y, z] = reciprocal;
    const quadratic = u11 * x * x + u22 * y * y + u33 * z * z +
        2 * u12 * x * y + 2 * u13 * x * z + 2 * u23 * y * z;
    return Math.exp(-2 * Math.PI ** 2 * quadratic);
}

function fractionalKey(position) {
    return position.map(value => {
        const wrapped = ((value % 1) + 1) % 1;
        const normalized = Math.abs(wrapped - 1) < 1e-8 ? 0 : wrapped;
        return Math.round(normalized * 1e8);
    }).join(',');
}

function reflectionIndices(reflection) {
    if (Array.isArray(reflection)) {
        return reflection;
    }
    return [reflection.h, reflection.k, reflection.l];
}

/**
 * Builds a symmetry-expanded atom sum with occupancy and displacement factors.
 * The supplied resolver provides the reflection-dependent complex scattering
 * factor for each independent atom.
 * @param {string} cifText - Coordinate CIF contents.
 * @param {number|string} cifBlock - CIF block index or name.
 * @param {object} options - Model options.
 * @param {object} [options.expectedCell] - Optional reflection cell to validate.
 * @param {function(object): object} options.resolveAtom - Atom factor resolver.
 * @returns {object} Reusable structure-factor model.
 */
export function createStructureFactorModel(cifText, cifBlock = 0, options = {}) {
    if (typeof cifText !== 'string' || cifText.length === 0) {
        throw new Error('Structure-factor calculation requires the coordinate CIF text');
    }
    if (typeof options.resolveAtom !== 'function') {
        throw new Error('Structure-factor calculation requires an atom factor resolver');
    }
    const cif = new CIF(cifText);
    const block = typeof cifBlock === 'number' ? cif.getBlock(cifBlock) : cif.getBlockByName(cifBlock);
    const cell = UnitCell.fromCIF(block);
    if (options.expectedCell && !cellMatches(cell, options.expectedCell)) {
        throw new Error('Structure-factor coordinate CIF cell does not match the reflection cell');
    }
    const wavelength = scalar(block, [
        '_diffrn_radiation_wavelength.wavelength',
        '_diffrn_radiation.wavelength',
        '_diffrn_radiation_wavelength',
    ]) ?? finiteNumber(options.wavelength);
    const atomSite = block.get('_atom_site');
    const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
    const occupancies = atomSite.get(
        ['_atom_site.occupancy', '_atom_site_occupancy'],
        Array(labels.length).fill(1),
    );
    const atoms = [];
    const sourceCounts = {};
    for (let index = 0; index < labels.length; index++) {
        let atom;
        try {
            atom = Atom.fromCIF(block, index);
        } catch (error) {
            if (error.message.includes('Dummy atom')) {
                continue;
            }
            throw error;
        }
        const resolved = options.resolveAtom({ atom, index, block, wavelength });
        if (!resolved || typeof resolved.scatteringAt !== 'function') {
            throw new Error(`No scattering-factor model for atom ${atom.label} (${atom.atomType})`);
        }
        const source = resolved.source ?? 'unknown';
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
        atoms.push({
            atom,
            occupancy: finiteNumber(occupancies[index]) ?? 1,
            scatteringAt: resolved.scatteringAt,
        });
    }

    const directTransform = cell.fractToCartMatrix.toArray();
    const inverseDirectTransform = math.inv(directTransform);
    const reciprocalResult = math.transpose(inverseDirectTransform);
    const reciprocalTransform = Array.isArray(reciprocalResult)
        ? reciprocalResult
        : reciprocalResult.toArray();
    const symmetry = CellSymmetry.fromCIF(block);
    const transforms = symmetry.symmetryOperations.map(operation => ({
        operation,
        cartesianRotation: math.multiply(
            math.multiply(directTransform, operation.rotMatrix),
            inverseDirectTransform,
        ),
    }));
    const expandedAtoms = [];
    for (const modelAtom of atoms) {
        const seen = new Set();
        const position = modelAtom.atom.position instanceof FractPosition
            ? [modelAtom.atom.position.x, modelAtom.atom.position.y, modelAtom.atom.position.z]
            : math.multiply(inverseDirectTransform, [
                modelAtom.atom.position.x,
                modelAtom.atom.position.y,
                modelAtom.atom.position.z,
            ]);
        for (const transform of transforms) {
            const transformedPosition = transform.operation.applyToPoint(position);
            const key = fractionalKey(transformedPosition);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            expandedAtoms.push({
                position: transformedPosition,
                occupancy: modelAtom.occupancy,
                scatteringAt: modelAtom.scatteringAt,
                displacement: displacementParameters(
                    modelAtom.atom,
                    cell,
                    transform.cartesianRotation,
                ),
            });
        }
    }

    function coefficientAt(h, k, l) {
        const reciprocal = reciprocalTransform.map(row => row[0] * h + row[1] * k + row[2] * l);
        const reciprocalLengthSquared = reciprocal.reduce((sum, value) => sum + value ** 2, 0);
        const sSquared = reciprocalLengthSquared / 4;
        let real = 0;
        let imaginary = 0;
        for (const atom of expandedAtoms) {
            const scattering = atom.scatteringAt(sSquared);
            const phase = TWO_PI * (h * atom.position[0] + k * atom.position[1] + l * atom.position[2]);
            const scale = atom.occupancy * displacementFactor(
                atom.displacement,
                reciprocal,
                reciprocalLengthSquared,
            );
            const cosine = Math.cos(phase);
            const sine = Math.sin(phase);
            real += scale * (scattering.real * cosine - scattering.imaginary * sine);
            imaginary += scale * (scattering.real * sine + scattering.imaginary * cosine);
        }
        return { real, imaginary };
    }

    return {
        coefficientAt,
        calculate(reflections) {
            return reflections.map(reflection => {
                const [h, k, l] = reflectionIndices(reflection);
                const coefficient = coefficientAt(h, k, l);
                return {
                    h, k, l,
                    ...coefficient,
                    amplitude: Math.hypot(coefficient.real, coefficient.imaginary),
                    phase: Math.atan2(coefficient.imaginary, coefficient.real) * 180 / Math.PI,
                };
            });
        },
        metadata: {
            wavelength,
            atomCount: atoms.length,
            expandedAtomCount: expandedAtoms.length,
            sourceCounts,
        },
    };
}
