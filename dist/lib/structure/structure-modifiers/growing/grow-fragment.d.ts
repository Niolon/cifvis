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
export function createBondIdentifier(atom1Label: string, atom2Label: string): string;
/**
 * Creates a unique identifier string for a hydrogen bond.
 * @param {string} donorAtomLabel - Label of the donor atom.
 * @param {string} hydrogenAtomLabel - Label of the hydrogen atom.
 * @param {string} acceptorAtomLabel - Label of the acceptor atom.
 * @returns {string} A unique string representing the hydrogen bond.
 */
export function createHBondIdentifier(donorAtomLabel: string, hydrogenAtomLabel: string, acceptorAtomLabel: string): string;
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
export function groupInstancesCoincide(structure: CrystalStructure, atomGroups: Array<object>, groupA: ConnectedGroup, groupB: ConnectedGroup): boolean;
/**
 * Collapses the site-symmetry stabiliser of every asymmetric-unit group into
 * one deterministic operation signature. The computation is done once before
 * graph traversal, so high-symmetry centres cannot repeatedly rediscover the
 * same group through different operation IDs.
 * @param {CrystalStructure} structure - Structure providing all symmetry operations.
 * @param {Array<object>} atomGroups - Asymmetric-unit covalent groups.
 * @returns {Array<Map<string, string>>} Raw operation ID to canonical operation ID for each group.
 */
export function getCanonicalGroupOperations(structure: CrystalStructure, atomGroups: Array<object>): Array<Map<string, string>>;
/**
 * Extracts the initial symmetry connections based on the structure's bond list.
 * These are the starting points for the connectivity exploration.
 * @param {CrystalStructure} structure - Crystal structure to analyze.
 * @param {Array<object>} atomGroups - Array of atom groups (from structure.connectedGroups).
 * @param {Map<string, number>} atomGroupMap - Map from atom label to group index.
 * @returns {Array<Array<SeedConnection>>} An array where each index corresponds to an atom group,
 * originating from that group: { targetIndex, targetSymmetry: connectingSymOp, bonds }.
 */
export function getSeedConnections(structure: CrystalStructure, atomGroups: Array<object>, atomGroupMap: Map<string, number>): Array<Array<SeedConnection>>;
/**
 * Groups asymmetric-unit covalent components into connected components of the
 * symmetry-bond quotient graph. Every member of one quotient component is
 * explored through one shared state table, rather than growing the same
 * symmetry-assembled molecule separately from every ASU atom.
 * @param {Array<Array<SeedConnection>>} seedConnectionsPerGroup - Directed symmetry connections by source group.
 * @returns {{componentByGroup: number[], groupsByComponent: number[][]}} Component membership data.
 */
export function getConnectivityComponents(seedConnectionsPerGroup: Array<Array<SeedConnection>>): {
    componentByGroup: number[];
    groupsByComponent: number[][];
};
/**
 * Initializes the queue of bond groups (connections) to process and the set of processed connections.
 * @param {Array<Array<object>>} seedConnectionsPerGroup - Connections extracted by getSeedConnections.
 * @param {AppliedSymmetry} identSymm - The identity symmetry operation object.
 * @param {number[]} [componentByGroup] - Quotient-component index for each source group.
 * @returns {ExplorationState} An object containing the initial queue and the set of processed connection keys.
 */
export function initializeExploration(seedConnectionsPerGroup: Array<Array<object>>, identSymm: AppliedSymmetry, componentByGroup?: number[]): ExplorationState;
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
export function exploreConnection(currentConnection: ConnectingBondGroup, structure: CrystalStructure, discoveredGroups: Array<Array<ConnectedGroup>>, seedConnectionsPerGroup: Array<Array<SeedConnection>>, processedConnections: Set<string>, atomGroups: Array<object>, queuedGroups?: Array<Array<ConnectedGroup>>, stateByOperation?: Array<Map<string, ConnectedGroup>>, canonicalGroupOperations?: Array<Map<string, string>>): ExplorationStepResult;
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
export function createConnectivity(structure: CrystalStructure, atomGroups: Array<object>): ConnectivityAnalysisResult;
/**
 * Collects required symmetry instances and creates inter-group bonds from network connections.
 * @param {Array<ConnectingBondGroup>} networkConnections - The network connections from createConnectivity.
 * @returns {SymmetryRequirements} The required symmetry instances and inter-group bonds.
 */
