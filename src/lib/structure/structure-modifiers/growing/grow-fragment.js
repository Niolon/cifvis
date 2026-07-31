import { CrystalStructure } from '../../crystal.js';
import { Bond, HBond } from '../../bonds.js';
import { createAtomId } from './util.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';
import { chemicalBonds } from '../../bond-classification.js';
import {
    positionsCoincide,
    SPECIAL_POSITION_TOLERANCE,
    wrappedCartesianCoordinates,
} from '../../position.js';

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
 * quotient-connectivity component.
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
 * Compares two group instances including their integer lattice translation.
 * This is deliberately distinct from {@link ConnectedGroup#isTranslationalDuplicateOf}:
 * a queue may contain only one exact instance, whereas a different translation of
 * the same operation is a periodic continuation and must not be queued at all.
 * @param {ConnectedGroup} first - First group instance.
 * @param {ConnectedGroup} second - Second group instance.
 * @returns {boolean} Whether the instances have the same group, operation and translation.
 */
function sameGroupInstance(first, second) {
    return first.groupIndex === second.groupIndex
        && first.appliedSymmetry.id === second.appliedSymmetry.id
        && first.appliedSymmetry.translation.every((value, index) =>
            value === second.appliedSymmetry.translation[index]);
}

// groupInstancesCoincide is called from exploreConnection's duplicate check for every
// prospective connection against every already-discovered instance in its creation-origin
// bucket - the same (groupIndex, operation) instance is compared over and over as the BFS
// proceeds. Caching its symmetry-transformed atom positions turns that from a full
// per-atom matrix transform (applyToAtom, the dominant cost in fragment growth per
// profiling) on every comparison into a one-time computation per instance.
//
// Keyed on the atomGroups array identity rather than structure.symmetry: the same
// symmetry object is reused across many distinct atomGroups (e.g. once per Hydrogen x
// Disorder x Symmetry mode combination when testing one structure), and caching by
// symmetry object alone would silently return another call's atoms.
const groupInstancePositionCaches = new WeakMap();

/**
 * Resolves, and caches, the symmetry-transformed positions of every atom in a group
 * instance.
 *
 * Cached (and resolved) by operation ID alone, dropping the instance's specific integer
 * lattice translation: groupInstancesCoincide compares positions through
 * {@link positionsCoincide}, which wraps into the reference cell first, so wrap(p + n)
 * === wrap(p) for any integer lattice translation n - the translation component of a
 * symmetry key can never change the coincidence verdict, only the operation ID can (see
 * CellSymmetry.applySymmetry: it adds the operation's own, possibly-fractional
 * transVector, then separately the position code's integer translation - wrapping erases
 * only the latter). So every translated variant of the same operation reaches the same
 * cache entry instead of paying its own per-atom matrix transform - the exact situation
 * a BFS exploring many lattice translations of a handful of operations hits hardest.
 * @param {CrystalStructure} structure - Crystal structure providing symmetry
 * @param {Array<object>} atomGroups - Original asymmetric-unit atom groups
 * @param {ConnectedGroup} group - The symmetry instance to resolve
 * @returns {object[]} The group's atoms transformed by this instance's operation (at the
 *  reference/zero lattice translation - sufficient for a wrapped position comparison)
 */
function resolveGroupInstancePositions(structure, atomGroups, group) {
    let cache = groupInstancePositionCaches.get(atomGroups);
    if (!cache) {
        cache = new Map();
        groupInstancePositionCaches.set(atomGroups, cache);
    }
    const key = `${group.groupIndex}@${group.appliedSymmetry.id}`;
    if (!cache.has(key)) {
        cache.set(
            key,
            structure.symmetry.applySymmetry(group.appliedSymmetry.id, atomGroups[group.groupIndex].atoms),
        );
    }
    return cache.get(key);
}

/**
 * Whether two symmetry instances of the same original atom group occupy the exact
 * same physical positions - e.g. because both applied operations belong to that
 * atom's (or group's) site-symmetry stabiliser on a special position. On a
 * high-multiplicity Wyckoff position, dozens of distinct operation IDs can all map
 * a group back onto itself; {@link ConnectedGroup#isTranslationalDuplicateOf} only
 * catches the same operation ID reached at a different lattice translation, so it
 * misses this case entirely and lets the BFS in {@link createConnectivity} re-explore
 * the same atoms under every one of those operations. This is the central routine
 * for that check - it reuses {@link positionsCoincide}, the same position-equality
 * primitive used elsewhere for special-position detection, so "same point in the
 * crystal" is defined consistently everywhere it matters.
 * @param {CrystalStructure} structure - Crystal structure providing symmetry and cell metrics.
 * @param {Array<object>} atomGroups - Original asymmetric-unit atom groups (from calculateConnectedGroups).
 * @param {ConnectedGroup} groupA - First symmetry instance.
 * @param {ConnectedGroup} groupB - Second symmetry instance.
 * @returns {boolean} True if both instances place every atom of the group at the same position.
 */
export function groupInstancesCoincide(structure, atomGroups, groupA, groupB) {
    if (groupA.groupIndex !== groupB.groupIndex) {
        return false;
    }
    const atoms = atomGroups[groupA.groupIndex].atoms;
    if (atoms.length === 0) {
        return false;
    }
    const positionsA = resolveGroupInstancePositions(structure, atomGroups, groupA);
    const positionsB = resolveGroupInstancePositions(structure, atomGroups, groupB);
    return positionsA.every((atomA, i) => positionsCoincide(atomA.position, positionsB[i].position, structure.cell));
}

/**
 * Collapses the site-symmetry stabiliser of every asymmetric-unit group into
 * one deterministic operation signature. The computation is done once before
 * graph traversal, so high-symmetry centres cannot repeatedly rediscover the
 * same group through different operation IDs.
 * @param {CrystalStructure} structure - Structure providing all symmetry operations.
 * @param {Array<object>} atomGroups - Asymmetric-unit covalent groups.
 * @returns {Array<Map<string, string>>} Raw operation ID to canonical operation ID for each group.
 */
export function getCanonicalGroupOperations(structure, atomGroups) {
    const operationIds = Array.from(structure.symmetry.operationIds.keys());
    return atomGroups.map((_, groupIndex) => {
        const canonicalByOperation = new Map();
        const representatives = [];
        for (const operationId of operationIds) {
            const candidate = new ConnectedGroup(groupIndex, `${operationId}_555`);
            const representative = representatives.find(existing =>
                groupInstancesCoincide(structure, atomGroups, candidate, existing),
            );
            if (representative) {
                canonicalByOperation.set(operationId, representative.appliedSymmetry.id);
            } else {
                representatives.push(candidate);
                canonicalByOperation.set(operationId, operationId);
            }
        }
        return canonicalByOperation;
    });
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
 * Groups asymmetric-unit covalent components into connected components of the
 * symmetry-bond quotient graph. Every member of one quotient component is
 * explored through one shared state table, rather than growing the same
 * symmetry-assembled molecule separately from every ASU atom.
 * @param {Array<Array<SeedConnection>>} seedConnectionsPerGroup - Directed symmetry connections by source group.
 * @returns {{componentByGroup: number[], groupsByComponent: number[][]}} Component membership data.
 */
export function getConnectivityComponents(seedConnectionsPerGroup) {
    const parents = seedConnectionsPerGroup.map((_, index) => index);
    const find = index => {
        let root = index;
        while (parents[root] !== root) {
            root = parents[root];
        }
        while (parents[index] !== index) {
            const parent = parents[index];
            parents[index] = root;
            index = parent;
        }
        return root;
    };
    const join = (first, second) => {
        const firstRoot = find(first);
        const secondRoot = find(second);
        if (firstRoot !== secondRoot) {
            parents[secondRoot] = firstRoot;
        }
    };

    seedConnectionsPerGroup.forEach((connections, groupIndex) => {
        connections.forEach(connection => join(groupIndex, connection.targetIndex));
    });

    const componentForRoot = new Map();
    const componentByGroup = parents.map((_, groupIndex) => {
        const root = find(groupIndex);
        if (!componentForRoot.has(root)) {
            componentForRoot.set(root, componentForRoot.size);
        }
        return componentForRoot.get(root);
    });
    const groupsByComponent = Array.from({ length: componentForRoot.size }, () => []);
    componentByGroup.forEach((componentIndex, groupIndex) => {
        groupsByComponent[componentIndex].push(groupIndex);
    });
    return { componentByGroup, groupsByComponent };
}

/**
 * Initializes the queue of bond groups (connections) to process and the set of processed connections.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - Connections extracted by getSeedConnections.
 * @param {AppliedSymmetry} identSymm - The identity symmetry operation object.
 * @param {number[]} [componentByGroup] - Quotient-component index for each source group.
 * @returns {ExplorationState} An object containing the initial queue and the set of processed connection keys.
 */
export function initializeExploration(seedConnectionsPerGroup, identSymm, componentByGroup = null) {
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
                componentByGroup?.[groupIndex] ?? groupIndex, // Shared quotient-component exploration state
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
 * @param {Array<object>} atomGroups - Original asymmetric-unit atom groups, needed to resolve real positions for
 *  special-position duplicate detection.
 * @param {Array<Array<ConnectedGroup>>} [queuedGroups] - Group instances already accepted into the BFS queue but
 * not yet processed. Including these prevents two routes in the same breadth-first layer from scheduling separate
 * copies of the same periodic image.
 * @param {Array<Map<string, ConnectedGroup>>} [stateByOperation] - Canonical state representative for each
 * `groupIndex|operationId` in a quotient component. This makes ordinary and translational duplicate checks O(1).
 * @param {Array<Map<string, string>>} [canonicalGroupOperations] - Site-symmetry operation signatures by group.
 * @returns {ExplorationStepResult} Results of processing the step.
 */
export function exploreConnection(
    currentConnection,
    structure,
    discoveredGroups,
    seedConnectionsPerGroup,
    processedConnections,
    atomGroups,
    queuedGroups = null,
    stateByOperation = null,
    canonicalGroupOperations = null,
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
        const componentIndex = currentConnection.creationOriginIndex;
        const existingInstances = discoveredGroups[componentIndex];
        const pendingInstances = queuedGroups?.[componentIndex] || [];
        // A group is considered discovered as soon as it is queued. Without this
        // second half of the guard, two different bonds in the same BFS layer can
        // each schedule a different lattice translation before either one reaches
        // the normal discoveredGroups check.
        const knownInstances = [...existingInstances, ...pendingInstances];
        const canonicalOperationId = canonicalGroupOperations?.[resultingGroup.groupIndex]
            ?.get(resultingGroup.appliedSymmetry.id) || resultingGroup.appliedSymmetry.id;
        const operationKey = `${resultingGroup.groupIndex}|${canonicalOperationId}`;
        const canonicalState = stateByOperation?.[componentIndex]?.get(operationKey);
        const translationPresent = canonicalState
            ? resultingGroup.isTranslationalDuplicateOf(canonicalState)
            : knownInstances.some(existing => resultingGroup.isTranslationalDuplicateOf(existing));

        // A different (non-translationally-related) operation can still place the group at
        // the exact same physical position when that operation belongs to the group's own
        // site-symmetry stabiliser - e.g. every atom sitting on a high-multiplicity special
        // position. isTranslationalDuplicateOf only compares operation IDs, so it can't see
        // this; groupInstancesCoincide resolves real positions and catches it. Skipped when a
        // translational duplicate was already found - no need for the extra position check.
        const positionDuplicate = !translationPresent && (canonicalState
            ? groupInstancesCoincide(structure, atomGroups, resultingGroup, canonicalState)
            : knownInstances.some(existing =>
                groupInstancesCoincide(structure, atomGroups, resultingGroup, existing),
            ));

        // Add to the appropriate list based on translation/position checks. A position
        // duplicate reached via a redundant operation isn't a new node to explore and isn't a
        // periodic continuation either (unlike a translation duplicate) - it's silently
        // dropped rather than queued or recorded as a dangling bond stub.
        if (translationPresent) {
            foundTranslations.push(prospectiveConnection);
        } else if (!positionDuplicate) {
            newDanglingConnections.push(prospectiveConnection);
            queuedGroups?.[componentIndex].push(resultingGroup);
            stateByOperation?.[componentIndex].set(operationKey, resultingGroup);
        }
    }

    return { newConnectedGroup, newDanglingConnections, foundTranslations };
}

/**
 * Analyzes the connectivity of a crystal structure including symmetry operations.
 * This function performs a breadth-first search starting from the asymmetric unit,
 * exploring connections across symmetry operations. It identifies unique symmetry-related
 * groups and flags connections that only involve translation (periodic continuations).
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
    const { componentByGroup, groupsByComponent } = getConnectivityComponents(seedConnectionsPerGroup);
    const canonicalGroupOperations = getCanonicalGroupOperations(structure, atomGroups);

    // Set up the initial processing queue and processed set
    const { danglingConnections, processedConnections } = initializeExploration(
        seedConnectionsPerGroup,
        identSymm,
        componentByGroup,
    );
    // Initial directed seed bonds describe the CIF's quotient graph and must be
    // retained even when a seed itself already reaches a translated canonical
    // state. They are not, however, a reason to expand that periodic image.
    const initialConnectionCount = danglingConnections.length;

    const networkConnections = []; // Bonds successfully processed and added to the network
    const translationLinks = []; // Bonds leading to translational duplicates

    // All seeds belonging to the same quotient component share one state table.
    // A molecule assembled entirely by symmetry bonds can therefore be reached from
    // many asymmetric-unit atoms without re-growing the same finite orbit each time.
    const discoveredGroups = groupsByComponent.map(() => []);

    // Tracks instances that have been accepted but are still waiting in the
    // queue. This closes the gap between discovering a candidate and processing
    // it, which was where diagonal and other multi-axis periodic walks could
    // repeatedly enqueue fresh translations.
    const queuedGroups = groupsByComponent.map(() => []);

    // One compact representative for every (ASU group, symmetry operation) in a
    // component. A second integer translation of the same pair is a periodic
    // continuation and is deliberately not enqueued.
    const stateByOperation = groupsByComponent.map(() => new Map());

    // Seed every member group's identity image. This is important even for a
    // component whose bonds all cross symmetry: it makes the shared traversal
    // represent the whole asymmetric-unit component from the outset.
    atomGroups.forEach((_, i) => {
        const componentIndex = componentByGroup[i];
        const identityGroup = new ConnectedGroup(i, identSymm);
        discoveredGroups[componentIndex].push(identityGroup);
        const canonicalOperationId = canonicalGroupOperations[i].get(identSymm.id) || identSymm.id;
        stateByOperation[componentIndex].set(`${i}|${canonicalOperationId}`, identityGroup);
    });

    // Process the queue iteratively using breadth-first search
    let connectionIndex = 0;
    while (connectionIndex < danglingConnections.length) {
        // Advancing an index preserves FIFO order without shifting the remaining
        // queue on every iteration.
        const currentConnection = danglingConnections[connectionIndex++];

        const currentGroup = new ConnectedGroup(
            currentConnection.targetIndex,
            currentConnection.targetSymmetry,
        );
        const componentIndex = currentConnection.creationOriginIndex;
        const currentPending = queuedGroups[componentIndex];
        const pendingIndex = currentPending.findIndex(group => sameGroupInstance(group, currentGroup));
        if (pendingIndex !== -1) {
            currentPending.splice(pendingIndex, 1);
        }

        const existingInstances = discoveredGroups[componentIndex];
        const canonicalOperationId = canonicalGroupOperations[currentGroup.groupIndex]
            .get(currentGroup.appliedSymmetry.id) || currentGroup.appliedSymmetry.id;
        const operationKey = `${currentGroup.groupIndex}|${canonicalOperationId}`;
        const canonicalState = stateByOperation[componentIndex].get(operationKey);
        if (canonicalState && currentGroup.isTranslationalDuplicateOf(canonicalState)) {
            // Periodicity is ordinary input, not an iteration failure. Retain the
            // compact canonical image and record this edge for cell-mode callers;
            // fragment growth later omits it because its other endpoint is absent.
            translationLinks.push(currentConnection);
            if (connectionIndex <= initialConnectionCount) {
                networkConnections.push(currentConnection);
            }
            continue;
        }
        if (!canonicalState) {
            existingInstances.push(currentGroup);
            stateByOperation[componentIndex].set(operationKey, currentGroup);
        } else if (!sameGroupInstance(currentGroup, canonicalState)
            && groupInstancesCoincide(structure, atomGroups, currentGroup, canonicalState)) {
            if (connectionIndex <= initialConnectionCount) {
                networkConnections.push(currentConnection);
            }
            continue;
        }

        // Process this connection group to find the next connected group and any new bonds
        const stepResult = exploreConnection(
            currentConnection,
            structure,
            discoveredGroups,
            seedConnectionsPerGroup,
            processedConnections, // Pass the set to be mutated
            atomGroups,
            queuedGroups,
            stateByOperation,
            canonicalGroupOperations,
        );

        // Add newly found dangling connections to the queue for further processing
        danglingConnections.push(...stepResult.newDanglingConnections);

        // Add bonds leading to translations to the separate list
        translationLinks.push(...stepResult.foundTranslations);

        // Record the bond group that was successfully processed
        networkConnections.push(currentConnection);
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

const periodicCartesianTranslations = new WeakMap();

/**
 * Gets all neighbouring unit-cell translations in Cartesian coordinates.
 * @param {object} cell - Unit cell defining the fractional basis.
 * @returns {number[][]} Cartesian translations for the surrounding 3×3×3 cells.
 */
function getPeriodicCartesianTranslations(cell) {
    let translations = periodicCartesianTranslations.get(cell);
    if (!translations) {
        const matrix = cell.fractToCartMatrix.toArray();
        translations = [];
        for (let x = -1; x <= 1; x += 1) {
            for (let y = -1; y <= 1; y += 1) {
                for (let z = -1; z <= 1; z += 1) {
                    translations.push([
                        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
                        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
                        matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
                    ]);
                }
            }
        }
        periodicCartesianTranslations.set(cell, translations);
    }
    return translations;
}

/**
 * Finds the already-kept canonical image of one atom at the same periodic
 * crystallographic position without a linear scan over all symmetry images.
 * @param {Map<string, Array<{atom: object, coordinates: number[]}>>} buckets - Spatial index for one original atom.
 * @param {object} atom - Symmetry-generated image being canonicalized.
 * @param {object} cell - Unit cell used for Cartesian comparison.
 * @param {number} tolerance - Cartesian coincidence tolerance in Å.
 * @returns {object|null} Kept canonical atom image, or null when this is new.
 */
function findCanonicalAtomImage(buckets, atom, cell, tolerance) {
    const coordinates = wrappedCartesianCoordinates(atom.position, cell);
    // Canonical atoms are indexed at their 26 neighbouring lattice images, so
    // one ordinary local query also discovers images on opposite cell faces.
    const bucket = coordinates.map(value => Math.floor(value / tolerance));
    for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dz = -1; dz <= 1; dz += 1) {
                const key = `${bucket[0] + dx},${bucket[1] + dy},${bucket[2] + dz}`;
                for (const candidate of buckets.get(key) || []) {
                    if (Math.hypot(
                        candidate.coordinates[0] - coordinates[0],
                        candidate.coordinates[1] - coordinates[1],
                        candidate.coordinates[2] - coordinates[2],
                    ) < tolerance) {
                        return candidate.atom;
                    }
                }
            }
        }
    }

    // Store all neighbouring periodic images, so a later atom can always use
    // one ordinary local bucket lookup regardless of which cell face it lies on.
    for (const translation of getPeriodicCartesianTranslations(cell)) {
        const translatedCoordinates = coordinates.map((value, index) => value + translation[index]);
        const ownKey = translatedCoordinates.map(value => Math.floor(value / tolerance)).join(',');
        const entries = buckets.get(ownKey) || [];
        entries.push({ atom, coordinates: translatedCoordinates });
        buckets.set(ownKey, entries);
    }
    return null;
}

