import { 
    normalizeAtomLabel, 
    createLabelMap, 
    reconcileAtomLabels, 
    atomLabelsMatch,
} from './reconcile-labels.js';
import { CIF } from '../read-cif/base.js';

describe('normalizeAtomLabel', () => {
    test('basic normalization (without suffixes)', () => {
        expect(normalizeAtomLabel('h2a')).toBe('H2A');
        expect(normalizeAtomLabel('H(2)A')).toBe('H2A');
        expect(normalizeAtomLabel('C[12]')).toBe('C12');
        expect(normalizeAtomLabel('O{1}')).toBe('O1');
    });

    test('suffix normalization only removes specific patterns', () => {
        // These should be normalized
        expect(normalizeAtomLabel('H2A^1', true)).toBe('H2A');
        expect(normalizeAtomLabel('O2^A', true)).toBe('O2');
        expect(normalizeAtomLabel('C1_$1', true)).toBe('C1');
        expect(normalizeAtomLabel('N3_$2', true)).toBe('N3');
        expect(normalizeAtomLabel('H2A^12', true)).toBe('H2A');
        expect(normalizeAtomLabel('O2^AB', true)).toBe('O2');
        expect(normalizeAtomLabel('C1_$12', true)).toBe('C1');
        
        // These should remain unchanged
        expect(normalizeAtomLabel('N3_$A', true)).toBe('N3_$A');
    });

    test('suffix handling is optional', () => {
        expect(normalizeAtomLabel('H2A^1', false)).toBe('H2A^1');
        expect(normalizeAtomLabel('C1_$1', false)).toBe('C1_$1');
    });

    test('preserves other special characters', () => {
        expect(normalizeAtomLabel('Fe_2', true)).toBe('FE_2');
        expect(normalizeAtomLabel('C/1', true)).toBe('C/1');
        expect(normalizeAtomLabel('N-1', true)).toBe('N-1');
    });

    test('throws on empty and invalid inputs', () => {
        expect(() => normalizeAtomLabel('')).toThrow('Empty atom label');
        expect(() => normalizeAtomLabel('()')).toThrow('normalizes to empty string');
        expect(() => normalizeAtomLabel(null)).toThrow('Empty atom label');
        expect(() => normalizeAtomLabel(undefined)).toThrow('Empty atom label');
    });
});

describe('createLabelMap', () => {
    test('handles basic normalization', () => {
        const labels = ['H2A', 'Fe(2)', 'c1'];
        const map = createLabelMap(labels);
        
        expect(map.get('H2A')).toBe('H2A');
        expect(map.get('FE2')).toBe('Fe(2)');
        expect(map.get('C1')).toBe('c1');
    });

    test('creates maps with suffix handling', () => {
        const labels = ['H2A^1', 'Fe2', 'C1_$1'];
        const map = createLabelMap(labels, true);
        
        expect(map.get('H2A')).toBe('H2A^1');
        expect(map.get('FE2')).toBe('Fe2');
        expect(map.get('C1')).toBe('C1_$1');
    });

    test('skips ambiguous mappings - basic', () => {
        const labels = ['H2A', 'h2a', 'H(2)A'];
        const consoleSpy = jest.spyOn(console, 'warn');
        const map = createLabelMap(labels);
        
        expect(map.has('H2A')).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Multiple labels map to H2A:'),
        );
        consoleSpy.mockRestore();
    });

    test('skips ambiguous mappings - with suffixes', () => {
        const labels = ['H2A^1', 'H2A', 'H2A_$1'];
        const consoleSpy = jest.spyOn(console, 'warn');
        const map = createLabelMap(labels, true);
        
        expect(map.has('H2A')).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Multiple labels map to H2A:'),
        );
        consoleSpy.mockRestore();
    });

    test('handles invalid labels', () => {
        const labels = ['H2A', '', 'C1', '()'];
        const consoleSpy = jest.spyOn(console, 'warn');
        const map = createLabelMap(labels);
        
        expect(map.has('H2A')).toBe(true);
        expect(map.has('C1')).toBe(true);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Empty atom label'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('normalizes to empty string'));
        consoleSpy.mockRestore();
    });
});