export function collectSymmetryRequirements(networkConnections: Array<ConnectingBondGroup>): SymmetryRequirements;
/**
 * Selects one compact periodic image for every (asymmetric-unit group,
 * symmetry-operation) pair.
 *
 * Given the structure and its groups, images are ranked by how far their centroid
 * sits from the middle of the reference cell, which keeps the in-cell image
 * wherever one exists (see {@link offsetFromCellMiddle}) and otherwise the nearest
 * one. Ranking by lattice translation alone cannot do this: a translation of [000]
 * is nominally "nearest the origin" yet still places the group several cells out
 * whenever the operation itself does. Without that context the L1 norm of the
 * translation is used instead, which treats [111], [101] and repeats along a
 * single axis alike. Either way the lexical tie-break keeps the result
 * deterministic among equally compact images.
 *
 * This is intentionally applied after connectivity is known. It changes only
 * the representative image retained for an already-equivalent periodic copy;
 * it does not reinterpret the symmetry operation or alter the default cell.
 * @param {Set<string>} symmetryInstances - `group@.@operation_translation` entries.
 * @param {CrystalStructure} [structure] - Structure providing symmetry and cell metrics.
 * @param {Array<object>} [atomGroups] - Asymmetric-unit covalent groups.
 * @returns {Set<string>} One most-compact image per group and operation.
 */
export function normalizeSymmetryInstances(symmetryInstances: Set<string>, structure?: CrystalStructure, atomGroups?: Array<object>): Set<string>;
/**
 * Generates symmetry-related atoms based on the required symmetry instances.
 * @param {Set<string>} requiredSymmetryInstances - Set of required symmetry instances.
 * @param {Array<object>} atomGroups - The atom groups from structure.connectedGroups.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {string} identSymmKey - The identity symmetry operation key.
 * @returns {{specialPositionAtoms: Map<string, string>, periodicDuplicateAtoms: Set<string>,
 * newAtoms: Array<object>}} Map of special position atoms (from -> to), the IDs of images omitted as
 * periodic repeats, and the generated atoms.
 */
export function generateSymmetryAtoms(requiredSymmetryInstances: Set<string>, atomGroups: Array<object>, structure: CrystalStructure, identSymmKey: string): {
    specialPositionAtoms: Map<string, string>;
    periodicDuplicateAtoms: Set<string>;
    newAtoms: Array<object>;
};
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
export function generateSymmetryBonds(atomGroups: Array<object>, requiredSymmetryInstances: Set<string>, interGroupBonds: Array<InterGroupBondInfo>, specialPositionAtoms: Map<string, string>, newAtoms: Array<object>, identSymmKey: string, structure?: CrystalStructure): {
    newBonds: Array<Bond>;
    atomLabels: Set<string>;
};
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
export function generateSymmetryHBonds(structure: CrystalStructure, atomGroups: Array<object>, atomGroupMap: Map<string, number>, requiredSymmetryInstances: Set<string>, specialPositionAtoms: Map<string, string>, atomLabels: Set<string>, identSymmKey: string): Array<HBond>;
/**
 * Processes translational links to generate additional bonds.
 * @param {Array<ConnectingBondGroup>} translationLinks - The translation links from createConnectivity.
 * @param {CrystalStructure} structure - The crystal structure.
 * @param {Map<string, string>} specialPositionAtoms - Map of special position atoms.
 * @param {Set<string>} existingBonds - Set of unique bond identifiers. This function adds identifiers of newly
 * created bonds to this set.
 * @returns {Array<Bond>} Additional bonds from translation links.
 */
export function processTranslationLinks(translationLinks: Array<ConnectingBondGroup>, structure: CrystalStructure, specialPositionAtoms: Map<string, string>, existingBonds: Set<string>): Array<Bond>;
/**
 * Grows a crystal structure by applying symmetry operations based on connectivity.
 * @param {CrystalStructure} structure - The crystal structure to grow.
 * @returns {CrystalStructure} New structure with symmetry-expanded atoms and bonds.
 */
