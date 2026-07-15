// Cold-start (fresh process) timing for the FULL default rendering pipeline:
// parse -> CrystalStructure -> all six structure modifiers (same order as
// crystal-viewer.js) -> ORTEP3JsStructure.
import { readFileSync } from 'fs';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';
import {
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/lib/structure/structure-modifiers/modes.js';
import {
    AtomLabelFilter, BondGenerator,
} from '../src/lib/structure/structure-modifiers/fixers.js';
import defaultSettings from '../src/lib/ortep3d/structure-settings.js';

const filePath = process.argv[2];
const t0 = performance.now();
const text = readFileSync(filePath, 'utf8');
const cif = new CIF(text);
const block = cif.getBlock(0);
let hasExplicitBonds = false;
try {
    block.get('_geom_bond');
    hasExplicitBonds = true;
} catch {
    hasExplicitBonds = false;
}
const t1 = performance.now();
let structure = CrystalStructure.fromCIF(block);
const startAtoms = structure.atoms.length;
const t2 = performance.now();

const modifiers = {
    removeatoms: new AtomLabelFilter(),
    missingbonds: new BondGenerator(defaultSettings.elementProperties, defaultSettings.bondGrowTolerance),
    disorder: new DisorderFilter(defaultSettings.disorderMode),
    symmetry: new SymmetryGrower(defaultSettings.symmetryMode),
    hydrogen: new HydrogenFilter(defaultSettings.hydrogenMode),
};
const modifierTimes = {};
for (const [name, modifier] of Object.entries(modifiers)) {
    modifier.ensureValidMode(structure);
    const mt0 = performance.now();
    structure = modifier.apply(structure);
    modifierTimes[name] = +(performance.now() - mt0).toFixed(3);
}
const t3 = performance.now();

// eslint-disable-next-line no-unused-vars
const ortep = new ORTEP3JsStructure(structure);
const t4 = performance.now();

console.log(JSON.stringify({
    file: filePath,
    hasExplicitBonds,
    atoms: startAtoms,
    parse: +(t1 - t0).toFixed(2),
    structureBuild: +(t2 - t1).toFixed(2),
    modifiers: +(t3 - t2).toFixed(2),
    modifierTimes,
    ortep: +(t4 - t3).toFixed(2),
    total: +(t4 - t0).toFixed(2),
}));
