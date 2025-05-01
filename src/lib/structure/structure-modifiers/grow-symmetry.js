import { CrystalStructure } from '../crystal.js';
import { Bond, HBond } from '../bonds.js';

/**
 * Represents a group of atoms in a specific symmetry position
 * @class
 * @property {number} groupIndex - Index of the group in the original structure
 * @property {string} symmetryId - Symmetry operation ID part of the symmetry code
 * @property {string} translationId - Translation ID part of the symmetry code (e.g., '555')
 */
class ConnectedGroup {
    /**
     * Creates a new connected group
     * @param {number} groupIndex - Index of the group in the original structure
     * @param {string} symmetry - Full symmetry operation code (e.g., '2_565')
     */
    constructor(groupIndex, symmetry) {
        this.groupIndex = groupIndex;
        // Split symm code for efficient comparison later
        const [symmetryId, translationId] = symmetry.split('_');
        this.symmetryId = symmetryId;
        this.translationId = translationId;
    }

    /**
     * Checks if this group instance is a translational duplicate of another.
     * @param {ConnectedGroup} other - Group to compare with
     * @returns {boolean} True if groups are equivalent (same group index and symmetry operation ID) but have
     *  different translations.
     */
    isTranslationalDuplicateOf(other) {
        // Check if only the translation part differs
        return this.groupIndex === other.groupIndex &&
               this.symmetryId === other.symmetryId &&
               this.translationId !== other.translationId;
    }

    /**
     * Gets the full symmetry string.
     * @returns {string} The combined symmetry and translation ID string.
     */
    getSymmetryString() {
        return `${this.symmetryId}_${this.translationId}`;
    }
}

/**
 * Represents the specific atoms involved in a symmetry connection.
 * @class
 * @property {string} originAtom - Label of the atom in the origin group
 * @property {string} targetAtom - Label of the atom in the target group (before symmetry)
 */
class ConnectingBond {
    constructor(originAtom, targetAtom, bondLength, bondLengthSU) {
        this.originAtom = originAtom;
        this.targetAtom = targetAtom;
        this.bondLength = bondLength;
        this.bondLengthSU = bondLengthSU;
    }
}

/**
 * Represents a bond group that crosses symmetry operations
 * @class
 * @property {number} originIndex - Index of the origin group
 * @property {string} originSymmetry - Symmetry operation of origin group
 * @property {number} targetIndex - Index of the target group
 * @property {string} connectingSymOp - Symmetry operation to apply to the target group (relative to originSymmetry)
 * @property {ConnectingBond[]} connectingBonds - All bonds that form the connection between the two fragments
 * @property {number} creationOriginIndex - Index of the group within the asym. unit this bond originates from
 */
class ConnectingBondGroup {
    /**
     * Represents a connection between two molecular fragments via symmetry
     * @param {number} originIndex - Index of the origin group
     * @param {string} originSymmetry - Symmetry operation of origin group
     * @param {number} targetIndex - Index of the target group
     * @param {string} connectingSymOp - Additional symmetry operation to get to target
     * @param {ConnectingBond[]} connectingBonds - All bonds that form the connection between the two fragments
     * @param {number} creationOriginIndex - Index of the group within the asym. unit this bond originates from. Used to
     *  track which groups belong together when checking for translational duplicates.
     */
    constructor(originIndex, originSymmetry, targetIndex, connectingSymOp, connectingBonds, creationOriginIndex) {
        this.originIndex = originIndex;
        this.originSymmetry = originSymmetry;
        this.targetIndex = targetIndex;
        this.connectingSymOp = connectingSymOp; // Note: This is the *additional* symm op, not the final one
        this.connectingBonds = connectingBonds;
        this.creationOriginIndex = creationOriginIndex;
    }

