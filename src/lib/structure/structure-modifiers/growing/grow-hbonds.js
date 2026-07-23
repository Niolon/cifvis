
import { HBond, Bond } from '../../bonds.js';
import { CrystalStructure } from '../../crystal.js';
import { combineAtomId } from './util.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';

const equivalentPositionCodeCaches = new WeakMap();
const inversePositionCodeCaches = new WeakMap();
const reciprocalPositionCodeCaches = new WeakMap();

/**
 * @param {object} position - Fractional position
 * @returns {string} Rounded coordinate key
 */
function coordinateKey(position) {
    return `${Math.round(position.x * 1e8)},${Math.round(position.y * 1e8)},${Math.round(position.z * 1e8)}`;
}

/**
 * @param {object} symmetry - Cell symmetry instance
 * @param {string} positionCode - Position code to invert
 * @returns {string} Inverse position code
 */
function cachedInversePositionCode(symmetry, positionCode) {
    let cache = inversePositionCodeCaches.get(symmetry);
    if (!cache) {
        cache = new Map();
        inversePositionCodeCaches.set(symmetry, cache);
    }
    if (!cache.has(positionCode)) {
        cache.set(positionCode, symmetry.invertPositionCode(positionCode));
    }
    return cache.get(positionCode);
}

/**
 * Finds every position code that places an atom at the same absolute fractional
 * position as a requested code. Atoms on special positions can have several
 * such codes, and each inverse can correspond to a distinct reciprocal donor.
 * @param {CrystalStructure} structure - Structure providing the symmetry group
 * @param {object} atom - Asymmetric-unit atom to transform
 * @param {string} positionCode - Requested absolute position code
 * @returns {string[]} Equivalent absolute position codes
 */
export function equivalentPositionCodes(structure, atom, positionCode) {
    let cache = equivalentPositionCodeCaches.get(structure.symmetry);
    if (!cache) {
        cache = new Map();
        equivalentPositionCodeCaches.set(structure.symmetry, cache);
    }
    const sourceKey = coordinateKey(atom.position);
    const exactCacheKey = `code|${sourceKey}|${positionCode}`;
    if (cache.has(exactCacheKey)) {
        return cache.get(exactCacheKey);
    }

    const transformedPosition = structure.symmetry.applySymmetry(positionCode, [atom])[0].position;
    const cacheKey = `position|${sourceKey}|${coordinateKey(transformedPosition)}`;
    if (cache.has(cacheKey)) {
        const equivalentCodes = cache.get(cacheKey);
        cache.set(exactCacheKey, equivalentCodes);
        return equivalentCodes;
    }

    const target = [transformedPosition.x, transformedPosition.y, transformedPosition.z];
    const source = [atom.position.x, atom.position.y, atom.position.z];
    const equivalentCodes = [];

    for (const [operationId, operationIndex] of structure.symmetry.operationIds) {
        const operation = structure.symmetry.symmetryOperations[operationIndex];
        const operationPosition = operation.applyToPoint(source);
        const translation = target.map((coordinate, index) => coordinate - operationPosition[index]);
        if (translation.every(value => Math.abs(value - Math.round(value)) < 1e-5)) {
            equivalentCodes.push(new AppliedSymmetry(
                operationId,
                translation.map(value => Math.round(value)),
            ).key);
        }
    }

    cache.set(cacheKey, equivalentCodes);
    cache.set(exactCacheKey, equivalentCodes);
    return equivalentCodes;
}

/**
 * Returns unique reciprocal operations for an H-bond definition, cached by
 * symmetry object and absolute endpoint positions.
 * @param {CrystalStructure} structure - Structure providing symmetry
 * @param {HBond} hBond - External H-bond definition
 * @param {object} donorAtom - Donor atom instance
 * @param {object} hydrogenAtom - Hydrogen atom instance
 * @param {string[]} equivalentAcceptorCodes - Codes for the same acceptor site
 * @returns {Array<{inverseSymmetry: string, positionKey: string}>} Reciprocal representatives
 */
