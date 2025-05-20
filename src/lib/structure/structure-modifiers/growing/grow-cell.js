import { CellSymmetry } from '../../cell-symmetry.js';
import { CrystalStructure } from '../../crystal.js';

import { create, all } from 'mathjs';
import { createSymAtomLabel } from './grow-fragment.js';

const math = create(all, {});

/**
 * @typedef {object} FractionalLimits
 * @property {number} minX - Minimum fractional X coordinate.
 * @property {number} maxX - Maximum fractional X coordinate.
 * @property {number} minY - Minimum fractional Y coordinate.
 * @property {number} maxY - Maximum fractional Y coordinate.
 * @property {number} minZ - Minimum fractional Z coordinate.
 * @property {number} maxZ - Maximum fractional Z coordinate.
 */

/**
 * Creates a set of symmetry element that will fill the complete cell, when executed subsequently on the
 * fragment grown from previously grown sets
 * @param {CellSymmetry} symmetry - Cell symmetry for which the minimal set should be determined
 * @returns {string[]} - Array containing the ids of the unique set.
 */
export function minimalGrowthSet(symmetry) {
    const generatedSet = new Set();
    const keepSet = [];
    keepSet.push(symmetry.identitySymOpId);

    symmetry.operationIds.keys().forEach( id => {
        if (keepSet.includes(id) || generatedSet.has(id)) {
            return;
        }
        keepSet.forEach(exist_id => {
            const combinedId = symmetry.combineSymmetryCodes(exist_id + '_555', id + '_555');
            generatedSet.add(combinedId.split('_')[0]);
        });
        keepSet.push(id);
    });
    return keepSet;
}

/**
 * Calculates the minimum and maximum fractional coordinates (x, y, z)
 * for all atoms in the asymmetric unit of the provided crystal structure.
 * @param {CrystalStructure} structure - The crystal structure to analyze.
 * @returns {FractionalLimits} An object containing the min/max fractional coordinates.
 */