    /**
     * Gets a key that uniquely identifies this bond connection, respecting symmetry and order.
     * Ensures that the connection A->B with symm S is the same key as B->A with inverse symm S'.
     * @param {string} finalTargetSymmetry - The fully combined symmetry operation for the target.
     * @returns {string} Unique identifier for the bond connection.
     */
    getKey(finalTargetSymmetry) {
        // Ensure consistent ordering for the key regardless of bond direction
        if (this.originIndex === this.targetIndex) {
            // Intra-group connection across symmetry
            if (this.originSymmetry < finalTargetSymmetry) {
                return `${this.originIndex}_${this.originSymmetry}_${this.targetIndex}_${finalTargetSymmetry}`;
            } else {
                return `${this.targetIndex}_${finalTargetSymmetry}_${this.originIndex}_${this.originSymmetry}`;
            }
        } else if (this.originIndex < this.targetIndex) {
            // Inter-group connection
            return `${this.originIndex}_${this.originSymmetry}_${this.targetIndex}_${finalTargetSymmetry}`;
        } else {
            // Inter-group connection (reversed order)
            return `${this.targetIndex}_${finalTargetSymmetry}_${this.originIndex}_${this.originSymmetry}`;
        }
    }
}

// --- Helper Function 1: Extract Initial Connections ---

/**
 * Extracts the initial symmetry connections based on the structure's bond list.
 * These are the starting points for the connectivity exploration.
 * @param {CrystalStructure} structure - Crystal structure to analyze.
 * @param {Array<object>} atomGroups - Array of atom groups (from structure.connectedGroups).
 * @param {Map<string, number>} atomGroupMap - Map from atom label to group index.
 * @returns {Array<Array<object>>} An array where each index corresponds to an atom group,
 * and the inner array contains objects describing symmetry connections
 * originating from that group: { targetIndex, targetSymmetry: connectingSymOp, bonds }.
 */
function getSeedConnections(structure, atomGroups, atomGroupMap) {
    const seedConnectionsKeys = new Map(); // Used to group bonds between the same groups/symm ops
    const seedConnectionsInGroup = atomGroups.map(() => []);

    structure.bonds
        .filter(bond => bond.atom2SiteSymmetry !== '.') // Only consider bonds crossing symmetry
        .forEach(bond => {
            const atom1Group = atomGroupMap.get(bond.atom1Label);
            const atom2Group = atomGroupMap.get(bond.atom2Label);
            // Key identifies the specific connection: origin group -> target group @ identity symm -> target symm
            const targetKey = `${atom1Group}->${atom2Group}@.@${bond.atom2SiteSymmetry}`;

            if (seedConnectionsKeys.has(targetKey)) {
                // Add bond to existing connection object
                const index = seedConnectionsKeys.get(targetKey);
                seedConnectionsInGroup[atom1Group][index].bonds.push(
                    new ConnectingBond(bond.atom1Label, bond.atom2Label, bond.bondLength, bond.bondLengthSU),
                );
            } else {
                // Create new connection object
                seedConnectionsKeys.set(targetKey, seedConnectionsInGroup[atom1Group].length);
                seedConnectionsInGroup[atom1Group].push({
                    targetIndex: atom2Group,
                    targetSymmetry: bond.atom2SiteSymmetry, // Symmetry op needed to reach atom 2
                    bonds: [new ConnectingBond(bond.atom1Label, bond.atom2Label, bond.bondLength, bond.bondLengthSU)],
                });
            }
        });
    return seedConnectionsInGroup;
}

// --- Helper Function 2: Initialize Processing Queue ---

/**
 * Initializes the queue of bond groups (connections) to process and the set of processed connections.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - Connections extracted by _getSeedConnections.
 * @param {string} identSymmString - The string representing the identity symmetry operation ('1_555').
 * @returns {{danglingConnections: Array<ConnectingBondGroup>, processedConnections: Set<string>}}
 * An object containing the initial queue and the set of processed connection keys.
 */
