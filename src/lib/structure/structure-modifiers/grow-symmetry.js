import { CrystalStructure } from '../crystal.js';
import { Bond, HBond } from '../bonds.js';

/**
 * Creates a unique identifier string for an atom including its symmetry code.
 * @param {string} atomLabel - The base label of the atom (e.g., 'C1').
 * @param {string} symOpLabel - The symmetry code (e.g., '1_555').
 * @returns {string} The combined label (e.g., 'C1@1_555').
 */
export function createSymAtomLabel(atomLabel, symOpLabel) {
    return `${atomLabel}@${symOpLabel}`;
}

/**
 * Creates a unique identifier string for a bond between two atom labels.
 * Ensures consistent ordering for duplicate checking.
 * @param {string} atom1Label - Label of the first atom (e.g., 'C1@1_555').
 * @param {string} atom2Label - Label of the second atom (e.g., 'O2@2_565').
 * @returns {string} A unique, ordered string representing the bond (e.g., 'C1@1_555->O2@2_565').
 */
export function createBondIdentifier(atom1Label, atom2Label) {
    // Ensure consistent order for Set comparison
    return atom1Label < atom2Label ? `${atom1Label}->${atom2Label}` : `${atom2Label}->${atom1Label}`;
}

/**
 * Creates a unique identifier string for a hydrogen bond.
 * @param {string} donorAtomLabel - Label of the donor atom.
 * @param {string} hydrogenAtomLabel - Label of the hydrogen atom.
 * @param {string} acceptorAtomLabel - Label of the acceptor atom.
 * @returns {string} A unique string representing the hydrogen bond.
 */
export function createHBondIdentifier(donorAtomLabel, hydrogenAtomLabel, acceptorAtomLabel) {
    return `${donorAtomLabel}-${hydrogenAtomLabel}...${acceptorAtomLabel}`;
}

/**
 * Represents a group of atoms in a specific symmetry position
 * @class
 * @property {number} groupIndex - Index of the group in the original structure
 * @property {string} symmetryId - Symmetry operation ID part of the symmetry code
 * @property {string} translationId - Translation ID part of the symmetry code (e.g., '555')
 */