/**
 * Selects one compact periodic image for every (asymmetric-unit group,
 * symmetry-operation) pair. Integer translations are lattice vectors, not
 * Cartesian axes: the complete three-component L1 norm is therefore used, so
 * [111], [101], and other diagonal periodic directions are treated exactly the
 * same as repeats along a, b, or c. The lexical tie-break makes the result
 * deterministic when equally compact images exist.
 *
 * This is intentionally applied after connectivity is known. It changes only
 * the representative image retained for an already-equivalent periodic copy;
 * it does not reinterpret the symmetry operation or alter the default cell.
 * @param {Set<string>} symmetryInstances - `group@.@operation_translation` entries.
 * @returns {Set<string>} One nearest-origin image per group and operation.
 */
export function normalizeSymmetryInstances(symmetryInstances) {
    const bestInstanceByOperation = new Map();
    for (const instance of symmetryInstances) {
        const [groupIndex, symmetryKey] = instance.split('@.@');
        const applied = AppliedSymmetry.fromString(symmetryKey);
        const operationKey = `${groupIndex}|${applied.id}`;
        const magnitude = applied.translation.reduce((sum, value) => sum + Math.abs(value), 0);
        const existing = bestInstanceByOperation.get(operationKey);
        if (!existing || magnitude < existing.magnitude
            || (magnitude === existing.magnitude && instance < existing.instance)) {
            bestInstanceByOperation.set(operationKey, { instance, magnitude });
        }
    }
    return new Set([...bestInstanceByOperation.values()].map(entry => entry.instance));
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
                // All images of one original atom share one canonical spatial
                // index. Equivalent operations, including operations differing
                // only by a lattice translation, resolve to the first retained
                // atom; later images become direct special-position mappings.
                const canonicalImages = new Map();
                for (let symmGroupIdx = 0; symmGroupIdx < atomsForOriginal.length; symmGroupIdx++) {
                    const symmAtom = atomsForOriginal[symmGroupIdx];
                    const isIdentity = symmGroupIdx === 0; // First group is identity
                    const canonicalAtom = findCanonicalAtomImage(
                        canonicalImages,
                        symmAtom,
                        structure.cell,
                        SPECIAL_POSITION_TOLERANCE,
                    );
                    if (canonicalAtom) {
                        specialPositionAtoms.set(symmAtom.uniqueId, canonicalAtom.uniqueId);
                    } else {
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

        if (atom1 === atom2) {
            return;
        }

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

                    if (originAtom === targetAtom) {
                        continue;
                    }

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
    const grownInstances = normalizeSymmetryInstances(requiredSymmetryInstances);
    // A translation link is sufficient evidence of a periodic covalent
    // continuation, even if its target happened not to enter
    // requiredSymmetryInstances before the queue was stopped. In both cases a
    // fragment is a compact representative: never retain a bond to an omitted
    // periodic image.
    const compactPeriodicFragment = translationLinks.length > 0
        || grownInstances.size < requiredSymmetryInstances.size;

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

    // Step 6: Fragment output contains only materialised atoms. Translation links
    // terminate at deliberately omitted periodic images, so cell rendering may use
    // them but fragment output must not turn them into dangling bonds.
    const translationBonds = compactPeriodicFragment ? [] : processTranslationLinks(
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

    // A compact periodic representative can orphan bonds/H-bonds that pointed at
    // an omitted image. Drop those so every retained edge has two materialised
    // endpoints.
    let finalBonds = newBonds;
    let finalHBonds = newHBonds;
    if (compactPeriodicFragment) {
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
