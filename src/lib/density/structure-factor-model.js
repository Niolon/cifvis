import { CIF } from '../read-cif/base.js';
import { Atom, UnitCell } from '../structure/crystal.js';
import { CellSymmetry } from '../structure/cell-symmetry.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import { FractPosition } from '../structure/position.js';
import * as math from '../math-lite.js';
import { cellsMatch as cellMatches } from './cell-matching.js';
import { finiteNumber, numericScalar } from './cif-values.js';

const TWO_PI = 2 * Math.PI;
const DEBYE_WALLER_SCALE = -2 * Math.PI ** 2;

export { finiteNumber } from './cif-values.js';
export { cellMatches };

function displacementParameters(atom, cell, cartesianRotation, reciprocalTransform) {
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
        const anisotropic = [
            transformed[0][0], transformed[1][1], transformed[2][2],
            transformed[0][1], transformed[0][2], transformed[1][2],
        ];
        const reciprocalQuadratic = math.multiply(
            math.transpose(reciprocalTransform),
            math.multiply(transformed, reciprocalTransform),
        );
        return {
            anisotropic,
            reciprocalQuadratic: [
                reciprocalQuadratic[0][0],
                reciprocalQuadratic[1][1],
                reciprocalQuadratic[2][2],
                reciprocalQuadratic[0][1],
                reciprocalQuadratic[0][2],
                reciprocalQuadratic[1][2],
            ],
        };
    }
    return null;
}