function initializeExploration(seedConnectionsPerGroup, identSymmString) {
    const danglingConnections = [];
    const processedConnections = new Set();

    seedConnectionsPerGroup.forEach((groupConnections, groupIndex) => {
        for (const connection of groupConnections) {
            // Initial bond groups start from the identity symmetry
            const initialBondGroup = new ConnectingBondGroup(
                groupIndex,            // Origin group index
                identSymmString,       // Origin symmetry is identity
                connection.targetIndex, // Target group index
                connection.targetSymmetry, // Symmetry op to reach target from origin
                connection.bonds,      // Specific atom bonds
                groupIndex,            // The creation origin is the group itself initially
            );

            // Calculate the key based on the *final* target symmetry (which is just connection.targetSymmetry here)
            const bondKey = initialBondGroup.getKey(connection.targetSymmetry);

            if (!processedConnections.has(bondKey)) {
                danglingConnections.push(initialBondGroup);
                processedConnections.add(bondKey); // Mark this initial connection as processed
            }
        }
    });

    return { danglingConnections, processedConnections };
}

// --- Helper Function 3: Process One Step of Connectivity ---

/**
 * Processes a single connection group from the queue, determines the resulting group's symmetry,
 * finds new connections, and checks for translations.
 * @param {ConnectingBondGroup} currentConnection - The connection group to process.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {Array<Array<ConnectedGroup>>} discoveredGroups - Current list of discovered group instances for each creation origin.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - The initial connections for each group type.
 * @param {Set<string>} processedConnections - Set of already processed connection keys (will be mutated).
 * @returns {{newConnectedGroup: ConnectedGroup, newDanglingConnections: Array<ConnectingBondGroup>, foundTranslations: Array<ConnectingBondGroup>}}
 * Results of processing the step.
 */
function exploreConnection(
    currentConnection, 
    structure, 
    discoveredGroups, 
    seedConnectionsPerGroup,
    processedConnections,
) {
    const newDanglingConnections = [];
    const foundTranslations = [];

    // Calculate the absolute symmetry operation for the target group reached by this bond
    const combinedSymmetry = structure.symmetry.combineSymmetryCodes(
        currentConnection.connectingSymOp, // Symmetry to apply to target
        currentConnection.originSymmetry, // Symmetry of the origin group
    );

    const newConnectedGroup = new ConnectedGroup(currentConnection.targetIndex, combinedSymmetry);

    // Find connections originating from the *type* of group we just reached (targetIndex)
    const targetGroupConnections = seedConnectionsPerGroup[currentConnection.targetIndex];

    // Process each connection from the target group
    for (const connection of targetGroupConnections) {
        // Calculate the absolute symmetry operation for the *next* group
        const nextTargetSymmetryAbsolute = structure.symmetry.combineSymmetryCodes(
            connection.targetSymmetry, // Symmetry to apply to the next target (relative to targetIndex@identity)
            combinedSymmetry,          // Absolute symmetry of the group we just reached (currentConnection.targetIndex)
        );

        // Create the prospective bond representing the next step
        const prospectiveConnection = new ConnectingBondGroup(
            currentConnection.targetIndex,  // Origin is the group we just reached
            combinedSymmetry,              // Symmetry of this origin
            connection.targetIndex,        // Target group index for the *next* step
            connection.targetSymmetry,     // Symmetry needed to get there *from targetIndex@identity*
            connection.bonds,              // Specific atom bonds for this connection type
            currentConnection.creationOriginIndex, // Propagate the original creation index
        );

        // Check if this connection path has already been processed or queued
        const connectionKey = prospectiveConnection.getKey(nextTargetSymmetryAbsolute);
        if (processedConnections.has(connectionKey)) {
            continue;
        }
        processedConnections.add(connectionKey); // Mark as processed *now* to prevent duplicates in queue

        const resultingGroup = new ConnectedGroup(connection.targetIndex, nextTargetSymmetryAbsolute);

        // Check if this resulting group is a translational duplicate of an existing group
        // within the same creationOriginIndex set
        const translationPresent = discoveredGroups[currentConnection.creationOriginIndex].some(existing => {
            return resultingGroup.isTranslationalDuplicateOf(existing);
        });

        // Add to the appropriate list based on translation check
        if (translationPresent) {
            foundTranslations.push(prospectiveConnection);
        } else {
            newDanglingConnections.push(prospectiveConnection);
        }
    }

    return { newConnectedGroup, newDanglingConnections, foundTranslations };
}