function reciprocalPositionCodes(structure, hBond, donorAtom, hydrogenAtom, equivalentAcceptorCodes) {
    let cache = reciprocalPositionCodeCaches.get(structure.symmetry);
    if (!cache) {
        cache = new Map();
        reciprocalPositionCodeCaches.set(structure.symmetry, cache);
    }
    const cacheKey = [
        hBond.donorAtomLabel,
        hBond.hydrogenAtomLabel,
        hBond.acceptorAtomLabel,
        coordinateKey(donorAtom.position),
        coordinateKey(hydrogenAtom.position),
        equivalentAcceptorCodes.join(','),
    ].join('|');
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const reciprocalCodes = [];
    const positions = new Set();
    for (const equivalentAcceptorCode of equivalentAcceptorCodes) {
        const inverseSymmetry = cachedInversePositionCode(structure.symmetry, equivalentAcceptorCode);
        const [reciprocalDonor, reciprocalHydrogen] = structure.symmetry.applySymmetry(
            inverseSymmetry, [donorAtom, hydrogenAtom],
        );
        const positionKey = `${coordinateKey(reciprocalDonor.position)},${coordinateKey(reciprocalHydrogen.position)}`;
        if (!positions.has(positionKey)) {
            positions.add(positionKey);
            reciprocalCodes.push({ inverseSymmetry, positionKey });
        }
    }
    cache.set(cacheKey, reciprocalCodes);
    return reciprocalCodes;
}

/**
 * Keeps chemically plausible bonds whose displayed endpoints reproduce the CIF distance.
 * Unresolved external metadata is retained but does not participate in connectivity.
 * @param {CrystalStructure} structure - Structure providing atoms and cell
 * @param {Bond[]} bonds - Bonds to validate
 * @returns {Bond[]} Geometry-compatible bonds
 */
export function filterBondsByGeometry(structure, bonds) {
    const atomsById = new Map(structure.atoms.map(atom => [atom.uniqueId, atom]));
    const keptById = new Map();
    for (const bond of bonds) {
        const atom1 = atomsById.get(bond.atom1Id);
        const atom2 = atomsById.get(bond.atom2Id);
        if (!atom1 || !atom2) {
            if (atom1 && bond.atom2SiteSymmetry && bond.atom2SiteSymmetry !== '.') {
                keptById.set(`${bond.atom1Id}|${bond.atom2Id}`, bond);
            }
            continue;
        }
        if (!Number.isFinite(bond.bondLength) || bond.bondLength > 4) {
            continue;
        }
        const cart1 = atom1.position.toCartesian(structure.cell);
        const cart2 = atom2.position.toCartesian(structure.cell);
        const actualLength = Math.hypot(
            cart1.x - cart2.x,
            cart1.y - cart2.y,
            cart1.z - cart2.z,
        );
        if (Math.abs(actualLength - bond.bondLength) <= Math.max(0.15, bond.bondLength * 0.1)) {
            const identifier = [bond.atom1Id, bond.atom2Id].sort().join('|');
            if (!keptById.has(identifier)) {
                keptById.set(identifier, bond);
            }
        }
    }
    return Array.from(keptById.values());
}

/**
 * Selects the displayed periodic images that reproduce each CIF H-bond geometry.
 * Component centring can change atom IDs and leave stale pre-centred interactions;
 * the crystallographic distances provide an unambiguous final reconciliation.
 * @param {CrystalStructure} structure - Structure containing grown periodic images
 * @returns {CrystalStructure} Structure with geometry-compatible H-bonds
 */
