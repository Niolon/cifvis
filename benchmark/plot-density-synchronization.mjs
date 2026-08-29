#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc, max-len -- standalone SVG figure generator */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? '/tmp/cifvis-density-pipeline-5000-final.csv');
const outputPrefix = resolve(process.argv[3] ?? 'benchmark/density-synchronization');
const structureInputs = process.argv.slice(4).map(path => resolve(path));

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n') {
            row.push(field.replace(/\r$/, ''));
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += character;
        }
    }
    if (field || row.length) {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
    }
    const header = rows.shift();
    return rows.filter(values => values.length === header.length).map(values =>
        Object.fromEntries(header.map((name, index) => [name, values[index]])));
}

const percentiles = [
    { fraction: 0.25, label: 'p25' },
    { fraction: 0.50, label: 'p50' },
    { fraction: 0.95, label: 'p95' },
    { fraction: 0.99, label: 'p99' },
];
const successful = parseCsv(readFileSync(input, 'utf8'))
    .filter(row => row.success === 'true')
    .sort((a, b) => Number(a.corePipelineMs) - Number(b.corePipelineMs));
const structureProfiles = new Map(structureInputs.flatMap(path =>
    parseCsv(readFileSync(path, 'utf8')))
    .filter(row => row.success === 'true' && row.symmetryMode === 'none' &&
        row.renderStyle === 'solid-3d' && row.hydrogenMode === 'none')
    .map(row => [row.codId, row]));
const representatives = percentiles.map(({ fraction, label }) => {
    const row = successful[Math.round(fraction * (successful.length - 1))];
    const structure = structureProfiles.get(row.codId);
    const number = name => Number(structure?.[name] || 0);
    const ortepKnown = [
        'ortepOptionsSetupMs', 'ortepCacheSetupMs', 'ortepStructurePreparationMs',
        'ortepAtomCreationMs', 'ortepBondCreationMs', 'ortepHydrogenBondCreationMs',
    ].reduce((sum, name) => sum + number(name), 0);
    const ortepOtherMs = Math.max(0, number('ortepConstructorMs') - ortepKnown);
    const createOtherMs = Math.max(0,
        number('create3dMs') - number('hydrogenFilterMs') -
        number('ortepConstructorMs') - number('ortepGroupAssemblyMs'));
    return {
        percentile: label,
        codId: row.codId,
        path: row.path,
        asymmetricUnitAtoms: Number(row.asymmetricUnitAtoms),
        unitCellAtoms: Number(row.unitCellAtoms),
        symmetryOperationCount: Number(row.symmetryOperationCount),
        reflectionCount: Number(row.reflectionCount),
        iamModelBuildMs: Number(row.iamModelBuildMs),
        fcalcMs: Number(row.fcalcMs),
        densityMs: Number(row.densityMs),
        surfaceMs: Number(row.surfaceWallMs),
        totalMs: Number(row.corePipelineMs),
        structure: structure ? {
            parseCifMs: number('parseCifMs'),
            parseStructureMs: number('parseStructureMs'),
            addBondsMs: number('addBondsMs'),
            hydrogenFilterMs: number('hydrogenFilterMs'),
            ortepOptionsMs: number('ortepOptionsSetupMs'),
            ortepCacheMs: number('ortepCacheSetupMs'),
            ortepPreparationMs: number('ortepStructurePreparationMs'),
            ortepAtomsMs: number('ortepAtomCreationMs'),
            ortepBondsMs: number('ortepBondCreationMs'),
            ortepHydrogenBondsMs: number('ortepHydrogenBondCreationMs'),
            ortepOtherMs,
            createOtherMs,
            ortepGroupMs: number('ortepGroupAssemblyMs'),
            ortepConstructorMs: number('ortepConstructorMs'),
            create3dMs: number('create3dMs'),
        } : null,
    };
});

const colors = {
    background: '#f7f8fb',
    ink: '#172033',
    muted: '#5e687a',
    grid: '#dce1e9',
    fcalc: '#3f72af',
    iam: '#5a8bc2',
    density: '#48a9a6',
    surface: '#f28e63',
    displaySetup: '#d5a23f',
    main: '#8d75c7',
    early: '#b8c0cc',
    wait: '#edf0f5',
    cif: '#8d75c7',
    structure: '#ba68a8',
    ortep: '#d88cba',
};

