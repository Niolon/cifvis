import { CrystalStructure } from '../../crystal.js';
import { Bond, HBond } from '../../bonds.js';
import { createAtomId } from './util.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';
import { chemicalBonds } from '../../bond-classification.js';

/**
 * @typedef {object} SeedConnection
 * @property {number} targetIndex - Index of the target atom group.
 * @property {AppliedSymmetry} targetSymmetry - The symmetry operation needed to reach the target group from the
 * origin group at identity.
 * @property {Array<ConnectingBond>} bonds - Specific bonds forming this connection.
 */

/**
 * @typedef {object} ExplorationState
 * @property {Array<ConnectingBondGroup>} danglingConnections - Queue of connection groups to process.
 * @property {Set<string>} processedConnections - Set of unique keys for connections already processed or queued.
 */

/**
 * @typedef {object} ExplorationStepResult
 * @property {ConnectedGroup} newConnectedGroup - The new group instance discovered in this step.
 * @property {Array<ConnectingBondGroup>} newDanglingConnections - New connections found that need further
 * exploration.
 * @property {Array<ConnectingBondGroup>} foundTranslations - Connections found that lead to translational
 * duplicates.
 */

/**
 * @typedef {object} ConnectivityAnalysisResult
 * @property {Array<ConnectingBondGroup>} networkConnections - Bond groups forming the core connected network.
 * @property {Array<ConnectingBondGroup>} translationLinks - Bond groups leading to translational duplicates
 * (potential infinite growth).
 * @property {Array<Array<ConnectedGroup>>} discoveredGroups - All unique group instances found, grouped by their
 * original asymmetric unit group index.
 */

/**
 * @typedef {object} InterGroupBondInfo
 * @property {string} originAtomId - ID of the atom in the origin group.
 * @property {AppliedSymmetry} originSymmetry - Symmetry of the origin group.
 * @property {string} targetAtomId - ID of the atom in the target group.
 * @property {AppliedSymmetry} targetSymmetry - Symmetry of the target group.
 * @property {number} bondLength - The length of the bond.
 * @property {number} bondLengthSU - Standard uncertainty of the bond length.
 */

/**
 * @typedef {object} SymmetryRequirements
 * @property {Set<string>} requiredSymmetryInstances - Set of unique group@symmetry strings that need to be generated.
 * @property {Array<InterGroupBondInfo>} interGroupBonds - List of bonds connecting different symmetry instances.
 */

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
 * @property {AppliedSymmetry} appliedSymmetry - Symmetry object defining position
 */
export class ConnectedGroup {
    /**
     * Creates a new connected group
     * @param {number} groupIndex - Index of the group in the original structure
     * @param {AppliedSymmetry} appliedSymmetry - Symmetry object
     */
    constructor(groupIndex, appliedSymmetry) {
        this.groupIndex = groupIndex;
        this.appliedSymmetry = typeof appliedSymmetry === 'string'
            ? AppliedSymmetry.fromString(appliedSymmetry)
            : appliedSymmetry;
    }

    /**
     * Checks if this group instance is a translational duplicate of another.
     * @param {ConnectedGroup} other - Group to compare with
     * @returns {boolean} True if groups are equivalent (same group index and symmetry operation ID) but have
     *  different translations.
     */
    isTranslationalDuplicateOf(other) {
        // Check if same group and same symmetry ID, but different translation
        return this.groupIndex === other.groupIndex &&
            this.appliedSymmetry.id === other.appliedSymmetry.id &&
            (
                this.appliedSymmetry.translation[0] !== other.appliedSymmetry.translation[0] ||
                this.appliedSymmetry.translation[1] !== other.appliedSymmetry.translation[1] ||
                this.appliedSymmetry.translation[2] !== other.appliedSymmetry.translation[2]
            );
    }

    /**
     * Gets the full symmetry string.
     * @returns {string} The combined symmetry and translation ID string.
     */
    getSymmetryString() {
        return this.appliedSymmetry.toString();
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
        this.originAtom = originAtom.includes('|') ? originAtom : createAtomId(originAtom, '1_555');
        this.targetAtom = targetAtom.includes('|') ? targetAtom : createAtomId(targetAtom, '1_555');
        this.bondLength = bondLength;
        this.bondLengthSU = bondLengthSU;
    }
}

/**
 * Represents a bond group that crosses symmetry operations
 * @class
 * @property {number} originIndex - Index of the origin group
 * @property {AppliedSymmetry} originSymmetry - Symmetry operation of origin group
 * @property {number} targetIndex - Index of the target group
 * @property {AppliedSymmetry} targetSymmetry - Direct symmetry operation for the target group
 * @property {ConnectingBond[]} connectingBonds - All bonds that form the connection between the two fragments
 * @property {number} creationOriginIndex - Index of the group within the asym. unit this bond originates from
 */