export function growFragment(structure: CrystalStructure): CrystalStructure;
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
    constructor(groupIndex: number, appliedSymmetry: AppliedSymmetry);
    groupIndex: number;
    appliedSymmetry: AppliedSymmetry;
    /**
     * Checks if this group instance is a translational duplicate of another.
     * @param {ConnectedGroup} other - Group to compare with
     * @returns {boolean} True if groups are equivalent (same group index and symmetry operation ID) but have
     *  different translations.
     */
    isTranslationalDuplicateOf(other: ConnectedGroup): boolean;
    /**
     * Gets the full symmetry string.
     * @returns {string} The combined symmetry and translation ID string.
     */
    getSymmetryString(): string;
}
/**
 * Represents the specific atoms involved in a symmetry connection.
 * @class
 * @property {string} originAtom - Label of the atom in the origin group
 * @property {string} targetAtom - Label of the atom in the target group (before symmetry)
 */
export class ConnectingBond {
    constructor(originAtom: any, targetAtom: any, bondLength: any, bondLengthSU: any);
    originAtom: any;
    targetAtom: any;
    bondLength: any;
    bondLengthSU: any;
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
    constructor(originIndex: number, originSymmetry: AppliedSymmetry, targetIndex: number, targetSymmetry: AppliedSymmetry, connectingBonds: ConnectingBond[], creationOriginIndex: number);
    originIndex: number;
    originSymmetry: AppliedSymmetry;
    targetIndex: number;
    targetSymmetry: AppliedSymmetry;
    connectingBonds: ConnectingBond[];
    creationOriginIndex: number;
    /**
     * Gets a key that uniquely identifies this bond connection, respecting symmetry and order.
     * Ensures that the connection A->B with symm S is the same key as B->A with inverse symm S'.
     * @returns {string} Unique identifier for the bond connection.
     */
    getKey(): string;
}
export type SeedConnection = {
    /**
     * - Index of the target atom group.
     */
    targetIndex: number;
    /**
     * - The symmetry operation needed to reach the target group from the
     * origin group at identity.
     */
    targetSymmetry: AppliedSymmetry;
    /**
     * - Specific bonds forming this connection.
     */
    bonds: Array<ConnectingBond>;
};
export type ExplorationState = {
    /**
     * - Queue of connection groups to process.
     */
    danglingConnections: Array<ConnectingBondGroup>;
    /**
     * - Set of unique keys for connections already processed or queued.
     */
    processedConnections: Set<string>;
};
export type ExplorationStepResult = {
    /**
     * - The new group instance discovered in this step.
     */
    newConnectedGroup: ConnectedGroup;
    /**
     * - New connections found that need further
     * exploration.
     */
    newDanglingConnections: Array<ConnectingBondGroup>;
    /**
     * - Connections found that lead to translational
     * duplicates.
     */
    foundTranslations: Array<ConnectingBondGroup>;
};
export type ConnectivityAnalysisResult = {
    /**
     * - Bond groups forming the core connected network.
     */
    networkConnections: Array<ConnectingBondGroup>;
    /**
     * - Bond groups leading to translational duplicates
     * (potential infinite growth).
     */
    translationLinks: Array<ConnectingBondGroup>;
    /**
     * - All unique group instances found, grouped by their
     * quotient-connectivity component.
     */
    discoveredGroups: Array<Array<ConnectedGroup>>;
};
export type InterGroupBondInfo = {
    /**
     * - ID of the atom in the origin group.
     */
    originAtomId: string;
    /**
     * - Symmetry of the origin group.
     */
    originSymmetry: AppliedSymmetry;
    /**
     * - ID of the atom in the target group.
     */
    targetAtomId: string;
    /**
     * - Symmetry of the target group.
     */
    targetSymmetry: AppliedSymmetry;
    /**
     * - The length of the bond.
     */
    bondLength: number;
    /**
     * - Standard uncertainty of the bond length.
     */
    bondLengthSU: number;
};
export type SymmetryRequirements = {
    /**
     * - Set of unique group@symmetry strings that need to be generated.
     */
    requiredSymmetryInstances: Set<string>;
    /**
     * - List of bonds connecting different symmetry instances.
     */
    interGroupBonds: Array<InterGroupBondInfo>;
};
import { CrystalStructure } from '../../crystal.js';
import { AppliedSymmetry } from '../../applied-symmetry.js';
import { Bond } from '../../bonds.js';
import { HBond } from '../../bonds.js';
//# sourceMappingURL=grow-fragment.d.ts.map