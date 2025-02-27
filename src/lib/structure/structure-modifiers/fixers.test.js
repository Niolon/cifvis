import { CrystalStructure, UnitCell, Atom } from '../crystal.js';
import { FractPosition } from '../position.js';
import { Bond } from '../bonds.js';
import { 
    AtomLabelFilter, BondGenerator, IsolatedHydrogenFixer,
} from './fixers.js';
import { MockStructure } from './base.test.js';

describe('AtomLabelFilter', () => {
    test('constructs with empty filter list', () => {
        const filter = new AtomLabelFilter();
        expect(filter.mode).toBe(AtomLabelFilter.MODES.OFF);
        expect(filter.filteredLabels.size).toBe(0);
    });

    test('constructs with filter list', () => {
        const filter = new AtomLabelFilter(['C1', 'O1']);
        expect(filter.filteredLabels.size).toBe(2);
        expect(filter.filteredLabels.has('C1')).toBe(true);
        expect(filter.filteredLabels.has('O1')).toBe(true);
    });

    test('allows updating filter list', () => {
        const filter = new AtomLabelFilter(['C1']);
        filter.setFilteredLabels(['O1', 'N1']);
        expect(filter.filteredLabels.size).toBe(2);
        expect(filter.filteredLabels.has('C1')).toBe(false);
        expect(filter.filteredLabels.has('O1')).toBe(true);
        expect(filter.filteredLabels.has('N1')).toBe(true);
    });

    test('returns original structure when filter off', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true }).build();
        const filter = new AtomLabelFilter(['C1', 'O1'], AtomLabelFilter.MODES.OFF);
        
        const filtered = filter.apply(structure);
        expect(filtered).toBe(structure);
    });

    test('filters atoms and related bonds', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true }).build();
        const filter = new AtomLabelFilter(['C1'], AtomLabelFilter.MODES.ON);
        
        const filtered = filter.apply(structure);
        expect(filtered.atoms.some(atom => atom.label === 'C1')).toBe(false);
        expect(filtered.bonds.some(bond => 
            bond.atom1Label === 'C1' || bond.atom2Label === 'C1',
        )).toBe(false);
    });

    test('filters atoms and related h-bonds', () => {
        const structure = MockStructure.createDefault({ hasHydrogens: true }).build();
        const filter = new AtomLabelFilter(['O1'], AtomLabelFilter.MODES.ON);
        
        const filtered = filter.apply(structure);
        expect(filtered.hBonds.some(hbond => 
            hbond.donorAtomLabel === 'O1' || 
            hbond.hydrogenAtomLabel === 'H1' ||
            hbond.acceptorAtomLabel === 'O1',
        )).toBe(false);
    });

    test('returns both applicable modes', () => {
        const filter = new AtomLabelFilter();
        const modes = filter.getApplicableModes();
        expect(modes).toEqual([
            AtomLabelFilter.MODES.ON,
            AtomLabelFilter.MODES.OFF,
        ]);
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

        const toleranceFactor = 1.3;

        generator = new BondGenerator(elementProperties, toleranceFactor);
    });

    describe('getMaxBondDistance', () => {
        test('calculates correct distance for element pair', () => {
            const distance = generator.getMaxBondDistance('C', 'O', elementProperties);
            expect(distance).toBeCloseTo((0.76 + 0.66) * 1.3);
        });

        test('throws error for unknown elements', () => {
            expect(() => {
                generator.getMaxBondDistance('C', 'Xx', elementProperties);
            }).toThrow('Missing radius for element Xx');
        });

        test('handles different tolerance factors', () => {
            const strictGenerator = new BondGenerator(elementProperties, 1.1);

            const looseGenerator = new BondGenerator(elementProperties, 1.5);

            const strictDistance = strictGenerator.getMaxBondDistance(
                'C', 'O', elementProperties,
            );
            const looseDistance = looseGenerator.getMaxBondDistance(
                'C', 'O', elementProperties,
            );

            expect(looseDistance).toBeGreaterThan(strictDistance);
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
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)
                .addBond('C1', 'O1', '.', 1.5, 0.01)  // Bond with custom parameters
                .build();

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
            const structure = new MockStructure()
                .addAtom('C1', 'C', 0, 0, 0)
                .addAtom('O1', 'O', 0.1, 0, 0)  // Close enough for bond
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
            expect(result.bonds[0].atom1Label).toBe('C1');
            expect(result.bonds[0].atom2Label).toBe('O1');
        });

        test('can handle ion atom types', () => {
            const structure = new MockStructure()
                .addAtom('C1', 'C1+', 0, 0, 0)
                .addAtom('O1', 'O-2', 0.1, 0, 0)
                .build();

            generator.mode = BondGenerator.MODES.CREATE;
            const result = generator.apply(structure);

            expect(result.bonds.length).toBe(1);
            expect(result.bonds[0].atom1Label).toBe('C1');
            expect(result.bonds[0].atom2Label).toBe('O1');
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
                b.atom1Label === 'H1' || b.atom2Label === 'H1',
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
                b.atom1Label === 'C1' && b.atom2Label === 'O1' && b.atom2SiteSymmetry === '2_555',
            );
            expect(symBond).toBeTruthy();
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
        
        // Create connected groups
        const connectedGroups = [
            {
                atoms: [atoms[0], atoms[2]], // C1 and H1
                bonds: [bonds[0]],
                hBonds: [],
            },
            {
                atoms: [atoms[1]], // O1
                bonds: [],
                hBonds: [],
            },
            {
                atoms: [atoms[3]], // H2 (isolated)
                bonds: [],
                hBonds: [],
            },
            {
                atoms: [atoms[4]], // H3 (isolated)
                bonds: [],
                hBonds: [],
            },
            {
                atoms: [atoms[5]], // H4 (isolated)
                bonds: [],
                hBonds: [],
            },
        ];
        
        // Mock structure with connected groups
        mockStructure = new CrystalStructure(unitCell, atoms, bonds);
        mockStructure.connectedGroups = connectedGroups;
        
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
        // Structure with isolated hydrogens should offer ON and OFF modes
        const modes = hydrogenFixer.getApplicableModes(mockStructure);
        expect(modes).toContain('on');
        expect(modes).toContain('off');
        expect(modes.length).toBe(2);
        
        // Structure with no bonds should only offer OFF mode
        const noBondsStructure = new CrystalStructure(
            mockStructure.cell,
            mockStructure.atoms,
            [],
            [],
        );
        noBondsStructure.connectedGroups = mockStructure.connectedGroups;
        
        const noIsolatedHStructure = new CrystalStructure(
            mockStructure.cell,
            mockStructure.atoms,
            mockStructure.bonds,
            [],
        );
        // Mock no isolated H atoms
        noIsolatedHStructure.connectedGroups = [
            {
                atoms: mockStructure.atoms,
                bonds: mockStructure.bonds,
                hBonds: [],
            },
        ];
        
        const noIsolatedModes = hydrogenFixer.getApplicableModes(noIsolatedHStructure);
        expect(noIsolatedModes).toEqual(['off']);
    });
    
    it('should return structure unchanged in OFF mode', () => {
        hydrogenFixer.mode = 'off';
        const result = hydrogenFixer.apply(mockStructure);
        
        // Should be the same structure
        expect(result).toBe(mockStructure);
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
            (b.atom1Label === 'C1' && b.atom2Label === 'H2') || 
            (b.atom1Label === 'H2' && b.atom2Label === 'C1'),
        );
        expect(h2Bond).toBeTruthy();
        
        const h3Bond = result.bonds.find(b => 
            (b.atom1Label === 'O1' && b.atom2Label === 'H3') || 
            (b.atom1Label === 'H3' && b.atom2Label === 'O1'),
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
            b.atom1Label === 'H4' || b.atom2Label === 'H4',
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
            (b.atom1Label === 'C1' && b.atom2Label === 'H1') || 
            (b.atom1Label === 'H1' && b.atom2Label === 'C1'),
        );
        expect(h1Bond).toBeTruthy();
        
        const h2Bond = result.bonds.find(b => 
            (b.atom1Label === 'O1' && b.atom2Label === 'H2') || 
            (b.atom1Label === 'H2' && b.atom2Label === 'O1'),
        );
        expect(h2Bond).toBeTruthy();
        
        // No H-H bond should exist
        const hhBond = result.bonds.find(b => 
            (b.atom1Label === 'H1' && b.atom2Label === 'H2') || 
            (b.atom1Label === 'H2' && b.atom2Label === 'H1'),
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
            (b.atom1Label === 'O1' && b.atom2Label === 'H1') || 
            (b.atom1Label === 'H1' && b.atom2Label === 'O1'),
        );
        expect(h1Bond).toBeTruthy();
        
        // Check H2 bonds to C2 (same group)
        const h2Bond = result.bonds.find(b => 
            (b.atom1Label === 'O2' && b.atom2Label === 'H2') || 
            (b.atom1Label === 'H2' && b.atom2Label === 'O2'),
        );
        expect(h2Bond).toBeTruthy();
        
        // Check H3 (group 0) bonds to nearest atom regardless of group
        const h3Bond = result.bonds.find(b => 
            b.atom1Label === 'H3' || b.atom2Label === 'H3',
        );
        expect(h3Bond).toBeTruthy();
        
        // H3 should bond to C1 as it's closer
        expect(h3Bond.atom1Label === 'O2' || h3Bond.atom2Label === 'O2').toBeTruthy();
    });
});