export class ConnectingBondGroup {
    /**
     * Represents a connection between two molecular fragments via symmetry
     * @param {number} originIndex - Index of the origin group
     * @param {AppliedSymmetry} originSymmetry - Symmetry operation of origin group
     * @param {number} targetIndex - Index of the target group
     * @param {AppliedSymmetry} targetSymmetry - Direct symmetry operation for the target
     * @param {ConnectingBond[]} connectingBonds - All bonds that form the connection between the two fragments
     * @param {number} creationOriginIndex - Index of the group within the asym. unit this bond originates from. Used to
     *  track which groups belong together when checking for translational duplicates.
     */
    constructor(originIndex, originSymmetry, targetIndex, targetSymmetry, connectingBonds, creationOriginIndex) {
        this.originIndex = originIndex;
        this.originSymmetry = typeof originSymmetry === 'string'
            ? AppliedSymmetry.fromString(originSymmetry)
            : originSymmetry;
        this.targetIndex = targetIndex;
        this.targetSymmetry = typeof targetSymmetry === 'string'
            ? AppliedSymmetry.fromString(targetSymmetry)
            : targetSymmetry;
        this.connectingBonds = connectingBonds;
        this.creationOriginIndex = creationOriginIndex;
    }

    /**
     * Gets a key that uniquely identifies this bond connection, respecting symmetry and order.
     * Ensures that the connection A->B with symm S is the same key as B->A with inverse symm S'.
     * @returns {string} Unique identifier for the bond connection.
     */
    getKey() {
        // Ensure consistent ordering for the key regardless of bond direction
        // Use cached keys from AppliedSymmetry
        const originSymKey = this.originSymmetry.key;
        const targetSymKey = this.targetSymmetry.key;

        if (this.originIndex === this.targetIndex) {
            // Intra-group connection across symmetry
            if (originSymKey < targetSymKey) {
                return `${this.originIndex}_${originSymKey}_${this.targetIndex}_${targetSymKey}`;
            } else {
                return `${this.targetIndex}_${targetSymKey}_${this.originIndex}_${originSymKey}`;
            }
        } else if (this.originIndex < this.targetIndex) {
            // Inter-group connection
            return `${this.originIndex}_${originSymKey}_${this.targetIndex}_${targetSymKey}`;
        } else {
            // Inter-group connection (reversed order)
            return `${this.targetIndex}_${targetSymKey}_${this.originIndex}_${originSymKey}`;
        }
    }
}

/**
 * Extracts the initial symmetry connections based on the structure's bond list.
 * These are the starting points for the connectivity exploration.
 * @param {CrystalStructure} structure - Crystal structure to analyze.
 * @param {Array<object>} atomGroups - Array of atom groups (from structure.connectedGroups).
 * @param {Map<string, number>} atomGroupMap - Map from atom label to group index.
 * @returns {Array<Array<SeedConnection>>} An array where each index corresponds to an atom group,
 * originating from that group: { targetIndex, targetSymmetry: connectingSymOp, bonds }.
 */
export function getSeedConnections(structure, atomGroups, atomGroupMap) {
    // Used to group bonds between the same groups/symm ops 
    const seedConnectionsKeys = atomGroups.map(() => new Map());
    const seedConnectionsInGroup = atomGroups.map(() => []);

    structure.bonds
        .filter(bond => bond.atom2SiteSymmetry !== '.') // Only consider bonds crossing symmetry
        .forEach(bond => {
            // For group lookup, we always need the base atom ID (identity symmetry)
            // bond.atom1Id is already in identity (set by BondsFactory)
            const atom1Group = atomGroupMap.get(bond.atom1Id) ?? atomGroupMap.get(bond.atom1Label);

            const atom2Label = bond.atom2Id.split('|')[0];
            const atom2BaseId = `${atom2Label}|1_555`;
            const atom2Group = atomGroupMap.get(atom2BaseId) ?? atomGroupMap.get(atom2Label);

            if (atom1Group === undefined || atom2Group === undefined) {
                return;
            }

            // Key identifies the specific connection: origin group -> target group @ identity symm -> target symm
            const targetKey = `${atom1Group}->${atom2Group}@.@${bond.atom2SiteSymmetry}`;

            if (seedConnectionsKeys[atom1Group].has(targetKey)) {
                // Add bond to existing connection object
                const index = seedConnectionsKeys[atom1Group].get(targetKey);
                seedConnectionsInGroup[atom1Group][index].bonds.push(
                    new ConnectingBond(bond.atom1Id, bond.atom2Id, bond.bondLength, bond.bondLengthSU),
                );
            } else {
                // Create new connection object
                seedConnectionsKeys[atom1Group].set(targetKey, seedConnectionsInGroup[atom1Group].length);
                seedConnectionsInGroup[atom1Group].push({
                    targetIndex: atom2Group,
                    targetSymmetry: AppliedSymmetry.fromString(bond.atom2SiteSymmetry),
                    bonds: [new ConnectingBond(bond.atom1Id, bond.atom2Id, bond.bondLength, bond.bondLengthSU)],
                });
            }
        });
    return seedConnectionsInGroup;
}

