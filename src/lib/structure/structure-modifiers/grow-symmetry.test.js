import { beforeEach, describe, test } from 'vitest';
import { MockStructure as MockStructureHelper } from './base.test.js';

import { 
    createSymAtomLabel, 
    createBondIdentifier, 
    createHBondIdentifier, 
    ConnectedGroup, 
    ConnectingBond, 
    ConnectingBondGroup,
    getSeedConnections,
    exploreConnection,
    generateSymmetryAtoms,
    generateSymmetryBonds,
    generateSymmetryHBonds,
    createConnectivity,
    collectSymmetryRequirements,
} from './grow-symmetry.js';

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
    let structureHelper;
    let structure;
    let atomGroups;
    let atomGroupMap;

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

    });
});