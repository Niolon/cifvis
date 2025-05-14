import { beforeEach, describe, test } from 'vitest';
import { MockStructure as MockStructureHelper } from '../base.test.js';
import { Bond } from '../../bonds.js';

import { 
    createSymAtomLabel, 
    createBondIdentifier, 
    createHBondIdentifier, 
    ConnectedGroup, 
    ConnectingBond, 
    ConnectingBondGroup,
    getSeedConnections,
    initializeExploration,
    exploreConnection,
    generateSymmetryAtoms,
    generateSymmetryBonds,
    generateSymmetryHBonds,
    createConnectivity,
    collectSymmetryRequirements,
    processTranslationLinks,
    growSymmetry,
} from './grow-fragment.js';

describe('Helper Functions', () => {
    test('createSymAtomLabel correctly formats labels', () => {
        expect(createSymAtomLabel('C1', '1_555')).toBe('C1@1_555');
        expect(createSymAtomLabel('O12', '2_654')).toBe('O12@2_654');
    });
    
    test('createBondIdentifier orders labels consistently', () => {
        expect(createBondIdentifier('C1@1_555', 'O2@2_565')).toBe('C1@1_555->O2@2_565');
        expect(createBondIdentifier('O2@2_565', 'C1@1_555')).toBe('C1@1_555->O2@2_565'); // Reversed input
        expect(createBondIdentifier('A', 'B')).toBe('A->B');
        expect(createBondIdentifier('B', 'A')).toBe('A->B');
    });

    test('createHBondIdentifier correctly formats labels', () => {
        expect(createHBondIdentifier('D@1', 'H@1', 'A@2')).toBe('D@1-H@1...A@2');
        expect(createHBondIdentifier('O1', 'H1A', 'N2@2_655')).toBe('O1-H1A...N2@2_655');
    });
});

describe('ConnectedGroup', () => {
    const group = new ConnectedGroup(0, '2_565');

    test('constructor splits symmetry correctly', () => {
        expect(group.groupIndex).toBe(0);
        expect(group.symmetryId).toBe('2');
        expect(group.translationId).toBe('565');
    });

    test('getSymmetryString returns the full string', () => {
        expect(group.getSymmetryString()).toBe('2_565');
    });

    test('isTranslationalDuplicateOf identifies translational duplicates', () => {
        const sameGroupSameSymm = new ConnectedGroup(0, '2_565');
        const sameGroupDiffTrans = new ConnectedGroup(0, '2_555');
        const sameGroupDiffSymm = new ConnectedGroup(0, '3_565');
        const diffGroupSameSymm = new ConnectedGroup(1, '2_565');

        expect(group.isTranslationalDuplicateOf(sameGroupSameSymm)).toBe(false); // Identical
        expect(group.isTranslationalDuplicateOf(sameGroupDiffTrans)).toBe(true); // Translational duplicate
        expect(group.isTranslationalDuplicateOf(sameGroupDiffSymm)).toBe(false); // Different symmetry op
        expect(group.isTranslationalDuplicateOf(diffGroupSameSymm)).toBe(false); // Different group index
    });
});

describe('ConnectingBondGroup', () => {
    const connectingBonds = [new ConnectingBond('C1', 'O1', 1.4, 0.01)];
    const bondGroup = new ConnectingBondGroup(0, '1_555', 0, '2_555', connectingBonds, 0);

    test('constructor sets properties correctly', () => {
        expect(bondGroup.originIndex).toBe(0);
        expect(bondGroup.originSymmetry).toBe('1_555');
        expect(bondGroup.targetIndex).toBe(0);
        expect(bondGroup.connectingSymOp).toBe('2_555');
        expect(bondGroup.connectingBonds).toEqual(connectingBonds);
        expect(bondGroup.creationOriginIndex).toBe(0);
    });

    test('getKey generates consistent keys for intra-group connections', () => {
        // Origin symm < Target symm
        expect(bondGroup.getKey('2_555')).toBe('0_1_555_0_2_555');

        // Origin symm > Target symm (create reversed group for test)
        const reversedBondGroup = new ConnectingBondGroup(0, '2_555', 0, 'inv_2_555', connectingBonds, 0);
        // Assume inv_2_555 combined with 2_555 gives 1_555 for the finalTargetSymmetry
        expect(reversedBondGroup.getKey('1_555')).toBe('0_1_555_0_2_555');
    });

    test('getKey generates consistent keys for inter-group connections', () => {
        // Origin index < Target index
        const interGroup = new ConnectingBondGroup(0, '1_555', 1, '3_555', connectingBonds, 0);
        expect(interGroup.getKey('3_555')).toBe('0_1_555_1_3_555');

        // Origin index > Target index (create reversed group for test)
        const reversedInterGroup = new ConnectingBondGroup(1, '3_555', 0, 'inv_3_555', connectingBonds, 1);
        expect(reversedInterGroup.getKey('1_555')).toBe('0_1_555_1_3_555');
    });
});

