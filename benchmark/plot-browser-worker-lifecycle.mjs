#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc, max-len -- standalone browser worker-lifecycle figure */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? '/tmp/browser-worker-lifecycle-inline.json');
const output = resolve(process.argv[3] ?? 'benchmark/density-worker-lifecycle.svg');
const source = JSON.parse(readFileSync(input, 'utf8'));
const structures = ['p25', 'p50', 'p95', 'p99'];
const modes = [
    ['recreate-lazy', 'Recreate · lazy', '#7a8799'],
    ['persistent-lazy', 'Persistent · lazy', '#6b8fbd'],
    ['prewarm-terminate', 'Recreate · prewarm', '#8f78b5'],
    ['persistent-prewarm', 'Persistent · prewarm', '#3f72af'],
];
const ink = '#172033';
const muted = '#5e687a';
const background = '#f7f8fb';
const startup = '#b7bfcb';

function median(values) {
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
}

function escape(text) {
    return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1040" viewBox="0 0 1280 1040" role="img" aria-label="Browser-only density worker lifecycle comparison">
<rect width="1280" height="1040" fill="${background}"/>
<style>text{font-family:Inter,system-ui,sans-serif;fill:${ink}}.title{font-size:27px;font-weight:700}.sub{font-size:15px;fill:${muted}}.label{font-size:16px;font-weight:650}.small{font-size:13px;fill:${muted}}.mode{font-size:13px;font-weight:650}.inside{font-size:12px;font-weight:650;fill:white}</style>
<text class="title" x="54" y="48">Browser-only density worker lifecycle</text>
<text class="sub" x="54" y="76">Inline production bundle · three fresh Chromium contexts per mode · each context loads p25 → p50 → p95 → p99.</text>
<rect x="770" y="91" width="14" height="14" fill="${startup}"/><text class="small" x="791" y="103">Worker/module startup</text>
<rect x="955" y="91" width="14" height="14" fill="#3f72af"/><text class="small" x="976" y="103">Remaining display path</text>`;

structures.forEach((percentile, structureIndex) => {
    const top = 126 + structureIndex * 220;
    const firstMode = source.results[modes[0][0]];
    const example = firstMode[0][structureIndex];
    const structure = source.cases[structureIndex];
    const medians = modes.map(([key, label, color]) => {
        const runs = source.results[key].map(repetition => repetition[structureIndex]);
        return {
            label,
            color,
            wallMs: median(runs.map(run => run.wallMs)),
            startupMs: median(runs.map(run => run.workerStartupToTaskMs)),
        };
    });
    const maximum = Math.max(...medians.map(row => row.wallMs));
    const factor = 790 / maximum;
    svg += `<text class="label" x="54" y="${top + 11}">${percentile} · COD ${escape(example.codId)}</text>`;
    svg += `<text class="small" x="54" y="${top + 32}">${structure.reflectionCount.toLocaleString()} HKLs · structure-local scale</text>`;
    medians.forEach((row, modeIndex) => {
        const y = top + 48 + modeIndex * 37;
        const startupWidth = row.startupMs * factor;
        const remainderWidth = Math.max(0, row.wallMs - row.startupMs) * factor;
        svg += `<text class="mode" x="246" y="${y + 20}" text-anchor="end">${escape(row.label)}</text>`;
        svg += `<rect x="262" y="${y}" width="${startupWidth}" height="27" fill="${startup}"/>`;
        svg += `<rect x="${262 + startupWidth}" y="${y}" width="${remainderWidth}" height="27" fill="${row.color}"/>`;
        if (startupWidth > 46) {
            svg += `<text class="inside" x="${262 + startupWidth / 2}" y="${y + 18}" text-anchor="middle">${row.startupMs.toFixed(1)} ms</text>`;
        }
        svg += `<text class="mode" x="${272 + startupWidth + remainderWidth}" y="${y + 20}">${row.wallMs.toFixed(1)} ms</text>`;
    });
});

svg += '<text class="small" x="54" y="1013">Startup is measured from posting the raw CIF to the first reflection-preparation task. Prewarmed and reused workers reduce it to sub-millisecond scale.</text></svg>';
writeFileSync(output, svg);
console.log(`Wrote ${output}`);
