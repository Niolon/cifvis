import { CrystalStructure } from '../../crystal.js';
import { growExternalHBonds } from './grow-hbonds.js';
import { MockStructure } from '../base.test.js';

describe('growExternalHBonds', () => {
    let basicStructure;

    beforeEach(() => {
        // Create a basic structure with hydrogen bonds that have symmetry
        basicStructure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('O1', 'H1', 'N1', '2_555')  // External HBond with symmetry
            .addHBond('O1', 'H2', 'N2', '.')      // Internal HBond without symmetry
            .build();
    });

    test('handles structures without HBonds', () => {
        const structure = MockStructure.createDefault().build();
        const grown = growExternalHBonds(structure);

        expect(grown.atoms.length).toBe(structure.atoms.length);
        expect(grown.bonds.length).toBe(structure.bonds.length);
        expect(grown.hBonds.length).toBe(0);
    });

    test('preserves internal HBonds (no symmetry)', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true })
            .addHBond('O1', 'H1', 'N1', '.')
            .build();

        const grown = growExternalHBonds(structure);

        expect(grown.hBonds.length).toBe(3); // 2 from default + 1 added = 3 total
        expect(grown.hBonds.every(hb => hb.acceptorAtomSymmetry === '.')).toBe(true);
        // Use donorAtomId and acceptorAtomId which contain uniqueId format
        expect(grown.hBonds.some(hb =>
            hb.donorAtomId.startsWith('O1|') && hb.acceptorAtomId.startsWith('N1|'),
        )).toBe(true);
    });

    test('grows external HBonds with symmetry operations', () => {
        const grown = growExternalHBonds(basicStructure);

        // Should have both the original internal HBond and the grown external one
        expect(grown.hBonds.length).toBeGreaterThan(basicStructure.hBonds.length);

        // Check for the grown HBond with updated IDs (using uniqueId format)
        const grownHBond = grown.hBonds.find(hb =>
            hb.donorAtomId === 'O1|2_555' &&
            hb.acceptorAtomId === 'N1|2_555' &&
            hb.acceptorAtomSymmetry === '.',
        );
        expect(grownHBond).toBeDefined();
    });

    test('grows connected atoms, bonds, and HBonds for acceptor group', () => {
        const grown = growExternalHBonds(basicStructure);

        // Should have grown atoms from the acceptor group
        expect(grown.atoms.length).toBeGreaterThan(basicStructure.atoms.length);

        // Check for grown atoms with symmetry in uniqueId (not label)
        const grownAtoms = grown.atoms.filter(atom => atom.uniqueId.includes('|2_555'));
        expect(grownAtoms.length).toBeGreaterThan(0);

        // Should have grown bonds within the acceptor group
        expect(grown.bonds.length).toBeGreaterThan(basicStructure.bonds.length);
    });

    test('avoids growing the same group twice for different HBonds', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('O1', 'H1', 'N1', '2_555')  // First HBond to same acceptor group
            .addHBond('C1', 'H2', 'N1', '2_555')  // Second HBond to same acceptor group
            .build();

        const grown = growExternalHBonds(structure);

        // Count how many times N1 with 2_555 symmetry appears (should be once)
        const grownN1Atoms = grown.atoms.filter(atom =>
            atom.label === 'N1' && atom.uniqueId === 'N1|2_555',
        );
        expect(grownN1Atoms.length).toBe(1); // Group should only be grown once
    });

    test('handles multiple symmetry operations', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('O1', 'H1', 'N1', '2_555')
            .addHBond('O1', 'H2', 'N2', '3_565')
            .build();

        const grown = growExternalHBonds(structure);

        // Should have grown atoms for both symmetry operations (check uniqueId)
        const grown2_555 = grown.atoms.filter(atom => atom.uniqueId.includes('|2_555'));
        const grown3_565 = grown.atoms.filter(atom => atom.uniqueId.includes('|3_565'));

        expect(grown2_555.length).toBeGreaterThan(0);
        expect(grown3_565.length).toBeGreaterThan(0);
    });

    test('preserves bond and HBond properties through growth', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('N2', 'H2', 'S1', '2_555', {
                dhDist: 1.1, dhDistSU: 0.02, haDist: 2.1, haDistSU: 0.03,
                daDist: 2.9, daDistSU: 0.04, angle: 176.0, angleSU: 2.0,
            })
            .build();

        const grown = growExternalHBonds(structure);

        // Find the original external HBond (donor is in ASU, acceptor has symmetry applied)
        const grownHBond = grown.hBonds.find(hb =>
            hb.donorAtomId.startsWith('N2|') &&
            hb.acceptorAtomId === 'S1|2_555',
        );

        expect(grownHBond).toBeDefined();
        expect(grownHBond.donorHydrogenDistance).toBe(1.1);
        expect(grownHBond.donorHydrogenDistanceSU).toBe(0.02);
        expect(grownHBond.acceptorHydrogenDistance).toBe(2.1);
        expect(grownHBond.acceptorHydrogenDistanceSU).toBe(0.03);
        expect(grownHBond.donorAcceptorDistance).toBe(2.9);
        expect(grownHBond.donorAcceptorDistanceSU).toBe(0.04);
        expect(grownHBond.hBondAngle).toBe(176);
        expect(grownHBond.hBondAngleSU).toBe(2);
    });

    test('filters and grows only internal bonds within acceptor group', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('O1', 'H1', 'N1', '2_555')
            .build();

        const grown = growExternalHBonds(structure);

        // All grown bonds should have atom2SiteSymmetry of '.'
        // Check using atom1Id/atom2Id which now contain uniqueId format
        const grownBonds = grown.bonds.filter(bond =>
            bond.atom1Id.includes('|2_555') || bond.atom2Id.includes('|2_555'),
        );

        grownBonds.forEach(bond => {
            expect(bond.atom2SiteSymmetry).toBe('.');
        });
    });

    test('filters and grows only internal HBonds within acceptor group', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
        })
            .addHBond('O1', 'H1', 'N1', '2_555')
            .addHBond('N1', 'H2', 'C1', '.')  // Internal HBond within acceptor group
            .build();

        const grown = growExternalHBonds(structure);

        // Should find grown internal HBonds with updated IDs
        const grownInternalHBond = grown.hBonds.find(hb =>
            hb.donorAtomId === 'N1|2_555' &&
            hb.acceptorAtomId === 'C1|2_555' &&
            hb.acceptorAtomSymmetry === '.',
        );

        expect(grownInternalHBond).toBeDefined();
    });

    test('returns new CrystalStructure with correct structure', () => {
        const grown = growExternalHBonds(basicStructure);

        expect(grown).toBeInstanceOf(CrystalStructure);
        expect(grown.cell).toBe(basicStructure.cell);
        expect(grown.symmetry).toBe(basicStructure.symmetry);
        expect(grown.atoms.length).toBeGreaterThan(basicStructure.atoms.length);
        expect(grown.bonds.length).toBeGreaterThan(basicStructure.bonds.length);
        expect(grown.hBonds.length).toBeGreaterThan(basicStructure.hBonds.length);
    });

    test('handles empty growable HBonds list', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true })
            .addHBond('O1', 'H1', 'N1', '.') // Only internal HBonds
            .build();

        const grown = growExternalHBonds(structure);

        // Should be identical to original since no external HBonds to grow
        expect(grown.atoms.length).toBe(structure.atoms.length);
        expect(grown.bonds.length).toBe(structure.bonds.length);
        expect(grown.hBonds.length).toBe(structure.hBonds.length);
    });

    test('preserves atom properties during growth', () => {
        const structure = MockStructure.createDefault({
            hasHydrogens: true,
            hasMultipleSymmetry: true,
            hasAnisoHydrogens: true,
            disorderGroups: [1],
        })
            .addHBond('O1', 'H1', 'A0', '2_555') // A0 has disorder group 1
            .build();

        const grown = growExternalHBonds(structure);

        const originalA0 = structure.atoms.find(atom => atom.label === 'A0');
        // Find grown atom by uniqueId instead of label
        const grownA0 = grown.atoms.find(atom => atom.uniqueId === 'A0|2_555');

        expect(grownA0).toBeDefined();
        expect(grownA0.label).toBe('A0'); // Label should be pure now
        expect(grownA0.atomType).toBe(originalA0.atomType);
        expect(grownA0.disorderGroup).toBe(originalA0.disorderGroup);

        if (originalA0.adp) {
            expect(grownA0.adp).toBeDefined();
            expect(grownA0.adp.constructor.name).toBe(originalA0.adp.constructor.name);
        }
    });
});
