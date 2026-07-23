import { readFileSync } from 'fs';
import { CIF, CrystalStructure, SymmetryGrower } from '../src/index.nobrowser.js';

const filePath = process.argv[2];
const content = readFileSync(filePath, 'utf8');
const cif = new CIF(content);
const block = cif.getBlock(0);
const structure = CrystalStructure.fromCIF(block);

const grower = new SymmetryGrower(SymmetryGrower.MODES.FRAGMENT);
for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    grower.apply(structure);
    console.log(`run ${i}: ${(performance.now() - t0).toFixed(0)}ms`);
}
