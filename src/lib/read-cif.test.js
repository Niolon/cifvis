import { CIF, CifBlock } from './read-cif.js';

describe('CIF Parser', () => {
  describe('CIF class', () => {
    test('parses multiple data blocks', () => {
      const cif = new CIF(`data_block1
_cell_length_a 5.4309(5)

data_block2
_cell_length_a 3.2468(3)`);
      
      const blocks = cif.getAllBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0].dataBlockName).toBe('block1');
      expect(blocks[1].dataBlockName).toBe('block2');
    });

    test('handles empty input', () => {
      const cif = new CIF('');
      const blocks = cif.getAllBlocks();
      expect(blocks).toEqual([]);
    });

    test('gets single block by index', () => {
      const cif = new CIF(`
data_block1
_cell_length_a 5.4309(5)`);
      
      const block = cif.getBlock(0);
      expect(block.dataBlockName).toBe('block1');
      expect(block.get('_cell_length_a')).toBe(5.4309);
    });
  });

  describe('CifBlock class', () => {
    test('parses standard uncertainty values', () => {
      const block = new CifBlock(`test
_cell_length_a 123.456(7)
_cell_length_b -123.456(7)
_cell_length_c 123(7)`);
      
      expect(block.get('_cell_length_a')).toBe(123.456);
      expect(block.get('_cell_length_a_su')).toBe(0.007);
      expect(block.get('_cell_length_b')).toBe(-123.456);
      expect(block.get('_cell_length_b_su')).toBe(0.007);
      expect(block.get('_cell_length_c')).toBe(123);
      expect(block.get('_cell_length_c_su')).toBe(7);
    });

    test('parses quoted strings', () => {
      const block = new CifBlock(`test
_string1 "Hello"
_string2 'World'`);
      
      expect(block.get('_string1')).toBe('Hello');
      expect(block.get('_string2')).toBe('World');
    });

    test('handles comments', () => {
      const block = new CifBlock(`data_test
_cell_length_a 5.4309(5) # inline comment
# full line comment
_cell_length_b 5.4309(5)`);
      
      expect(block.get('_cell_length_a')).toBe(5.4309);
      expect(block.get('_cell_length_b')).toBe(5.4309);
    });

    test('preserves # in quoted strings', () => {
      const block = new CifBlock(`data_test
_note1 "text with # inside" # comment`);
      
      expect(block.get('_note1')).toBe('text with # inside');
    });

    test('handles values on next line', () => {
      const block = new CifBlock(`data_test
_diffrn_measurement_device   
 'XtaLAB Synergy-S'
_diffrn_measurement_method   
 'phi and omega scans'
_chemical_formula_sum
 'C10 H16 N2 O4'`);
      
      expect(block.get('_diffrn_measurement_device')).toBe('XtaLAB Synergy-S');
      expect(block.get('_diffrn_measurement_method')).toBe('phi and omega scans');
      expect(block.get('_chemical_formula_sum')).toBe('C10 H16 N2 O4');
    });

    test('parses basic loop', () => {
      const block = new CifBlock(`test
loop_
_atom_site_label
_atom_site_type
C1 C
O1 O`);
      
      const loop = block.get('_atom_site');
      expect(loop.get('_atom_site_label')).toEqual(['C1', 'O1']);
      expect(loop.get('_atom_site_type')).toEqual(['C', 'O']);
    });

    test('parses loop with uncertainties', () => {
      const block = new CifBlock(`test
loop_
_cell_length_a
_cell_length_b
5.4309(5) 5.4309(5)`);
      
      const loop = block.get('_cell_length');
      expect(loop.get('_cell_length_a')).toEqual([5.4309]);
      expect(loop.get('_cell_length_a_su')).toEqual([0.0005]);
    });
  });
});