export function reconcileHBondsByGeometry(structure) {
    const atomsById = new Map(structure.atoms.map(atom => [atom.uniqueId, atom]));
    const atomsByLabel = new Map();
    for (const atom of structure.atoms) {
        if (!atomsByLabel.has(atom.label)) {
            atomsByLabel.set(atom.label, []);
        }
        atomsByLabel.get(atom.label).push(atom);
    }
    const distance = (atom1, atom2) => {
        const cart1 = atom1.position.toCartesian(structure.cell);
        const cart2 = atom2.position.toCartesian(structure.cell);
        return Math.hypot(cart1.x - cart2.x, cart1.y - cart2.y, cart1.z - cart2.z);
    };
    const tolerance = target => Math.max(0.15, target * 0.1);
    const compatible = (actual, target) => !Number.isFinite(target) ||
        Math.abs(actual - target) <= tolerance(target);

    const reconciled = [];
    const identifiers = new Set();
    for (const hbond of structure.hBonds) {
        const donorCandidates = atomsByLabel.get(hbond.donorAtomLabel) || [];
        const hydrogenCandidates = atomsByLabel.get(hbond.hydrogenAtomLabel) || [];
        const acceptorCandidates = atomsByLabel.get(hbond.acceptorAtomLabel) || [];
        let best = null;

        let donorHydrogenPairs = [];
        const currentDonor = atomsById.get(hbond.donorAtomId);
        const currentHydrogen = atomsById.get(hbond.hydrogenAtomId);
        if (currentDonor && currentHydrogen &&
            compatible(distance(currentDonor, currentHydrogen), hbond.donorHydrogenDistance)) {
            donorHydrogenPairs = [[currentDonor, currentHydrogen]];
        } else {
            let bestPair = null;
            for (const donor of donorCandidates) {
                for (const hydrogen of hydrogenCandidates) {
                    const actual = distance(donor, hydrogen);
                    const error = Math.abs(actual - hbond.donorHydrogenDistance);
                    if (compatible(actual, hbond.donorHydrogenDistance) &&
                        (!bestPair || error < bestPair.error)) {
                        bestPair = { donor, hydrogen, error };
                    }
                }
            }
            if (bestPair) {
                donorHydrogenPairs = [[bestPair.donor, bestPair.hydrogen]];
            }
        }

        for (const [donor, hydrogen] of donorHydrogenPairs) {
            const donorHydrogenDistance = distance(donor, hydrogen);
            for (const acceptor of acceptorCandidates) {
                const acceptorHydrogenDistance = distance(hydrogen, acceptor);
                const donorAcceptorDistance = distance(donor, acceptor);
                if (!compatible(acceptorHydrogenDistance, hbond.acceptorHydrogenDistance) ||
                    !compatible(donorAcceptorDistance, hbond.donorAcceptorDistance)) {
                    continue;
                }
                const score = Math.abs(donorHydrogenDistance - hbond.donorHydrogenDistance) +
                    Math.abs(acceptorHydrogenDistance - hbond.acceptorHydrogenDistance) +
                    Math.abs(donorAcceptorDistance - hbond.donorAcceptorDistance);
                if (!best || score < best.score) {
                    best = { donor, hydrogen, acceptor, score };
                }
            }
        }
        if (!best) {
            continue;
        }

        const identifier = `${best.donor.uniqueId}|${best.hydrogen.uniqueId}|${best.acceptor.uniqueId}`;
        if (identifiers.has(identifier)) {
            continue;
        }
        identifiers.add(identifier);
        reconciled.push(new HBond(
            best.donor.uniqueId,
            best.hydrogen.uniqueId,
            best.acceptor.uniqueId,
            hbond.donorHydrogenDistance,
            hbond.donorHydrogenDistanceSU,
            hbond.acceptorHydrogenDistance,
            hbond.acceptorHydrogenDistanceSU,
            hbond.donorAcceptorDistance,
            hbond.donorAcceptorDistanceSU,
            hbond.hBondAngle,
            hbond.hBondAngleSU,
            '.',
        ));
    }

    return new CrystalStructure(
        structure.cell,
        structure.atoms,
        structure.bonds,
        reconciled,
        structure.symmetry,
    );
}

/**
 * Grows external hydrogen bonds (HBonds) in a crystal structure by applying symmetry operations
 * to connected groups and generating new atoms, bonds, and HBonds as needed.
 *
 * This function identifies HBonds that cross symmetry boundaries (i.e., those with a non-'.'
 * acceptorAtomSymmetry), applies the corresponding symmetry operation to the connected group,
 * and adds the resulting atoms, bonds, and HBonds to the structure. It ensures that each group
 * is only grown once per symmetry operation to avoid duplication.
 * @param {CrystalStructure} structure - The crystal structure to grow HBonds for.
 * @param {Map<string, string>} [specialPositionAtoms] - Symmetry atom IDs mapped to their
 * canonical special-position atom IDs during preceding fragment growth.
 * @returns {CrystalStructure} A new CrystalStructure instance with the grown atoms, bonds, and HBonds.
 * @throws {Error} If an HBond references a non-existing acceptor atom.
 */