describe('Structure dependent methods', () => {
    let structureHelper; // Helper to build structures
    let structure; // The built CrystalStructure
    let atomGroups; // Result of structure.calculateConnectedGroups()
    let atomGroupMap; // Map from atom label to group index

    beforeEach(() => {
        // Default setup for many tests, can be overridden
        structureHelper = new MockStructureHelper()
            .addAtom('C1', 'C', 0.1, 0.1, 0.1)
            .addAtom('C2', 'C', 0.2, 0.2, 0.2)
            .addAtom('O1', 'O', 0.3, 0.3, 0.3)
            .addAtom('N1', 'N', 0.4, 0.4, 0.4)
            .addAtom('S1', 'S', 0.5, 0.5, 0.5)
            .addBond('C1', 'C2')
            .addBond('C2', 'O1');
        // Group 0: C1, C2, O1
        // Group 1: N1
        // Group 2: S1
    });

    describe('getSeedConnections', () => {
        /**
         * Set up the necessary objects for the tests after the structure has been modified
         * for the individual test.
         */
        function setupStructure() {
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });
        }

        test('should correctly identify a single symmetry bond', () => {
            structureHelper.addBond('O1', 'N1', '2_565', 2.0, 0.02); // O1 (group 0) -> N1 (group 1)
            setupStructure();
            
            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);

            expect(seedConnectionsPerGroup.length).toBe(3); // C1-C2-O1, N1, S1
            
            // Group 0 (C1,C2,O1) should have one connection
            expect(seedConnectionsPerGroup[0].length).toBe(1);
            const connection0 = seedConnectionsPerGroup[0][0];
            expect(connection0.targetIndex).toBe(1); // Target is group 1 (N1)
            expect(connection0.targetSymmetry).toBe('2_565');
            expect(connection0.bonds.length).toBe(1);
            expect(connection0.bonds[0]).toBeInstanceOf(ConnectingBond);
            expect(connection0.bonds[0].originAtom).toBe('O1');
            expect(connection0.bonds[0].targetAtom).toBe('N1');
            expect(connection0.bonds[0].bondLength).toBe(2.0);
            expect(connection0.bonds[0].bondLengthSU).toBe(0.02);

            // Other groups should have no outgoing symmetry connections
            expect(seedConnectionsPerGroup[1].length).toBe(0);
            expect(seedConnectionsPerGroup[2].length).toBe(0);
        });

        test('should return empty connections if no symmetry bonds exist', () => {
            structureHelper.addBond('C1', 'N1', '.'); // Non-symmetry bond
            setupStructure();
            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);
            
            expect(seedConnectionsPerGroup.length).toBe(2); // C1-C2-O1-N1, S1
            seedConnectionsPerGroup.forEach(connections => {
                expect(connections.length).toBe(0);
            });
        });

        test('should return empty connections for a structure with no bonds at all', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1);
            setupStructure();
            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);

            expect(seedConnectionsPerGroup.length).toBe(1);
            expect(seedConnectionsPerGroup[0].length).toBe(0);
        });

        test('should group multiple atomic bonds defining the same symmetry connection', () => {
            // C1 (group 0) -> N1 (group 1) via 2_565
            // O1 (group 0) -> N1 (group 1) via 2_565 (N1 is a single-atom group here)
            structureHelper.addBond('C1', 'N1', '2_565', 1.8, 0.01); 
            structureHelper.addBond('O1', 'N1', '2_565', 1.9, 0.02); 
            setupStructure();

            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);

            expect(seedConnectionsPerGroup.length).toBe(3); // C1-C2-O1, N1, S1
            expect(seedConnectionsPerGroup[0].length).toBe(1); // Only one connection type from group 0
            
            const connection0 = seedConnectionsPerGroup[0][0];
            expect(connection0.targetIndex).toBe(1); // Target is group 1 (N1)
            expect(connection0.targetSymmetry).toBe('2_565');
            expect(connection0.bonds.length).toBe(2); // Two atomic bonds form this connection

            expect(connection0.bonds).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ originAtom: 'C1', targetAtom: 'N1', bondLength: 1.8 }),
                    expect.objectContaining({ originAtom: 'O1', targetAtom: 'N1', bondLength: 1.9 }),
                ]),
            );
        });

        test('should handle multiple distinct symmetry connections from the same origin group', () => {
            // O1 (group 0) -> N1 (group 1) via 2_565
            // C1 (group 0) -> S1 (group 2) via 3_444
            structureHelper.addBond('O1', 'N1', '2_565', 2.0, 0.02);
            structureHelper.addBond('C1', 'S1', '3_444', 2.1, 0.03);
            setupStructure();

            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);
            expect(seedConnectionsPerGroup.length).toBe(3);
            expect(seedConnectionsPerGroup[0].length).toBe(2); // Two distinct connections from group 0

            const connToN1 = seedConnectionsPerGroup[0].find(c => c.targetIndex === 1);
            expect(connToN1).toBeDefined();
            expect(connToN1.targetSymmetry).toBe('2_565');
            expect(connToN1.bonds.length).toBe(1);
            expect(connToN1.bonds[0].originAtom).toBe('O1');
            expect(connToN1.bonds[0].targetAtom).toBe('N1');

            const connToS1 = seedConnectionsPerGroup[0].find(c => c.targetIndex === 2);
            expect(connToS1).toBeDefined();
            expect(connToS1.targetSymmetry).toBe('3_444');
            expect(connToS1.bonds.length).toBe(1);
            expect(connToS1.bonds[0].originAtom).toBe('C1');
            expect(connToS1.bonds[0].targetAtom).toBe('S1');
        });

        test('should handle symmetry bonds from different origin groups', () => {
            // Group 0: C1, C2, O1
            // Group 1: N1
            // Group 2: S1
            structureHelper.addBond('O1', 'N1', '2_565'); // Group 0 -> Group 1
            structureHelper.addAtom('P1', 'P', 0.6, 0.6, 0.6); // Group 3: P1
            structureHelper.addBond('S1', 'P1', '4_555'); // Group 2 -> Group 3
            setupStructure();

            const seedConnectionsPerGroup = getSeedConnections(structure, atomGroups, atomGroupMap);
            expect(seedConnectionsPerGroup.length).toBe(4); // C1-C2-O1, N1, S1, P1

            // Connection from Group 0
            expect(seedConnectionsPerGroup[0].length).toBe(1);
            expect(seedConnectionsPerGroup[0][0].targetIndex).toBe(1); // N1
            expect(seedConnectionsPerGroup[0][0].targetSymmetry).toBe('2_565');

            // No connections from Group 1 (N1)
            expect(seedConnectionsPerGroup[1].length).toBe(0); 

            // Connection from Group 2 (S1)
            expect(seedConnectionsPerGroup[2].length).toBe(1);
            expect(seedConnectionsPerGroup[2][0].targetIndex).toBe(3); // P1
            expect(seedConnectionsPerGroup[2][0].targetSymmetry).toBe('4_555');

            // No connections from Group 3 (P1)
            expect(seedConnectionsPerGroup[3].length).toBe(0);
        });
    });

    describe('initializeExploration', () => {
        const identSymmString = '1_555'; // Standard identity for these tests
        let b1, b2;

        beforeEach(() => {
            b1 = [new ConnectingBond('C1', 'N1', 1.5, 0.01)];
            b2 = [new ConnectingBond('O1', 'S1', 1.8, 0.02)];
        });

        test('should return empty results for no seed connections', () => {
            const seedConnectionsPerGroup = [];
            const { danglingConnections, processedConnections } = initializeExploration(seedConnectionsPerGroup, identSymmString);
            expect(danglingConnections).toEqual([]);
            expect(processedConnections.size).toBe(0);
        });

        test('should return empty results for empty groups in seed connections', () => {
            const seedConnectionsPerGroup = [[], []]; // Two groups, no connections
            const { danglingConnections, processedConnections } = initializeExploration(
                seedConnectionsPerGroup, 
                identSymmString,
            );
            expect(danglingConnections).toEqual([]);
            expect(processedConnections.size).toBe(0);
        });

        test('should process a single seed connection correctly', () => {
            const seedConnectionsPerGroup = [
                [{ targetIndex: 1, targetSymmetry: '2_565', bonds: b1 }],
                [], // Group 1 has no outgoing seeds
            ];
            const { danglingConnections, processedConnections } = initializeExploration(
                seedConnectionsPerGroup, 
                identSymmString,
            );

            expect(danglingConnections.length).toBe(1);
            const bondGroup = danglingConnections[0];
            expect(bondGroup).toBeInstanceOf(ConnectingBondGroup);
            expect(bondGroup.originIndex).toBe(0);
            expect(bondGroup.originSymmetry).toBe(identSymmString);
            expect(bondGroup.targetIndex).toBe(1);
            expect(bondGroup.connectingSymOp).toBe('2_565');
            expect(bondGroup.connectingBonds).toEqual(b1);
            expect(bondGroup.creationOriginIndex).toBe(0);

            expect(processedConnections.size).toBe(1);
            // Key for CBG(originIdx=0, originSym='1_555', targetIdx=1, connectingSymOp='2_565')
            // finalTargetSymmetry for getKey is '2_565'
            // Assuming 0 < 1, key is '0_1_555_1_2_565'
            expect(processedConnections.has('0_1_555_1_2_565')).toBe(true);
        });

        test('should process multiple seed connections from the same group', () => {
            const seedConnectionsPerGroup = [
                [
                    { targetIndex: 1, targetSymmetry: '2_565', bonds: b1 },
                    { targetIndex: 2, targetSymmetry: '3_444', bonds: b2 },
                ],
            ];
            const { danglingConnections, processedConnections } = initializeExploration(
                seedConnectionsPerGroup, 
                identSymmString,
            );

            expect(danglingConnections.length).toBe(2);
            expect(danglingConnections[0].creationOriginIndex).toBe(0);
            expect(danglingConnections[1].creationOriginIndex).toBe(0);
            expect(danglingConnections[0].connectingSymOp).toBe('2_565');
            expect(danglingConnections[1].connectingSymOp).toBe('3_444');

            expect(processedConnections.size).toBe(2);
            expect(processedConnections.has('0_1_555_1_2_565')).toBe(true); // 0 -> 1 via 2_565
            expect(processedConnections.has('0_1_555_2_3_444')).toBe(true); // 0 -> 2 via 3_444
        });

        test('should process seed connections from different groups', () => {
            const seedConnectionsPerGroup = [
                [{ targetIndex: 1, targetSymmetry: '2_565', bonds: b1 }], // From group 0
                [{ targetIndex: 0, targetSymmetry: '3_565', bonds: b2 }], // From group 1
            ];
            const { danglingConnections, processedConnections } = initializeExploration(
                seedConnectionsPerGroup,
                identSymmString,
            );

            expect(danglingConnections.length).toBe(2);
            const bondGroup0 = danglingConnections.find(bg => bg.creationOriginIndex === 0);
            const bondGroup1 = danglingConnections.find(bg => bg.creationOriginIndex === 1);

            expect(bondGroup0).toBeDefined();
            expect(bondGroup0.originIndex).toBe(0);
            expect(bondGroup0.targetIndex).toBe(1);
            expect(bondGroup0.connectingSymOp).toBe('2_565');

            expect(bondGroup1).toBeDefined();
            expect(bondGroup1.originIndex).toBe(1);
            expect(bondGroup1.targetIndex).toBe(0);
            expect(bondGroup1.connectingSymOp).toBe('3_565');

            expect(processedConnections.size).toBe(2);
            expect(processedConnections.has('0_1_555_1_2_565')).toBe(true);
            // Key for CBG(originIdx=1, originSym='1_555', targetIdx=0, connectingSymOp='inv_2_565')
            // finalTargetSymmetry for getKey is 'inv_2_565'
            // Assuming 0 < 1, key is '3_565_1_1_555'
            expect(processedConnections.has('0_3_565_1_1_555')).toBe(true);
        });

        test('should skip duplicate initial connections based on key', () => {
            // This simulates if getSeedConnections somehow produced a duplicate entry
            const seedConnectionsPerGroup = [
                [
                    { targetIndex: 1, targetSymmetry: '2_565', bonds: b1 },
                    { targetIndex: 1, targetSymmetry: '2_565', bonds: b1 }],
            ];
            const { danglingConnections, processedConnections } = initializeExploration(
                seedConnectionsPerGroup,
                identSymmString,
            );
            expect(danglingConnections.length).toBe(1); // Only one should be added
            expect(processedConnections.size).toBe(1);
        });
    });

    describe('exploreConnection', () => {
        let currentConnection;
        let discoveredGroups;
        let seedConnectionsPerGroup;
        let processedConnections;
        const identSymmString = '1_555';

        beforeEach(() => {
            // Default structure:
            // Group 0: C1, C2, O1
            // Group 1: N1
            // Group 2: S1
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('C2', 'C', 0.2, 0.2, 0.2) // Group 0
                .addAtom('O1', 'O', 0.3, 0.3, 0.3) // Group 0
                .addBond('C1', 'C2')
                .addBond('C2', 'O1')
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addAtom('S1', 'S', 0.5, 0.5, 0.5); // Group 2
            
            // Setup structure and dependent objects
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });

            // Initialize discoveredGroups with identity for each group
            discoveredGroups = atomGroups.map((_, i) => [new ConnectedGroup(i, identSymmString)]);
            processedConnections = new Set();
        });

        test('should explore a simple connection leading to a new group and new dangling connections', () => {
            // Current connection: Group 0 (ident) -> Group 1 via '2_565'
            const bondsForCurrent = [new ConnectingBond('O1', 'N1', 1.5, 0.01)];
            currentConnection = new ConnectingBondGroup(0, identSymmString, 1, '2_565', bondsForCurrent, 0);

            // Seed connections: Group 1 has an outgoing connection to Group 2 via '3_444'
            const bondsForSeed = [new ConnectingBond('N1', 'S1', 1.6, 0.01)];
            seedConnectionsPerGroup = [
                [], // Group 0 seeds (not relevant for this step)
                [{ targetIndex: 2, targetSymmetry: '3_444', bonds: bondsForSeed }], // Group 1 seeds
                [], // Group 2 seeds
            ];

            const result = exploreConnection(
                currentConnection, 
                structure, 
                discoveredGroups, 
                seedConnectionsPerGroup, 
                processedConnections,
            );

            // New connected group should be Group 1 @ 2_565 (since origin was ident)
            expect(result.newConnectedGroup).toBeInstanceOf(ConnectedGroup);
            expect(result.newConnectedGroup.groupIndex).toBe(1); // Target was N1 (group 1)
            expect(result.newConnectedGroup.getSymmetryString()).toBe('2_565');

            // New dangling connections: from Group 1 @ 2_565 -> Group 2 via '3_444'
            expect(result.newDanglingConnections.length).toBe(1);
            const newDangling = result.newDanglingConnections[0];
            expect(newDangling.originIndex).toBe(1); // Origin is the group we just reached
            expect(newDangling.originSymmetry).toBe('2_565');
            expect(newDangling.targetIndex).toBe(2); // Target from seed
            expect(newDangling.connectingSymOp).toBe('3_444'); // Symm op from seed
            expect(newDangling.connectingBonds).toEqual(bondsForSeed);
            expect(newDangling.creationOriginIndex).toBe(0); // Propagated

            expect(result.foundTranslations.length).toBe(0);
            
            // Check processedConnections was updated
            // Key for newDangling: origin=1@2_565, target=2, connSym='3_444'
            // finalTargetSymmetry = combine('3_444', '2_565') -> let's assume '5_xxx' for simplicity of key
            // (actual combination depends on CellSymmetry mock)
            // For now, just check size. A more robust check would mock combineSymmetryCodes or use a real one.
            expect(processedConnections.size).toBe(1); // One new connection was processed and added
        });

        test('should find no new dangling connections if target group has no outgoing symmetry bonds', () => {
            const bondsForCurrent = [new ConnectingBond('O1', 'N1', 1.5, 0.01)];
            currentConnection = new ConnectingBondGroup(0, identSymmString, 1, '2_565', bondsForCurrent, 0);
            seedConnectionsPerGroup = [[], [], []]; // No outgoing connections from any group

            const result = exploreConnection(
                currentConnection, 
                structure, 
                discoveredGroups, 
                seedConnectionsPerGroup, 
                processedConnections,
            );

            expect(result.newConnectedGroup.groupIndex).toBe(1);
            expect(result.newConnectedGroup.getSymmetryString()).toBe('2_565');
            expect(result.newDanglingConnections.length).toBe(0);
            expect(result.foundTranslations.length).toBe(0);
            expect(processedConnections.size).toBe(0); // No *new* connections were processed from the target
        });

        test('should identify a connection leading to a translational duplicate', () => {
            const bondsForCurrent = [new ConnectingBond('O1', 'N1', 1.5, 0.01)];
            currentConnection = new ConnectingBondGroup(0, identSymmString, 1, '2_565', bondsForCurrent, 0);

            // Seed connection from Group 1 that leads back to Group 0 via 'inv_2_555' (hypothetical inverse)
            // such that 'inv_2_555' combined with '2_565' results in '1_556' (translational duplicate of '1_555')
            const bondsForSeed = [new ConnectingBond('N1', 'C1', 1.5, 0.01)];
            seedConnectionsPerGroup = [
                [],
                [{ targetIndex: 0, targetSymmetry: 'inv_2_555', bonds: bondsForSeed }],
                [],
            ];
            
            // Add the expected translational duplicate to discoveredGroups for creationOriginIndex 0
            // We need to mock combineSymmetryCodes or ensure the mock structure's symmetry ops behave as expected.
            // For this test, let's assume 'inv_2_555' combined with '2_565' (originSymm of N1) gives '1_556'
            // And '1_555' is already in discoveredGroups[0]
            // So, if the new group is Group 0 @ 1_556, it's a translational duplicate.
            // To make this testable without complex mocking of combineSymmetryCodes,
            // let's directly add the 'future' translational duplicate to discoveredGroups.
            discoveredGroups[0].push(new ConnectedGroup(0, '1_556')); // This is what would be a duplicate
            
            // We need to ensure structure.symmetry.combineSymmetryCodes produces '1_556'
            // For simplicity, let's assume it does for now. A more robust test would mock this.
            vi.spyOn(structure.symmetry, 'combineSymmetryCodes').mockImplementation((symOp1, symOp2) => {
                if (symOp1 === 'inv_2_555' && symOp2 === '2_565') {
                    return '1_556'; 
                } // Target symm for N1 -> C1
                if (symOp1 === '2_565' && symOp2 === '1_555') {
                    return '2_565'; 
                } // Target symm for O1 -> N1
                return `${symOp1}_then_${symOp2}`; // Default mock
            });

            const result = exploreConnection(
                currentConnection, 
                structure, 
                discoveredGroups, 
                seedConnectionsPerGroup, 
                processedConnections,
            );

            expect(result.newConnectedGroup.groupIndex).toBe(1); // N1
            expect(result.newConnectedGroup.getSymmetryString()).toBe('2_565');
            expect(result.newDanglingConnections.length).toBe(0);
            expect(result.foundTranslations.length).toBe(1);
            
            const translation = result.foundTranslations[0];
            expect(translation.originIndex).toBe(1); // From N1
            expect(translation.originSymmetry).toBe('2_565');
            expect(translation.targetIndex).toBe(0); // To C1 (group 0)
            expect(translation.connectingSymOp).toBe('inv_2_555');
            expect(translation.creationOriginIndex).toBe(0);

            expect(processedConnections.size).toBe(1); // The translational link was added to processed
        });

        test('should skip connections if their key is already in processedConnections', () => {
            const bondsForCurrent = [new ConnectingBond('O1', 'N1', 1.5, 0.01)];
            currentConnection = new ConnectingBondGroup(0, identSymmString, 1, '2_565', bondsForCurrent, 0);

            const bondsForSeed = [new ConnectingBond('N1', 'S1', 1.6, 0.01)];
            seedConnectionsPerGroup = [
                [],
                [{ targetIndex: 2, targetSymmetry: '3_444', bonds: bondsForSeed }],
                [],
            ];

            // Manually add the key for the prospective connection to processedConnections
            // Prospective: origin=1@2_565, target=2, connSym='3_444'
            // finalTargetSymmetry = combine('3_444', '2_565')
            // Let's mock combineSymmetryCodes for consistent key generation
            vi.spyOn(structure.symmetry, 'combineSymmetryCodes').mockImplementation((symOp1, symOp2) => {
                if (symOp1 === '3_444' && symOp2 === '2_565') {
                    return 'combined_A'; 
                } // For N1 -> S1
                if (symOp1 === '2_565' && symOp2 === '1_555') {
                    return '2_565'; 
                }    // For O1 -> N1
                return `${symOp1}_then_${symOp2}`;
            });
            const prospectiveKey = new ConnectingBondGroup(1, '2_565', 2, '3_444', bondsForSeed, 0)
                .getKey('combined_A');
            processedConnections.add(prospectiveKey);

            const result = exploreConnection(
                currentConnection, 
                structure, 
                discoveredGroups, 
                seedConnectionsPerGroup, 
                processedConnections,
            );

            expect(result.newDanglingConnections.length).toBe(0); // Should be skipped
            expect(result.foundTranslations.length).toBe(0);
            expect(processedConnections.size).toBe(1); // No new keys added
        });
    });

    describe('createConnectivity', () => {
        test('should correctly identify network connections and translational links', () => {
            // Setup a specific structure for this test
            // MockStructureHelper uses P 21/m by default.
            // Identity operation is 1 (x,y,z)
            // Symmetry operation 2 is (-x, y+1/2, -z)
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4); // Group 1

            // Bond 1: C1 (G0) -> N1 (G1) via symm op '2_555'
            // '2_555' means: apply symmetry operation #2, and the standard unit cell origin (555).
            // This will be a network connection.
            structureHelper.addBond('C1', 'N1', '2_555');

            // Bond 2: N1 (G1) -> C1 (G0) via symm op '2_565'
            // '2_565' means: apply symmetry operation #2, and translate by (0,1,0) from standard origin.
            // When exploring from N1 (already at symm '2_555' due to the first bond),
            // applying this '2_565' (relative to ASU N1) to C1 will result in C1@1_575.
            // C1@1_575 is a translational duplicate of C1@1_555 (the ASU C1).
            // So, this path should lead to a translationLink.
            structureHelper.addBond('N1', 'C1', '2_565');

            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups(); // Important: calculate before passing

            const identSymmString = structure.symmetry.identitySymOpId + '_555'; // Expected: '1_555'

            const { networkConnections, translationLinks, discoveredGroups } = createConnectivity(structure, atomGroups);

            // Assertions for networkConnections
            // Two initial connections are made from the asymmetric unit.
            expect(networkConnections.length).toBe(2);

            const cbg_C1_to_N1_symm = networkConnections.find(
                bg => bg.originIndex === 0 && bg.targetIndex === 1 && bg.connectingSymOp === '2_555',
            );
            expect(cbg_C1_to_N1_symm).toBeDefined();
            expect(cbg_C1_to_N1_symm.originSymmetry).toBe(identSymmString);
            expect(cbg_C1_to_N1_symm.creationOriginIndex).toBe(0);
            expect(cbg_C1_to_N1_symm.connectingBonds[0].originAtom).toBe('C1');
            expect(cbg_C1_to_N1_symm.connectingBonds[0].targetAtom).toBe('N1');

            const cbg_N1_to_C1_symm = networkConnections.find(
                bg => bg.originIndex === 1 && bg.targetIndex === 0 && bg.connectingSymOp === '2_565',
            );
            expect(cbg_N1_to_C1_symm).toBeDefined();
            expect(cbg_N1_to_C1_symm.originSymmetry).toBe(identSymmString);
            expect(cbg_N1_to_C1_symm.creationOriginIndex).toBe(1);
            expect(cbg_N1_to_C1_symm.connectingBonds[0].originAtom).toBe('N1');
            expect(cbg_N1_to_C1_symm.connectingBonds[0].targetAtom).toBe('C1');

            // Assertions for translationLinks
            // Each network connection will explore one step further, leading to a translational link.
            expect(translationLinks.length).toBe(2);

            // Path: C1@1_555 -> N1@2_555 (network). From N1@2_555, seed N1->C1@2_565 leads to C1@1_575.
            // This C1@1_575 is a translation of C1@1_555.
            const tl_from_N1_at_2_555 = translationLinks.find(
                bg => bg.originIndex === 1 && bg.originSymmetry === '2_555' && // From N1@2_555
                      bg.targetIndex === 0 && bg.connectingSymOp === '2_565',   // To C1 via 2_565 (relative to ASU N1)
            );
            expect(tl_from_N1_at_2_555).toBeDefined();
            expect(tl_from_N1_at_2_555.creationOriginIndex).toBe(0); // Path started from C1
            expect(tl_from_N1_at_2_555.connectingBonds[0].originAtom).toBe('N1');
            expect(tl_from_N1_at_2_555.connectingBonds[0].targetAtom).toBe('C1');

            // Path: N1@1_555 -> C1@2_565 (network). From C1@2_565, seed C1->N1@2_555 leads to N1@1_575.
            // This N1@1_575 is a translation of N1@1_555.
            const tl_from_C1_at_2_565 = translationLinks.find(
                bg => bg.originIndex === 0 && bg.originSymmetry === '2_565' && // From C1@2_565
                      bg.targetIndex === 1 && bg.connectingSymOp === '2_555',   // To N1 via 2_555 (relative to ASU C1)
            );
            expect(tl_from_C1_at_2_565).toBeDefined();
            expect(tl_from_C1_at_2_565.creationOriginIndex).toBe(1); // Path started from N1
            expect(tl_from_C1_at_2_565.connectingBonds[0].originAtom).toBe('C1');
            expect(tl_from_C1_at_2_565.connectingBonds[0].targetAtom).toBe('N1');

            // Assertions for discoveredGroups
            expect(discoveredGroups.length).toBe(2); // For Group 0 (C1) and Group 1 (N1)

            // Discovered groups for creationOriginIndex 0 (path starting from C1@1_555)
            // Should contain C1@1_555 (identity) and N1@2_555 (from C1 -> N1@2_555 connection)
            expect(discoveredGroups[0].length).toBe(2);
            expect(discoveredGroups[0]).toEqual(expect.arrayContaining([
                expect.objectContaining({ groupIndex: 0, symmetryId: '1', translationId: '555' }), // C1@1_555
                expect.objectContaining({ groupIndex: 1, symmetryId: '2', translationId: '555' }), // N1@2_555
            ]));

            // Discovered groups for creationOriginIndex 1 (path starting from N1@1_555)
            // Should contain N1@1_555 (identity) and C1@2_565 (from N1 -> C1@2_565 connection)
            expect(discoveredGroups[1].length).toBe(2);
            expect(discoveredGroups[1]).toEqual(expect.arrayContaining([
                expect.objectContaining({ groupIndex: 1, symmetryId: '1', translationId: '555' }), // N1@1_555
                expect.objectContaining({ groupIndex: 0, symmetryId: '2', translationId: '565' }), // C1@2_565
            ]));
        });

        test('should handle structure with no symmetry bonds', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)
                .addBond('C1', 'N1', '.'); // No symmetry
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555';

            const { networkConnections, translationLinks, discoveredGroups } = createConnectivity(structure, atomGroups);

            expect(networkConnections.length).toBe(0);
            expect(translationLinks.length).toBe(0);
            expect(discoveredGroups.length).toBe(1); // Only one group C1-N1
            expect(discoveredGroups[0].length).toBe(1); // Only identity instance
            expect(discoveredGroups[0][0].getSymmetryString()).toBe(identSymmString);
        });

        test('should complete for a simple case without hitting iteration limits', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C').addAtom('N1', 'N').addBond('C1', 'N1', '2_555');
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();

            const { networkConnections, translationLinks, discoveredGroups } = createConnectivity(
                structure, atomGroups,
            );
            expect(networkConnections.length).toBe(1); // C1@1_555 -> N1@2_555
            expect(translationLinks.length).toBe(0);
            // Discovered for C1's path: C1@1_555 (initial), N1@2_555 (new)
            expect(discoveredGroups[0].length).toBe(2);
            // Discovered for N1's path: N1@1_555 (initial)
            expect(discoveredGroups[1].length).toBe(1);
        });
    });

    describe('collectSymmetryRequirements', () => {
        let structure;
        // let atomGroups; // Not directly used in tests, but calculated by setupConnectivity
        // let atomGroupMap; // Not directly used in tests, but calculated by setupConnectivity
        let identSymmString;
        
        /**
         * Helper to build structure, calculate groups, and get connectivity results.
         * @param {MockStructureHelper} helper - The configured helper.
         * @returns {object} Results from createConnectivity.
         */
        function setupConnectivity(helper) {
            structure = helper.build();
            const atomGroups = structure.calculateConnectedGroups();
            const atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });
            identSymmString = structure.symmetry.identitySymOpId + '_555';
            return createConnectivity(structure, atomGroups);
        }
        
        test('should handle origin=identity, finalTarget=symmetry (original case)', () => {
            // Scenario 1: atom1 = originAtom, atom2 = targetAtom@symm
            // Group 0: C1, C2 (identity symmetry)
            // Group 1: N1 with symmetry '2_555'
            // The connection between them is: C1 (group 0, 1_555) -> N1 (group 1, 2_555)
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('C2', 'C', 0.2, 0.2, 0.2)
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)
                .addBond('C1', 'C2', '.')
                .addBond('C1', 'N1', '2_555', 1.5, 0.01);
        
            const { networkConnections } = setupConnectivity(helper);
        
            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(2);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // Identity for C1, C2
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // Symmetry for N1
        
            expect(interGroupBonds.length).toBe(1);
            expect(interGroupBonds[0].originSymmAtom).toBe('C1'); // Should be identity by default
            expect(interGroupBonds[0].targetSymmAtom).toBe('N1@2_555');
            expect(interGroupBonds[0].bondLength).toBe(1.5);
            expect(interGroupBonds[0].bondLengthSU).toBe(0.01);
        });

        test('should handle origin=identity, finalTarget=identity (identity bond)', () => {
            // Scenario 2: atom1 = originAtom, atom2 = targetAtom
            // Group 0: C1
            // Group 1: N1
            // Connection: C1 (G0, 1_555) -> N1 (G1, 1_555) via explicit identity '1_555'
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addBond('C1', 'N1', '1_555', 1.4, 0.02); // Explicit identity symmetry

            const { networkConnections } = setupConnectivity(helper);
            // Expected networkConnections: one entry for C1@1_555 -> N1 via 1_555
            // originSymmetry = '1_555', connectingSymOp = '1_555'
            // finalTargetSymmetry = combine('1_555', '1_555') = '1_555'

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(2);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // C1 at identity
            expect(requiredSymmetryInstances).toContain('1@.@1_555'); // N1 at identity

            expect(interGroupBonds.length).toBe(1);
            expect(interGroupBonds[0].originSymmAtom).toBe('C1');
            expect(interGroupBonds[0].targetSymmAtom).toBe('N1');
            expect(interGroupBonds[0].bondLength).toBe(1.4);
        });

        test('should handle origin=symmetry, finalTarget=symmetry (chain connection)', () => {
            // Scenario 3: atom1 = originAtom@symm, atom2 = targetAtom@symm_combined
            // Path: A@1_555 -> B@2_555. Then from B@2_555, connect to D via '3_555' (relative to ASU B).
            // Results in B@2_555 -> D@4_545 (using P21/m: op3(op2(X)) = op4 with y-translation)
            const helper = new MockStructureHelper()
                .addAtom('A1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('B1', 'N', 0.2, 0.2, 0.2) // Group 1
                .addAtom('D1', 'O', 0.3, 0.3, 0.3) // Group 2
                .addBond('A1', 'B1', '2_555', 1.5, 0.01)  // A1 -> B1@2_555
                .addBond('B1', 'D1', '3_555', 1.6, 0.02); // B1(ASU) -> D1@3_555

            const { networkConnections } = setupConnectivity(helper);
            // networkConnections will include:
            // 1. A1@1_555 -> B1 via 2_555 (results in B1@2_555)
            // 2. B1@1_555 -> D1 via 3_555 (results in D1@3_555)
            // 3. B1@2_555 -> D1 via 3_555 (results in D1@4_545) - this is the one we're testing for atom1/atom2

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(5); // A1@1, B1@1, D1@1, B1@2_555, D1@3_555, D1@4_545
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // A1
            expect(requiredSymmetryInstances).toContain('1@.@1_555'); // B1
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // B1@2_555
            expect(requiredSymmetryInstances).toContain('2@.@3_555'); // D1@3_555
            expect(requiredSymmetryInstances).toContain('2@.@4_545'); // D1@4_545

            expect(interGroupBonds.length).toBe(3);
            expect(interGroupBonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ originSymmAtom: 'A1', targetSymmAtom: 'B1@2_555' }),
                expect.objectContaining({ originSymmAtom: 'B1', targetSymmAtom: 'D1@3_555' }),
                expect.objectContaining({ originSymmAtom: 'B1@2_555', targetSymmAtom: 'D1@4_545' }),
            ]));
        });

        test('should handle origin=symmetry, finalTarget=identity (return to identity)', () => {
            // Scenario 4: atom1 = originAtom@symm, atom2 = targetAtom
            // Path: A@1_555 -> B@2_555. Then from B@2_555, connect to A via '2_555' (relative to ASU B).
            // Results in B@2_555 -> A@1_555 (using P21/m: op2(op2(X)) = op1)
            const helper = new MockStructureHelper()
                .addAtom('A1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('B1', 'N', 0.2, 0.2, 0.2) // Group 1
                .addBond('A1', 'B1', '2_555', 1.5, 0.01)  // A1 -> B1@2_555
                .addBond('B1', 'A1', '2_555', 1.5, 0.01); // B1(ASU) -> A1@2_555

            const { networkConnections } = setupConnectivity(helper);

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(4); // A1@1, B1@1, B1@2_555, A1@2_555
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // A1
            expect(requiredSymmetryInstances).toContain('1@.@1_555'); // B1
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // B1@2_555
            expect(requiredSymmetryInstances).toContain('0@.@2_555'); // A1@2_555

            expect(interGroupBonds.length).toBe(2); // A1->B1@S2, B1->A1@S2, B1@S2->A1@S1
            expect(interGroupBonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ originSymmAtom: 'A1', targetSymmAtom: 'B1@2_555' }),
                expect.objectContaining({ originSymmAtom: 'B1', targetSymmAtom: 'A1@2_555' }),
            ]));
        });

        test('should collect requirements for multiple inter-group connections from the same origin group', () => {
            // Group 0: C1
            // Group 1: N1
            // Group 2: S1
            // Connections: C1 (G0) -> N1 (G1) via '2_555', C1 (G0) -> S1 (G2) via '3_555'
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addAtom('S1', 'S', 0.5, 0.5, 0.5) // Group 2
                .addBond('C1', 'N1', '2_555', 1.5, 0.01)
                .addBond('C1', 'S1', '3_555', 1.8, 0.02);

            const { networkConnections } = setupConnectivity(helper);

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(3);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // C1 identity
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // N1 symm
            expect(requiredSymmetryInstances).toContain('2@.@3_555'); // S1 symm

            expect(interGroupBonds.length).toBe(2);
            expect(interGroupBonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ originSymmAtom: 'C1', targetSymmAtom: 'N1@2_555', bondLength: 1.5 }),
                expect.objectContaining({ originSymmAtom: 'C1', targetSymmAtom: 'S1@3_555', bondLength: 1.8 }),
            ]));
        });

        test('should collect requirements for multiple inter-group connections from different origin groups', () => {
            // Group 0: C1
            // Group 1: N1
            // Group 2: S1
            // Group 3: P1
            // Connections: C1 (G0) -> N1 (G1) via '2_555', S1 (G2) -> P1 (G3) via '4_555'
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addAtom('S1', 'S', 0.5, 0.5, 0.5) // Group 2
                .addAtom('P1', 'P', 0.6, 0.6, 0.6) // Group 3
                .addBond('C1', 'N1', '2_555', 1.5, 0.01)
                .addBond('S1', 'P1', '4_555', 2.0, 0.03);

            const { networkConnections } = setupConnectivity(helper);

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(4);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // C1 identity
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // N1 symm
            expect(requiredSymmetryInstances).toContain('2@.@1_555'); // S1 identity
            expect(requiredSymmetryInstances).toContain('3@.@4_555'); // P1 symm

            expect(interGroupBonds.length).toBe(2);
            expect(interGroupBonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ originSymmAtom: 'C1', targetSymmAtom: 'N1@2_555', bondLength: 1.5 }),
                expect.objectContaining({ originSymmAtom: 'S1', targetSymmAtom: 'P1@4_555', bondLength: 2.0 }),
            ]));
        });

        test('should collect requirements for an intra-group symmetry connection', () => {
            // Group 0: C1
            // Connection: C1 (G0) -> C1 (G0) via '2_555'
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addBond('C1', 'C1', '2_555', 2.5, 0.05);

            const { networkConnections } = setupConnectivity(helper);

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(2);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // C1 identity
            expect(requiredSymmetryInstances).toContain('0@.@2_555'); // C1 symm

            expect(interGroupBonds.length).toBe(1);
            expect(interGroupBonds[0]).toEqual(expect.objectContaining({
                originSymmAtom: 'C1',
                targetSymmAtom: 'C1@2_555',
                bondLength: 2.5,
                bondLengthSU: 0.05,
            }));
        });

        test('should collect requirements for a connection group with multiple connecting bonds', () => {
            // Group 0: C1, C2
            // Group 1: N1
            // Connections: C1 (G0) -> N1 (G1) via '2_555', C2 (G0) -> N1 (G1) via '2_555'
            const helper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('C2', 'C', 0.2, 0.2, 0.2) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addBond('C1', 'C2', '.')
                .addBond('C1', 'N1', '2_555', 1.5, 0.01)
                .addBond('C2', 'N1', '2_555', 1.6, 0.02);

            const { networkConnections } = setupConnectivity(helper);

            const { requiredSymmetryInstances, interGroupBonds } = collectSymmetryRequirements(
                networkConnections, structure, identSymmString,
            );

            expect(requiredSymmetryInstances.size).toBe(2);
            expect(requiredSymmetryInstances).toContain('0@.@1_555'); // Identity for C1, C2
            expect(requiredSymmetryInstances).toContain('1@.@2_555'); // Symmetry for N1

            expect(interGroupBonds.length).toBe(2);
            expect(interGroupBonds[0].originSymmAtom).toBe('C1'); // Should be identity by default
            expect(interGroupBonds[0].targetSymmAtom).toBe('N1@2_555');
            expect(interGroupBonds[0].bondLength).toBe(1.5);
            expect(interGroupBonds[0].bondLengthSU).toBe(0.01);
        });

        // Note: Test cases involving combinations of inter/intra group bonds,
        // and connections from different origin groups are implicitly covered
        // by the tests above and the createConnectivity tests which ensure
        // the networkConnections array contains all necessary connections.
    });

    describe('generateSymmetryAtoms', () => {
        test('should generate symmetry atoms and handle special positions', () => {
            // Start with C1 and apply '2_555' symmetry, it should generate C1@2_555
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1);
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555';
            const requiredSymmetryInstances = new Set(['0@.@2_555']);

            const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
                requiredSymmetryInstances, atomGroups, structure, identSymmString,
            );

            expect(specialPositionAtoms.size).toBe(0);
            expect(newAtoms.length).toBe(2);
            expect(newAtoms[0].label).toBe('C1');
            expect(newAtoms[1].label).toBe('C1@2_555');
        });
    });

    describe('generateSymmetryBonds', () => {
        test('should generate symmetry bonds and handle special positions', () => {
            // C1-C2 with identity and requires C1@2_555-C2@2_555
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('C2', 'C', 0.2, 0.2, 0.2)
                .addBond('C1', 'C2', '.', 1.5, 0.01);
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555';
            const requiredSymmetryInstances = new Set(['0@.@2_555']);
            const interGroupBonds = [];
            const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
                requiredSymmetryInstances, atomGroups, structure, identSymmString,
            );
            const { newBonds, atomLabels } = generateSymmetryBonds(
                atomGroups, requiredSymmetryInstances, interGroupBonds, specialPositionAtoms, newAtoms, identSymmString,
            );

            // Should retain the original bond and add the symmetry-equivalent bond
            expect(newBonds.length).toBe(2);
            expect(newBonds).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ atom1Label: 'C1', atom2Label: 'C2' }), // Original
                    expect.objectContaining({ atom1Label: 'C1@2_555', atom2Label: 'C2@2_555' }), // Symmetry
                ]),
            );
            expect(atomLabels.size).toBe(4);
        });        test('should correctly add inter-group bonds', () => {
            const atomGroups = [
                { atoms: [{ label: 'C1', atomType: 'C' }], bonds: [], hBonds: [] }, // Group 0
                { atoms: [{ label: 'N1', atomType: 'N' }], bonds: [], hBonds: [] }, // Group 1
            ];
            const requiredSymmetryInstances = new Set([
                '0@.@1_555', // C1 at identity
                '1@.@2_555', // N1 at symm '2_555'
            ]);
            const interGroupBonds = [
                { originSymmAtom: 'C1', targetSymmAtom: 'N1@2_555', bondLength: 1.6, bondLengthSU: 0.02 },
            ];
            const specialPositionAtoms = new Map();
            // Simulating atoms that would be in the final structure
            const newAtomsList = [ 
                { label: 'C1', atomType: 'C' }, { label: 'N1@2_555', atomType: 'N' },
            ];
            const identSymmString = '1_555';

            const { newBonds, atomLabels } = generateSymmetryBonds(
                atomGroups, requiredSymmetryInstances, interGroupBonds,
                specialPositionAtoms, newAtomsList, identSymmString,
            );

            expect(newBonds.length).toBe(1); // Only the inter-group bond
            expect(newBonds[0]).toEqual(expect.objectContaining({
                atom1Label: 'C1',
                atom2Label: 'N1@2_555',
                bondLength: 1.6,
                bondLengthSU: 0.02,
                atom2SiteSymmetry: '.', // Inter-group bonds are created as direct connections
            }));
            expect(atomLabels.size).toBe(2);
            expect(atomLabels).toContain('C1');
            expect(atomLabels).toContain('N1@2_555');
        });

        test('should handle special positions in inter-group bonds', () => {
            const atomGroups = [
                { atoms: [{ label: 'C1', atomType: 'C' }], bonds: [], hBonds: [] }, // Group 0
                { atoms: [{ label: 'N1', atomType: 'N' }], bonds: [], hBonds: [] }, // Group 1
            ];
            const requiredSymmetryInstances = new Set([ // These are used for intra-group bond generation, not directly for inter-group here
                '0@.@1_555',
                '1@.@2_555', 
                '0@.@3_555', 
            ]);
            const interGroupBonds = [
                { originSymmAtom: 'C1@3_555', targetSymmAtom: 'N1@2_555', bondLength: 1.7, bondLengthSU: 0.03 },
            ];
            const specialPositionAtoms = new Map([
                ['C1@3_555', 'C1X'], // C1@3_555 is mapped to C1X
                ['N1@2_555', 'N1Y'], // N1@2_555 is mapped to N1Y
            ]);
            const newAtomsList = [ // Atoms that are kept after special position resolution
                { label: 'C1X', atomType: 'C' }, { label: 'N1Y', atomType: 'N' },
            ];
            const identSymmString = '1_555';

            const { newBonds, atomLabels } = generateSymmetryBonds(
                atomGroups, requiredSymmetryInstances, interGroupBonds,
                specialPositionAtoms, newAtomsList, identSymmString,
            );

            expect(newBonds.length).toBe(1);
            expect(newBonds[0]).toEqual(expect.objectContaining({
                atom1Label: 'C1X', // Resolved from C1@3_555
                atom2Label: 'N1Y', // Resolved from N1@2_555
                bondLength: 1.7,
            }));
            expect(atomLabels.size).toBe(2);
            expect(atomLabels).toContain('C1X');
            expect(atomLabels).toContain('N1Y');
        });

        test('should not add duplicate inter-group bonds (after special position resolution)', () => {
            const atomGroups = [
                { atoms: [{ label: 'C1', atomType: 'C' }], bonds: [], hBonds: [] },
                { atoms: [{ label: 'N1', atomType: 'N' }], bonds: [], hBonds: [] },
            ];
            const requiredSymmetryInstances = new Set(); // Not relevant for this specific test focus
            const interGroupBonds = [
                { originSymmAtom: 'C1', targetSymmAtom: 'N1@2_555', bondLength: 1.6, bondLengthSU: 0.02 },
                // This bond, after special position mapping, will be identical to the first one
                { originSymmAtom: 'C1@3_555', targetSymmAtom: 'N1@4_555', bondLength: 1.6, bondLengthSU: 0.02 },
            ];
            const specialPositionAtoms = new Map([
                ['C1@3_555', 'C1'],      // Map C1@3_555 back to C1
                ['N1@4_555', 'N1@2_555'], // Map N1@4_555 back to N1@2_555
            ]);
            const newAtomsList = [
                { label: 'C1', atomType: 'C' }, { label: 'N1@2_555', atomType: 'N' },
            ];
            const identSymmString = '1_555';

            const { newBonds } = generateSymmetryBonds(
                atomGroups, requiredSymmetryInstances, interGroupBonds,
                specialPositionAtoms, newAtomsList, identSymmString,
            );

            expect(newBonds.length).toBe(1); // Only one bond should be present
            expect(newBonds[0].atom1Label).toBe('C1');
            expect(newBonds[0].atom2Label).toBe('N1@2_555');
        });

        test('should not add inter-group bond if it duplicates an existing intra-group bond (after symm & special pos)', () => {
            const atomGroups = [
                { // Group 0
                    atoms: [{ label: 'C1', atomType: 'C' }, { label: 'C2', atomType: 'C' }],
                    bonds: [new Bond('C1', 'C2', 1.5, 0.01, '.')], // Original intra-group bond
                    hBonds: [],
                },
                { // Group 1 (dummy)
                    atoms: [{ label: 'N1', atomType: 'N' }], bonds: [], hBonds: [],
                },
            ];
            // C1@symm_A will be mapped to C1, N1@symm_B (from group 1) will be mapped to C2 (in group 0)
            // The inter-group bond C1@symm_A -- N1@symm_B becomes C1--C2, duplicating the intra-group bond.
            const requiredSymmetryInstances = new Set([
                // '0@.@1_555' for C1, C2 (implicitly handled by initial bonds)
                // '0@.@symm_A' for C1@symm_A (used in interGroupBonds)
                // '1@.@symm_B' for N1@symm_B (used in interGroupBonds)
            ]);
            const interGroupBonds = [
                { originSymmAtom: 'C1@symm_A', targetSymmAtom: 'N1@symm_B', bondLength: 1.5, bondLengthSU: 0.01 },
            ];
            const specialPositionAtoms = new Map([
                ['C1@symm_A', 'C1'], 
                ['N1@symm_B', 'C2'], 
            ]);
            const newAtomsList = [ 
                { label: 'C1', atomType: 'C' }, { label: 'C2', atomType: 'C' }, { label: 'N1', atomType: 'N' },
            ];
            const identSymmString = '1_555';

            const { newBonds } = generateSymmetryBonds(
                atomGroups, requiredSymmetryInstances, interGroupBonds,
                specialPositionAtoms, newAtomsList, identSymmString,
            );

            expect(newBonds.length).toBe(1); // Only the original C1-C2 bond
            expect(newBonds[0].atom1Label).toBe('C1');
            expect(newBonds[0].atom2Label).toBe('C2');
        });
    });

    describe('generateSymmetryHBonds', () => {
        test('should generate symmetry h-bonds and handle special positions', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('O1', 'O', 0.1, 0.1, 0.1)
                .addAtom('H1', 'H', 0.2, 0.2, 0.2)
                .addAtom('N1', 'N', 0.3, 0.3, 0.3)
                .addHBond('O1', 'H1', 'N1', '.', { daDist: 2.5, angle: 170 }); // Original H-bond
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555';
            const requiredSymmetryInstances = new Set(['0@.@2_555']);
            const atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });
            const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
                requiredSymmetryInstances, atomGroups, structure, identSymmString,
            );
            const atomLabels = new Set(newAtoms.map(a => a.label));
            const newHBonds = generateSymmetryHBonds(
                structure, atomGroups, atomGroupMap, requiredSymmetryInstances,
                specialPositionAtoms, atomLabels, identSymmString,
            );
            // Should keep the original h-bond and add the symmetry-equivalent one
            expect(newHBonds.length).toBe(2);
            expect(newHBonds).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ donorAtomLabel: 'O1', hydrogenAtomLabel: 'H1', acceptorAtomLabel: 'N1' }), // Original
                    expect.objectContaining({ donorAtomLabel: 'O1@2_555', hydrogenAtomLabel: 'H1@2_555', acceptorAtomLabel: 'N1@2_555' }), // Symmetry
                ]),
            );
        });

        test('should generate external H-bonds where acceptor is generated and becomes internal', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('O1', 'O', 0.1, 0.1, 0.1) // Group 0
                .addAtom('H1', 'H', 0.15, 0.15, 0.15) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)   // Group 1
                .addBond('O1', 'H1', '.')
                // External H-bond: O1-H1 ... N1@2_555
                .addHBond('O1', 'H1', 'N1', '2_555', { daDist: 2.8, angle: 160 });
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555'; // '1_555'
            const atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });

            // Required symmetry:
            // - Group 0 (O1, H1) at symm '3_555'
            // - Group 1 (N1) at symm combine('3_555', '2_555') -> '4_545' (from P21/m default)
            const requiredSymmetryInstances = new Set([
                '0@.@3_555', // For O1@3_555, H1@3_555
                '1@.@4_545', // For N1@4_545 (target acceptor)
            ]);
            const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
                requiredSymmetryInstances, atomGroups, structure, identSymmString,
            );
            const atomLabels = new Set(newAtoms.map(a => a.label)); // Will contain N1@4_545

            const newHBonds = generateSymmetryHBonds(
                structure, atomGroups, atomGroupMap, requiredSymmetryInstances,
                specialPositionAtoms, atomLabels, identSymmString,
            );

            // Expected:
            // 1. Original ASU H-bond: O1-H1...N1@2_555 (remains as is, acceptor is external)
            // 2. Symm-generated external H-bond: O1@3_555 - H1@3_555 ... N1@4_545 (acceptor is internal)
            expect(newHBonds.length).toBe(2);
            expect(newHBonds).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ // Original external H-bond
                        donorAtomLabel: 'O1', hydrogenAtomLabel: 'H1', acceptorAtomLabel: 'N1',
                        acceptorAtomSymmetry: '2_555' }),
                    expect.objectContaining({ // Symmetry generated, acceptor now internal
                        donorAtomLabel: 'O1@3_555', hydrogenAtomLabel: 'H1@3_555', acceptorAtomLabel: 'N1@4_545',
                        acceptorAtomSymmetry: '.' }),
                ]),
            );
        });

        test('should generate external H-bonds where acceptor remains external', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('O1', 'O', 0.1, 0.1, 0.1) // Group 0
                .addAtom('H1', 'H', 0.15, 0.15, 0.15) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)   // Group 1
                .addBond('O1', 'H1', '.')
                .addHBond('O1', 'H1', 'N1', '2_555', { daDist: 2.8, angle: 160 }); // O1-H1 ... N1@2_555
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = structure.symmetry.identitySymOpId + '_555';
            const atomGroupMap = new Map();
            atomGroups.forEach((group, i) => {
                group.atoms.forEach(atom => atomGroupMap.set(atom.label, i));
            });

            // Required symmetry:
            // - Group 0 (O1, H1) at symm '3_555'
            // - Group 1 (N1) *not* generated at combined symm '4_545'.
            const requiredSymmetryInstances = new Set(['0@.@3_555']); // Only O1, H1 are symm-generated
            const { specialPositionAtoms, newAtoms } = generateSymmetryAtoms(
                requiredSymmetryInstances, atomGroups, structure, identSymmString,
            );
            const atomLabels = new Set(newAtoms.map(a => a.label)); // Will NOT contain N1@4_545

            const newHBonds = generateSymmetryHBonds(
                structure, atomGroups, atomGroupMap, requiredSymmetryInstances,
                specialPositionAtoms, atomLabels, identSymmString,
            );

            // Expected:
            // 1. Original ASU H-bond: O1-H1...N1@2_555
            // 2. Symm-generated external H-bond: O1@3_555 - H1@3_555 ... N1 (acceptor is N1, symm is '4_545')
            expect(newHBonds.length).toBe(2);
            expect(newHBonds).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        donorAtomLabel: 'O1', hydrogenAtomLabel: 'H1', acceptorAtomLabel: 'N1',
                        acceptorAtomSymmetry: '2_555' }),
                    expect.objectContaining({
                        donorAtomLabel: 'O1@3_555', hydrogenAtomLabel: 'H1@3_555', acceptorAtomLabel: 'N1',
                        acceptorAtomSymmetry: '4_545' }), // Combined symm of '3_555' and '2_555'
                ]),
            );
        });

        test('should handle special positions for acceptors in external H-bonds', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('O1', 'O').addAtom('H1', 'H').addAtom('N1', 'N') // G0: O1,H1; G1: N1
                .addBond('O1', 'H1', '.')
                .addHBond('O1', 'H1', 'N1', '2_555'); // O1-H1 ... N1@2_555
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();
            const identSymmString = '1_555';
            const atomGroupMap = new Map();
            atomGroups.forEach((g, i) => g.atoms.forEach(a => atomGroupMap.set(a.label, i)));

            const requiredSymmetryInstances = new Set(['0@.@3_555', '1@.@4_545']); // O1@3_555, H1@3_555, N1@4_545
            const specialPositionAtoms = new Map([['N1@4_545', 'N1_mapped']]); // N1@4_545 maps to N1_mapped
            const { newAtoms } = generateSymmetryAtoms(requiredSymmetryInstances, atomGroups, structure, identSymmString);
            const atomLabels = new Set([...newAtoms.map(a => a.label), 'N1_mapped']); // Ensure N1_mapped is "present"

            const newHBonds = generateSymmetryHBonds(structure, atomGroups, atomGroupMap, requiredSymmetryInstances, specialPositionAtoms, atomLabels, identSymmString);
            expect(newHBonds.find(hb => hb.donorAtomLabel === 'O1@3_555' && hb.acceptorAtomLabel === 'N1_mapped' && hb.acceptorAtomSymmetry === '.')).toBeDefined();
        });
    });

    describe('processTranslationLinks', () => {
        test('should process translation links correctly', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)
                .addBond('C1', 'N1', '2_555');
            structure = structureHelper.build();
            atomGroups = structure.calculateConnectedGroups();

            const translationLinks = [new ConnectingBondGroup(0, '1_555', 1, '2_565', [new ConnectingBond('C1', 'N1', 1.5, 0.01)], 0)];
            const specialPositionAtoms = new Map();
            const existingBonds = new Set();

            const additionalBonds = processTranslationLinks(translationLinks, structure, specialPositionAtoms, existingBonds);

            expect(additionalBonds.length).toBe(1);
            expect(additionalBonds[0].atom1Label).toBe('C1@1_555');
            expect(additionalBonds[0].atom2Label).toBe('N1');
            expect(additionalBonds[0].atom2SiteSymmetry).toBe('2_565');
        });
    });

    describe('growSymmetry', () => {
        test('should return the same structure if no symmetry growth is needed', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('N1', 'N', 0.2, 0.2, 0.2)
                .addBond('C1', 'N1', '.'); // No symmetry operation
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);

            expect(grownStructure.atoms.length).toBe(2);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining(['C1', 'N1']));
            expect(grownStructure.bonds.length).toBe(1);
            expect(grownStructure.bonds[0].atom1Label).toBe('C1');
            expect(grownStructure.bonds[0].atom2Label).toBe('N1');
            expect(grownStructure.bonds[0].atom2SiteSymmetry).toBe('.');
        });

        test('should perform simple symmetry growth for one inter-group bond', () => {
            // C1 (Group 0) bonds to N1 (Group 1) via symmetry '2_555'
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4) // Group 1
                .addBond('C1', 'N1', '2_555');    // C1 -> N1@2_555
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);
            // Expected atoms: C1 (ASU), N1 (ASU), N1@2_555
            // Expected bonds: C1 - N1@2_555 (direct bond after growth)

            expect(grownStructure.atoms.length).toBe(3);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining(['C1', 'N1', 'N1@2_555']));
            
            expect(grownStructure.bonds.length).toBe(1);
            const bond = grownStructure.bonds[0];
            expect(bond.atom1Label).toBe('C1');
            expect(bond.atom2Label).toBe('N1@2_555');
            expect(bond.atom2SiteSymmetry).toBe('.'); // Bond is now direct
        });

        test('should handle intra-group symmetry bond (atom to its own image)', () => {
            // C1 (Group 0) bonds to its own image C1 via symmetry '2_555'
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addBond('C1', 'C1', '2_555');    // C1 -> C1@2_555
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);
            // Expected atoms: C1 (ASU), C1@2_555
            // Expected bonds: C1 - C1@2_555 (direct bond after growth)

            expect(grownStructure.atoms.length).toBe(2);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining(['C1', 'C1@2_555']));

            expect(grownStructure.bonds.length).toBe(2);
            const bond = grownStructure.bonds[0];
            // Order might vary due to createBondIdentifier
            const bondLabels = [bond.atom1Label, bond.atom2Label].sort();
            expect(bondLabels).toEqual(['C1', 'C1@2_555'].sort());
            expect(bond.atom2SiteSymmetry).toBe('.');
        });

        test('should handle chain growth A-B@S1, B@S1-C@S_combined', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('A1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('B1', 'N', 0.2, 0.2, 0.2) // Group 1
                .addAtom('C1', 'O', 0.3, 0.3, 0.3) // Group 2
                .addBond('A1', 'B1', '2_555')      // A1 -> B1@2_555
                .addBond('B1', 'C1', '3_555');     // B1 -> C1@3_555 (from ASU B1)
            structure = structureHelper.build();
            
            const grownStructure = growSymmetry(structure);

            // Expected atoms: A1, B1, C1 (ASU)
            // B1@2_555 (from A1-B1@S1)
            // C1_symm (from B1@2_555 connecting to C1 via '3_555' relative to ASU B1)
            //   Symmetry of B1@2_555 is '2_555'. Connecting op to C1 is '3_555'.
            //   Final symm for C1 is combine('3_555', '2_555').
            //   P21/m: op2 = (-x,y+1/2,-z), op3 = (-x,-y,-z)
            //   op3(op2(X)) = op3(-x,y+1/2,-z) = (x, -(y+1/2), z) = (x, -y-1/2, z). This is op4 with y-translation.
            //   So C1_symm should be C1@4_545 (approx, depends on exact combination logic for translations)
            //   Let's verify with actual combination: combine('3_555','2_555') -> '4_545'
            const combinedSymm_B1_to_C1 = structure.symmetry.combineSymmetryCodes(
                '3_555', '2_555',
            ); // Should be '4_545'

            expect(grownStructure.atoms.length).toBe(6);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining([
                'A1', 'B1', 'C1', 'B1@2_555', `C1@${combinedSymm_B1_to_C1}`,
            ]));

            expect(grownStructure.bonds.length).toBe(3);
            expect(grownStructure.bonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ atom1Label: 'A1', atom2Label: 'B1@2_555', atom2SiteSymmetry: '.' }),
                expect.objectContaining(
                    { atom1Label: 'B1@2_555', atom2Label: `C1@${combinedSymm_B1_to_C1}`, atom2SiteSymmetry: '.' },
                ),
            ]));
        });

        test('should correctly handle translational links', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4); // Group 1
            structureHelper.addBond('C1', 'N1', '2_555'); // C1@1_555 -> N1@2_555
            structureHelper.addBond('N1', 'C1', '2_565'); // N1@1_555 -> C1@2_565
            // This setup leads to translational links as detailed in thought process.
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);

            // Expected atoms: C1, N1 (ASU), N1@2_555, C1@2_565
            expect(grownStructure.atoms.length).toBe(4);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining([
                'C1', 'N1', 'N1@2_555', 'C1@2_565',
            ]));

            // Expected bonds:
            // 1. C1 - N1@2_555 (symm '.') from network connection
            // 2. N1 - C1@2_565 (symm '.') from network connection
            // 3. N1@2_555 - C1 (symm '1_565') from translationLink
            // 4. C1@2_565 - N1 (symm '1_545') from translationLink
            expect(grownStructure.bonds.length).toBe(4);
            expect(grownStructure.bonds).toEqual(expect.arrayContaining([
                expect.objectContaining({ 
                    atom1Label: 'C1', 
                    atom2Label: 'N1@2_555', 
                    atom2SiteSymmetry: '.', 
                    bondLength: 1.5, 
                    bondLengthSU: 0.01,
                }),
                expect.objectContaining({ 
                    atom1Label: 'N1', 
                    atom2Label: 'C1@2_565', 
                    atom2SiteSymmetry: '.', 
                    bondLength: 1.5, 
                    bondLengthSU: 0.01, 
                }),
                expect.objectContaining({ 
                    atom1Label: 'N1@2_555', 
                    atom2Label: 'C1', 
                    atom2SiteSymmetry: '1_575', 
                    bondLength: 1.5, 
                    bondLengthSU: 0.01, 
                }),
                expect.objectContaining({ 
                    atom1Label: 'C1@2_565', 
                    atom2Label: 'N1', 
                    atom2SiteSymmetry: '1_575',
                    bondLength: 1.5, 
                    bondLengthSU: 0.01, 
                }),
            ]));
        });

        test('should handle special positions correctly', () => {
            // C1 at (0,0,0) - an inversion center for P21/m with origin at -1.
            // C2 at (0.1,0.1,0.1)
            // Bond C1-C2 (intra-group)
            // Bond C2 to C1 via symm '3_555' (op3 is inversion -x,-y,-z)
            // C1@3_555 should map to C1.
            structureHelper = new MockStructureHelper()
                .addAtom('C1', 'C', 0, 0, 0)       // Group 0
                .addAtom('C2', 'C', 0.1, 0.1, 0.1) // Group 0
                .addBond('C1', 'C2', '.')          // Intra-group bond
                .addBond('C2', 'C1', '3_555');     // C2 connects to C1@3_555
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);

            // Expected atoms: C1, C2 (ASU), C2@3_555. (C1@3_555 maps to C1)
            expect(grownStructure.atoms.length).toBe(3);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining([
                'C1', 'C2', 'C2@3_555',
            ]));

            // Expected bonds:
            // 1. C1-C2 (original ASU bond)
            // 2. C1-C2@3_555 (symm copy of C1-C2, where C1@3_555 became C1)
            // The inter-group bond C2 - C1@3_555 becomes C2-C1, which is a duplicate of #1 and should be skipped.
            expect(grownStructure.bonds.length).toBe(2);
            const bond1 = grownStructure.bonds.find(b => 
                (b.atom1Label === 'C1' && b.atom2Label === 'C2') || (b.atom1Label === 'C2' && b.atom2Label === 'C1'),
            );
            const bond2 = grownStructure.bonds.find(b =>
                (b.atom1Label === 'C1' && b.atom2Label === 'C2@3_555') || (b.atom1Label === 'C2@3_555' && b.atom2Label === 'C1'),
            );
            expect(bond1).toBeDefined();
            expect(bond1.atom2SiteSymmetry).toBe('.');
            expect(bond2).toBeDefined();
            expect(bond2.atom2SiteSymmetry).toBe('.');
        });

        test('should keep hydrogen bonds if symmetry not grown in that direction', () => {
            structureHelper = new MockStructureHelper()
                .addAtom('O1', 'O', 0.1, 0.1, 0.1) // Group 0
                .addAtom('H1', 'H', 0.15, 0.15, 0.15) // Group 0
                .addAtom('N1', 'N', 0.4, 0.4, 0.4)   // Group 1
                .addBond('O1', 'H1', '.') // O1-H1 bond
                .addHBond('O1', 'H1', 'N1', '2_555'); // O1-H1 ... N1@2_555
            structure = structureHelper.build();

            const grownStructure = growSymmetry(structure);

            // Expected atoms: O1, H1, N1 (ASU), N1@2_555
            expect(grownStructure.atoms.length).toBe(3);
            expect(grownStructure.atoms.map(a => a.label)).toEqual(expect.arrayContaining([
                'O1', 'H1', 'N1',
            ]));

            // Expected bonds: O1-H1
            expect(grownStructure.bonds.length).toBe(1);
            expect(grownStructure.bonds[0].atom1Label).toBe('O1');
            expect(grownStructure.bonds[0].atom2Label).toBe('H1');

            // Expected H-Bonds: O1-H1...N1@2_555
            expect(grownStructure.hBonds.length).toBe(1);
            const hbond = grownStructure.hBonds[0];
            expect(hbond.donorAtomLabel).toBe('O1');
            expect(hbond.hydrogenAtomLabel).toBe('H1');
            expect(hbond.acceptorAtomLabel).toBe('N1');
            expect(hbond.acceptorAtomSymmetry).toBe('2_555'); // HBond is now direct
        });
    });
});