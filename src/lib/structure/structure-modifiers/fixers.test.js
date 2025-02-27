import { 
    AtomLabelFilter, BondGenerator,
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