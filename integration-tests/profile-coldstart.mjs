// Measures pure cold-start cost: one file, one fresh process, no JIT warmup.
// This approximates "first structure a user sees after loading the page".
import { readFileSync } from 'fs';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';

const filePath = process.argv[2];
const t0 = performance.now();
const text = readFileSync(filePath, 'utf8');
const t1 = performance.now();
const cif = new CIF(text);
const block = cif.getBlock(0);
const t2 = performance.now();
const structure = CrystalStructure.fromCIF(block);
const t3 = performance.now();
// eslint-disable-next-line no-unused-vars
const ortep = new ORTEP3JsStructure(structure);
const t4 = performance.now();

console.log(JSON.stringify({
    file: filePath,
    atoms: structure.atoms.length,
    read: +(t1 - t0).toFixed(2),
    parse: +(t2 - t1).toFixed(2),
    structure: +(t3 - t2).toFixed(2),
    ortep: +(t4 - t3).toFixed(2),
    total: +(t4 - t0).toFixed(2),
}));