describe('reconcileAtomLabels', () => {
    function createTestCif(bondLabels, atomLabels) {
        const cifText = `
data_test
loop_
_atom_site.label
${atomLabels.join('\n')}

loop_
_geom_bond.id
_geom_bond.atom_site_label_1
1 ${bondLabels[0]}
2 ${bondLabels[1]}
`;
        const cif = new CIF(cifText);
        return cif.getBlock();
    }

    test('basic reconciliation without suffixes', () => {
        const block = createTestCif(
            ['h2a', 'Fe(2)'],     // Bond labels
            ['H2A', 'Fe2'],       // Atom site labels
        );
        
        const bondLoop = block.get('_geom_bond');
        const atomSite = block.get('_atom_site');
        const refLabels = atomSite.get('_atom_site.label');
        
        reconcileAtomLabels(bondLoop, '_geom_bond.atom_site_label_1', refLabels);
        expect(bondLoop.get('_geom_bond.atom_site_label_1')).toEqual(['H2A', 'Fe2']);
    });

    test('reconciliation with suffixes', () => {
        const block = createTestCif(
            ['H2A^1', 'C1_$1'],   // Bond labels
            ['H2A', 'C1'],        // Atom site labels
        );
        
        const bondLoop = block.get('_geom_bond');
        const atomSite = block.get('_atom_site');
        const refLabels = atomSite.get('_atom_site.label');
        
        reconcileAtomLabels(
            bondLoop, 
            '_geom_bond.atom_site_label_1', 
            refLabels,
            true,  // Enable suffix handling
        );
        expect(bondLoop.get('_geom_bond.atom_site_label_1')).toEqual(['H2A', 'C1']);
    });

    test('uses original values for non-matching labels', () => {
        const block = createTestCif(
            ['H3B', 'Fe(2)'],     // Bond labels
            ['H2A', 'Fe2'],       // Atom site labels
        );
        
        const bondLoop = block.get('_geom_bond');
        const atomSite = block.get('_atom_site');
        const refLabels = atomSite.get('_atom_site.label');
        
        reconcileAtomLabels(
            bondLoop,
            '_geom_bond.atom_site_label_1',
            refLabels,
            '_geom_bond.atom_site_label_1',  // Fallback to original
        );
        expect(bondLoop.get('_geom_bond.atom_site_label_1')).toEqual(['H3B', 'Fe2']);
    });

    test('preserves other loop data', () => {
        const block = createTestCif(
            ['h2a_$1', 'Fe(2)'],
            ['H2A', 'Fe2'],
        );
        
        const bondLoop = block.get('_geom_bond');
        const atomSite = block.get('_atom_site');
        const refLabels = atomSite.get('_atom_site.label');
        
        reconcileAtomLabels(
            bondLoop,
            '_geom_bond.atom_site_label_1',
            refLabels,
            true,
        );
        
        // Check loop integrity
        expect(bondLoop.get('_geom_bond.id')).toEqual([1, 2]);
        expect(bondLoop.getHeaders()).toEqual(bondLoop.getHeaders());
    });
});

describe('atomLabelsMatch', () => {
    test('basic matching without suffixes', () => {
        expect(atomLabelsMatch('H2A', 'h2a')).toBe(true);
        expect(atomLabelsMatch('H(2)A', 'H2A')).toBe(true);
        expect(atomLabelsMatch('Fe[2]', 'FE2')).toBe(true);
        expect(atomLabelsMatch('H2A', 'H2B')).toBe(false);
    });

    test('matching with suffixes enabled', () => {
        expect(atomLabelsMatch('H2A^1', 'H2A', true)).toBe(true);
        expect(atomLabelsMatch('C1_$1', 'C1', true)).toBe(true);
        expect(atomLabelsMatch('O2^A', 'O2', true)).toBe(true);
        expect(atomLabelsMatch('H2A^1', 'H2B^1', true)).toBe(false);
        expect(atomLabelsMatch('H2A^12', 'H2A', true)).toBe(true);
        expect(atomLabelsMatch('O2^AA', 'O2', true)).toBe(true);

    });

    test('suffix handling is optional', () => {
        expect(atomLabelsMatch('H2A^1', 'H2A', false)).toBe(false);
        expect(atomLabelsMatch('C1_$1', 'C1_$2', false)).toBe(false);
        expect(atomLabelsMatch('C1_$12', 'C1', true)).toBe(true);
    });

    test('throws on invalid inputs', () => {
        expect(() => atomLabelsMatch('', 'H1')).toThrow('Empty atom label');
        expect(() => atomLabelsMatch('()', 'H1')).toThrow('normalizes to empty string');
        expect(() => atomLabelsMatch(null, 'H1')).toThrow('Empty atom label');
        expect(() => atomLabelsMatch(undefined, 'H1')).toThrow('Empty atom label');
    });
});