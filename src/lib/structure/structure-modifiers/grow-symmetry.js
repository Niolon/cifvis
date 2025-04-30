import { CrystalStructure } from '../../structure/crystal.js';

/**
 * Represents a group of atoms in a specific symmetry position
 * @class
 * @property {number} groupIndex - Index of the group in the original structure
 * @property {string} symmetry - Symmetry operation code applied to this group
 */
class ConnectedGroup {
    /**
     * Creates a new connected group
     * @param {number} groupIndex - Index of the group in the original structure
     * @param {string} symmetry - Symmetry operation code
     */
    constructor(groupIndex, symmetry) {
        
        this.groupIndex = groupIndex;
        const [symmetryId, translationId] = symmetry.split('_');
        // split upon construction so that we do not split in comparison
        this.symmetryId = symmetryId;
        this.translationId = translationId;
    }

    /**
     * Checks if two connected groups are equivalent except for translation
     * @param {ConnectedGroup} other - Group to compare with
     * @returns {boolean} True if groups are equivalent
     */
    translationPresent(other) {
        return this.groupIndex === other.groupIndex && 
               this.symmetryId === other.symmetryId &&
               this.translationId !== other.translationId;
    }
}

class ConnectingBond {
    constructor(originAtom, targetAtom) {
        this.originAtom = originAtom;
        this.targetAtom = targetAtom;
    }
}

/**
 * Represents a bond that crosses symmetry operations
 * @class
 * @property {number} originIndex - Index of the origin group
 * @property {string} originSymmetry - Symmetry operation of origin group
 * @property {number} targetIndex - Index of the target group
 * @property {string} targetSymmetry - Additional symmetry operation to get to target
 */
class ConnectingBondGroup {
    /**
     * Represents a connection between two molecular fragments via symmetry
     * @param {number} originIndex - Index of the origin group
     * @param {string} originSymmetry - Symmetry operation of origin group
     * @param {number} targetIndex - Index of the target group
     * @param {string} targetSymmetry - Additional symmetry operation to get to target
     * @param {ConnectingBond[]} connectingBonds - All bonds that form the connection between the two fragments
     * @param {number} creationOriginIndex - Index of the group within the asym. unit this bond originates from
     */
    constructor(originIndex, originSymmetry, targetIndex, targetSymmetry, connectingBonds, creationOriginIndex) {
        this.originIndex = originIndex;
        this.originSymmetry = originSymmetry;
        this.targetIndex = targetIndex;
        this.targetSymmetry = targetSymmetry;
        this.connectingBonds = connectingBonds;
        this.creationOriginIndex = creationOriginIndex;
    }

    /**
     * Gets a key that uniquely identifies this bond
     * @returns {string} Unique identifier for the bond
     */
    getKey() {
        if (this.originIndex === this.targetIndex) {
            if (this.originSymmetry < this.targetSymmetry) {
                return `${this.originIndex}_${this.originSymmetry}_${this.targetIndex}_${this.targetSymmetry}`;
            } else {
                return `${this.targetIndex}_${this.targetSymmetry}_${this.originIndex}_${this.originSymmetry}`;
            }
        }
        if (this.originIndex < this.targetIndex) {
            return `${this.originIndex}_${this.originSymmetry}_${this.targetIndex}_${this.targetSymmetry}`;
        } else {
            return `${this.targetIndex}_${this.targetSymmetry}_${this.originIndex}_${this.originSymmetry}`;
        }
    }
}

/**
 * Analyzes the connectivity of a crystal structure including symmetry operations
 * @param {CrystalStructure} structure - Crystal structure to analyze
 * @returns {{connectingBondGroups: ConnectingBondGroup[], infiniteTranslationGroups: ConnectingBondGroup[]}} - the
 *  found connected Bond groups and translations
 */