/**
 * Initializes the queue of bond groups (connections) to process and the set of processed connections.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - Connections extracted by getSeedConnections.
 * @param {AppliedSymmetry} identSymm - The identity symmetry operation object.
 * @returns {ExplorationState} An object containing the initial queue and the set of processed connection keys.
 */
export function initializeExploration(seedConnectionsPerGroup, identSymm) {
    const danglingConnections = [];
    const processedConnections = new Set();

    seedConnectionsPerGroup.forEach((groupConnections, groupIndex) => {
        for (const connection of groupConnections) {
            // Initial bond groups start from the identity symmetry
            const initialBondGroup = new ConnectingBondGroup(
                groupIndex,            // Origin group index
                identSymm,             // Origin symmetry is identity
                connection.targetIndex, // Target group index
                connection.targetSymmetry, // Symmetry op to reach target from origin
                connection.bonds,      // Specific atom bonds
                groupIndex,            // The creation origin is the group itself initially
            );

            // Calculate the key based on the target symmetry
            const bondKey = initialBondGroup.getKey();

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
 * @param {Array<Array<ConnectedGroup>>} discoveredGroups - Current list of discovered group instances for each
 *  creation origin.
 * @param {Array<Array<SeedConnection>>} seedConnectionsPerGroup - The initial connections for each group type.
 * @param {Set<string>} processedConnections - Set of unique keys for connections already processed or queued. This
 * function adds new connection keys to this set as they are encountered.
 * @returns {ExplorationStepResult} Results of processing the step.
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

    const newConnectedGroup = new ConnectedGroup(currentConnection.targetIndex, currentConnection.targetSymmetry);

    // Find connections originating from the *type* of group we just reached (targetIndex)
    const targetGroupConnections = seedConnectionsPerGroup[currentConnection.targetIndex];

    // Process each connection from the target group
    for (const connection of targetGroupConnections) {
        // A seed connection is defined at identity as origin -> T(target).
        // When visiting that origin group at absolute symmetry S, both endpoints
        // are transformed by S, so the new target is S(T(target)).
        const relativeTargetSymmetry = typeof connection.targetSymmetry === 'string'
            ? AppliedSymmetry.fromString(connection.targetSymmetry)
            : connection.targetSymmetry;
        const nextTargetSymmetryAbsolute = relativeTargetSymmetry.combine(
            currentConnection.targetSymmetry,
            structure.symmetry,
        );

        // Create the prospective bond representing the next step
        const prospectiveConnection = new ConnectingBondGroup(
            currentConnection.targetIndex,  // Origin is the group we just reached
            currentConnection.targetSymmetry,      // Symmetry of this origin
            connection.targetIndex,        // Target group index for the *next* step
            nextTargetSymmetryAbsolute,     // Direct symmetry needed to get to the target
            connection.bonds,              // Specific atom bonds for this connection type
            currentConnection.creationOriginIndex, // Propagate the original creation index
        );

        // Check if this connection path has already been processed or queued
        const connectionKey = prospectiveConnection.getKey();
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
 * @param {Array<object>} atomGroups - Created distinct groups of interconnected atoms.
 * @returns {ConnectivityAnalysisResult} - Object containing the list of bond groups used to build the connected
 *  network, bond groups leading to translational duplicates, and the discovered group instances.
 */
export function createConnectivity(structure, atomGroups) {
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => atomGroupMap.set(atom.uniqueId, i));
    });

    // Create base identity AppliedSymmetry
    const identSymm = AppliedSymmetry.fromString(structure.symmetry.identitySymOpId + '_555');

    // Find all initial connections defined in the bond list
    const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);

    // Set up the initial processing queue and processed set
    const { danglingConnections, processedConnections } = initializeExploration(
        seedConnectionsPerGroup,
        identSymm,
    );

    const networkConnections = []; // Bonds successfully processed and added to the network
    const translationLinks = []; // Bonds leading to translational duplicates

    // Tracks all symmetry instances found for each original group index
    const discoveredGroups = atomGroups.map(() => []);

    // Add the initial identity group for each original group index
    atomGroups.forEach((_, i) => {
        discoveredGroups[i].push(new ConnectedGroup(i, identSymm));
    });

    let safetyCounter = 0;
    const MAXITER = 10000; // Safety limit

    // Process the queue iteratively using breadth-first search
    let connectionIndex = 0;
    while (connectionIndex < danglingConnections.length) {
        if (safetyCounter++ > MAXITER) {
            console.error(
                'Max iterations reached in createConnectivity. Possible infinite loop orvery complex structure.',
            );
            break; // Exit loop to prevent freezing
        }

        // Advancing an index preserves FIFO order without shifting the remaining
        // queue on every iteration.
        const currentConnection = danglingConnections[connectionIndex++];

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

    if (connectionIndex < danglingConnections.length) {
        console.warn(
            'Connectivity processing stopped due to iteration limit. ' +
            `${danglingConnections.length - connectionIndex} ` +
            'connections remain unprocessed.',
        );
    }

    return { networkConnections, translationLinks, discoveredGroups };
}

/**
 * Collects required symmetry instances and creates inter-group bonds from network connections.
 * @param {Array<ConnectingBondGroup>} networkConnections - The network connections from createConnectivity.
 * @returns {SymmetryRequirements} The required symmetry instances and inter-group bonds.
 */
export function collectSymmetryRequirements(networkConnections) {
    const requiredSymmetryInstances = new Set();
    const interGroupBonds = [];

    // Collect all unique group@symmetry instances needed
    networkConnections.forEach((group) => {
        // Use .key for string representation in Set
        requiredSymmetryInstances.add(`${group.originIndex}@.@${group.originSymmetry.key}`);
        requiredSymmetryInstances.add(`${group.targetIndex}@.@${group.targetSymmetry.key}`);

        group.connectingBonds.forEach(conBond => {
            // Store raw components for reconstruction later
            interGroupBonds.push({
                originAtomId: conBond.originAtom,
                originSymmetry: group.originSymmetry,
                targetAtomId: conBond.targetAtom,
                targetSymmetry: group.targetSymmetry,
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
 * @param {string} identSymmKey - The identity symmetry operation key.
 * @returns {{specialPositionAtoms: Map<string, string>, newAtoms: Array<object>}} Map of special position atoms
 * (from -> to) and the generated atoms.
 */
export function generateSymmetryAtoms(requiredSymmetryInstances, atomGroups, structure, identSymmKey) {
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
        const [idxStr, symKey] = g.split('@.@');
        if (symKey === identSymmKey) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        // Ensure atoms are cloned/copied properly if modified later
        const originalAtoms = atomGroups[groupIndex].atoms;
        const newGroupAtoms = structure.symmetry.applySymmetry(symKey, originalAtoms);

        // Convert to AppliedSymmetry once for this group
        const appliedSym = AppliedSymmetry.fromString(symKey);

        newGroupAtoms.forEach(atom => {
            // Set the appliedSymmetry object
            atom.appliedSymmetry = appliedSym;
            // Label remains the chemical label.
            // uniqueId will automatically include the symmetry info.
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
                for (let symmGroupIdx = 0; symmGroupIdx < atomsForOriginal.length; symmGroupIdx++) {
                    const symmAtom = atomsForOriginal[symmGroupIdx];
                    const isIdentity = symmGroupIdx === 0; // First group is identity
                    let specPos = false; // Assume not special position initially
                    for (const keptSymmAtom of keptSymmAtoms) {
                        // Use a small tolerance for floating point comparisons
                        specPos = Math.abs(keptSymmAtom.position.x - symmAtom.position.x) * structure.cell.a < 1e-4 &&
                            Math.abs(keptSymmAtom.position.y - symmAtom.position.y) * structure.cell.b < 1e-4 &&
                            Math.abs(keptSymmAtom.position.z - symmAtom.position.z) * structure.cell.c < 1e-4;
                        if (specPos) {
                            // Map the duplicate atom ID to the kept atom ID
                            specialPositionAtoms.set(symmAtom.uniqueId, keptSymmAtom.uniqueId);
                            break; // Found a match, no need to check further kept atoms
                        }
                    }
                    if (!specPos) {
                        // This atom represents a unique position for this original atom, keep it
                        keptSymmAtoms.push(symmAtom);
                        // Only add non-identity atoms to newAtoms (identity atoms are already in structure.atoms)
                        if (!isIdentity) {
                            newAtoms.push(symmAtom);
                        }
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
 * @param {Array<InterGroupBondInfo>} interGroupBonds - Inter-group bonds from collectSymmetryRequirements.
 * @param {Map<string, string>} specialPositionAtoms - Map of special position atoms.
 * @param {Array<object>} newAtoms - The generated atoms.
 * @param {string} identSymmKey - The identity symmetry operation key.
 * @param {CrystalStructure} [structure] - Source structure whose external bond definitions are completed across
 * the generated symmetry instances.
 * @returns {{newBonds: Array<Bond>, atomLabels: Set<string>}} New bonds and set of atom labels.
 */
export function generateSymmetryBonds(
    atomGroups, requiredSymmetryInstances, interGroupBonds, specialPositionAtoms, newAtoms, identSymmKey,
    structure = null,
) {
    // Initialize with the original intra-group bonds
    const newBonds = [];
    atomGroups.forEach(g => {
        newBonds.push(...g.bonds);
    });

    const existingBonds = new Set();

    // Track existing bonds to avoid duplicates
    newBonds.forEach(b => {
        existingBonds.add(createBondIdentifier(b.atom1Id, b.atom2Id));
    });

    // Generate symmetry-related intra-group bonds
    requiredSymmetryInstances.forEach(g => {
        const [idxStr, symKey] = g.split('@.@');
        if (symKey === identSymmKey) {
            return; // Skip identity operation
        }
        const groupIndex = Number(idxStr);
        const originalBonds = atomGroups[groupIndex].bonds;
        originalBonds.forEach(b => {
            // Extract base label from the bond's atom IDs (which are in uniqueId format)
            const atom1BaseLabel = b.atom1Id.split('|')[0];
            const atom2BaseLabel = b.atom2Id.split('|')[0];
            // Create new IDs with the target symmetry
            const atom1Id = createAtomId(atom1BaseLabel, symKey);
            const atom2Id = createAtomId(atom2BaseLabel, symKey);
            const atom1 = specialPositionAtoms.get(atom1Id) || atom1Id;
            const atom2 = specialPositionAtoms.get(atom2Id) || atom2Id;

            const bondString = createBondIdentifier(atom1, atom2);
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                newBonds.push(new Bond(
                    atom1, atom2, b.bondLength, b.bondLengthSU, '.',
                ));
            }
        });
    });

    //Add inter-group bonds
    interGroupBonds.forEach(b => {
        const originAtomId = b.originAtomId || b.originSymmAtom;
        const targetAtomId = b.targetAtomId || b.targetSymmAtom;
        const originBaseLabel = originAtomId.split(/[|@]/)[0];
        const targetBaseLabel = targetAtomId.split(/[|@]/)[0];
        const originSymmetry = b.originSymmetry || AppliedSymmetry.fromString(
            originAtomId.split(/[|@]/)[1] || identSymmKey,
        );
        const targetSymmetry = b.targetSymmetry || AppliedSymmetry.fromString(
            targetAtomId.split(/[|@]/)[1] || identSymmKey,
        );

        const atom1Raw = originSymmetry.key === identSymmKey
            ? createAtomId(originBaseLabel, identSymmKey)
            : createAtomId(originBaseLabel, originSymmetry.key);

        const atom2Raw = targetSymmetry.key === identSymmKey
            ? createAtomId(targetBaseLabel, identSymmKey)
            : createAtomId(targetBaseLabel, targetSymmetry.key);

        const mappedAtom1 = specialPositionAtoms.get(atom1Raw) || atom1Raw;
        const mappedAtom2 = specialPositionAtoms.get(atom2Raw) || atom2Raw;
        const atom1 = mappedAtom1.includes('|') ? mappedAtom1 : createAtomId(mappedAtom1, identSymmKey);
        const atom2 = mappedAtom2.includes('|') ? mappedAtom2 : createAtomId(mappedAtom2, identSymmKey);

        const bondString = createBondIdentifier(atom1, atom2);
        if (!existingBonds.has(bondString)) {
            existingBonds.add(bondString);
            newBonds.push(new Bond(
                atom1, atom2, b.bondLength, b.bondLengthSU, '.',
            ));
        }
    });

    // A CIF lists a symmetry-crossing bond from an asymmetric-unit atom to one
    // symmetry image. Once both fragment instances have been generated, the
    // complete symmetry orbit of that bond must be present. A connection group
    // alone cannot provide this: for example, an inversion-completed molecule
    // may contain both C1-C5' and its distinct mate C1'-C5, even though both
    // connect the same two fragment instances and therefore share one graph
    // edge. Generate every external bond definition from each included origin
    // instance, retaining only bonds whose two resolved atoms are actually in
    // the completed fragment.
    if (structure) {
        const groupByAtomLabel = new Map();
        const symmetriesByGroup = atomGroups.map(() => new Set([identSymmKey]));
        const availableAtomIds = new Set(newAtoms.map(atom => atom.uniqueId).filter(Boolean));

        atomGroups.forEach((group, groupIndex) => {
            group.atoms.forEach(atom => {
                groupByAtomLabel.set(atom.label, groupIndex);
                availableAtomIds.add(atom.uniqueId || createAtomId(atom.label, identSymmKey));
            });
        });
        requiredSymmetryInstances.forEach(instance => {
            const [groupIndexString, symKey] = instance.split('@.@');
            symmetriesByGroup[Number(groupIndexString)]?.add(symKey);
        });

        structure.bonds
            .filter(bond => bond.atom2SiteSymmetry !== '.')
            .forEach(bond => {
                const originGroupIndex = groupByAtomLabel.get(bond.atom1Label);
                if (originGroupIndex === undefined) {
                    return;
                }

                const relativeTargetSymmetry = AppliedSymmetry.fromString(bond.atom2SiteSymmetry);
                for (const originSymKey of symmetriesByGroup[originGroupIndex]) {
                    const originSymmetry = AppliedSymmetry.fromString(originSymKey);
                    const targetSymmetry = relativeTargetSymmetry.combine(originSymmetry, structure.symmetry);
                    const originAtomRaw = createAtomId(bond.atom1Label, originSymKey);
                    const targetAtomRaw = createAtomId(bond.atom2Label, targetSymmetry.key);
                    const originAtom = specialPositionAtoms.get(originAtomRaw) || originAtomRaw;
                    const targetAtom = specialPositionAtoms.get(targetAtomRaw) || targetAtomRaw;

                    if (!availableAtomIds.has(originAtom) || !availableAtomIds.has(targetAtom)) {
                        continue;
                    }

                    const bondString = createBondIdentifier(originAtom, targetAtom);
                    if (!existingBonds.has(bondString)) {
                        existingBonds.add(bondString);
                        newBonds.push(new Bond(
                            originAtom, targetAtom, bond.bondLength, bond.bondLengthSU, '.',
                        ));
                    }
                }
            });
    }

    // Create set of atom labels for lookup
    const atomLabels = new Set(newAtoms.map(a => a.uniqueId));

    return { newBonds, atomLabels };
}

/**
 * Generates hydrogen bonds for symmetry instances and handles special positions.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {Array<object>} atomGroups - The atom groups from structure.connectedGroups.
 * @param {Map<string, number>} atomGroupMap - Map from atom label to group index.
 * @param {Set<string>} requiredSymmetryInstances - Set of required symmetry instances (e.g. '0@.@2_655').
 * @param {Map<string, string>} specialPositionAtoms - Map from a duplicate symmetry-generated atom label to the
 * label of the atom instance that is kept (representing the same spatial position).
 * @param {Set<string>} atomLabels - Set of atom labels.
 * @param {string} identSymmKey - The identity symmetry operation key.
 * @returns {Array<HBond>} New hydrogen bonds.
 */
export function generateSymmetryHBonds(
    structure, atomGroups, atomGroupMap, requiredSymmetryInstances, specialPositionAtoms, atomLabels, identSymmKey,
) {
    const finalHBonds = [];
    const finalHBondIdentifiers = new Set();

    // Add all original H-bonds first
    structure.hBonds.forEach(hb => {
        let identifier;
        if (hb.acceptorAtomSymmetry === '.' || hb.acceptorAtomSymmetry === identSymmKey) { // Internal H-bond
            identifier = createHBondIdentifier(hb.donorAtomId, hb.hydrogenAtomId, hb.acceptorAtomId);
        } else { // External H-bond
            const noSymIdentifier = createHBondIdentifier(
                hb.donorAtomId,
                hb.hydrogenAtomId,
                hb.acceptorAtomId,
            );
            identifier = `${noSymIdentifier}@${hb.acceptorAtomSymmetry}`;
        }
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
            // Use the full donor atom ID for lookup since atomGroupMap is keyed by uniqueId
            const donorGroupIndex = atomGroupMap.get(hb.donorAtomId);
            if (donorGroupIndex !== undefined) {
                externalHBondDefinitions[donorGroupIndex].push(hb);
            }
        });

    // Process required symmetry instances to generate new H-bonds
    requiredSymmetryInstances.forEach(gInstance => {
        const [idxStr, symKey] = gInstance.split('@.@');
        if (symKey === identSymmKey) {
            return;
        }

        const groupIndex = Number(idxStr);

        // Handle intra-group H-bonds (generate symmetry copies)
        const originalIntraGroupHBonds = atomGroups[groupIndex].hBonds;
        originalIntraGroupHBonds.forEach(hb => {
            // Extract base labels from the H-bond's atom IDs (which are in uniqueId format)
            const donorBaseLabel = hb.donorAtomId.split('|')[0];
            const hBaseLabel = hb.hydrogenAtomId.split('|')[0];
            const acceptorBaseLabel = hb.acceptorAtomId.split('|')[0];
            // Create new IDs with the target symmetry
            const sDonor = createAtomId(donorBaseLabel, symKey);
            const sH = createAtomId(hBaseLabel, symKey);
            const sAcceptor = createAtomId(acceptorBaseLabel, symKey);

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
            // Extract base labels from the H-bond's atom IDs
            const donorBaseLabel = hb.donorAtomId.split('|')[0];
            const hBaseLabel = hb.hydrogenAtomId.split('|')[0];
            // Create new IDs with the target symmetry
            const sDonor = createAtomId(donorBaseLabel, symKey);
            const sH = createAtomId(hBaseLabel, symKey);

            const finalDonor = specialPositionAtoms.get(sDonor) || sDonor;
            const finalH = specialPositionAtoms.get(sH) || sH;

            const newAcceptorOverallSymmetry = structure.symmetry.combineSymmetryCodes(
                symKey, hb.acceptorAtomSymmetry,
            );
            const acceptorBaseLabel = hb.acceptorAtomId.split('|')[0];
            const potentialAcceptorFullId = createAtomId(acceptorBaseLabel, newAcceptorOverallSymmetry);
            const finalAcceptorIdForLookup = specialPositionAtoms.get(
                potentialAcceptorFullId,
            ) || potentialAcceptorFullId;

            let newHBondToAdd;
            let hBondIdentifier;

            if (atomLabels.has(finalAcceptorIdForLookup)) {
                // Acceptor is generated and becomes internal
                newHBondToAdd = new HBond(
                    finalDonor, finalH, finalAcceptorIdForLookup,
                    hb.donorHydrogenDistance, hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance, hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance, hb.donorAcceptorDistanceSU,
                    hb.hBondAngle, hb.hBondAngleSU,
                    '.', // Acceptor is now internal
                );
                hBondIdentifier = createHBondIdentifier(finalDonor, finalH, finalAcceptorIdForLookup);
            } else {
                // Acceptor remains external
                // Extract base label from acceptor (acceptorAtomLabel may already contain symmetry like 'O|1_554')
                newHBondToAdd = new HBond(
                    finalDonor, finalH, acceptorBaseLabel, // Use base acceptor label
                    hb.donorHydrogenDistance, hb.donorHydrogenDistanceSU,
                    hb.acceptorHydrogenDistance, hb.acceptorHydrogenDistanceSU,
                    hb.donorAcceptorDistance, hb.donorAcceptorDistanceSU,
                    hb.hBondAngle, hb.hBondAngleSU,
                    newAcceptorOverallSymmetry, // New external symmetry
                );
                const symmHBIdentifier = createHBondIdentifier(finalDonor, finalH, acceptorBaseLabel);
                hBondIdentifier = `${symmHBIdentifier}@${newAcceptorOverallSymmetry}`;
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
 * @param {Set<string>} existingBonds - Set of unique bond identifiers. This function adds identifiers of newly
 * created bonds to this set.
 * @returns {Array<Bond>} Additional bonds from translation links.
 */
export function processTranslationLinks(translationLinks, structure, specialPositionAtoms, existingBonds) {
    const additionalBonds = [];
    translationLinks.forEach(tl => {
        for (const conBond of tl.connectingBonds) {
            // ConnectingBond IDs retain the relative symmetry from the source CIF
            // row, while the translation link contains the absolute symmetry of
            // each endpoint. Use the labels plus those absolute symmetries; combining
            // them would apply the source symmetry twice.
            const atom1Label = conBond.originAtom.split('|')[0];
            const atom2Label = conBond.targetAtom.split('|')[0];
            const atom1Id = createAtomId(atom1Label, tl.originSymmetry.key);
            const atom2Id = createAtomId(atom2Label, tl.targetSymmetry.key);
            const atom1 = specialPositionAtoms.get(atom1Id) || atom1Id;
            const atom2 = specialPositionAtoms.get(atom2Id) || atom2Id;
            const atom2Symmetry = atom2.split('|')[1] || tl.targetSymmetry.key;

            const bondString = createBondIdentifier(atom1, atom2);
            if (!existingBonds.has(bondString)) {
                existingBonds.add(bondString);
                additionalBonds.push(
                    new Bond(
                        atom1,
                        // A translation link terminates at an intentionally omitted
                        // periodic image. Keep its absolute ID consistent with the
                        // external symmetry instead of accidentally resolving the
                        // bond to the existing identity atom.
                        atom2,
                        conBond.bondLength,
                        conBond.bondLengthSU,
                        atom2Symmetry,
                    ),
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
export function growFragment(structure) {
    // `_geom_bond` loops can contain publication contacts as well as chemical
    // bonds. Fragment growth must operate on the chemical graph only; otherwise
    // an intermolecular contact turns a finite molecule into a symmetry network.
    const graphStructure = new CrystalStructure(
        structure.cell,
        structure.atoms,
        chemicalBonds(structure),
        structure.hBonds,
        structure.symmetry,
    );
    const atomGroups = graphStructure.calculateConnectedGroups();

    // Map atoms to their group indices for faster lookup
    const atomGroupMap = new Map();
    atomGroups.forEach((group, i) => {
        group.atoms.forEach(atom => {
            atomGroupMap.set(atom.uniqueId, i);
        });
    });

    const identSymmKey = structure.symmetry.identitySymOpId + '_555';

    // Step 1: Analyze connectivity to find all necessary symmetry operations
    const { networkConnections, translationLinks } = createConnectivity(graphStructure, atomGroups);

    // Step 2: Collect required symmetry instances and inter-group bonds
    const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
        networkConnections, structure, identSymmKey,
    );

    // In a periodic structure (an extended chain, layer or framework) growing the
    // fragment replicates the unit along its periodic lattice directions into an
    // unbounded block. A periodic replica is, by definition, the same group reached
    // by the same symmetry operation at a different lattice translation
    // (see ConnectedGroup.isTranslationalDuplicateOf). So keep a single instance per
    // (group, operation) - the one nearest the origin - which suppresses replication
    // along every periodic direction (axis, screw or diagonal) on its own, while
    // keeping distinct-operation images that build the finite (non-periodic)
    // directions. For a genuinely molecular fragment each (group, operation) already
    // occurs once, so nothing is dropped.
    const bestInstanceByOperation = new Map();
    for (const instance of requiredSymmetryInstances) {
        const applied = AppliedSymmetry.fromString(instance.split('@.@')[1]);
        const operationKey = `${instance.split('@.@')[0]}|${applied.id}`;
        const magnitude = Math.abs(applied.translation[0])
            + Math.abs(applied.translation[1]) + Math.abs(applied.translation[2]);
        const existing = bestInstanceByOperation.get(operationKey);
        if (!existing || magnitude < existing.magnitude
            || (magnitude === existing.magnitude && instance < existing.instance)) {
            bestInstanceByOperation.set(operationKey, { instance, magnitude });
        }
    }
    const grownInstances = new Set([...bestInstanceByOperation.values()].map(entry => entry.instance));
    // Whether any periodic replica was actually collapsed. When true the fragment was
    // extended; drop the now-orphaned periodic-image bonds so the result is bounded
    // and self-consistent. When false the fragment is finite (or already a bounded
    // repeat unit) and keeps its normal dangling-bond behaviour.
    const collapsedPeriodicReplicas = grownInstances.size < requiredSymmetryInstances.size;

    // Step 3: Generate symmetry-related atoms and handle special positions
    const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
        grownInstances, atomGroups, graphStructure, identSymmKey,
    );

    // Step 4: Generate bonds for symmetry instances
    const { newBonds, atomLabels } = generateSymmetryBonds(
        atomGroups, grownInstances, interGroupBonds,
        specialPositionAtoms, newAtoms, identSymmKey, graphStructure,
    );

    // Step 5: Generate hydrogen bonds
    const newHBonds = generateSymmetryHBonds(
        graphStructure, atomGroups, atomGroupMap, grownInstances,
        specialPositionAtoms, atomLabels, identSymmKey,
    );

    // Step 6: Process translation links. When periodic replicas were collapsed the
    // growth is intentionally clamped, so these periodic-direction connections are
    // not materialised as dangling bonds; otherwise they behave as before.
    const translationBonds = collapsedPeriodicReplicas ? [] : processTranslationLinks(
        translationLinks, graphStructure, specialPositionAtoms,
        new Set(newBonds.map(b => createBondIdentifier(b.atom1Id, b.atom2Id))),
    );
    // Avoid passing very large translation networks as function arguments. Complex
    // structures can legitimately produce tens of thousands of translation bonds,
    // which exceeds the JavaScript engine's argument-count/stack limit with push(...).
    for (const bond of translationBonds) {
        newBonds.push(bond);
    }

    const allAtoms = [...graphStructure.atoms, ...newAtoms];

    // Collapsing periodic replicas can orphan bonds/H-bonds that pointed at a dropped
    // image. Drop those so the result is self-consistent (every bond references a
    // materialised atom) rather than carrying dangling references.
    let finalBonds = newBonds;
    let finalHBonds = newHBonds;
    if (collapsedPeriodicReplicas) {
        const materialised = new Set(allAtoms.map(atom => atom.uniqueId));
        finalBonds = newBonds.filter(bond =>
            materialised.has(bond.atom1Id) && materialised.has(bond.atom2Id));
        finalHBonds = newHBonds.filter(hbond =>
            materialised.has(hbond.donorAtomId) && materialised.has(hbond.hydrogenAtomId)
            && materialised.has(hbond.acceptorAtomId));
    }

    const grownStructure = new CrystalStructure(
        graphStructure.cell,
        allAtoms,
        finalBonds,
        finalHBonds,
        graphStructure.symmetry,
    );

    return { grownStructure, specialPositionAtoms };
}
