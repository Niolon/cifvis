import { CrystalStructure, UnitCell, Atom } from '../crystal.js';
import { FractPosition } from '../position.js';
import { Bond } from '../bonds.js';
import { CellSymmetry, SymmetryOperation } from '../cell-symmetry.js';
import { CIF } from '../../read-cif/base.js';
import {
    AtomLabelFilter, BondGenerator, IsolatedHydrogenFixer,
} from './fixers.js';
import { SymmetryGrower } from './modes.js';
import { MockStructure } from './base.test.js';

/**
 * Pins a mock structure to P1 symmetry. The default MockStructure carries
 * P2_1/m; several BondGenerator tests exercise only the intra-cell Cartesian
 * pass, so P1 keeps the symmetry-equivalent pass (covered by its own tests)
 * from adding correct-but-unrelated bonds.
 * @param {CrystalStructure} structure - Structure to modify in place
 * @returns {CrystalStructure} The same structure with P1 symmetry
 */
function asP1(structure) {
    structure.symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
    return structure;
}

describe('AtomLabelFilter', () => {
    let mockStructure;
    let mockAtoms;

    beforeEach(() => {
        // Setup mock atoms with different label patterns
        mockAtoms = [
            new Atom('C1', 'C', new FractPosition(0, 0, 0)),
            new Atom('C2', 'C', new FractPosition(0, 0, 0)),
            new Atom('H2A', 'H', new FractPosition(0, 0, 0)),
            new Atom('N3', 'N', new FractPosition(0, 0, 0)),
            new Atom('O4', 'O', new FractPosition(0, 0, 0)),
            new Atom('C>5', 'C', new FractPosition(0, 0, 0)), // Label with > character
            new Atom('C5', 'C', new FractPosition(0, 0, 0)),
        ];

        mockStructure = new CrystalStructure(
            new UnitCell(10, 10, 10, 90, 90, 90),
            mockAtoms,
            [],  // No bonds for this test
        );

        // Spy on console.warn to check for warnings
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    test('filters individual atoms', () => {
        const filter = new AtomLabelFilter(['C1', 'N3'], 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(5);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C1');
        expect(filtered.atoms.map(a => a.label)).not.toContain('N3');
    });

    test('filters range of atoms', () => {
        const filter = new AtomLabelFilter(['C1>N3'], 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(3);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C1');
        expect(filtered.atoms.map(a => a.label)).not.toContain('C2');
        expect(filtered.atoms.map(a => a.label)).not.toContain('H2A');
        expect(filtered.atoms.map(a => a.label)).not.toContain('N3');
    });

    test('filters combination of individual and range', () => {
        const filter = new AtomLabelFilter(['C1>C2', 'O4'], 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(4);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C1');
        expect(filtered.atoms.map(a => a.label)).not.toContain('C2');
        expect(filtered.atoms.map(a => a.label)).not.toContain('O4');
    });

    test('handles labels containing > character', () => {
        const filter = new AtomLabelFilter(['C>5'], 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(6);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C>5');
    });

    test('handles range with invalid labels', () => {
        const filter = new AtomLabelFilter(['INVALID>C5'], 'on');
        expect(() => filter.apply(mockStructure)).toThrow('Range filtering included unknown start label: INVALID');

        const filter2 = new AtomLabelFilter(['C5>INVALID'], 'on');
        expect(() => filter2.apply(mockStructure)).toThrow('Range filtering included unknown end label: INVALID');
    });

    test('accepts string input', () => {
        const filter = new AtomLabelFilter('C1,N3,O4', 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(4);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C1');
        expect(filtered.atoms.map(a => a.label)).not.toContain('N3');
        expect(filtered.atoms.map(a => a.label)).not.toContain('O4');
    });

    test('accepts string input with ranges', () => {
        const filter = new AtomLabelFilter('C1>N3,O4', 'on');
        const filtered = filter.apply(mockStructure);

        expect(filtered.atoms.length).toBe(2);
        expect(filtered.atoms.map(a => a.label)).not.toContain('C1');
        expect(filtered.atoms.map(a => a.label)).not.toContain('C2');
        expect(filtered.atoms.map(a => a.label)).not.toContain('H2A');
        expect(filtered.atoms.map(a => a.label)).not.toContain('N3');
        expect(filtered.atoms.map(a => a.label)).not.toContain('O4');
    });
});

describe('BondGenerator', () => {
    let generator;
    let elementProperties;

    beforeEach(() => {
        elementProperties = {
            'C': { radius: 0.76 },
            'O': { radius: 0.66 },
            'N': { radius: 0.71 },
            'H': { radius: 0.31 },
        };

        const tolerance = 0.3;

        generator = new BondGenerator(elementProperties, tolerance);
    });

    describe('getMaxBondDistance', () => {
        test('calculates correct distance for element pair', () => {
            const distance = generator.getMaxBondDistance('C', 'O', elementProperties);
            expect(distance).toBeCloseTo(0.76 + 0.66 + 0.3);
        });

        test('throws error for unknown elements', () => {
            expect(() => {
                generator.getMaxBondDistance('C', 'Xx', elementProperties);
            }).toThrow('Missing radius for element Xx');
        });

        test('handles different tolerances', () => {
            const strictGenerator = new BondGenerator(elementProperties, 0.1);

            const looseGenerator = new BondGenerator(elementProperties, 0.6);

            const strictDistance = strictGenerator.getMaxBondDistance(
                'C', 'O', elementProperties,
            );
            const looseDistance = looseGenerator.getMaxBondDistance(
                'C', 'O', elementProperties,
            );

            expect(looseDistance).toBeGreaterThan(strictDistance);
        });

        test('tightens tolerance to 0.40 for s-block element pairs', () => {
            const naProperties = {
                'Na': { radius: 1.66 },
                'Cl': { radius: 1.02 },
            };
            const sBlockGenerator = new BondGenerator(naProperties, 0.45);

            expect(sBlockGenerator.getMaxBondDistance('Na', 'Cl', naProperties))
                .toBeCloseTo(1.66 + 1.02 + 0.40);
        });

        test('does not tighten tolerance below the configured value for non-s-block pairs', () => {
            const distance = generator.getMaxBondDistance('C', 'O', elementProperties);
            expect(distance).toBeCloseTo(0.76 + 0.66 + 0.3);
        });
    });

    describe('modes with existing bonds', () => {
        test('KEEP preserves existing bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1', '.', 1.5, 0.01)
                .build();

            generator.mode = BondGenerator.MODES.KEEP;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.KEEP);
            expect(result.bonds).toEqual(structure.bonds);
        });

        test('ADD preserves existing bonds and adds new ones', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addAtom('N1', 'N', 0.1, 0.1, 0)
                .addBond('C1', 'O1')
                .build();

            generator.mode = BondGenerator.MODES.ADD;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.ADD);
            expect(result.bonds.length).toBeGreaterThan(structure.bonds.length);
            expect(result.bonds).toContainEqual(structure.bonds[0]);
        });

        test('REPLACE generates new bonds replacing existing ones', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1', '.', 1.5, 0.01)  // Bond with custom parameters
                .build());

            generator.mode = BondGenerator.MODES.REPLACE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.REPLACE);
            expect(result.bonds.length).toBe(1);
            expect(result.bonds[0]).not.toEqual(structure.bonds[0]);
        });

        test('CREATE switches to KEEP when bonds exist', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1')
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.KEEP);
            expect(result.bonds).toEqual(structure.bonds);
        });

        test('IGNORE switches to KEEP when bonds exist', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1')
                .build();

            generator.mode = BondGenerator.MODES.IGNORE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.KEEP);
            expect(result.bonds).toEqual(structure.bonds);
        });
    });

    describe('modes without existing bonds', () => {
        test('KEEP switches to CREATE for structure without bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.KEEP;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.CREATE);
            expect(result.bonds.length).toBeGreaterThan(0);
        });

        test('ADD switches to CREATE for structure without bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.ADD;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.CREATE);
            expect(result.bonds.length).toBeGreaterThan(0);
        });

        test('REPLACE switches to CREATE for structure without bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.REPLACE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.CREATE);
            expect(result.bonds.length).toBeGreaterThan(0);
        });

        test('CREATE generates bonds for structure without bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.CREATE);
            expect(result.bonds.length).toBeGreaterThan(0);
        });

        test('Bond creation uses custom user radii', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'X-', 0, 0, 0)
                .addAtom('O1', 'O+', 0.1, 0, 0)
                .build();

            generator.elementProperties['O+'] = { radius: 0.66 };
            generator.elementProperties['X-'] = { radius: 0.66 };

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.CREATE);
            expect(result.bonds.length).toBeGreaterThan(0);
        });

        test('IGNORE maintains empty bonds array', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.IGNORE;
            const result = generator.apply(structure);

            expect(generator.mode).toBe(BondGenerator.MODES.IGNORE);
            expect(result.bonds).toEqual([]);
        });
    });

    describe('bond generation behavior', () => {
        test('generates bonds between nearby atoms', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)  // Close enough for bond
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
            expect(result.bonds[0].atom1Id).toBe('C1|1_555');
            expect(result.bonds[0].atom2Id).toBe('O1|1_555');
        });

        test('can handle ion atom types', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C1+', 0, 0, 0)
                .addAtom('O1', 'O-2', 0.1, 0, 0)
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
            expect(result.bonds[0].atom1Id).toBe('C1|1_555');
            expect(result.bonds[0].atom2Id).toBe('O1|1_555');
        });

        test('skips atoms that are too far apart', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.5, 0.5, 0.5)  // Too far for bond
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(0);
        });

        test('handles hydrogens with existing bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('H1', 'H', 0.1, 0, 0)
                .addAtom('O1', 'O', 0.2, 0, 0)
                .addBond('C1', 'H1')  // Existing H bond
                .build();

            generator.mode = BondGenerator.MODES.ADD;
            const result = generator.apply(structure);

            const hBonds = result.bonds.filter(b =>
                b.atom1Id === 'H1|1_555' || b.atom2Id === 'H1|1_555',
            );
            expect(hBonds.length).toBe(1);  // Should not create additional H bonds
        });

        test('calculates actual distances for generated bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)  // In a 10Å cell this is 1Å
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds[0].bondLength).toBeCloseTo(1.0, 5);
        });

        test('preserves symmetry operations in existing bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1', '2_555')  // Bond with symmetry operation
                .build();

            generator.mode = BondGenerator.MODES.ADD;
            const result = generator.apply(structure);

            const symBond = result.bonds.find(b =>
                b.atom1Id === 'C1|1_555' && b.atom2Id === 'O1|2_555' && b.atom2SiteSymmetry === '2_555',
            );
            expect(symBond).toBeTruthy();
        });

        test('does not bond atoms in different nonzero disorder groups', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0, 1)
                .addAtom('O1', 'O', 0.1, 0, 0, 2)
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(0);
        });

        test('bonds disorder-group-0 atoms to any group', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0, 2)
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
        });

        test('bonds atoms in the same nonzero disorder group', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0, 1)
                .addAtom('O1', 'O', 0.1, 0, 0, 1)
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
        });

        test('grid-hashing finds the same bonds as a brute-force scan for atoms spread across cells', () => {
            // Cell is large relative to bonding radii, so atoms placed across
            // the fractional range fall into different spatial grid cells.
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0.01, 0.01, 0.01)
                .addAtom('O1', 'O', 0.02, 0.01, 0.01) // bonds to C1
                .addAtom('C2', 'C', 0.5, 0.5, 0.5)
                .addAtom('O2', 'O', 0.501, 0.5, 0.5) // bonds to C2
                .addAtom('N1', 'N', 0.7, 0.7, 0.7) // isolated: far from all atoms and their images
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            const bondPairs = result.bonds
                .map(b => [b.atom1Id, b.atom2Id].sort().join('-'))
                .sort();
            expect(bondPairs).toEqual([
                'C1|1_555-O1|1_555',
                'C2|1_555-O2|1_555',
            ]);
        });
    });

    describe('symmetry-equivalent bond perception', () => {
        test('does not add symmetry bonds for a molecule bonded within the cell (P1)', () => {
            const structure = asP1(new MockStructure()
                .addAtom('C1', 'C', 0.1, 0.1, 0.1)
                .addAtom('O1', 'O', 0.12, 0.1, 0.1)
                .build());

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds).toHaveLength(1);
            expect(result.bonds[0].atom2SiteSymmetry).toBe('.');
        });

        test('bonds an atom to a symmetry image when no in-cell partner is in range', () => {
            // C1 and O1 are far apart within the cell, but the inversion image of
            // O1 lands ~1.4 A from C1, so the only bond crosses the inversion centre.
            const cell = new UnitCell(5, 5, 5, 90, 90, 90);
            const atoms = [
                new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
                new Atom('O1', 'O', new FractPosition(0.62, 0.9, 0.9)),
            ];
            const symmetry = new CellSymmetry('P-1', 2, [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,-y,-z'),
            ]);
            const structure = new CrystalStructure(cell, atoms, [], [], symmetry);

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            const symmetryBonds = result.bonds.filter(bond => bond.atom2SiteSymmetry !== '.');
            expect(symmetryBonds.length).toBeGreaterThan(0);
            for (const bond of symmetryBonds) {
                // The emitted code must resolve against the space group, and the
                // anchor is always a home-cell (1_555) atom.
                expect(() => symmetry.parsePositionCode(bond.atom2SiteSymmetry)).not.toThrow();
                expect(bond.atom1Id.endsWith('|1_555')).toBe(true);
            }
            // The C1-O1 contact across the inversion centre is among them.
            const hasCrossSymmetryCO = symmetryBonds.some(bond =>
                bond.atom1Id.split('|')[0] === 'C1' && bond.atom2Id.split('|')[0] === 'O1');
            expect(hasCrossSymmetryCO).toBe(true);
        });

        test('does not bond an atom to itself across a symmetry element', () => {
            const cell = new UnitCell(5, 5, 5, 90, 90, 90);
            // An atom on a general position; its own images must never self-bond.
            const atoms = [new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1))];
            const symmetry = new CellSymmetry('P-1', 2, [
                new SymmetryOperation('x,y,z'),
                new SymmetryOperation('-x,-y,-z'),
            ]);
            const structure = new CrystalStructure(cell, atoms, [], [], symmetry);

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            for (const bond of result.bonds) {
                expect(bond.atom1Id).not.toBe(bond.atom2Id);
            }
        });

        test('finds periodic bonds for an atom listed on a cell face (out-of-cell fallback)', () => {
            // A1 sits exactly on the +x face (fractional 1.0), so it is an
            // out-of-cell home atom; its periodic bond to B1 near x=0 is only found
            // via the direct fallback, not the border-pruned grid pass.
            const cell = new UnitCell(3, 3, 3, 90, 90, 90);
            const atoms = [
                new Atom('A1', 'C', new FractPosition(1.0, 0.5, 0.5)),
                new Atom('B1', 'O', new FractPosition(0.1, 0.5, 0.5)),
            ];
            const symmetry = new CellSymmetry('P1', 1, [new SymmetryOperation('x,y,z')]);
            const structure = new CrystalStructure(cell, atoms, [], [], symmetry);

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            const aToB = result.bonds.find(bond =>
                bond.atom1Id === 'A1|1_555' && bond.atom2Id.split('|')[0] === 'B1'
                && bond.atom2SiteSymmetry !== '.');
            expect(aToB).toBeDefined();
            expect(() => symmetry.parsePositionCode(aToB.atom2SiteSymmetry)).not.toThrow();
        });

        test('perceives NaCl coordination via symmetry and renders it after cell growth', () => {
            // Real Fm-3m NaCl with no symmetry-operation loop: the operators are
            // reconstructed from the space-group number, and the Na-Cl bonds only
            // exist to symmetry-equivalent Cl atoms.
            const cifText = [
                'data_nacl',
                '_cell_length_a 5.6402',
                '_cell_length_b 5.6402',
                '_cell_length_c 5.6402',
                '_cell_angle_alpha 90',
                '_cell_angle_beta 90',
                '_cell_angle_gamma 90',
                '_symmetry_Int_Tables_number 225',
                '_symmetry_space_group_name_H-M \'Fm-3m\'',
                'loop_',
                '_atom_site_type_symbol',
                '_atom_site_label',
                '_atom_site_fract_x',
                '_atom_site_fract_y',
                '_atom_site_fract_z',
                'Na Na1 0 0 0',
                'Cl Cl1 0.5 0.5 0.5',
            ].join('\n');
            const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
            const nonMolecularProps = { Na: { radius: 1.66 }, Cl: { radius: 1.02 } };

            const bondGenerator = new BondGenerator(nonMolecularProps, 0.45);
            bondGenerator.mode = BondGenerator.MODES.CREATE;
            const perceived = bondGenerator.apply(structure);

            // Six octahedral Na-Cl contacts, each to a symmetry-equivalent Cl.
            expect(perceived.bonds).toHaveLength(6);
            expect(perceived.bonds.every(bond => bond.atom2SiteSymmetry !== '.')).toBe(true);
            expect(perceived.bonds.every(bond => bond.atom1Id === 'Na1|1_555')).toBe(true);

            // After cell growth the partner Cl atoms are materialised, so the bonds
            // become renderable (both endpoints present).
            const grown = new SymmetryGrower('cell').apply(perceived);
            expect(grown.atoms).toHaveLength(8);
            const atomIds = new Set(grown.atoms.map(atom => atom.uniqueId));
            const renderable = grown.bonds.filter(
                bond => atomIds.has(bond.atom1Id) && atomIds.has(bond.atom2Id),
            );
            expect(renderable.length).toBeGreaterThan(0);

            // Fragment growth on this 3D-periodic structure must stay bounded: the
            // periodic replicas (same operation, different lattice translation) are
            // collapsed to one per operation instead of expanding into a block. The
            // result is small and self-consistent (no bonds to missing atoms).
            const fragment = new SymmetryGrower('fragment').apply(perceived);
            expect(fragment.atoms.length).toBeLessThanOrEqual(8);
            const fragmentIds = new Set(fragment.atoms.map(atom => atom.uniqueId));
            expect(fragment.bonds.every(
                bond => fragmentIds.has(bond.atom1Id) && fragmentIds.has(bond.atom2Id),
            )).toBe(true);
        });
    });

    describe('getApplicableModes', () => {
        test('returns correct modes for structure with bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1')
                .build();

            const modes = generator.getApplicableModes(structure);
            expect(modes).toEqual([
                BondGenerator.MODES.KEEP,
                BondGenerator.MODES.ADD,
                BondGenerator.MODES.REPLACE,
            ]);
        });

        test('returns correct modes for structure without bonds', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            const modes = generator.getApplicableModes(structure);
            expect(modes).toEqual([
                BondGenerator.MODES.CREATE,
                BondGenerator.MODES.IGNORE,
            ]);
        });
    });

    describe('error handling', () => {
        test('handles missing atomic radii', () => {
            const structure = new MockStructure()
                .addAtom('X1', 'X', 0, 0, 0)  // Unknown element
                .addAtom('O1', 'O', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            expect(() => generator.apply(structure)).toThrow('Missing radius for element X');
        });
    });
});