export class ConnectedGroup {
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
export class ConnectingBond {
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
export class ConnectingBondGroup {
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
export function getSeedConnections(structure, atomGroups, atomGroupMap) {
    // Used to group bonds between the same groups/symm ops 
    const seedConnectionsKeys = new Map(); 
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

/**
 * Initializes the queue of bond groups (connections) to process and the set of processed connections.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - Connections extracted by getSeedConnections.
 * @param {string} identSymmString - The string representing the identity symmetry operation ('1_555').
 * @returns {{danglingConnections: Array<ConnectingBondGroup>, processedConnections: Set<string>}}
 * An object containing the initial queue and the set of processed connection keys.
 */
export function initializeExploration(seedConnectionsPerGroup, identSymmString) {
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
export function exploreConnection(
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
 * @param {object[]} atomGroups - created distinct groups of interconnected atoms
 * @returns {{networkConnections: Array<ConnectingBondGroup>, translationLinks: Array<ConnectingBondGroup>, 
 *   discoveredGroups: Array<Array<ConnectedGroup>>}}
 * Object containing the list of bond groups used to build the connected network, 
 * bond groups leading to translational duplicates, and the discovered group instances.
 */
export function createConnectivity(structure, atomGroups) {
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
            `Connectivity processing stopped due to iteration limit. ${danglingConnections.length} ` +
            'connections remain unprocessed.',
        );
    }

    return { networkConnections, translationLinks, discoveredGroups };
}

/**
 * Collects required symmetry instances and creates inter-group bonds from network connections.
 * @param {Array<ConnectingBondGroup>} networkConnections - The network connections from createConnectivity.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {string} identSymmString - The identity symmetry operation string.
 * @returns {{requiredSymmetryInstances: Set<string>, interGroupBonds: Array<{originSymmAtom: string, targetSymmAtom: string, 
 *   bondLength: number, bondLengthSU: number}>}}
 * The required symmetry instances and inter-group bonds.
 */
export function collectSymmetryRequirements(networkConnections, structure, identSymmString) {
    const requiredSymmetryInstances = new Set();
    const interGroupBonds = [];
    
    // Collect all unique group@symmetry instances needed
    networkConnections.forEach((group) => {
        requiredSymmetryInstances.add(`${group.originIndex}@.@${group.originSymmetry}`);
        const finalTargetSymmetry = structure.symmetry.combineSymmetryCodes(
            group.connectingSymOp, group.originSymmetry,
        );
        requiredSymmetryInstances.add(`${group.targetIndex}@.@${finalTargetSymmetry}`);

        group.connectingBonds.forEach(conBond => {
            const atom1 = group.originSymmetry === identSymmString 
                ? conBond.originAtom 
                : createSymAtomLabel(conBond.originAtom, group.originSymmetry);
            const atom2 = finalTargetSymmetry === identSymmString
                ? conBond.targetAtom 
                : createSymAtomLabel(conBond.targetAtom, finalTargetSymmetry);
            interGroupBonds.push({ 
                originSymmAtom: atom1, 
                targetSymmAtom: atom2,
                bondLength: conBond.bondLength,
                bondLengthSU: conBond.bondLengthSU,
            });
        });
    });

    return { requiredSymmetryInstances, interGroupBonds };
}

/**
 * Generates symmetry-related atoms based on the required symmetry instances.
 * @param {Set<string>} requiredSymmetryInstances - Set of required symmetry instances.
 * @param {Array<object>} atomGroups - The atom groups from structure.connectedGroups.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {string} identSymmString - The identity symmetry operation string.
 * @returns {Map<string, string>} Map of special position atoms (from -> to).
 */
export function generateSymmetryAtoms(requiredSymmetryInstances, atomGroups, structure, identSymmString) {
    // Store atom groups for each symmetry: [groupIndex][symmInstanceIndex][atomIndex]
    const atomsByGroupAndSymmetry = atomGroups.map(g => [[...g.atoms]]); // Start with identity atoms
    
    // --- Special position handling ---
    // This logic identifies atoms generated by symmetry that occupy the same
    // position as another atom (either the original or from another symm op).
    // It maps the duplicate atom's label to the label of the atom being kept.
    const specialPositionAtoms = new Map();
    const newAtoms = [];

    // Generate atoms for all required symmetry instances
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
            atom.label = createSymAtomLabel(atom.label, symOp);
        });
        atomsByGroupAndSymmetry[groupIndex].push(newGroupAtoms);
    });

    // Process all symmetry atoms to handle special positions
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
                        newAtoms.push(symmAtom);
                    }
                }
            }
        }
    });

    return { specialPositionAtoms, newAtoms };
}

/**
 * Generates bonds for symmetry instances and handles special positions.
 * @param {Array<object>} atomGroups - The atom groups from structure.connectedGroups.
 * @param {Set<string>} requiredSymmetryInstances - Set of required symmetry instances.
 * @param {Array<{originSymmAtom: string, targetSymmAtom: string, bondLength: number, bondLengthSU: number}>} interGroupBonds 
 * - Inter-group bonds from collectSymmetryRequirements.
 * @param interGroupBonds
 * @param {Map<string, string>} specialPositionAtoms - Map of special position atoms.
 * @param newAtoms
 * @param {string} identSymmString - The identity symmetry operation string.
 * @returns {{newBonds: Array<Bond>, atomLabels: Set<string>}} New bonds and set of atom labels.
 */
