/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param -- compact model helpers */
import { CIF } from '../read-cif/base.js';
import { Atom, UnitCell } from '../structure/crystal.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import { FractPosition } from '../structure/position.js';
import * as math from '../math-lite.js';
import { cellsMatch as cellMatches } from './cell-matching.js';
import { finiteNumber, numericScalar } from './cif-values.js';

const TWO_PI = 2 * Math.PI;

export { finiteNumber } from './cif-values.js';
export { cellMatches };

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

/** @returns {object|null} Plain displacement data safe for structured cloning. */
function serializeAdp(adp) {
    if (adp instanceof UIsoADP) {
        return { type: 'Uiso', values: [adp.uiso] };
    }
    if (adp instanceof UAnisoADP) {
        return {
            type: 'Uani',
            values: [adp.u11, adp.u22, adp.u33, adp.u12, adp.u13, adp.u23],
        };
    }
    return null;
}

/** @returns {UIsoADP|UAnisoADP|null} Reconstructed displacement object. */
function deserializeAdp(adp) {
    if (adp?.type === 'Uiso') {
        return new UIsoADP(adp.values[0]);
    }
    if (adp?.type === 'Uani') {
        return new UAnisoADP(...adp.values);
    }
    return null;
}

/** @returns {boolean} Whether an ADP has a materially negative Cartesian eigenvalue. */
function isNpdAdp(adp, cell) {
    if (adp instanceof UIsoADP) {
        return adp.uiso < -1e-10;
    }
    if (!(adp instanceof UAnisoADP)) {
        return false;
    }
    const matrix = adp.getUCart(cell);
    const symmetric = [
        [matrix[0], matrix[3], matrix[4]],
        [matrix[3], matrix[1], matrix[5]],
        [matrix[4], matrix[5], matrix[2]],
    ];
    return math.eigs(symmetric).eigenvectors.some(entry => entry.value < -1e-10);
}

/**
 * Captures the already constructed/repaired coordinate model for worker use.
 * Occupancies remain sourced from the atom-site loop because display Atom
 * objects intentionally do not carry refinement-only site metadata.
 * @returns {object} Structured-clone-safe structure-factor input.
 */
export function createStructureFactorModelInput(structure, block) {
    const atomSite = block.get('_atom_site');
    const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
    const occupancies = atomSite.get(
        ['_atom_site.occupancy', '_atom_site_occupancy'],
        Array(labels.length).fill(1),
    );
    const occupancyByLabel = new Map(labels.map((label, index) => [
        String(label),
        finiteNumber(occupancies[index]) ?? 1,
    ]));
    const inverseDirectTransform = math.inv(structure.cell.fractToCartMatrix);
    const atoms = structure.atoms.map(atom => {
        const position = atom.position instanceof FractPosition
            ? [atom.position.x, atom.position.y, atom.position.z]
            : math.multiply(inverseDirectTransform, [
                atom.position.x,
                atom.position.y,
                atom.position.z,
            ]);
        return {
            label: atom.label,
            atomType: atom.atomType,
            position: Array.isArray(position) ? position : position.toArray(),
            adp: serializeAdp(atom.adp),
            occupancy: occupancyByLabel.get(String(atom.label)) ?? 1,
        };
    });
    return {
        cell: Object.fromEntries(
            ['a', 'b', 'c', 'alpha', 'beta', 'gamma'].map(name => [name, structure.cell[name]]),
        ),
        atoms,
        symmetryOperations: structure.symmetry.symmetryOperations.map(operation => ({
            rotation: operation.rotMatrix.map(row => [...row]),
            translation: [...operation.transVector],
        })),
        wavelength: numericScalar(block, [
            '_diffrn_radiation_wavelength.wavelength',
            '_diffrn_radiation.wavelength',
            '_diffrn_radiation_wavelength',
        ]),
    };
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
    const input = options.structureModel ?? null;
    const cell = input
        ? new UnitCell(
            input.cell.a,
            input.cell.b,
            input.cell.c,
            input.cell.alpha,
            input.cell.beta,
            input.cell.gamma,
        )
        : UnitCell.fromCIF(block);
    if (options.expectedCell && !cellMatches(cell, options.expectedCell)) {
        throw new Error('Structure-factor coordinate CIF cell does not match the reflection cell');
    }
    const wavelength = input?.wavelength ?? numericScalar(block, [
        '_diffrn_radiation_wavelength.wavelength',
        '_diffrn_radiation.wavelength',
        '_diffrn_radiation_wavelength',
    ]) ?? finiteNumber(options.wavelength);
    const sourceAtoms = input?.atoms ?? (() => {
        const atomSite = block.get('_atom_site');
        const labels = atomSite.get(['_atom_site.label', '_atom_site_label']);
        const occupancies = atomSite.get(
            ['_atom_site.occupancy', '_atom_site_occupancy'],
            Array(labels.length).fill(1),
        );
        return labels.map((label, index) => ({ label, index, occupancy: occupancies[index] }));
    })();
    const atoms = [];
    const sourceCounts = {};
    for (let sourceIndex = 0; sourceIndex < sourceAtoms.length; sourceIndex++) {
        const sourceAtom = sourceAtoms[sourceIndex];
        let atom;
        const atomIndex = sourceAtom.index ?? sourceIndex;
        if (input) {
            atom = new Atom(
                sourceAtom.label,
                sourceAtom.atomType,
                new FractPosition(...sourceAtom.position),
                deserializeAdp(sourceAtom.adp),
            );
        } else {
            try {
                atom = Atom.fromCIF(block, atomIndex);
            } catch (error) {
                if (error.message.includes('Dummy atom')) {
                    continue;
                }
                throw error;
            }
        }
        const resolved = options.resolveAtom({ atom, index: atomIndex, block, wavelength });
        if (!resolved || typeof resolved.scatteringAt !== 'function') {
            throw new Error(`No scattering-factor model for atom ${atom.label} (${atom.atomType})`);
        }
        const source = resolved.source ?? 'unknown';
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
        atoms.push({
            atom,
            occupancy: finiteNumber(sourceAtom.occupancy) ?? 1,
            scatteringAt: resolved.scatteringAt,
        });
    }

    const directTransform = cell.fractToCartMatrix.toArray();
    const inverseDirectTransform = math.inv(directTransform);
    const reciprocalResult = math.transpose(inverseDirectTransform);
    const reciprocalTransform = Array.isArray(reciprocalResult)
        ? reciprocalResult
        : reciprocalResult.toArray();
    const symmetryOperations = input?.symmetryOperations ??
        CellSymmetry.fromCIF(block).symmetryOperations.map(operation => ({
            rotation: operation.rotMatrix,
            translation: operation.transVector,
        }));
    const transforms = symmetryOperations.map(operation => ({
        operation: {
            rotation: operation.rotation,
            translation: operation.translation,
        },
        cartesianRotation: math.multiply(
            math.multiply(directTransform, operation.rotation),
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
            const transformedResult = math.add(
                math.multiply(transform.operation.rotation, position),
                transform.operation.translation,
            );
            const transformedPosition = Array.isArray(transformedResult)
                ? transformedResult
                : transformedResult.toArray();
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
    const npdAdpLabels = atoms
        .filter(modelAtom => isNpdAdp(modelAtom.atom.adp, cell))
        .map(modelAtom => modelAtom.atom.label);

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
            npdAdpCount: npdAdpLabels.length,
            npdAdpLabels,
        },
    };
}
