import { tryToFixCifBlock } from './base.js';
import { CIF } from '../read-cif/base.js';

describe('tryToFixCifBlock', () => {
    test('reconciles ADP labels', () => {
        const cifText = `
data_test
loop_
_atom_site.label
H2A
C1

loop_
_atom_site_aniso.label
h2a
c1`;
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        
        tryToFixCifBlock(block, true, false, false);
        
        const anisoLabels = block.get('_atom_site_aniso').get('_atom_site_aniso.label');
        expect(anisoLabels).toEqual(['H2A', 'C1']);
    });

    test('reconciles bond labels and symmetry', () => {
        const cifText = `
data_test
loop_
_atom_site.label
H2A
C1

loop_
_geom_bond.atom_site_label_1
_geom_bond.atom_site_label_2
_geom_bond.site_symmetry_2
h2a C1 2-555
c1 H2A 12_565`;
        const cif = new CIF(cifText);
        const block = cif.getBlock();
        
        tryToFixCifBlock(block, false, true, true);
        
        const bondLoop = block.get('_geom_bond');
        expect(bondLoop.get('_geom_bond.atom_site_label_1')).toEqual(['H2A', 'C1']);
        expect(bondLoop.get('_geom_bond.site_symmetry_2')).toEqual(['2_555', '12_565']);
    });

    test('reconciles h-bond labels and symmetry', () => {
        const cifText = `
data_test
loop_
_atom_site.label
H2A
C1
O1

loop_
_geom_hbond.atom_site_label_d
_geom_hbond.atom_site_label_h  
_geom_hbond.atom_site_label_a
_geom_hbond.site_symmetry_a
h2a C1 o1 2-555
c1 H2A O1 12_565`;
        const cif = new CIF(cifText);
        const block = cif.getBlock();
        
        tryToFixCifBlock(block, false, true, true);
        
        const hbondLoop = block.get('_geom_hbond');
        expect(hbondLoop.get('_geom_hbond.atom_site_label_d')).toEqual(['H2A', 'C1']);
        expect(hbondLoop.get('_geom_hbond.atom_site_label_a')).toEqual(['O1', 'O1']);
        expect(hbondLoop.get('_geom_hbond.site_symmetry_a')).toEqual(['2_555', '12_565']);
    });

    test('handles missing optional data gracefully', () => {
        const cifText = `
data_test
loop_
_atom_site.label
H2A
C1`;
        const cif = new CIF(cifText);
        const block = cif.getBlock();
        
        expect(() => tryToFixCifBlock(block)).not.toThrow();
    });
});