/**
 * Analyzes the connectivity of a crystal structure including symmetry operations.
 * This function performs a breadth-first search starting from the asymmetric unit,
 * exploring connections across symmetry operations. It identifies unique symmetry-related
 * groups and flags connections that only involve translation (potential infinite growth).
 * @param {CrystalStructure} structure - Crystal structure to analyze.
 * @returns {{networkConnections: Array<ConnectingBondGroup>, translationLinks: Array<ConnectingBondGroup>}}
 * Object containing the list of bond groups used to build the connected network
 * and bond groups leading to translational duplicates.
 */
export function createConnectivity(structure) {
    const atomGroups = structure.connectedGroups;

    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
    });
    const identSymmString = structure.symmetry.identitySymOpId + '_555';

    // Find all initial connections defined in the bond list
    const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);

    // Set up the initial processing queue and processed set
    const { danglingConnections, processedConnections } = initializeExploration(seedConnectionsPerGroup, identSymmString);

    const networkConnections = []; // Bonds successfully processed and added to the network
    const translationLinks = []; // Bonds leading to translational duplicates
    // Tracks all symmetry instances found for each original group index
    const discoveredGroups = atomGroups.map(() => []);

    // Add the initial identity group for each original group index
    atomGroups.forEach((_, i) => {
        discoveredGroups[i].push(new ConnectedGroup(i, identSymmString));
    });

    let safetyCounter = 0;
    const MAXITER = 10000; // Safety limit

    // Process the queue iteratively using breadth-first search
    while (danglingConnections.length > 0) {
        if (safetyCounter++ > MAXITER) {
            console.error('Max iterations reached in createConnectivity. Possible infinite loop or very complex structure.');
            break; // Exit loop to prevent freezing
        }

        const currentConnection = danglingConnections.shift();

        // Process this connection group to find the next connected group and any new bonds
        const stepResult = exploreConnection(
            currentConnection,
            structure,
            discoveredGroups,
            seedConnectionsPerGroup,
            processedConnections, // Pass the set to be mutated
        );

        // Add the newly found connected group to our tracking list
        discoveredGroups[currentConnection.creationOriginIndex].push(stepResult.newConnectedGroup);

        // Add newly found dangling connections to the queue for further processing
        danglingConnections.push(...stepResult.newDanglingConnections);

        // Add bonds leading to translations to the separate list
        translationLinks.push(...stepResult.foundTranslations);

        // Record the bond group that was successfully processed
        networkConnections.push(currentConnection);
    }

    if (danglingConnections.length > 0) {
        console.warn(
            `Connectivity processing stopped due to iteration limit. ${danglingConnections.length}`
            + 'connections remain unprocessed.',
        );
    }

    return { networkConnections, translationLinks };
}

/**
 * Expands the asymmetric unit by applying symmetry operations based on connectivity.
 * (Note: This function is incomplete in the provided snippet but shows usage
 * of the refactored createConnectivity)
 * @param {CrystalStructure} structure - The crystal structure.
 */
