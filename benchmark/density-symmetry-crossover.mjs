// Measures where the symmetry-aware isosurface path stops paying for itself.
//
// createSymmetryAwareIsosurfaces runs marching cubes once per symmetry-unique region
// and reuses the equivalents, then stitches the patches back together. The saving grows
// with the number of equivalent copies, but the stitching cost grows with the number of
// patches and their shared boundary. A structure with a very small asymmetric unit in a
// high-symmetry group - ionic and mineral phases especially - produces many small
// regions with a lot of boundary, which is exactly the shape where the reuse saves
// little and the stitching costs a lot.
//
// Uses `cif-iam` input so any CIF can be measured without a reflection file.
//
// Usage: node benchmark/density-symmetry-crossover.mjs structure.cif [more.cif ...] [--runs N]
/* eslint-disable jsdoc/require-param, jsdoc/require-returns -- local benchmark helpers */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CIF } from '../src/lib/read-cif/base.js';
import { CrystalStructure } from '../src/lib/structure/crystal.js';
import { tryToFixCifBlock } from '../src/lib/fix-cif/base.js';
import { HydrogenFilter, SymmetryGrower } from '../src/lib/structure/structure-modifiers/modes.js';
import {
    calculateDifferenceDensityMap,
    parseDifferenceDensitySource,
} from '../src/lib/density/difference-density.js';
import { isosurfaceResolution } from '../src/lib/density/isosurface.js';
import { createSymmetryAwareIsosurfaces } from '../src/lib/density/symmetry-isosurface.js';
import { parseCube } from '../src/lib/density/cube.js';

const args = process.argv.slice(2);
const runIndex = args.indexOf('--runs');
const runCount = runIndex === -1 ? 3 : Math.max(1, Number(args[runIndex + 1]) || 3);
const paths = args.filter((arg, index) =>
    !arg.startsWith('--') && (runIndex === -1 || index !== runIndex + 1));

if (paths.length === 0) {
    console.error('Usage: node benchmark/density-symmetry-crossover.mjs structure.cif [...] [--runs N]');
    process.exit(1);
}

/** Median of numeric observations. */
function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

/** Frees the GPU-side resources a measured group holds. */
function disposeGroup(group) {
    const materials = new Set();
    group.traverse(object => {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            materials.add(object.material);
        }
    });
    materials.forEach(material => material.dispose());
}

const header = [
    'structure'.padEnd(22), 'ops'.padStart(4), 'asu'.padStart(4), 'atoms'.padStart(6),
    'regions'.padStart(8), 'reused'.padStart(7),
    'direct'.padStart(9), 'symmetry'.padStart(9), 'stitch'.padStart(8), 'verdict'.padStart(10),
].join(' ');
console.log(header);
console.log('-'.repeat(header.length));

for (const path of paths) {
    let structure;
    let densityMap;
    try {
        const text = fs.readFileSync(path, 'utf8');
        const block = new CIF(text).getBlock(0);
        try {
            structure = CrystalStructure.fromCIF(block);
        } catch {
            tryToFixCifBlock(block);
            structure = CrystalStructure.fromCIF(block);
        }
        // A scalar field is all the isosurface path needs. Preferring a matching cube
        // file lets high-symmetry phases be measured even where the CIF carries no
        // reflections, which is the norm for the mineral structures this is about.
        const cubePath = path.replace(/\.cif$/, '_density.cube');
        densityMap = fs.existsSync(cubePath)
            ? parseCube(fs.readFileSync(cubePath, 'utf8'), { property: 'generic' })
            : calculateDifferenceDensityMap(
                parseDifferenceDensitySource(text, 0, { inputMode: 'cif-iam' }),
            );
    } catch (error) {
        console.log(`${path.split('/').pop().padEnd(22)} skipped: ${error.message.slice(0, 60)}`);
        continue;
    }

    const operationCount = structure.symmetry.symmetryOperations.length;
    const asymmetricUnitSize = structure.atoms.length;
    structure.cell = densityMap.cell;
    const filtered = new HydrogenFilter(HydrogenFilter.MODES.NONE).apply(structure);
    const grown = new SymmetryGrower(SymmetryGrower.MODES.CELL).apply(filtered);

    const baseOptions = {
        visible: true, sigmaLevel: 3, radius: 1.5, resolution: 64,
        gridSpacing: 0.15, maxResolution: 96, maxPolyCount: 100000,
    };
    baseOptions.resolution = isosurfaceResolution(grown, baseOptions);

    const observations = { direct: [], symmetry: [] };
    let lastSymmetry = null;
    for (let run = 0; run < runCount; run++) {
        // Alternate the order so neither variant consistently benefits from warm caches.
        const variants = run % 2 === 0
            ? [['direct', false], ['symmetry', true]]
            : [['symmetry', true], ['direct', false]];
        for (const [name, useSymmetry] of variants) {
            const started = performance.now();
            const group = createSymmetryAwareIsosurfaces(
                densityMap, grown, { ...baseOptions, useSymmetry },
            );
            observations[name].push(performance.now() - started);
            if (useSymmetry) {
                lastSymmetry = {
                    stitchTimeMs: group.userData.stitchTimeMs ?? 0,
                    generated: group.userData.generatedRegionCount ?? 0,
                    reused: group.userData.reusedRegionCount ?? 0,
                };
            }
            disposeGroup(group);
        }
    }

    const direct = median(observations.direct);
    const symmetry = median(observations.symmetry);
    const ratio = direct / symmetry;
    const verdict = ratio >= 1.1 ? `${ratio.toFixed(2)}x win`
        : (ratio <= 0.9 ? `${(1 / ratio).toFixed(2)}x LOSS` : 'neutral');

    console.log([
        path.split('/').pop().replace('.cif', '').padEnd(22),
        String(operationCount).padStart(4),
        String(asymmetricUnitSize).padStart(4),
        String(grown.atoms.length).padStart(6),
        String(lastSymmetry.generated + lastSymmetry.reused).padStart(8),
        String(lastSymmetry.reused).padStart(7),
        `${direct.toFixed(0)}ms`.padStart(9),
        `${symmetry.toFixed(0)}ms`.padStart(9),
        `${lastSymmetry.stitchTimeMs.toFixed(0)}ms`.padStart(8),
        verdict.padStart(10),
    ].join(' '));
}
