#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc -- standalone paired benchmark report */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? '/tmp/browser-density-structure-impact-50.json');
const output = resolve(process.argv[3] ?? '/tmp/browser-density-structure-impact-50-summary.json');
const markdownOutput = output.replace(/\.json$/u, '.md');
const benchmark = JSON.parse(readFileSync(input, 'utf8'));
const modes = benchmark.modes ?? ['disabled', 'active'];
const baselineMode = modes[0];
const modeLabels = {
    disabled: 'No worker',
    'idle-worker': 'Prewarmed idle worker',
    'deferred-density': 'Parse early; defer density',
    'active-density': 'Current early density',
    active: 'Current early density',
};

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

function distribution(values) {
    return {
        p10: percentile(values, 0.1),
        p50: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        p99: percentile(values, 0.99),
    };
}

function summarizeComponent([id, label, value]) {
    const structures = benchmark.results.map(result => ({
        codId: result.codId,
        values: Object.fromEntries(modes.map(mode => [
            mode,
            median(result.runs[mode].map(value)),
        ])),
    }));
    const baseline = structures.map(row => row.values[baselineMode]);
    const modeSummaries = Object.fromEntries(modes.map(mode => {
        const modeValues = structures.map(row => row.values[mode]);
        const pairedDeltas = modeValues.map((value, index) => value - baseline[index]);
        const pairedRatios = modeValues.map((value, index) =>
            baseline[index] > 0 ? value / baseline[index] : null);
        return [mode, {
            label: modeLabels[mode] ?? mode,
            durationMs: distribution(modeValues),
            pairedDeltaMs: distribution(pairedDeltas),
            pairedRatio: distribution(pairedRatios),
            largestRegressions: structures.map((row, index) => ({
                codId: row.codId,
                baselineMs: baseline[index],
                modeMs: modeValues[index],
                deltaMs: pairedDeltas[index],
                ratio: pairedRatios[index],
            })).sort((first, second) => second.deltaMs - first.deltaMs).slice(0, 5),
        }];
    }));
    return { id, label, modes: modeSummaries };
}

const componentsSummary = components.map(summarizeComponent);
const reflectionReadiness = Object.fromEntries(modes.map(mode => {
    const runs = benchmark.results.flatMap(result => result.runs[mode]);
    return [mode, {
        readyCount: runs.filter(run => run.reflectionsPreparedByStructureDisplay).length,
        runCount: runs.length,
    }];
}));
const summary = {
    generatedAt: new Date().toISOString(),
    source: input,
    endpoint: benchmark.endpoint,
    structureCount: benchmark.results.length,
    repetitions: benchmark.repetitions,
    warmupRepetitions: benchmark.warmupRepetitions ?? 0,
    baselineMode,
    modes: Object.fromEntries(modes.map(mode => [mode, modeLabels[mode] ?? mode])),
    reflectionReadiness,
    components: componentsSummary,
};
writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);

const format = value => Number.isFinite(value) ? value.toFixed(2) : 'n/a';
const ratio = value => Number.isFinite(value) ? `${value.toFixed(2)}×` : 'n/a';
const rows = componentsSummary.flatMap(component => modes.map(mode => {
    const values = component.modes[mode];
    return `| ${component.label} | ${values.label} | ${format(values.durationMs.p50)} | ` +
        `${format(values.pairedDeltaMs.p50)} | ${format(values.pairedDeltaMs.p90)} | ` +
        `${ratio(values.pairedRatio.p50)} | ${ratio(values.pairedRatio.p90)} |`;
}));
const markdown = '# Difference-density scheduling impact on structure display\n\n' +
    `${benchmark.results.length} paired structures; ${benchmark.repetitions} measured browser ` +
    `runs per mode and structure after ${benchmark.warmupRepetitions ?? 0} warm-up run(s). ` +
    'All modes load identical CIF text. Configured workers are prewarmed outside the timer, ' +
    'and timing stops when the molecular structure scene is ready. Deltas and ratios use the ' +
    `${modeLabels[baselineMode] ?? baselineMode} mode as baseline.\n\n` +
    '| Component | Mode | p50 | Paired delta p50 | Paired delta p90 | ' +
    'Paired ratio p50 | Paired ratio p90 |\n' +
    '|---|---|---:|---:|---:|---:|---:|\n' + `${rows.join('\n')}\n`;
writeFileSync(markdownOutput, markdown);
console.log(JSON.stringify({ output, markdownOutput }, null, 2));