describe('IsolatedHydrogenFixer', () => {
    let mockStructure;
    let hydrogenFixer;

    beforeEach(() => {
        // Create a simple unit cell
        const unitCell = new UnitCell(10, 10, 10, 90, 90, 90);

        // Create atoms including isolated hydrogen
        const atoms = [
            new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
            new Atom('O1', 'O', new FractPosition(0.2, 0.2, 0.2)),
            // Bonded hydrogen
            new Atom('H1', 'H', new FractPosition(0.15, 0.15, 0.15)),
            // Isolated hydrogen - close to C1
            new Atom('H2', 'H', new FractPosition(0.108, 0.11, 0.11)),
            // Isolated hydrogen - close to O1
            new Atom('H3', 'H', new FractPosition(0.21, 0.19, 0.21)),
            // Isolated hydrogen - not close to any atom
            new Atom('H4', 'H', new FractPosition(0.5, 0.5, 0.5)),
        ];

        // Create bonds (only H1 is bonded)
        const bonds = [
            new Bond('C1', 'H1', 1.0, null, '.'),
        ];

        // Mock structure with connected groups
        mockStructure = new CrystalStructure(unitCell, atoms, bonds);

        // Create fixer with default settings
        hydrogenFixer = new IsolatedHydrogenFixer();
    });

    it('should initialize with correct default values', () => {
        expect(hydrogenFixer.mode).toBe('off');
        expect(hydrogenFixer.maxBondDistance).toBe(1.1);

        const customFixer = new IsolatedHydrogenFixer('on', 1.5);
        expect(customFixer.mode).toBe('on');
        expect(customFixer.maxBondDistance).toBe(1.5);
    });

    it('should correctly detect applicable modes', () => {
        const modes = hydrogenFixer.getApplicableModes(mockStructure);
        expect(modes).toContain('on');
        expect(modes.length).toBe(1);

        // Structure with no bonds should only offer OFF mode
        const noBondsStructure = new CrystalStructure(
            mockStructure.cell,
            mockStructure.atoms,
            [],
            [],
        );

        const noBondModes = hydrogenFixer.getApplicableModes(noBondsStructure);
        expect(noBondModes).toEqual(['off']);

        // Structure without isolated hydrogen atoms has only OFF
        const noIsolatedHStructure = new CrystalStructure(
            mockStructure.cell,
            mockStructure.atoms.slice(0, 3),
            mockStructure.bonds,
            [],
        );

        const noIsolatedModes = hydrogenFixer.getApplicableModes(noIsolatedHStructure);
        expect(noIsolatedModes).toEqual(['off']);
    });

    it('should correctly identify isolated hydrogen atoms', () => {
        // Access private method for testing
        const isolatedHydrogens = hydrogenFixer.findIsolatedHydrogenAtoms(mockStructure);

        expect(isolatedHydrogens.length).toBe(3);
        expect(isolatedHydrogens[0].atom.label).toBe('H2');
        expect(isolatedHydrogens[1].atom.label).toBe('H3');
        expect(isolatedHydrogens[2].atom.label).toBe('H4');
    });

    it('should create bonds for isolated hydrogens in ON mode', () => {
        hydrogenFixer.mode = 'on';
        const result = hydrogenFixer.apply(mockStructure);

        // Should be a new structure with additional bonds
        expect(result).not.toBe(mockStructure);

        // Should have more bonds than original
        expect(result.bonds.length).toBeGreaterThan(mockStructure.bonds.length);

        // Check bonds were created for H2 and H3 to nearest atoms
        const h2Bond = result.bonds.find(b =>
            (b.atom1Id === 'C1|1_555' && b.atom2Id === 'H2|1_555') ||
            (b.atom1Id === 'H2|1_555' && b.atom2Id === 'C1|1_555'),
        );
        expect(h2Bond).toBeTruthy();

        const h3Bond = result.bonds.find(b =>
            (b.atom1Id === 'O1|1_555' && b.atom2Id === 'H3|1_555') ||
            (b.atom1Id === 'H3|1_555' && b.atom2Id === 'O1|1_555'),
        );
        expect(h3Bond).toBeTruthy();
    });

    it('should limit bonds to the maximum distance', () => {
        // Set a very small max distance
        hydrogenFixer.maxBondDistance = 0.2;
        hydrogenFixer.mode = 'on';

        const result = hydrogenFixer.apply(mockStructure);

        // Should only create bonds for H2 and H3, not for distant H4
        expect(result.bonds.length).toBe(3); // Original + 2 new

        // Check no bond was created for H4
        const h4Bond = result.bonds.find(b =>
            b.atom1Id === 'H4|1_555' || b.atom2Id === 'H4|1_555',
        );
        expect(h4Bond).toBeFalsy();
    });

    it('should not bond hydrogens to other hydrogens', () => {
        // Create a structure with two close hydrogens
        const unitCell = new UnitCell(10, 10, 10, 90, 90, 90);

        const atoms = [
            new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1)),
            new Atom('O1', 'O', new FractPosition(0.2, 0.1, 0.1)),
            new Atom('H1', 'H', new FractPosition(0.105, 0.15, 0.15)),
            new Atom('H2', 'H', new FractPosition(0.106, 0.105, 0.15)), // Very close to H1
        ];

        // Create a preexisting bond between C1 and O1
        const bonds = [
            new Bond('C1', 'O1', 1.0, null, '.'),
        ];

        const testStructure = new CrystalStructure(unitCell, atoms, bonds);

        hydrogenFixer.mode = 'on';
        const result = hydrogenFixer.apply(testStructure);

        // Should have 3 bonds total: 1 preexisting + 2 new hydrogen bonds
        expect(result.bonds.length).toBe(3);

        // Check for bonds to C1
        const h1Bond = result.bonds.find(b =>
            (b.atom1Id === 'C1|1_555' && b.atom2Id === 'H1|1_555') ||
            (b.atom1Id === 'H1|1_555' && b.atom2Id === 'C1|1_555'),
        );
        expect(h1Bond).toBeTruthy();

        const h2Bond = result.bonds.find(b =>
            (b.atom1Id === 'O1|1_555' && b.atom2Id === 'H2|1_555') ||
            (b.atom1Id === 'H2|1_555' && b.atom2Id === 'O1|1_555'),
        );
        expect(h2Bond).toBeTruthy();

        // No H-H bond should exist
        const hhBond = result.bonds.find(b =>
            (b.atom1Id === 'H1|1_555' && b.atom2Id === 'H2|1_555') ||
            (b.atom1Id === 'H2|1_555' && b.atom2Id === 'H1|1_555'),
        );
        expect(hhBond).toBeFalsy();
    });

    it('should respect disorder groups when creating bonds', () => {
        // Create a structure with atoms in different disorder groups
        const unitCell = new UnitCell(10, 10, 10, 90, 90, 90);

        const atoms = [
            new Atom('C1', 'C', new FractPosition(0.1, 0.1, 0.1), null, 1),  // Group 1
            new Atom('O1', 'O', new FractPosition(0.12, 0.1, 0.1), null, 1),  // Group 1
            new Atom('C2', 'C', new FractPosition(0.15, 0.1, 0.1), null, 2),  // Group 2
            new Atom('O2', 'O', new FractPosition(0.17, 0.1, 0.1), null, 2),  // Group 2
            new Atom('H1', 'H', new FractPosition(0.12, 0.12, 0.12), null, 1), // Group 1
            new Atom('H2', 'H', new FractPosition(0.17, 0.12, 0.12), null, 2), // Group 2
            new Atom('H3', 'H', new FractPosition(0.13, 0.11, 0.11), null, 0),  // Group 0 (can bond to any)
        ];

        // Create preexisting bonds between C and O in each group
        const bonds = [
            new Bond('C1', 'O1', 1.0, null, '.'),
            new Bond('C2', 'O2', 1.0, null, '.'),
        ];

        const testStructure = new CrystalStructure(unitCell, atoms, bonds);

        hydrogenFixer.mode = 'on';
        const result = hydrogenFixer.apply(testStructure);

        // Should have 5 bonds total: 2 preexisting + 3 new hydrogen bonds
        expect(result.bonds.length).toBe(5);

        // Check H1 bonds to C1 (same group)
        const h1Bond = result.bonds.find(b =>
            (b.atom1Id === 'O1|1_555' && b.atom2Id === 'H1|1_555') ||
            (b.atom1Id === 'H1|1_555' && b.atom2Id === 'O1|1_555'),
        );
        expect(h1Bond).toBeTruthy();

        // Check H2 bonds to C2 (same group)
        const h2Bond = result.bonds.find(b =>
            (b.atom1Id === 'O2|1_555' && b.atom2Id === 'H2|1_555') ||
            (b.atom1Id === 'H2|1_555' && b.atom2Id === 'O2|1_555'),
        );
        expect(h2Bond).toBeTruthy();

        // Check H3 (group 0) bonds to nearest atom regardless of group
        const h3Bond = result.bonds.find(b =>
            b.atom1Id === 'H3|1_555' || b.atom2Id === 'H3|1_555',
        );
        expect(h3Bond).toBeTruthy();

        // H3 should bond to C1 as it's closer
        expect(h3Bond.atom1Id === 'O2|1_555' || h3Bond.atom2Id === 'O2|1_555').toBeTruthy();
    });
});