export function generateSymmetryBonds(
    atomGroups, requiredSymmetryInstances, interGroupBonds, specialPositionAtoms, newAtoms, identSymmString,
) {
    // Initialize with the original intra-group bonds
    const newBonds = [];
    atomGroups.forEach(g => {
        newBonds.push(...g.bonds);
    });
    
    const existingBonds = new Set();
    
    // Track existing bonds to avoid duplicates
    newBonds.forEach(b => {
        existingBonds.add(createBondIdentifier(b.atom1Label, b.atom2Label));
    });

    // Generate symmetry-related intra-group bonds
    requiredSymmetryInstances.forEach(g => {
        const [idxStr, symOp] = g.split('@.@');
        if (symOp === identSymmString) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        const originalBonds = atomGroups[groupIndex].bonds;
        originalBonds.forEach(b => {
            const atom1Label = createSymAtomLabel(b.atom1Label, symOp);
            const atom2Label = createSymAtomLabel(b.atom2Label, symOp);
            const atom1 = specialPositionAtoms.get(atom1Label) || atom1Label;
            const atom2 = specialPositionAtoms.get(atom2Label) || atom2Label;
            
            const bondString = createBondIdentifier(atom1, atom2);
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                newBonds.push(new Bond(
                    atom1, atom2, b.bondLength, b.bondLengthSU, '.',
                ));
            }
        });
    });

    // Add inter-group bonds
    interGroupBonds.forEach(b => {
        const atom1 = specialPositionAtoms.get(b.originSymmAtom) || b.originSymmAtom;
        const atom2 = specialPositionAtoms.get(b.targetSymmAtom) || b.targetSymmAtom;
        const bondString = createBondIdentifier(atom1, atom2);
        if (!existingBonds.has(bondString)) {
            existingBonds.add(bondString);
            newBonds.push(new Bond(
                atom1, atom2, b.bondLength, b.bondLengthSU, '.',
            ));
        }
    });

    // Create set of atom labels for lookup
    const atomLabels = new Set(newAtoms.map(a => a.label));
    
    return { newBonds, atomLabels };
}

/**
 * Generates hydrogen bonds for symmetry instances and handles special positions.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {Array<object>} atomGroups - The atom groups from structure.connectedGroups.
 * @param {Map<string, number>} atomGroupMap - Map from atom label to group index.
 * @param {Set<string>} requiredSymmetryInstances - Set of required symmetry instances.
 * @param {Map<string, string>} specialPositionAtoms - Map of special position atoms.
 * @param {Set<string>} atomLabels - Set of atom labels.
 * @param {string} identSymmString - The identity symmetry operation string.
 * @returns {Array<HBond>} New hydrogen bonds.
 */