export function growSymmetry(structure) {
    const atomGroups = structure.connectedGroups;
    const identitySymOpString = `${structure.symmetry.identitySymOpId}_555`;
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
    });

    // Call the refactored function
    const {
        networkConnections,
        translationLinks,
    } = createConnectivity(structure);

    const requiredSymmetryInstances = new Set();
    let interGroupBonds = [];
    // Collect all unique group@symmetry instances needed
    networkConnections.forEach((group) => {
        requiredSymmetryInstances.add(`${group.originIndex}@.@${group.originSymmetry}`);
        const finalTargetSymmetry = structure.symmetry.combineSymmetryCodes(
            group.connectingSymOp, group.originSymmetry,
        );
        requiredSymmetryInstances.add(`${group.targetIndex}@.@${finalTargetSymmetry}`);

        const addBonds = group.connectingBonds.map(conBond => {
            const atom1 = `${conBond.originAtom}@${group.originSymmetry}`;
            const atom2 = `${conBond.targetAtom}@${finalTargetSymmetry}`;
            return { 
                originSymmAtom: atom1, 
                targetSymmAtom: atom2,
                bondLength: conBond.bondLength,
                bondLengthSU: conBond.bondLengthSU,
            };
        });

        interGroupBonds = interGroupBonds.concat(addBonds);
    });

    // Store potential atoms: [groupIndex][symmInstanceIndex][atomIndex]
    const atomsByGroupAndSymmetry = atomGroups.map(g => [[...g.atoms]]); // Start with identity atoms
    const identSymmString = structure.symmetry.identitySymOpString;
    let newBonds = [];
    let newHBonds = [];
    atomGroups.forEach(g => {
        newBonds = newBonds.concat(g.bonds);
        newHBonds = newHBonds.concat(g.hBonds);
    });
    
    const existingBonds = new Set();
    newBonds.forEach(b => {
        if (b.atom1Label < b.atom2Label) {
            existingBonds.add(`${b.atom1Label}->${b.atom2Label}`);
        } else {
            existingBonds.add(`${b.atom2Label}->${b.atom1Label}`);
        }
    });

    const existingHBonds = new Set();
    newHBonds.forEach(hb => {
        existingHBonds.add(`${hb.donorAtomLabel}-${hb.hydrogenAtomLabel}...${hb.acceptorAtomLabel}`);
    });

    requiredSymmetryInstances.forEach(g => {
        const [idxStr, symOp] = g.split('@.@');
        if (symOp === identSymmString) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        // Ensure atoms are cloned/copied properly if modified later
        const originalAtoms = atomGroups[groupIndex].atoms;
        const newGroupAtoms = structure.symmetry.applySymmetry(symOp, originalAtoms);
        newGroupAtoms.forEach(atom => {
            // Modify label to indicate symmetry instance
            atom.label += `@${symOp}`;
        });
        atomsByGroupAndSymmetry[groupIndex].push(newGroupAtoms);
    });

    // --- Special position handling ---
    // This logic identifies atoms generated by symmetry that occupy the same
    // position as another atom (either the original or from another symm op).
    // It maps the duplicate atom's label to the label of the atom being kept.
    const specialPositionAtoms = new Map();
    let newAtoms = [];

    atomsByGroupAndSymmetry.forEach(g => {
        // Compare atoms across different symmetry instances *of the same original atom*
        if (g.length > 0 && g[0].length > 0) { // Check if there are atoms to compare
            const numOriginalAtoms = g[0].length;
            for (let atomIdx = 0; atomIdx < numOriginalAtoms; ++atomIdx) {
                const atomsForOriginal = g.map(symmGroup => symmGroup[atomIdx]); // Get atom from all symmetry instances
                const keptSymmAtoms = []; // Track unique positions found for this original atom
                for (const symmAtom of atomsForOriginal) {
                    let specPos = false; // Assume not special position initially
                    for (const keptSymmAtom of keptSymmAtoms) {
                        // Use a small tolerance for floating point comparisons
                        specPos = Math.abs(keptSymmAtom.position.x - symmAtom.position.x) * structure.cell.a < 1e-4 &&
                                   Math.abs(keptSymmAtom.position.y - symmAtom.position.y) * structure.cell.b < 1e-4 &&
                                   Math.abs(keptSymmAtom.position.z - symmAtom.position.z) * structure.cell.c < 1e-4;
                        if (specPos) {
                            // Map the duplicate atom label to the kept atom label
                            specialPositionAtoms.set(symmAtom.label, keptSymmAtom.label);
                            break; // Found a match, no need to check further kept atoms
                        }
                    }
                    if (!specPos) {
                        // This atom represents a unique position for this original atom, keep it
                        keptSymmAtoms.push(symmAtom);
                    }
                }
                newAtoms = newAtoms.concat(keptSymmAtoms);
            }
        }
    });

    requiredSymmetryInstances.forEach(g => {
        const [idxStr, symOp] = g.split('@.@');
        if (symOp === identitySymOpString) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        const originalBonds = atomGroups[groupIndex].bonds;
        const addedBonds = originalBonds.map(b => {
            const atom1Label = `${b.atom1Label}@${symOp}`;
            const atom2Label = `${b.atom2Label}@${symOp}`;
            const atom1 = specialPositionAtoms.has(atom1Label) ? specialPositionAtoms.get(atom1Label) : atom1Label;
            const atom2 = specialPositionAtoms.has(atom2Label) ? specialPositionAtoms.get(atom2Label) : atom2Label;
            const bondString = atom1 < atom2 ? `${atom1}->${atom2}` : `${atom2}->${atom1}`;
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                return new Bond(
                    atom1, atom2, b.bondLength, b.bondLengthSU, '.',
                );
            }
        }).filter(b => b);
        newBonds = newBonds.concat(addedBonds);
    });

    const newInterBonds = interGroupBonds.map( b => {
        const atom1 = specialPositionAtoms.has(b.originSymmAtom) ? 
            specialPositionAtoms.get(b.originSymmAtom) : 
            b.originSymmAtom;
        const atom2 = specialPositionAtoms.has(b.targetSymmAtom) ? 
            specialPositionAtoms.get(b.targetSymmAtom) : 
            b.targetSymmAtom;
        const bondString = atom1 < atom2 ? `${atom1}->${atom2}` : `${atom2}->${atom1}`;
        if (!existingBonds.has(bondString)) {
            existingBonds.add(bondString);
            return new Bond(
                atom1, atom2, b.bondLength, b.bondLengthSU, '.',
            );
        }
    }).filter(b => b);
    newBonds = newBonds.concat(newInterBonds);

    const atomLabels = new Set(newAtoms.map(a => a.label));

    const externalHBonds = atomGroups.map(() => []);

    structure.hBonds
        .filter(hb => hb.acceptorAtomSymmetry !== '.')
        .forEach(hb => {
            externalHBonds[atomGroupMap.get(hb.donorAtomLabel)].push(hb);
        });

    requiredSymmetryInstances.forEach(g => {
        const [idxStr, symOp] = g.split('@.@');
        if (symOp === identitySymOpString) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        const originalHBonds = atomGroups[groupIndex].hBonds;
        const symmHBonds = originalHBonds.map(hb => {
            const symmDonorAtom = `${hb.donorAtomLabel}@${symOp}`;
            const symmAcceptorAtom = `${hb.acceptorAtomLabel}@${symOp}`;
            const symmHAtom = `${hb.hydrogenAtomLabel}@${symOp}`;
            const donorAtom = specialPositionAtoms.has(symmDonorAtom) ? 
                specialPositionAtoms.get(symmDonorAtom) : 
                symmDonorAtom;
            const acceptorAtom = specialPositionAtoms.has(symmAcceptorAtom) ? 
                specialPositionAtoms.get(symmAcceptorAtom) : 
                symmAcceptorAtom;
            const hAtom = specialPositionAtoms.has(symmHAtom) ? 
                specialPositionAtoms.get(symmHAtom) : 
                symmHAtom;

            const hBondString = `${donorAtom}-${hAtom}...${acceptorAtom}`;
            if (!existingHBonds.has(hBondString)) {
                existingHBonds.add(hBondString);
                return new HBond(
                    donorAtom,
                    hAtom,
                    acceptorAtom,
                    hb.donorHydrogenDistance,
                    hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance,
                    hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance,
                    hb.donorAcceptorDistanceSU,
                    hb.hBondAngle,
                    hb.hBondAngleSU,
                    '.',
                );
            }
        }).filter(hb => hb);
        newHBonds = newHBonds.concat(symmHBonds);
        //if (!existingHBonds[groupIndex] || existingHBonds[groupIndex].length === 0) {
        //    return
        //}
        const extSymmHBonds = externalHBonds[groupIndex].map(hb => {
            const combinedSymm = structure.symmetry.combineSymmetryCodes(
                symOp,
                hb.acceptorAtomSymmetry,
            );
            const symmDonorAtom = `${hb.donorAtomLabel}@${symOp}`;
            const symmAcceptorAtom = `${hb.acceptorAtomLabel}@${combinedSymm}`;
            const symmHAtom = `${hb.hydrogenAtomLabel}@${symOp}`;
            const donorAtom = specialPositionAtoms.has(symmDonorAtom) ? 
                specialPositionAtoms.get(symmDonorAtom) : 
                symmDonorAtom;
            const acceptorAtom = specialPositionAtoms.has(symmAcceptorAtom) ? 
                specialPositionAtoms.get(symmAcceptorAtom) : 
                symmAcceptorAtom;
            const hAtom = specialPositionAtoms.has(symmHAtom) ? 
                specialPositionAtoms.get(symmHAtom) : 
                symmHAtom;
            const hBondString = `${donorAtom}-${hAtom}...${acceptorAtom}`;
            if (!existingHBonds.has(hBondString)) {
                if (atomLabels.has(acceptorAtom)) {
                    existingHBonds.add(hBondString);
                    return new HBond(
                        donorAtom,
                        hAtom,
                        acceptorAtom,
                        hb.donorHydrogenDistance,
                        hb.donorHydrogenDistanceSU,
                        hb.acceptorHydrogenDistance,
                        hb.acceptorHydrogenDistanceSU,
                        hb.donorAcceptorDistance,
                        hb.donorAcceptorDistanceSU,
                        hb.hBondAngle,
                        hb.hBondAngleSU,
                        '.',
                    );
                } else {  
                    existingHBonds.add(hBondString);
                    return new HBond(
                        donorAtom,
                        hAtom,
                        hb.acceptorAtomLabel,
                        hb.donorHydrogenDistance,
                        hb.donorHydrogenDistanceSU,
                        hb.acceptorHydrogenDistance,
                        hb.acceptorHydrogenDistanceSU,
                        hb.donorAcceptorDistance,
                        hb.donorAcceptorDistanceSU,
                        hb.hBondAngle,
                        hb.hBondAngleSU,
                        combinedSymm,
                    );
                }
            } 
        }).filter(hb => hb);
        newHBonds = newHBonds.concat(extSymmHBonds);
    });

    translationLinks.forEach(tl => {
        for (const conBond of tl.connectingBonds) {
            const targetSymmetry = structure.symmetry.combineSymmetryCodes(tl.connectingSymOp, tl.originSymmetry);
            const atom1Label = `${conBond.originAtom}@${tl.originSymmetry}`;
            const atom2Label = `${conBond.targetAtom}@${targetSymmetry}`;
            const atom1 = specialPositionAtoms.has(atom1Label) ? specialPositionAtoms.get(atom1Label) : atom1Label;
            const atom2 = specialPositionAtoms.has(atom2Label) ? specialPositionAtoms.get(atom2Label) : atom2Label;
            const bondString = atom1 < atom2 ? `${atom1}->${atom2}` : `${atom2}->${atom1}`;
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                newBonds.push(
                    new Bond(atom1, conBond.targetAtom, conBond.bondLength, conBond.bondLengthSU, targetSymmetry),
                );
            }
        }
    });
  
    return new CrystalStructure(structure.cell, newAtoms, newBonds, newHBonds, structure.symmetry);
}