function preparedDisplacementFactor(parameters, prepared, reflectionIndex) {
    if (!parameters) {
        return 1;
    }
    if (parameters.isotropic !== undefined) {
        return Math.exp(
            DEBYE_WALLER_SCALE * parameters.isotropic *
            prepared.reciprocalLengthSquared[reflectionIndex],
        );
    }
    const [c11, c22, c33, c12, c13, c23] = parameters.reciprocalQuadratic;
    return Math.exp(DEBYE_WALLER_SCALE * (
        c11 * prepared.hSquared[reflectionIndex] +
        c22 * prepared.kSquared[reflectionIndex] +
        c33 * prepared.lSquared[reflectionIndex] +
        2 * c12 * prepared.hk[reflectionIndex] +
        2 * c13 * prepared.hl[reflectionIndex] +
        2 * c23 * prepared.kl[reflectionIndex]
    ));
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

function prepareReflectionArrays(reflections, reciprocalTransform) {
    const count = reflections.length;
    const h = new Int32Array(count);
    const k = new Int32Array(count);
    const l = new Int32Array(count);
    const hSquared = new Float64Array(count);
    const kSquared = new Float64Array(count);
    const lSquared = new Float64Array(count);
    const hk = new Float64Array(count);
    const hl = new Float64Array(count);
    const kl = new Float64Array(count);
    const reciprocalLengthSquared = new Float64Array(count);
    const sSquared = new Float64Array(count);
    const uniqueH = new Map();
    const uniqueK = new Map();
    const uniqueL = new Map();
    const hTableIndex = new Int32Array(count);
    const kTableIndex = new Int32Array(count);
    const lTableIndex = new Int32Array(count);
    for (let index = 0; index < count; index++) {
        const indices = reflectionIndices(reflections[index]);
        if (indices.length < 3 || indices.some(value =>
            !Number.isInteger(value) || value < -2147483648 || value > 2147483647)) {
            throw new Error('Structure-factor reflection indices must be 32-bit integers');
        }
        [h[index], k[index], l[index]] = indices;
        hSquared[index] = h[index] ** 2;
        kSquared[index] = k[index] ** 2;
        lSquared[index] = l[index] ** 2;
        hk[index] = h[index] * k[index];
        hl[index] = h[index] * l[index];
        kl[index] = k[index] * l[index];
        const reciprocalX = reciprocalTransform[0][0] * h[index] +
            reciprocalTransform[0][1] * k[index] + reciprocalTransform[0][2] * l[index];
        const reciprocalY = reciprocalTransform[1][0] * h[index] +
            reciprocalTransform[1][1] * k[index] + reciprocalTransform[1][2] * l[index];
        const reciprocalZ = reciprocalTransform[2][0] * h[index] +
            reciprocalTransform[2][1] * k[index] + reciprocalTransform[2][2] * l[index];
        reciprocalLengthSquared[index] = reciprocalX ** 2 + reciprocalY ** 2 + reciprocalZ ** 2;
        sSquared[index] = reciprocalLengthSquared[index] / 4;
        hTableIndex[index] = addUniqueValue(uniqueH, h[index]);
        kTableIndex[index] = addUniqueValue(uniqueK, k[index]);
        lTableIndex[index] = addUniqueValue(uniqueL, l[index]);
    }
    return {
        h, k, l, hSquared, kSquared, lSquared, hk, hl, kl,
        reciprocalLengthSquared, sSquared,
        uniqueH: [...uniqueH.keys()],
        uniqueK: [...uniqueK.keys()],
        uniqueL: [...uniqueL.keys()],
        hTableIndex, kTableIndex, lTableIndex,
    };
}

function addUniqueValue(values, value) {
    let index = values.get(value);
    if (index === undefined) {
        index = values.size;
        values.set(value, index);
    }
    return index;
}

function phaseAxisTable(position, indices) {
    const table = new Float64Array(2 * indices.length);
    for (let index = 0; index < indices.length; index++) {
        const phase = TWO_PI * indices[index] * position;
        table[2 * index] = Math.cos(phase);
        table[2 * index + 1] = Math.sin(phase);
    }
    return table;
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
 * @param {object} structure - Finished, repaired crystal structure.
 * @param {object} block - Coordinate CIF block supplying occupancies.
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
 * factor for each independent atom. Equal `scatteringKey` values identify
 * numerically identical models that share one evaluation per reflection.
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
    const scatteringModels = [];
    const scatteringModelIndices = new Map();
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
        const scatteringKey = resolved.scatteringKey ?? resolved.scatteringAt;
        let scatteringModelIndex = scatteringModelIndices.get(scatteringKey);
        if (scatteringModelIndex === undefined) {
            scatteringModelIndex = scatteringModels.length;
            scatteringModelIndices.set(scatteringKey, scatteringModelIndex);
            scatteringModels.push({
                scatteringAt: resolved.scatteringAt,
                exponentialCount: resolved.exponentialCount ?? 0,
                atoms: [],
            });
        }
        atoms.push({
            atom,
            occupancy: finiteNumber(sourceAtom.occupancy) ?? 1,
            scatteringModelIndex,
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
    let expandedAtomCount = 0;
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
            const expandedAtom = {
                position: transformedPosition,
                occupancy: modelAtom.occupancy,
                displacement: displacementParameters(
                    modelAtom.atom,
                    cell,
                    transform.cartesianRotation,
                    reciprocalTransform,
                ),
            };
            expandedAtomCount++;
            scatteringModels[modelAtom.scatteringModelIndex].atoms.push(expandedAtom);
        }
    }
    const npdAdpLabels = atoms
        .filter(modelAtom => isNpdAdp(modelAtom.atom.adp, cell))
        .map(modelAtom => modelAtom.atom.label);
    const displacementModels = new Set();
    const isotropicDisplacementModels = new Map();
    const reciprocalAnisotropicModels = new Set();
    let noAdpExpandedAtomCount = 0;
    let uisoExpandedAtomCount = 0;
    let uaniExpandedAtomCount = 0;
    for (const scatteringModel of scatteringModels) {
        for (const atom of scatteringModel.atoms) {
            displacementModels.add(JSON.stringify(atom.displacement));
            if (!atom.displacement) {
                noAdpExpandedAtomCount++;
            } else if (atom.displacement.isotropic !== undefined) {
                uisoExpandedAtomCount++;
                let displacementModel = isotropicDisplacementModels.get(atom.displacement.isotropic);
                if (displacementModel === undefined) {
                    displacementModel = { index: isotropicDisplacementModels.size, atomCount: 0 };
                    isotropicDisplacementModels.set(atom.displacement.isotropic, displacementModel);
                }
                displacementModel.atomCount++;
                atom.displacement.isotropicModelIndex = displacementModel.index;
            } else {
                uaniExpandedAtomCount++;
                reciprocalAnisotropicModels.add(JSON.stringify(atom.displacement.reciprocalQuadratic));
            }
        }
    }

    function coefficientAt(h, k, l) {
        const reciprocal = reciprocalTransform.map(row => row[0] * h + row[1] * k + row[2] * l);
        const reciprocalLengthSquared = reciprocal.reduce((sum, value) => sum + value ** 2, 0);
        const sSquared = reciprocalLengthSquared / 4;
        let real = 0;
        let imaginary = 0;
        for (let modelIndex = 0; modelIndex < scatteringModels.length; modelIndex++) {
            const scatteringModel = scatteringModels[modelIndex];
            const scattering = scatteringModel.scatteringAt(sSquared);
            for (const atom of scatteringModel.atoms) {
                const phase = TWO_PI * (
                    h * atom.position[0] + k * atom.position[1] + l * atom.position[2]
                );
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
        }
        return { real, imaginary };
    }

    function calculatePrepared(reflections) {
        const phaseMode = 'tables';
        const dwfMode = 'uiso-vectors';
        const reflectionPreparationStart = performance.now();
        const prepared = prepareReflectionArrays(reflections, reciprocalTransform);
        const reflectionPreparationMs = performance.now() - reflectionPreparationStart;
        const reflectionCount = reflections.length;
        const scatteringPreparationStart = performance.now();
        const scattering = scatteringModels.map(model => {
            const real = new Float64Array(reflectionCount);
            const imaginary = new Float64Array(reflectionCount);
            let realOnly = true;
            for (let reflectionIndex = 0; reflectionIndex < reflectionCount; reflectionIndex++) {
                const value = model.scatteringAt(prepared.sSquared[reflectionIndex]);
                real[reflectionIndex] = value.real;
                imaginary[reflectionIndex] = value.imaginary;
                realOnly &&= value.imaginary === 0;
            }
            return { real, imaginary, realOnly };
        });
        const scatteringPreparationMs = performance.now() - scatteringPreparationStart;
        const real = new Float64Array(reflectionCount);
        const imaginary = new Float64Array(reflectionCount);
        const dwfPreparationStart = performance.now();
        const sharedIsotropicModelCount = [...isotropicDisplacementModels.values()]
            .filter(model => model.atomCount > 1).length;
        const singletonIsotropicAtomCount = [...isotropicDisplacementModels.values()]
            .filter(model => model.atomCount === 1).length;
        const useIsotropicDwfVectors = sharedIsotropicModelCount > 0;
        const isotropicDwfVectors = useIsotropicDwfVectors
            ? [...isotropicDisplacementModels].map(([isotropic, model]) => {
                if (model.atomCount === 1) {
                    return null;
                }
                const values = new Float64Array(reflectionCount);
                for (let reflectionIndex = 0; reflectionIndex < reflectionCount; reflectionIndex++) {
                    values[reflectionIndex] = Math.exp(
                        DEBYE_WALLER_SCALE * isotropic *
                        prepared.reciprocalLengthSquared[reflectionIndex],
                    );
                }
                return values;
            })
            : null;
        const dwfPreparationMs = performance.now() - dwfPreparationStart;
        let phaseTablePreparationMs = 0;
        let accumulationMs = 0;
        let phaseTrigEvaluationCount = 0;
        let dwfExpEvaluationCount = useIsotropicDwfVectors
            ? sharedIsotropicModelCount * reflectionCount
            : 0;

        for (let modelIndex = 0; modelIndex < scatteringModels.length; modelIndex++) {
            const model = scatteringModels[modelIndex];
            const modelScattering = scattering[modelIndex];
            for (const atom of model.atoms) {
                const isotropicDwf = isotropicDwfVectors &&
                    atom.displacement?.isotropicModelIndex !== undefined
                    ? isotropicDwfVectors[atom.displacement.isotropicModelIndex]
                    : null;
                const phasePreparationStart = performance.now();
                const tables = {
                    x: phaseAxisTable(atom.position[0], prepared.uniqueH),
                    y: phaseAxisTable(atom.position[1], prepared.uniqueK),
                    z: phaseAxisTable(atom.position[2], prepared.uniqueL),
                };
                phaseTablePreparationMs += performance.now() - phasePreparationStart;
                phaseTrigEvaluationCount += 2 * (
                    prepared.uniqueH.length + prepared.uniqueK.length + prepared.uniqueL.length
                );
                if (atom.displacement) {
                    dwfExpEvaluationCount += isotropicDwf
                        ? 0
                        : reflectionCount;
                }
                const accumulationStart = performance.now();
                for (let reflectionIndex = 0; reflectionIndex < reflectionCount; reflectionIndex++) {
                    const hOffset = 2 * prepared.hTableIndex[reflectionIndex];
                    const kOffset = 2 * prepared.kTableIndex[reflectionIndex];
                    const lOffset = 2 * prepared.lTableIndex[reflectionIndex];
                    const xyReal = tables.x[hOffset] * tables.y[kOffset] -
                        tables.x[hOffset + 1] * tables.y[kOffset + 1];
                    const xyImaginary = tables.x[hOffset] * tables.y[kOffset + 1] +
                        tables.x[hOffset + 1] * tables.y[kOffset];
                    const phaseReal = xyReal * tables.z[lOffset] -
                        xyImaginary * tables.z[lOffset + 1];
                    const phaseImaginary = xyReal * tables.z[lOffset + 1] +
                        xyImaginary * tables.z[lOffset];
                    const scale = atom.occupancy * (isotropicDwf
                        ? isotropicDwf[reflectionIndex]
                        : preparedDisplacementFactor(
                            atom.displacement,
                            prepared,
                            reflectionIndex,
                        ));
                    if (modelScattering.realOnly) {
                        const amplitude = scale * modelScattering.real[reflectionIndex];
                        real[reflectionIndex] += amplitude * phaseReal;
                        imaginary[reflectionIndex] += amplitude * phaseImaginary;
                    } else {
                        const scatteringReal = modelScattering.real[reflectionIndex];
                        const scatteringImaginary = modelScattering.imaginary[reflectionIndex];
                        real[reflectionIndex] += scale * (
                            scatteringReal * phaseReal - scatteringImaginary * phaseImaginary
                        );
                        imaginary[reflectionIndex] += scale * (
                            scatteringReal * phaseImaginary + scatteringImaginary * phaseReal
                        );
                    }
                }
                accumulationMs += performance.now() - accumulationStart;
            }
        }
        const fSquared = new Float64Array(reflectionCount);
        for (let index = 0; index < reflectionCount; index++) {
            fSquared[index] = real[index] ** 2 + imaginary[index] ** 2;
        }
        const cromerMannExpEvaluationCount = scatteringModels.reduce(
            (sum, model) => sum + model.exponentialCount * reflectionCount,
            0,
        );
        const outputBytes = prepared.h.byteLength + prepared.k.byteLength + prepared.l.byteLength +
            real.byteLength + imaginary.byteLength + fSquared.byteLength;
        const reflectionWorkspaceBytes = [
            prepared.hSquared, prepared.kSquared, prepared.lSquared,
            prepared.hk, prepared.hl, prepared.kl,
            prepared.reciprocalLengthSquared, prepared.sSquared,
            prepared.hTableIndex, prepared.kTableIndex, prepared.lTableIndex,
        ].reduce((sum, array) => sum + array.byteLength, 0);
        const scatteringWorkspaceBytes = scattering.reduce(
            (sum, model) => sum + model.real.byteLength + model.imaginary.byteLength,
            0,
        );
        const phaseTableWorkBytes = 2 * Float64Array.BYTES_PER_ELEMENT * (
            prepared.uniqueH.length + prepared.uniqueK.length + prepared.uniqueL.length
        );
        const dwfWorkBytes = isotropicDwfVectors?.reduce(
            (sum, values) => sum + (values?.byteLength ?? 0),
            0,
        ) ?? 0;
        return {
            h: prepared.h,
            k: prepared.k,
            l: prepared.l,
            real,
            imaginary,
            fSquared,
            diagnostics: {
                backend: 'prepared-soa',
                phaseMode,
                dwfMode,
                dwfVectorReuseEnabled: useIsotropicDwfVectors,
                reflectionPreparationMs,
                scatteringPreparationMs,
                dwfPreparationMs,
                phaseTablePreparationMs,
                accumulationMs,
                reflectionCount,
                expandedAtomCount,
                scatteringModelCount: scatteringModels.length,
                displacementModelCount: displacementModels.size,
                noAdpExpandedAtomCount,
                uisoExpandedAtomCount,
                uaniExpandedAtomCount,
                uniqueUisoCount: isotropicDisplacementModels.size,
                sharedUisoModelCount: sharedIsotropicModelCount,
                uniqueReciprocalUaniTensorCount: reciprocalAnisotropicModels.size,
                uisoDwfExpEvaluationCount: useIsotropicDwfVectors
                    ? (sharedIsotropicModelCount + singletonIsotropicAtomCount) * reflectionCount
                    : uisoExpandedAtomCount * reflectionCount,
                uaniDwfExpEvaluationCount: uaniExpandedAtomCount * reflectionCount,
                phaseTrigEvaluationCount,
                dwfExpEvaluationCount,
                cromerMannExpEvaluationCount,
                outputBytes,
                workBufferBytes: reflectionWorkspaceBytes +
                    scatteringWorkspaceBytes + phaseTableWorkBytes + dwfWorkBytes,
            },
        };
    }

    return {
        coefficientAt,
        calculatePrepared,
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
            expandedAtomCount,
            symmetryOperationCount: transforms.length,
            scatteringModelCount: scatteringModels.length,
            displacementModelCount: displacementModels.size,
            noAdpExpandedAtomCount,
            uisoExpandedAtomCount,
            uaniExpandedAtomCount,
            uniqueUisoCount: isotropicDisplacementModels.size,
            uniqueReciprocalUaniTensorCount: reciprocalAnisotropicModels.size,
            sourceCounts,
            npdAdpCount: npdAdpLabels.length,
            npdAdpLabels,
        },
    };
}