export function generateSymmetryHBonds(
    structure, atomGroups, atomGroupMap, requiredSymmetryInstances, specialPositionAtoms, atomLabels, identSymmString,
) {
    const finalHBonds = [];
    const finalHBondIdentifiers = new Set();

    // Add all original H-bonds first, ensuring their identifiers are correctly stored
    // to prevent adding duplicates later if they are re-generated.
    structure.hBonds.forEach(hb => {
        let identifier;
        if (hb.acceptorAtomSymmetry === '.' || hb.acceptorAtomSymmetry === identSymmString) { // Internal H-bond
            identifier = createHBondIdentifier(hb.donorAtomLabel, hb.hydrogenAtomLabel, hb.acceptorAtomLabel);
        } else { // External H-bond
            identifier = `${createHBondIdentifier(hb.donorAtomLabel, hb.hydrogenAtomLabel, hb.acceptorAtomLabel)}@${hb.acceptorAtomSymmetry}`;
        }
        // Only add if not already present (e.g. if input structure.hBonds had duplicates)
        if (!finalHBondIdentifiers.has(identifier)) {
            finalHBondIdentifiers.add(identifier);
            finalHBonds.push(hb);
        }
    });

    // Get definitions of external H-bonds originating from each group in the ASU
    const externalHBondDefinitions = atomGroups.map(() => []);
    structure.hBonds
        .filter(hb => hb.acceptorAtomSymmetry !== '.')
        .forEach(hb => {
            const donorGroupIndex = atomGroupMap.get(hb.donorAtomLabel);
            if (donorGroupIndex !== undefined) {
                externalHBondDefinitions[donorGroupIndex].push(hb);
            }
        });

    // Process required symmetry instances to generate new H-bonds
    requiredSymmetryInstances.forEach(gInstance => {
        const [idxStr, symOp] = gInstance.split('@.@');
        // Skip generating from identity if not explicitly needed for special position remapping (already handled by initial add)
        if (symOp === identSymmString) {
            // Potentially, if atoms involved in an original H-bond were remapped by specialPositionAtoms
            // even for identity, we might need to re-evaluate. However, the current logic
            // of adding originals first and then checking identifiers should handle this.
            // If C1 -> C1_sp, then original O1-H1..C1 becomes O1-H1..C1_sp if we re-evaluate.
            // For now, this early return is kept as per original logic, assuming `specialPositionAtoms`
            // primarily remaps non-identity generated atoms.
            // The tests pass with this, but it's a subtle area.
            return;
        }
        
        const groupIndex = Number(idxStr);
        
        // Handle intra-group H-bonds (generate symmetry copies)
        const originalIntraGroupHBonds = atomGroups[groupIndex].hBonds;
        originalIntraGroupHBonds.forEach(hb => {
            const sDonor = createSymAtomLabel(hb.donorAtomLabel, symOp);
            const sH = createSymAtomLabel(hb.hydrogenAtomLabel, symOp);
            const sAcceptor = createSymAtomLabel(hb.acceptorAtomLabel, symOp);

            const finalDonor = specialPositionAtoms.get(sDonor) || sDonor;
            const finalH = specialPositionAtoms.get(sH) || sH;
            const finalAcceptor = specialPositionAtoms.get(sAcceptor) || sAcceptor;

            const hBondIdentifier = createHBondIdentifier(finalDonor, finalH, finalAcceptor);
            if (!finalHBondIdentifiers.has(hBondIdentifier)) {
                finalHBondIdentifiers.add(hBondIdentifier);
                finalHBonds.push(new HBond(
                    finalDonor, finalH, finalAcceptor,
                    hb.donorHydrogenDistance, hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance, hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance, hb.donorAcceptorDistanceSU,
                    hb.hBondAngle, hb.hBondAngleSU,
                    '.', // Generated intra-group H-bonds are internal
                ));
            }
        });

        // Handle external H-bonds (generate symmetry copies)
        externalHBondDefinitions[groupIndex].forEach(hb => {
            const sDonor = createSymAtomLabel(hb.donorAtomLabel, symOp);
            const sH = createSymAtomLabel(hb.hydrogenAtomLabel, symOp);
            
            const finalDonor = specialPositionAtoms.get(sDonor) || sDonor;
            const finalH = specialPositionAtoms.get(sH) || sH;

            const newAcceptorOverallSymmetry = structure.symmetry.combineSymmetryCodes(
                symOp, hb.acceptorAtomSymmetry,
            );
            const potentialAcceptorFullLabel = createSymAtomLabel(hb.acceptorAtomLabel, newAcceptorOverallSymmetry);
            const finalAcceptorLabelForLookup = specialPositionAtoms.get(potentialAcceptorFullLabel) || potentialAcceptorFullLabel;

            let newHBondToAdd;
            let hBondIdentifier;

            if (atomLabels.has(finalAcceptorLabelForLookup)) {
                // Acceptor is generated and becomes internal
                newHBondToAdd = new HBond(
                    finalDonor, finalH, finalAcceptorLabelForLookup,
                    hb.donorHydrogenDistance, hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance, hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance, hb.donorAcceptorDistanceSU,
                    hb.hBondAngle, hb.hBondAngleSU,
                    '.', // Acceptor is now internal
                );
                hBondIdentifier = createHBondIdentifier(finalDonor, finalH, finalAcceptorLabelForLookup);
            } else {
                // Acceptor remains external
                newHBondToAdd = new HBond(
                    finalDonor, finalH, hb.acceptorAtomLabel, // Use base acceptor label
                    hb.donorHydrogenDistance, hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance, hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance, hb.donorAcceptorDistanceSU,
                    hb.hBondAngle, hb.hBondAngleSU,
                    newAcceptorOverallSymmetry, // New external symmetry
                );
                hBondIdentifier = `${createHBondIdentifier(finalDonor, finalH, hb.acceptorAtomLabel)}@${newAcceptorOverallSymmetry}`;
            }

            if (!finalHBondIdentifiers.has(hBondIdentifier)) {
                finalHBondIdentifiers.add(hBondIdentifier);
                finalHBonds.push(newHBondToAdd);
            }
        });
    });

    return finalHBonds;
}