export function getFragmentLimits(structure) {
    let minX, maxX;
    let minY, maxY;
    let minZ, maxZ;

    for (const atom of structure.atoms) {
        if (minX === undefined || atom.position.x < minX) {
            minX = atom.position.x;
        }
        if (maxX === undefined || atom.position.x > maxX) {
            maxX = atom.position.x;
        }
        if (minY === undefined || atom.position.y < minY) {
            minY = atom.position.y;
        }
        if (maxY === undefined || atom.position.y > maxY) {
            maxY = atom.position.y;
        }
        if (minZ === undefined || atom.position.z < minZ) {
            minZ = atom.position.z;
        }
        if (maxZ === undefined || atom.position.z > maxZ) {
            maxZ = atom.position.z;
        }
    }
    return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Applies a symmetry operation to fractional coordinate limits.
 * @param {FractionalLimits} limits - The initial fractional coordinate limits.
 * @param {SymmetryOperation} symOp - The symmetry operation to apply.
 * @returns {FractionalLimits} The transformed fractional coordinate limits.
 */
export function getSymmetryLimits(limits, symOp) {
    const minVec = math.matrix([limits.minX, limits.minY, limits.minZ]);
    const maxVec = math.matrix([limits.maxX, limits.maxY, limits.maxZ]);
    const symmMinVec = math.multiply(symOp.rotMatrix, minVec) + symOp.transVector;
    const symmMaxVec = math.multiply(symOp.rotMatrix, maxVec) + symOp.transVector;
    return {
        minX: symmMinVec.get([0]) < symmMaxVec.get([0]) ? symmMinVec.get([0]) : symmMaxVec.get([0]),
        maxX: symmMinVec.get([0]) > symmMaxVec.get([0]) ? symmMinVec.get([0]) : symmMaxVec.get([0]),
        minY: symmMinVec.get([1]) < symmMaxVec.get([1]) ? symmMinVec.get([1]) : symmMaxVec.get([1]),
        maxY: symmMinVec.get([1]) > symmMaxVec.get([1]) ? symmMinVec.get([1]) : symmMaxVec.get([1]),
        minZ: symmMinVec.get([2]) < symmMaxVec.get([2]) ? symmMinVec.get([2]) : symmMaxVec.get([2]),
        maxZ: symmMinVec.get([2]) > symmMaxVec.get([2]) ? symmMinVec.get([2]) : symmMaxVec.get([2]),
    };  
}

/**
 *
 * @param limits
 * @param symmetry
 */
export function getSymmetryCentre(limits, symmetry) {
    const symmLimits = getSymmetryLimits(limits, symmetry);
    return {
        x: (symmLimits.minX + symmLimits.maxX) / 2,
        y: (symmLimits.minY + symmLimits.maxY) / 2,
        z: (symmLimits.minZ + symmLimits.maxZ) / 2,
    };
}

/**
 * 
 * @param {CrystalStructure} structure 
 */
function evaluateAtomGroupsGrown(structure) {
    const atomGroups = structure.calculateConnectedGroups();
    const identitySymOp = structure.symmetry.identitySymOpId;
    const presentSymmetries = atomGroups.map(g => {
        const groupSymmetries = new Set();
        for (const atom of g) {
            const labelSplit = atom.label.split('@');
            if (labelSplit.length === 2) {
                groupSymmetries.add(labelSplit[1]);
            } else if (labelSplit.length === 1) {
                groupSymmetries.add(`${identitySymOp}_555`);
            }
        }
        return Array.from(groupSymmetries);
    });

    // evaluate if grown
    const fragmentGrown = presentSymmetries.some(g => g.length > 1);
}

/**
 *
 * @param {CrystalStructure} structure
 * @param cutFragments
 * @param highlySymmetricLimit
 */
export function growCell(structure, cutFragments = true, highlySymmetricLimit = 8) {
    const atomGroups = structure.calculateConnectedGroups();

    const limits = getFragmentLimits(structure);
    let combineGrowth;
    let growSymIds;
    if (structure.symmetry.symmetryOperations.length > highlySymmetricLimit) {
        // The more symmetry elements we have, the higher the chance for symmetry equivalent atoms
        // So for highly symmetrical structures we prefer a smaller set of symm elements that get
        // applied one after the other
        combineGrowth = true;
        growSymIds = minimalGrowthSet(structure.symmetry);
    } else {
        // Low number of symOps ->  
        combineGrowth = false;
        growSymIds = structure.symmetry.operationIds.keys();
    }
    const symmIds = structure.symmetry.operationIds;
    const identityId = structure.symmetry.identitySymOpId;
    
    const newAtoms = [];
    const newBonds = [];
    const newHBonds = [];

    const growAtoms = [...structure.atoms];
    const growBonds = [...structure.bonds];
    const growHBonds = [...structure.hBonds];
    console.log(symmIds);
    console.log(growSymIds);

    for (const id of growSymIds) {
        const symOp = structure.symmetry.symmetryOperations[symmIds[id]];
        console.log(id, symmIds[id], symOp);

        const symmCentre = getSymmetryCentre(limits, symOp);

        // Calculate the offsets as integers
        const offsetX = Math.floor(symmCentre.x);
        const offsetY = Math.floor(symmCentre.y);
        const offsetZ = Math.floor(symmCentre.z);
        const translationString = `${5 + offsetX}${5 + offsetY}${5 + offsetZ}`;

        // const newLimits = getSymmetryLimits(limits, symOp]
        // apply symmetry to growFragment
        const symmString = `${id}_${translationString}`;
        const symmAtoms = structure.symmetry.applySymmetry(symmString, growAtoms);

        symmAtoms.forEach(atom => {
            const labelSplit = atom.label.split('@');
            if (labelSplit.length === 2) {
                const symmId = structure.symmetry.combineSymmetryCodes(symmString, labelSplit[1]);
                atom.label = createSymAtomLabel(labelSplit[0], symmId);
            } else if (labelSplit.length === 1) {
                atom.label = createSymAtomLabel(atom.label, symmString);
            } else {
                throw new Error(`Encountered invalid atom label ${atom.label} (did not expect multiple symmetry indicating @)`);
            }
        });

        // check and filter atoms on special positions

        // add bonds with filtered atom labels

        // add hbonds with filtered atom labels

        // if combineGrows replace growFragment with combined new and grown atoms and bonds
    }

}