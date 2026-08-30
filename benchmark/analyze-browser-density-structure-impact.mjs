#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone paired benchmark report */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? '/tmp/browser-density-structure-impact-50.json');
const output = resolve(process.argv[3] ?? '/tmp/browser-density-structure-impact-50-summary.json');
const markdownOutput = output.replace(/\.json$/u, '.md');
const benchmark = JSON.parse(readFileSync(input, 'utf8'));

const percentile = (values, fraction) => {
    const sorted = values.filter(Number.isFinite).sort((first, second) => first - second);
    return sorted.length ? sorted[Math.round(fraction * (sorted.length - 1))] : null;
};
const median = values => percentile(values, 0.5);
const difference = (timings, end, start) =>
    Number.isFinite(timings?.[end]) && Number.isFinite(timings?.[start])
        ? Math.max(0, timings[end] - timings[start])
        : null;

const components = [
    ['structureWall', 'Load-to-structure-display wall time', run => run.structureWallMs],
    ['parseCif', 'Parse coordinate CIF', run =>
        difference(run.timings, 'cifParsedMs', 'rawCifPostedMs') ?? run.timings.cifParsedMs],
    ['buildStructure', 'Build crystallographic structure', run =>
        difference(run.timings, 'structureReadyMs', 'cifParsedMs')],
    ['structureFactorModel', 'Prepare structure-factor model', run =>
        difference(run.timings, 'structureModelReadyMs', 'structureReadyMs')],
    ['densityDispatch', 'Start concurrent density calculation', run =>
        difference(run.timings, 'densityLoadStartedMs', 'structureModelReadyMs') ?? 0],
    ['molecularScene', 'Build molecular scene', run =>
        difference(
            run.timings,
            'structureSceneReadyMs',
            Number.isFinite(run.timings.densityLoadStartedMs)
                ? 'densityLoadStartedMs'
                : 'structureModelReadyMs',
        )],
];

function summarizeComponent([id, label, value]) {
    const structures = benchmark.results.map(result => {
        const disabled = median(result.runs.disabled.map(value));
        const active = median(result.runs.active.map(value));
        return {
            codId: result.codId,
            disabledMs: disabled,
            activeMs: active,
            deltaMs: active - disabled,
            ratio: disabled > 0 ? active / disabled : null,
        };
    });
    const values = name => structures.map(row => row[name]);
    return {
        id,
        label,
        disabledMs: {
            p10: percentile(values('disabledMs'), 0.1),
            p50: percentile(values('disabledMs'), 0.5),
            p90: percentile(values('disabledMs'), 0.9),
            p99: percentile(values('disabledMs'), 0.99),
        },
        activeMs: {
            p10: percentile(values('activeMs'), 0.1),
            p50: percentile(values('activeMs'), 0.5),
            p90: percentile(values('activeMs'), 0.9),
            p99: percentile(values('activeMs'), 0.99),
        },
        pairedDeltaMs: {
            p10: percentile(values('deltaMs'), 0.1),
            p50: percentile(values('deltaMs'), 0.5),
            p90: percentile(values('deltaMs'), 0.9),
            p99: percentile(values('deltaMs'), 0.99),
        },
        pairedRatio: {
            p10: percentile(values('ratio'), 0.1),
            p50: percentile(values('ratio'), 0.5),
            p90: percentile(values('ratio'), 0.9),
            p99: percentile(values('ratio'), 0.99),
        },
        largestRegressions: structures.sort((first, second) => second.deltaMs - first.deltaMs)
            .slice(0, 5),
    };
}

const componentsSummary = components.map(summarizeComponent);
const summary = {
    generatedAt: new Date().toISOString(),
    source: input,
    endpoint: benchmark.endpoint,
    structureCount: benchmark.results.length,
    repetitions: benchmark.repetitions,
    densityActiveWorker: benchmark.densityActiveWorker,
    components: componentsSummary,
};
writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);

const format = value => Number.isFinite(value) ? value.toFixed(2) : 'n/a';
const ratio = value => Number.isFinite(value) ? `${value.toFixed(2)}×` : 'n/a';
const rows = componentsSummary.map(component => `| ${component.label} | ` +
    `${format(component.disabledMs.p50)} | ${format(component.activeMs.p50)} | ` +
    `${format(component.pairedDeltaMs.p50)} | ${format(component.pairedDeltaMs.p90)} | ` +
    `${ratio(component.pairedRatio.p50)} | ${ratio(component.pairedRatio.p90)} |`);
const markdown = '# Difference-density impact on structure display\n\n' +
    `${benchmark.results.length} paired structures; ${benchmark.repetitions} browser runs per ` +
    'mode and structure. Both modes load identical CIF text. Density-active uses a prewarmed ' +
    'worker, starts reflection/density work in parallel, and stops timing when the molecular ' +
    'structure scene is ready.\n\n' +
    '| Component | Disabled p50 | Active p50 | Paired delta p50 | Paired delta p90 | ' +
    'Paired ratio p50 | Paired ratio p90 |\n' +
    '|---|---:|---:|---:|---:|---:|---:|\n' + `${rows.join('\n')}\n`;
writeFileSync(markdownOutput, markdown);
console.log(JSON.stringify({ output, markdownOutput }, null, 2));