/**
 * Processes translational links to generate additional bonds.
 * @param {Array<ConnectingBondGroup>} translationLinks - The translation links from createConnectivity.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {Map<string, string>} specialPositionAtoms - Map of special position atoms.
 * @param {Set<string>} existingBonds - Set of existing bond identifiers.
 * @returns {Array<Bond>} Additional bonds from translation links.
 */
export function processTranslationLinks(translationLinks, structure, specialPositionAtoms, existingBonds) {
    const additionalBonds = [];
    
    translationLinks.forEach(tl => {
        for (const conBond of tl.connectingBonds) {
            const targetSymmetry = structure.symmetry.combineSymmetryCodes(tl.connectingSymOp, tl.originSymmetry);
            const atom1Label = createSymAtomLabel(conBond.originAtom, tl.originSymmetry);
            const atom2Label = createSymAtomLabel(conBond.targetAtom, targetSymmetry);
            const atom1 = specialPositionAtoms.get(atom1Label) || atom1Label;
            const atom2 = specialPositionAtoms.get(atom2Label) || atom2Label;
            
            const bondString = createBondIdentifier(atom1, atom2);
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                additionalBonds.push(
                    new Bond(atom1, conBond.targetAtom, conBond.bondLength, conBond.bondLengthSU, targetSymmetry),
                );
            }
        }
    });
    
    return additionalBonds;
}

/**
 * Grows a crystal structure by applying symmetry operations based on connectivity.
 * @param {CrystalStructure} structure - The crystal structure to grow.
 * @returns {CrystalStructure} New structure with symmetry-expanded atoms and bonds.
 */
export function growSymmetry(structure) {
    const atomGroups = structure.calculateConnectedGroups();
    
    // Map atoms to their group indices for faster lookup
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
    });
    
    const identSymmString = structure.symmetry.identitySymOpId + '_555';

    // Step 1: Analyze connectivity to find all necessary symmetry operations
    const { networkConnections, translationLinks } = createConnectivity(structure, atomGroups);

    // Step 2: Collect required symmetry instances and inter-group bonds
    const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
        networkConnections, structure, identSymmString,
    );

    // Step 3: Generate symmetry-related atoms and handle special positions
    const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
        requiredSymmetryInstances, atomGroups, structure, identSymmString,
    );

    // Step 4: Generate bonds for symmetry instances
    const { newBonds, atomLabels } = generateSymmetryBonds(
        atomGroups, requiredSymmetryInstances, interGroupBonds, 
        specialPositionAtoms, newAtoms, identSymmString,
    );

    // Step 5: Generate hydrogen bonds for symmetry instances
    const newHBonds = generateSymmetryHBonds(
        structure, atomGroups, atomGroupMap, requiredSymmetryInstances, 
        specialPositionAtoms, atomLabels, identSymmString,
    );

    // Step 6: Process translation links to add any remaining bonds
    const existingBondIds = new Set(newBonds.map(b => createBondIdentifier(b.atom1Label, b.atom2Label)));
    const translationBonds = processTranslationLinks(
        translationLinks, structure, specialPositionAtoms, existingBondIds,
    );
    
    newBonds.push(...translationBonds);

    // Step 7: Create the new structure with grown symmetry
    return new CrystalStructure(structure.cell, newAtoms, newBonds, newHBonds, structure.symmetry);
}