function svgStart(title, subtitle, height) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${height}" viewBox="0 0 1280 ${height}" role="img" aria-label="${title}">
<rect width="1280" height="${height}" fill="${colors.background}"/>
<style>
text{font-family:Inter,system-ui,sans-serif;fill:${colors.ink}} .title{font-size:27px;font-weight:700}.sub{font-size:15px;fill:${colors.muted}}.label{font-size:16px;font-weight:650}.small{font-size:13px;fill:${colors.muted}}.detail{font-size:11px;fill:${colors.muted}}.inside{font-size:13px;font-weight:650;fill:white}.lane{font-size:12px;font-weight:650;fill:${colors.muted}}
</style>
<defs><pattern id="untimed" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="${colors.early}"/><line x1="0" y1="0" x2="0" y2="8" stroke="#9099a8" stroke-width="3"/></pattern></defs>
<text class="title" x="54" y="48">${title}</text><text class="sub" x="54" y="76">${subtitle}</text>`;
}

function stageRect(x, y, width, height, fill, label, value) {
    const valueLabel = `${value.toFixed(1)} ms`;
    const text = width > 105 ? `${label}  ${valueLabel}` : width > 55 ? valueLabel : '';
    return `<rect x="${x}" y="${y}" width="${Math.max(0, width)}" height="${height}" fill="${fill}"/><text class="inside" x="${x + width / 2}" y="${y + height / 2 + 5}" text-anchor="middle">${text}</text>`;
}

function serialFigure() {
    const barX = 365;
    const barWidth = 845;
    let body = svgStart(
        'Node workload composition: four representative COD structures',
        'Structure/ORTEP stages are exact reruns of these CIFs; density stages are their exact rows from the 4,968 successful cases. Each bar has its own scale.',
        600,
    );
    body += `<rect x="465" y="88" width="16" height="16" fill="${colors.structure}"/><text class="small" x="487" y="101">CIF/structure</text><rect x="595" y="88" width="16" height="16" fill="${colors.ortep}"/><text class="small" x="617" y="101">ORTEP</text><rect x="685" y="88" width="16" height="16" fill="${colors.iam}"/><text class="small" x="707" y="101">IAM setup</text><rect x="790" y="88" width="16" height="16" fill="${colors.fcalc}"/><text class="small" x="812" y="101">Fcalc kernel</text><rect x="920" y="88" width="16" height="16" fill="${colors.density}"/><text class="small" x="942" y="101">FFT/map</text><rect x="1030" y="88" width="16" height="16" fill="${colors.surface}"/><text class="small" x="1052" y="101">Surface</text>`;
    representatives.forEach((row, index) => {
        const y = 125 + index * 105;
        const structureMs = row.structure
            ? row.structure.parseCifMs + row.structure.parseStructureMs +
                row.structure.addBondsMs + row.structure.create3dMs
            : 0;
        const combinedTotal = row.totalMs + structureMs + row.iamModelBuildMs;
        const factor = barWidth / combinedTotal;
        body += `<text class="label" x="54" y="${y + 19}">${row.percentile} · COD ${row.codId}</text>`;
        body += `<text class="small" x="54" y="${y + 42}">${row.asymmetricUnitAtoms} ASU · ${row.unitCellAtoms} cell · ${row.symmetryOperationCount} symops · ${row.reflectionCount.toLocaleString()} HKLs</text>`;
        let x = barX;
        for (const [label, value, color] of [
            ['CIF/structure', row.structure
                ? row.structure.parseCifMs + row.structure.parseStructureMs +
                    row.structure.addBondsMs
                : 0, colors.structure],
            ['ORTEP', row.structure?.create3dMs ?? 0, colors.ortep],
            ['IAM setup', row.iamModelBuildMs, colors.iam],
            ['Fcalc kernel', row.fcalcMs, colors.fcalc],
            ['FFT/map', row.densityMs, colors.density],
            ['Surface', row.surfaceMs, colors.surface],
        ]) {
            const width = value * factor;
            body += stageRect(x, y, width, 48, color, label, value);
            x += width;
        }
        body += `<text class="label" x="${barX + barWidth}" y="${y - 9}" text-anchor="end">${combinedTotal.toFixed(1)} ms combined</text>`;
    });
    body += '<text class="small" x="54" y="566">Selection percentile: corePipelineMs. Synthetic reflection generation and structure parsing were intentionally untimed in this benchmark.</text></svg>';
    return body;
}

function synchronizedFigure() {
    const workX = 255;
    const workWidth = 955;
    let body = svgStart(
        'Node-derived scheduling model for the same four structures',
        'All main-thread structure/ORTEP and numerical widths are measured. The hatched HKL bar marks its available overlap window because early parse duration was not recorded.',
        900,
    );
    representatives.forEach((row, index) => {
        const top = 112 + index * 190;
        const structure = row.structure;
        // The density model is posted immediately after CrystalStructure.fromCIF.
        // Bond generation and all later modifier/ORTEP work prepare the displayed
        // structure and therefore overlap the worker; they are not prerequisites
        // of the structure-factor calculation.
        const snapshotMs = structure.parseCifMs + structure.parseStructureMs;
        const sceneMs = structure.addBondsMs + structure.create3dMs;
        const mapMs = row.iamModelBuildMs + row.fcalcMs + row.densityMs;
        const joinMs = snapshotMs + Math.max(sceneMs, mapMs);
        const synchronizedTotal = joinMs + row.surfaceMs;
        const factor = workWidth / synchronizedTotal;
        const snapshotX = workX + snapshotMs * factor;
        const joinX = workX + joinMs * factor;
        const surfaceWidth = row.surfaceMs * factor;
        body += `<text class="label" x="54" y="${top + 14}">${row.percentile} · COD ${row.codId}</text>`;
        body += `<text class="small" x="54" y="${top + 35}">${row.unitCellAtoms} cell atoms · ${row.reflectionCount.toLocaleString()} HKLs</text>`;
        body += `<text class="lane" x="240" y="${top + 58}" text-anchor="end">MAIN THREAD</text><text class="lane" x="240" y="${top + 108}" text-anchor="end">DENSITY WORKER</text>`;
        let mainX = workX;
        const mainStages = [
            ['CIF', structure.parseCifMs, colors.cif],
            ['Crystal model', structure.parseStructureMs, colors.structure],
            ['Display setup', structure.addBondsMs + structure.hydrogenFilterMs +
                structure.ortepOptionsMs, colors.displaySetup],
            ['Cache', structure.ortepCacheMs, '#9d83c5'],
            ['Prep', structure.ortepPreparationMs, '#857ac1'],
            ['Atoms', structure.ortepAtomsMs, '#706fb8'],
            ['Bonds', structure.ortepBondsMs + structure.ortepHydrogenBondsMs, '#625fa5'],
            ['Other/group', structure.ortepOtherMs + structure.createOtherMs +
                structure.ortepGroupMs, '#514d8c'],
        ];
        for (const [label, value, color] of mainStages) {
            const width = value * factor;
            body += stageRect(mainX, top + 41, width, 32, color, label, value);
            mainX += width;
        }
        if (mainX < joinX) {
            body += `<rect x="${mainX}" y="${top + 41}" width="${joinX - mainX}" height="32" fill="${colors.wait}"/><text class="small" x="${(mainX + joinX) / 2}" y="${top + 62}" text-anchor="middle">structure visible · waiting for map</text>`;
        }
        body += stageRect(joinX, top + 41, surfaceWidth, 32, colors.surface, 'Surface', row.surfaceMs);
        body += `<rect x="${workX}" y="${top + 91}" width="${snapshotX - workX}" height="32" fill="url(#untimed)"/>`;
        if (snapshotX - workX > 90) {
            body += `<text class="inside" x="${(workX + snapshotX) / 2}" y="${top + 112}" text-anchor="middle">HKL parse/merge</text>`;
        }
        body += stageRect(snapshotX, top + 91, row.iamModelBuildMs * factor, 32,
            colors.iam, 'IAM setup', row.iamModelBuildMs);
        body += stageRect(snapshotX + row.iamModelBuildMs * factor, top + 91,
            row.fcalcMs * factor, 32, colors.fcalc, 'Fcalc kernel', row.fcalcMs);
        body += stageRect(snapshotX + (row.iamModelBuildMs + row.fcalcMs) * factor,
            top + 91, row.densityMs * factor, 32, colors.density, 'FFT/map', row.densityMs);
        body += `<line x1="${workX}" y1="${top + 73}" x2="${workX}" y2="${top + 91}" stroke="${colors.muted}" stroke-width="2"/><text class="small" x="${workX + 7}" y="${top + 87}">raw CIF → parse/merge</text>`;
        body += `<line x1="${snapshotX}" y1="${top + 31}" x2="${snapshotX}" y2="${top + 91}" stroke="${colors.ink}" stroke-width="2"/><circle cx="${snapshotX}" cy="${top + 91}" r="4" fill="${colors.background}" stroke="${colors.ink}" stroke-width="2"/><text class="small" x="${snapshotX + 7}" y="${top + 35}">display-only setup/ORTEP continues in parallel</text><text class="small" x="${snapshotX + 7}" y="${top + 139}">worker starts: model + prepared HKLs</text>`;
        body += `<line x1="${joinX}" y1="${top + 91}" x2="${joinX}" y2="${top + 73}" stroke="${colors.surface}" stroke-width="2" stroke-dasharray="4 3"/><text class="small" x="${joinX - 7}" y="${top + 87}" text-anchor="end">map → surface</text>`;
        body += `<text class="label" x="${workX + workWidth}" y="${top + 160}" text-anchor="end">${synchronizedTotal.toFixed(1)} ms synchronized measured path</text>`;
    });
    body += '<text class="small" x="54" y="888">* The worker join waits for both inputs: prepared HKLs and the model posted after CrystalStructure.fromCIF. Bonds, modifiers, and ORTEP are display-only work. Browser first-paint remains excluded.</text></svg>';
    return body;
}

writeFileSync(`${outputPrefix}-serial.svg`, serialFigure());
writeFileSync(`${outputPrefix}-staged.svg`, synchronizedFigure());
writeFileSync(`${outputPrefix}-representatives.json`, `${JSON.stringify({
    input,
    structureInputs,
    successful: successful.length,
    representatives,
}, null, 2)}\n`);
console.log(`Wrote ${outputPrefix}-serial.svg`);
console.log(`Wrote ${outputPrefix}-staged.svg`);
console.log(`Wrote ${outputPrefix}-representatives.json`);
