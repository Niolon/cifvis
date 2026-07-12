/**
 * Debug: Run growCell and see debug output
 */

import { readFileSync } from 'fs';
import { CrystalStructure } from './src/lib/structure/crystal.js';
import { growCell } from './src/lib/structure/structure-modifiers/growing/grow-cell.js';
import { CIF } from './src/lib/read-cif/base.js';

const cifContent = readFileSync('./demo/public/cif/urea.cif', 'utf-8');
const cif = new CIF(cifContent);
const structure = CrystalStructure.fromCIF(cif.getBlock(0));

console.log('Running growCell with debug logging...\n');
const cellGrown = growCell(structure, true);

console.log('\n=== Final H-bonds with N|1_555 and O|2_556 ===');
cellGrown.hBonds.filter(hb =>
    hb.donorAtomId === 'N|1_555' && hb.acceptorAtomId === 'O|2_556',
).forEach(hb => {
    console.log(`  ${hb.donorAtomId} - ${hb.hydrogenAtomId} ... ${hb.acceptorAtomId}`);
});
