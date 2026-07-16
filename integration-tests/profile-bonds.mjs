// Profiles the FULL default rendering pipeline (parse -> CrystalStructure ->
// all six structure modifiers, in the same order crystal-viewer.js runs them
// -> ORTEP3JsStructure), split by whether the source CIF carries an explicit
// _geom_bond loop or not, to quantify the cost of on-the-fly bond generation.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { CIF, CrystalStructure, ORTEP3JsStructure } from '../src/index.nobrowser.js';
import {
    HydrogenFilter, DisorderFilter, SymmetryGrower,
} from '../src/lib/structure/structure-modifiers/modes.js';
import {
    AtomLabelFilter, BondGenerator,
} from '../src/lib/structure/structure-modifiers/fixers.js';
import defaultSettings from '../src/lib/ortep3d/structure-settings.js';

const COD_DIR = process.argv[2] || '/home/niklas/cod/cif';
const SAMPLE_SIZE = parseInt(process.argv[3] || '400', 10);

function sampleFiles() {
    const raw = execSync(
        `find "${COD_DIR}" -maxdepth 4 -name "*.cif" | shuf -n ${SAMPLE_SIZE}`,
        { maxBuffer: 1024 * 1024 * 50 },
    ).toString().trim();
    return raw.split('\n').filter(Boolean);
}

function now() {
    return performance.now();
}

function buildModifiers() {
    return {
        removeatoms: new AtomLabelFilter(),
        missingbonds: new BondGenerator(defaultSettings.elementProperties, defaultSettings.bondGrowTolerance),
        disorder: new DisorderFilter(defaultSettings.disorderMode),
        symmetry: new SymmetryGrower(defaultSettings.symmetryMode),
        hydrogen: new HydrogenFilter(defaultSettings.hydrogenMode),
    };
}

const withBonds = [];
const withoutBonds = [];
let failures = 0;

const files = sampleFiles();
console.log(`Sampled ${files.length} CIF files from ${COD_DIR}`);

for (const filePath of files) {
    try {
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

        const t0 = now();
        const structure0 = CrystalStructure.fromCIF(block);
        const t1 = now();

        const modifiers = buildModifiers();
        let structure = structure0;
        const modifierTimes = {};
        for (const [name, modifier] of Object.entries(modifiers)) {
            modifier.ensureValidMode(structure);
            const mt0 = now();
            structure = modifier.apply(structure);
            modifierTimes[name] = now() - mt0;
        }
        const t2 = now();

        // eslint-disable-next-line no-unused-vars
        const ortep = new ORTEP3JsStructure(structure);
        const t3 = now();

        const rec = {
            file: filePath,
            atomCount: structure0.atoms.length,
            finalAtomCount: structure.atoms.length,
            structureBuild: t1 - t0,
            modifiers: t2 - t1,
            modifierTimes,
            ortep: t3 - t2,
            total: t3 - t0,
        };
        (hasExplicitBonds ? withBonds : withoutBonds).push(rec);
    } catch {
        failures++;
    }
}

function stats(arr) {
    if (arr.length === 0) {
        return null;
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    return { mean: sum / sorted.length, p50: pct(0.5), p90: pct(0.9), max: sorted[sorted.length - 1] };
}

function report(label, records) {
    console.log(`\n=== ${label} (n=${records.length}) ===`);
    if (records.length === 0) {
        return;
    }
    for (const stage of ['structureBuild', 'modifiers', 'ortep', 'total']) {
        const s = stats(records.map(r => r[stage]));
        console.log(
            `  ${stage.padEnd(16)} mean=${s.mean.toFixed(2).padStart(7)}ms  p50=${s.p50.toFixed(2).padStart(7)}ms  ` +
            `p90=${s.p90.toFixed(2).padStart(7)}ms  max=${s.max.toFixed(2).padStart(7)}ms`,
        );
    }
    for (const modName of ['removeatoms', 'missingbonds', 'disorder', 'symmetry', 'hydrogen']) {
        const s = stats(records.map(r => r.modifierTimes[modName]));
        if (s) {
            console.log(
                `    modifier:${modName.padEnd(13)} mean=${s.mean.toFixed(3).padStart(8)}ms  ` +
                `p90=${s.p90.toFixed(3).padStart(8)}ms  max=${s.max.toFixed(3).padStart(8)}ms`,
            );
        }
    }
    const avgAtoms = records.reduce((a, r) => a + r.atomCount, 0) / records.length;
    console.log(`  avg asymmetric-unit atom count: ${avgAtoms.toFixed(1)}`);
}

report('WITH explicit _geom_bond loop', withBonds);
report('WITHOUT explicit _geom_bond loop (bonds generated)', withoutBonds);
console.log(`\nfailures: ${failures}`);

const slowestNoBonds = [...withoutBonds].sort((a, b) => b.total - a.total).slice(0, 10);
console.log('\nSlowest no-explicit-bonds structures:');
for (const r of slowestNoBonds) {
    console.log(
        `  ${r.total.toFixed(1).padStart(8)}ms  atoms=${String(r.atomCount).padStart(4)}  ` +
        `missingbonds=${r.modifierTimes.missingbonds.toFixed(2)}ms  ${r.file}`,
    );
}