export function createConnectivity(structure) {
    const atomGroups = structure.connectedGroups;

    // Map from atom label to its group index
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
    });
    const identSymmString = `${structure.symmetry.identitySymOpId}_555`;

    // Figure out which group bonds to where
    const originalGroupConnectionsKeys = new Map();
    const originalGroupConnections = atomGroups.map(() => []);

    structure.bonds
        .filter(bond => bond.atom2SiteSymmetry !== '.')
        .forEach(bond => {
            const atom1Group = atomGroupMap.get(bond.atom1Label);
            const atom2Group = atomGroupMap.get(bond.atom2Label);
            const targetKey = `${atom1Group}->${atom2Group}@.@${bond.atom2SiteSymmetry}`;

            if (originalGroupConnectionsKeys.has(targetKey)) {
                const index = originalGroupConnectionsKeys.get(targetKey);
                originalGroupConnections[atom1Group][index].bonds.push(
                    { originAtom: bond.atom1Label, targetAtom: bond.atom2Label },
                );
            } else {
                originalGroupConnectionsKeys.set(targetKey, originalGroupConnections[atom1Group].length);
                originalGroupConnections[atom1Group].push({
                    targetIndex: atom2Group,
                    targetSymmetry: bond.atom2SiteSymmetry,
                    bonds: [{ originAtom: bond.atom1Label, targetAtom: bond.atom2Label }],
                });
            }

        });

    // Create initial dangling bonds, every created dangling bond has been processed
    const danglingBondGroups = [];
    const processedConnections = new Set();
    
    originalGroupConnections.forEach((groupInfo, groupIndex) => {
        for (const connection of groupInfo) {
            const danglingBondGroup = new ConnectingBondGroup(
                groupIndex,
                identSymmString,
                connection.targetIndex,
                connection.targetSymmetry,
                connection.bonds,
                groupIndex,
            );
            const bondKey = danglingBondGroup.getKey();
            if (!processedConnections.has(bondKey)) {
                danglingBondGroups.push(danglingBondGroup);
                processedConnections.add(bondKey);
            }
            
        }
    });

    // Process dangling bonds until none are left, track which groups we need for that
    // also track which groups would lead to infinite connections
    const usedBondGroups = [];
    const connectedGroups = atomGroups.map(() => []);
    const translationConnections = [];

    // We have already created the initial groups
    atomGroups.forEach((_, i) => {
        connectedGroups[i].push(new ConnectedGroup(i, identSymmString));
    });

    let count = 0;
    while (danglingBondGroups.length > 0) {
        // Always read from the front -> we prefer growth from inside out for translation
        const currentBondGroup = danglingBondGroups.shift();
        console.log(currentBondGroup);
        
        // Calculate combined symmetry for the target group
        const combinedSymmetry = structure.symmetry.combinePositionCodes(
            currentBondGroup.targetSymmetry, 
            currentBondGroup.originSymmetry,
        );

        connectedGroups[currentBondGroup.creationOriginIndex].push(
            new ConnectedGroup(currentBondGroup.targetIndex, combinedSymmetry),
        );
        
        // Get the target group's connections
        const targetGroupConnections = originalGroupConnections[currentBondGroup.targetIndex];
        
        // Add new dangling bonds from this group
        for (const connection of targetGroupConnections) {
            const newTargetSymmetry = structure.symmetry.combinePositionCodes(
                connection.targetSymmetry, 
                combinedSymmetry,
            );

            const prospectiveBond = new ConnectingBondGroup(
                currentBondGroup.targetIndex,
                combinedSymmetry,
                connection.targetIndex,
                newTargetSymmetry,
                connection.bonds,
                currentBondGroup.creationOriginIndex, // Use the original creationOriginIndex
            );

            console.log(connection.targetSymmetry, combinedSymmetry, newTargetSymmetry);

            // Skip if we've already processed this connection
            const connectionKey = prospectiveBond.getKey();
            if (processedConnections.has(connectionKey)) {
                continue;
            }
            processedConnections.add(connectionKey);

            const resultingGroup = new ConnectedGroup(connection.targetIndex, newTargetSymmetry);

            const translationPresent = connectedGroups[currentBondGroup.creationOriginIndex].some(existing => {
                return resultingGroup.translationPresent(existing);
            });

            if (translationPresent) {
                translationConnections.push(prospectiveBond);
            } else {
                danglingBondGroups.push(prospectiveBond);
            }
        }

        usedBondGroups.push(currentBondGroup);
        
        if (count > 10000) {
            throw Error('maximum number of operations reached');
            // break; // Safety limit
        }
        count++;
    }

    console.log(connectedGroups);
    console.log(usedBondGroups);
    return { connectingBondGroups: usedBondGroups, infiniteTranslationGroups: translationConnections };
}

/**
 *
 * @param {Array} array - the array to be transposed
 * @returns {Array} - the transposed array
 */
function transpose(array) {
    return array[0].map((col, i) => array.map(row => row[i]));
}

/**
 *
 * @param {CrystalStructure} structure - The crystal structure.
 */
export function growSymmetry(structure) {
    const atomGroups = structure.connectedGroups;
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
    });

    const {
        connectingBondGroups: connectingBondGroups,
        infiniteTranslationGroups: infitineTranslationGroups,
    } = createConnectivity(structure);

    const growGroups = new Set();
    connectingBondGroups.forEach((group) => {
        growGroups.add(`${group.originIndex}@.@${group.originSymmetry}`);
        growGroups.add(`${group.targetIndex}@.@${group.targetSymmetry}`);

    });
    console.log(growGroups);

    // be sure to create a copy of the array
    const potentialAtomsGroups = atomGroups.map(g => [[...g.atoms]]);
    const identSymmString = `${structure.symmetry.identitySymOpId}_555`;

    growGroups.forEach(g => {
        const [idxStr, symOp] = g.split('@.@');
        if (symOp === identSymmString) {
            return;
        }
        const groupIndex = Number(idxStr);
        const newGroupAtoms = structure.symmetry.applySymmetry(symOp, atomGroups[groupIndex].atoms);
        newGroupAtoms.forEach(atom => {
            atom.label += `@${symOp}`;
        });
        potentialAtomsGroups[groupIndex].push(newGroupAtoms);
    });

    const specialPositionAtoms = new Map();

    potentialAtomsGroups.forEach(g => {
        transpose(g).forEach(symmAtoms => {
            const keptSymmAtoms = [];
            let isSpecialPos;
            symmAtoms.forEach(symmAtom => {
                for (const keptSymmAtom of keptSymmAtoms) {
                    isSpecialPos = Math.abs(keptSymmAtom.position.x - symmAtom.position.x) * structure.cell.a < 1e-5
                        && Math.abs(keptSymmAtom.position.y - symmAtom.position.y) * structure.cell.b < 1e-5
                        && Math.abs(keptSymmAtom.position.z - symmAtom.position.z) * structure.cell.c < 1e-5;
                    if (isSpecialPos) {
                        specialPositionAtoms.set(symmAtom.label, keptSymmAtom.label);
                        break;
                    }
                }
                if (!isSpecialPos) {
                    keptSymmAtoms.push(symmAtom);
                }
            });
            console.log(keptSymmAtoms);
        });
    });
    console.log(specialPositionAtoms);
    console.log(potentialAtomsGroups);
    console.log(growGroups);
    console.log(connectingBondGroups);
    console.log(infitineTranslationGroups);
}