export function growExternalHBonds(structure, specialPositionAtoms = new Map()) {
    const groups = structure.calculateConnectedGroups();
    const grownSpecialPositionAtoms = new Map();
    const resolveSpecialPosition = (atomId) => {
        const resolvedStartingId = specialPositionAtoms.get(atomId) || atomId;
        return grownSpecialPositionAtoms.get(resolvedStartingId) ||
            grownSpecialPositionAtoms.get(atomId) || resolvedStartingId;
    };
    const atomsById = new Map(structure.atoms.map(atom => [atom.uniqueId, atom]));
    const atomsByLabel = new Map();
    const groupByAtomId = new Map();
    const groupByAtomLabel = new Map();
    groups.forEach((group, groupIndex) => {
        group.atoms.forEach(atom => {
            groupByAtomId.set(atom.uniqueId, groupIndex);
            if (!groupByAtomLabel.has(atom.label)) {
                groupByAtomLabel.set(atom.label, groupIndex);
            }
            if (!atomsByLabel.has(atom.label)) {
                atomsByLabel.set(atom.label, atom);
            }
        });
    });

    const growableHBonds = [];
    const finalHBonds = [];
    const growableDefinitionIds = new Set();
    structure.hBonds.forEach(hBond => {
        if (hBond.acceptorAtomSymmetry === '.') {
            finalHBonds.push(hBond);
        } else {
            // Fragment growth carries symmetry-transformed copies of the same CIF
            // interaction. They are already-realized images, not independent seeds
            // for another growth shell.
            const donorSymmetryId = hBond.donorAtomId.includes('|')
                ? hBond.donorAtomId.split('|')[1].split('_')[0]
                : structure.symmetry.identitySymOpId;
            const definitionId = [
                hBond.donorAtomLabel,
                hBond.hydrogenAtomLabel,
                hBond.acceptorAtomLabel,
                donorSymmetryId,
                hBond.donorHydrogenDistance,
                hBond.acceptorHydrogenDistance,
                hBond.donorAcceptorDistance,
                hBond.hBondAngle,
            ].join('|');
            if (!growableDefinitionIds.has(definitionId)) {
                growableDefinitionIds.add(definitionId);
                growableHBonds.push(hBond);
            }
        }
    });

    // calculateConnectedGroups intentionally excludes external H-bonds. Index them
    // separately by the covalent donor group so all interactions belonging to a copied
    // molecule can be transformed together.
    const externalHBondsByGroup = groups.map(() => []);
    for (const hBond of growableHBonds) {
        const donorGroupIndex = groupByAtomId.get(hBond.donorAtomId);
        if (donorGroupIndex !== undefined) {
            externalHBondsByGroup[donorGroupIndex].push(hBond);
        }
    }

    const alreadyGrownGroups = new Set();

    const finalAtoms = [...structure.atoms];
    const finalBonds = [...structure.bonds];
    const finalAtomIds = new Set(finalAtoms.map(atom => atom.uniqueId));
    const finalAtomIdsByPosition = new Map(finalAtoms.map(atom => [
        `${atom.label}|${coordinateKey(atom.position)}`,
        atom.uniqueId,
    ]));
    const finalBondIds = new Set(finalBonds.map(bond =>
        [resolveSpecialPosition(bond.atom1Id), resolveSpecialPosition(bond.atom2Id)].sort().join('|'),
    ));
    const finalHBondIds = new Set(finalHBonds.map(hBond =>
        `${hBond.donorAtomId}|${hBond.hydrogenAtomId}|${hBond.acceptorAtomId}`,
    ));
    const reciprocalHBondPositions = new Set();
    const transformedExternalHBonds = [];
    const addFinalHBond = hBond => {
        const identifier = `${hBond.donorAtomId}|${hBond.hydrogenAtomId}|${hBond.acceptorAtomId}`;
        if (!finalHBondIds.has(identifier)) {
            finalHBonds.push(hBond);
            finalHBondIds.add(identifier);
        }
    };
    const addFinalBond = (bond) => {
        const identifier = [bond.atom1Id, bond.atom2Id].sort().join('|');
        if (!finalBondIds.has(identifier)) {
            finalBonds.push(bond);
            finalBondIds.add(identifier);
        }
    };

    /**
     * Grows one connected group with an outer symmetry operation.
     * @param {number} groupIndex - Connected-group index
     * @param {string} symOpLabel - Outer symmetry operation
     */
    const growGroup = (groupIndex, symOpLabel) => {
        const growLabel = `${groupIndex}@${symOpLabel}`;
        if (alreadyGrownGroups.has(growLabel)) {
            return;
        }
        alreadyGrownGroups.add(growLabel);

        const group = groups[groupIndex];
        const symmetryAtoms = structure.symmetry.applySymmetry(symOpLabel, group.atoms);
        for (let i = 0; i < symmetryAtoms.length; i++) {
            const atom = symmetryAtoms[i];
            const originalAtom = group.atoms[i];

            let combinedSymm = symOpLabel;
            if (originalAtom.appliedSymmetry &&
                originalAtom.appliedSymmetry.key !== `${structure.symmetry.identitySymOpId}_555`) {
                combinedSymm = structure.symmetry.combineSymmetryCodes(
                    symOpLabel, originalAtom.appliedSymmetry.key,
                );
            }

            atom.appliedSymmetry = AppliedSymmetry.fromString(combinedSymm);
            const atomPositionKey = `${atom.label}|${coordinateKey(atom.position)}`;
            const positionAtomId = finalAtomIdsByPosition.get(atomPositionKey);
            if (positionAtomId) {
                if (positionAtomId !== atom.uniqueId) {
                    grownSpecialPositionAtoms.set(atom.uniqueId, positionAtomId);
                }
            } else if (!finalAtomIds.has(atom.uniqueId)) {
                finalAtoms.push(atom);
                finalAtomIds.add(atom.uniqueId);
                finalAtomIdsByPosition.set(atomPositionKey, atom.uniqueId);
            }
        }

        group.bonds
            .filter(({ atom2SiteSymmetry }) => atom2SiteSymmetry === '.')
            .forEach(bond => {
                addFinalBond(new Bond(
                    resolveSpecialPosition(combineAtomId(
                        bond.atom1Id, symOpLabel, structure.symmetry,
                    )),
                    resolveSpecialPosition(combineAtomId(
                        bond.atom2Id, symOpLabel, structure.symmetry,
                    )),
                    bond.bondLength,
                    bond.bondLengthSU,
                    '.',
                ));
            });

        const groupHBonds = [...group.hBonds, ...externalHBondsByGroup[groupIndex]];
        groupHBonds.forEach(groupHBond => {
            if (groupHBond.acceptorAtomSymmetry === '.') {
                addFinalHBond(new HBond(
                    resolveSpecialPosition(combineAtomId(
                        groupHBond.donorAtomId, symOpLabel, structure.symmetry,
                    )),
                    resolveSpecialPosition(combineAtomId(
                        groupHBond.hydrogenAtomId, symOpLabel, structure.symmetry,
                    )),
                    resolveSpecialPosition(combineAtomId(
                        groupHBond.acceptorAtomId, symOpLabel, structure.symmetry,
                    )),
                    groupHBond.donorHydrogenDistance,
                    groupHBond.donorHydrogenDistanceSU,
                    groupHBond.acceptorHydrogenDistance,
                    groupHBond.acceptorHydrogenDistanceSU,
                    groupHBond.donorAcceptorDistance,
                    groupHBond.donorAcceptorDistanceSU,
                    groupHBond.hBondAngle,
                    groupHBond.hBondAngleSU,
                    '.',
                ));
                return;
            }

            // Defer external interactions until every requested group has been grown.
            // Their transformed acceptor may be supplied by a later reciprocal image.
            transformedExternalHBonds.push(new HBond(
                resolveSpecialPosition(combineAtomId(
                    groupHBond.donorAtomId, symOpLabel, structure.symmetry,
                )),
                resolveSpecialPosition(combineAtomId(
                    groupHBond.hydrogenAtomId, symOpLabel, structure.symmetry,
                )),
                resolveSpecialPosition(combineAtomId(
                    groupHBond.acceptorAtomId, symOpLabel, structure.symmetry,
                )),
                groupHBond.donorHydrogenDistance,
                groupHBond.donorHydrogenDistanceSU,
                groupHBond.acceptorHydrogenDistance,
                groupHBond.acceptorHydrogenDistanceSU,
                groupHBond.donorAcceptorDistance,
                groupHBond.donorAcceptorDistanceSU,
                groupHBond.hBondAngle,
                groupHBond.hBondAngleSU,
                '.',
            ));
        });
    };

    for (const hBond of growableHBonds) {
        // Extract base label from acceptorAtomLabel (may already contain symmetry like 'O|1_554')
        const acceptorBaseLabel = hBond.acceptorAtomId.split('|')[0];
        // find group index of acceptor atom, should always be possible because
        // of checks in structure.calculateConnectedGroups()
        // Extract base label from acceptorAtomId (e.g., 'N1|2_555' -> 'N1')
        const acceptorGroupBaseLabel = hBond.acceptorAtomId.split('|')[0];
        const acceptorGroupIndex = groupByAtomLabel.get(acceptorGroupBaseLabel);
        if (acceptorGroupIndex === undefined) {
            throw new Error(
                `Cannot grow H-bond: acceptor atom ${acceptorGroupBaseLabel} is not in the structure`,
            );
        }

        const symOpLabel = hBond.acceptorAtomSymmetry;
        growGroup(acceptorGroupIndex, symOpLabel);

        // Add the now-internal H-bond only after its acceptor has been validated.
        addFinalHBond(new HBond(
            resolveSpecialPosition(hBond.donorAtomId),
            resolveSpecialPosition(hBond.hydrogenAtomId),
            resolveSpecialPosition(combineAtomId(
                acceptorBaseLabel, hBond.acceptorAtomSymmetry, structure.symmetry,
            )),
            hBond.donorHydrogenDistance,
            hBond.donorHydrogenDistanceSU,
            hBond.acceptorHydrogenDistance,
            hBond.acceptorHydrogenDistanceSU,
            hBond.donorAcceptorDistance,
            hBond.donorAcceptorDistanceSU,
            hBond.hBondAngle,
            hBond.hBondAngleSU,
            '.',
        ));

        // Also grow the periodic equivalents pointing into the base acceptor.
        // An acceptor on a special position can have multiple position codes at
        // the same absolute site. Their inverses can place donors at distinct
        // reciprocal images, so inverting only the literal CIF code loses part
        // of the H-bond orbit (as for the two Hb donors accepted by urea O).
        const donorGroupIndex = groupByAtomId.get(hBond.donorAtomId);
        if (donorGroupIndex === undefined) {
            throw new Error(
                `Cannot grow reciprocal H-bond: donor atom ${hBond.donorAtomId} is not in the structure`,
            );
        }
        const acceptorAtom = atomsByLabel.get(acceptorBaseLabel);
        const equivalentAcceptorCodes = equivalentPositionCodes(structure, acceptorAtom, symOpLabel);
        const donorAtom = atomsById.get(hBond.donorAtomId);
        const hydrogenAtom = atomsById.get(hBond.hydrogenAtomId);
        if (!donorAtom || !hydrogenAtom) {
            throw new Error(
                'Cannot grow reciprocal H-bond: donor or hydrogen atom of '
                + `${hBond.donorAtomId}-${hBond.hydrogenAtomId} is not in the structure`,
            );
        }
        const reciprocalCodes = reciprocalPositionCodes(
            structure, hBond, donorAtom, hydrogenAtom, equivalentAcceptorCodes,
        );
        for (const { inverseSymmetry, positionKey: reciprocalPositionKey } of reciprocalCodes) {
            const positionKey = [
                hBond.donorAtomLabel,
                hBond.hydrogenAtomLabel,
                acceptorBaseLabel,
                reciprocalPositionKey,
            ].join('|');
            if (reciprocalHBondPositions.has(positionKey)) {
                continue;
            }
            reciprocalHBondPositions.add(positionKey);

            growGroup(donorGroupIndex, inverseSymmetry);
            addFinalHBond(new HBond(
                resolveSpecialPosition(combineAtomId(
                    hBond.donorAtomId, inverseSymmetry, structure.symmetry,
                )),
                resolveSpecialPosition(combineAtomId(
                    hBond.hydrogenAtomId, inverseSymmetry, structure.symmetry,
                )),
                `${acceptorBaseLabel}|${structure.symmetry.identitySymOpId}_555`,
                hBond.donorHydrogenDistance,
                hBond.donorHydrogenDistanceSU,
                hBond.acceptorHydrogenDistance,
                hBond.acceptorHydrogenDistanceSU,
                hBond.donorAcceptorDistance,
                hBond.donorAcceptorDistanceSU,
                hBond.hBondAngle,
                hBond.hBondAngleSU,
                '.',
            ));
        }
    }

    // A symmetry-completed donor molecule can carry more than the single H-bond that
    // requested its growth. Retain every transformed interaction whose full set of
    // endpoints is now present, including H-bonds from the other half of a molecule
    // completed across a special position.
    for (const hBond of transformedExternalHBonds) {
        if (finalAtomIds.has(hBond.donorAtomId) &&
            finalAtomIds.has(hBond.hydrogenAtomId) &&
            finalAtomIds.has(hBond.acceptorAtomId)) {
            addFinalHBond(hBond);
        }
    }

    return new CrystalStructure(
        structure.cell,
        finalAtoms,
        finalBonds,
        finalHBonds,
        structure.symmetry,
    );
}
