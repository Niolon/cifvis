#!/usr/bin/env node
/* eslint-disable jsdoc/require-jsdoc, max-len -- standalone browser-timeline figure */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? 'benchmark/browser-only-density-timeline.json');
const output = resolve(process.argv[3] ?? 'benchmark/density-synchronization-staged.svg');
const dataOutput = resolve(process.argv[4] ?? 'benchmark/browser-density-timeline-data.json');
const source = JSON.parse(readFileSync(input, 'utf8'));
const { results } = source;
const percentiles = ['p25', 'p50', 'p95', 'p99'];
const colors = {
    background: '#f7f8fb', ink: '#172033', muted: '#5e687a', wait: '#edf0f5',
    startup: '#9ca7b7', cif: '#8d75c7', model: '#ba68a8', display: '#d5a23f',
    hkl: '#7a8799', join: '#e7bf61', dataset: '#6b8fbd', iam: '#5a8bc2',
    fcalc: '#3f72af', corrections: '#8f78b5', coefficients: '#73599b', fft: '#48a9a6',
    surface: '#f28e63', transfer: '#f3c4ad',
};

function rect(x, y, width, height, color, label, duration) {
    const safeWidth = Math.max(0, width);
    const value = `${duration.toFixed(1)} ms`;
    const text = safeWidth > 125 ? `${label}  ${value}` : safeWidth > 62 ? value : '';
    return `<rect x="${x}" y="${y}" width="${safeWidth}" height="${height}" fill="${color}"/><text class="inside" x="${x + safeWidth / 2}" y="${y + height / 2 + 5}" text-anchor="middle">${text}</text>`;
}

function segment(start, end, y, factor, color, label) {
    return rect(255 + start * factor, y, (end - start) * factor, 32, color, label, end - start);
}

function synchronizedWaits(timings) {
    const modelPosted = timings.modelPostedMs;
    const reflectionsPrepared = timings.reflectionsPreparedMs;
    const calculationStarted = timings.workerCalculationStartedMs;
    return {
        workerIdleAfterReflectionPreparationMs:
            Math.max(0, modelPosted - reflectionsPrepared),
        modelWaitForReflectionPreparationMs:
            Math.max(0, reflectionsPrepared - modelPosted),
        workerJoinDelayMs:
            Math.max(0, calculationStarted - Math.max(modelPosted, reflectionsPrepared)),
    };
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" viewBox="0 0 1280 900" role="img" aria-label="Browser-only main-thread and density-worker timeline">
<rect width="1280" height="900" fill="${colors.background}"/>
<style>text{font-family:Inter,system-ui,sans-serif;fill:${colors.ink}}.title{font-size:27px;font-weight:700}.sub{font-size:15px;fill:${colors.muted}}.label{font-size:16px;font-weight:650}.small{font-size:13px;fill:${colors.muted}}.inside{font-size:13px;font-weight:650;fill:white}.lane{font-size:12px;font-weight:650;fill:${colors.muted}}</style>
<text class="title" x="54" y="48">Browser-only density synchronization</text>
<text class="sub" x="54" y="76">Fresh Chromium contexts with prewarmed workers and Uiso-vector Fcalc; every position comes from the page or density worker. Each structure has its own time scale.</text>`;

[
    ['Startup', colors.startup, 255], ['HKL', colors.hkl, 355],
    ['Join', colors.join, 435], ['Dataset setup', colors.dataset, 515],
    ['IAM model', colors.iam, 650], ['Fcalc', colors.fcalc, 760],
    ['Coefficients', colors.coefficients, 845], ['FFT/map', colors.fft, 970],
    ['Surface', colors.surface, 1070],
].forEach(([label, color, x]) => {
    svg += `<rect x="${x}" y="88" width="13" height="13" fill="${color}"/><text class="small" x="${x + 19}" y="99">${label}</text>`;
});

results.forEach((row, index) => {
    const top = 112 + index * 190;
    const t = row.browserTimings;
    const end = t.densityAppliedMs;
    const factor = 955 / end;
    const mainY = top + 41;
    const workerY = top + 101;
    const rawPosted = t.rawCifPostedMs;
    const modelPosted = t.modelPostedMs;
    const sceneReady = t.structureSceneReadyMs;
    const prepStarted = t.reflectionPreparationStartedMs;
    const prepReady = t.reflectionsPreparedMs;
    const calculationStarted = t.workerCalculationStartedMs;
    const mapPosted = t.workerMapPostedMs;
    const mapReceived = t.mapReceivedMs;
    const datasetEnd = Math.min(mapPosted, calculationStarted + row.browserDatasetPreparationMs);
    const iamModelMs = row.browserIamModelBuildMs ?? 0;
    const fcalcMs = row.browserFcalcMs ?? 0;
    const datasetOtherMs = Math.max(0, row.browserDatasetPreparationMs - iamModelMs - fcalcMs);
    const stages = row.browserDatasetStages ?? {};
    const rawSetupMs = (stages.datasetSourceSetupMs ?? 0) +
        (stages.datasetCellSymmetrySetupMs ?? 0) +
        (stages.datasetObservationSetupMs ?? 0);
    const rawCorrectionMs = (stages.datasetCoordinateSetupMs ?? 0) +
        (stages.datasetSolventMaskDiscoveryDecodeMs ?? 0) +
        (stages.datasetSolventMaskSymmetryExpansionMs ?? 0) +
        (stages.datasetSolventMaskCopyApplicationMs ?? 0) +
        (stages.datasetSolventMaskMetadataMs ?? 0) + (stages.datasetExtinctionMs ?? 0) +
        (stages.datasetScaleFitMs ?? 0);
    const rawCoefficientMs = (stages.datasetCoefficientInputSetupMs ?? 0) +
        (stages.datasetCoefficientExpansionMs ?? 0) + (stages.datasetFinalizationMs ?? 0);
    const measuredOtherMs = rawSetupMs + rawCorrectionMs + rawCoefficientMs;
    const otherScale = measuredOtherMs > 0 ? datasetOtherMs / measuredOtherMs : 0;
    const setupMs = rawSetupMs * otherScale;
    const correctionMs = rawCorrectionMs * otherScale;
    const coefficientMs = rawCoefficientMs * otherScale;
    const setupEnd = Math.min(datasetEnd, calculationStarted + setupMs);
    const iamEnd = Math.min(datasetEnd, setupEnd + iamModelMs);
    const fcalcEnd = Math.min(datasetEnd, iamEnd + fcalcMs);
    const correctionEnd = Math.min(datasetEnd, fcalcEnd + correctionMs);
    const workerIdle = Math.max(0, modelPosted - prepReady);
    const modelWait = Math.max(0, prepReady - modelPosted);
    const joinDelay = Math.max(0, calculationStarted - Math.max(modelPosted, prepReady));

    svg += `<text class="label" x="54" y="${top + 14}">${percentiles[index]} · COD ${row.codId}</text>`;
    svg += `<text class="small" x="54" y="${top + 35}">${row.reflectionCount.toLocaleString()} HKLs · browser median of 3 fresh contexts</text>`;
    svg += `<text class="lane" x="240" y="${mainY + 21}" text-anchor="end">MAIN THREAD</text><text class="lane" x="240" y="${workerY + 21}" text-anchor="end">DENSITY WORKER</text>`;

    svg += segment(0, t.cifParsedMs, mainY, factor, colors.cif, 'CIF');
    svg += segment(t.cifParsedMs, modelPosted, mainY, factor, colors.model, 'Crystal model');
    svg += segment(modelPosted, sceneReady, mainY, factor, colors.display, 'Display/ORTEP');
    if (sceneReady < mapReceived) {
        svg += segment(sceneReady, mapReceived, mainY, factor, colors.wait, 'Structure visible · waiting for map');
    }
    svg += segment(mapReceived, end, mainY, factor, colors.surface, 'Install map + surface');

    svg += segment(rawPosted, prepStarted, workerY, factor, colors.startup, 'Worker/module startup');
    svg += segment(prepStarted, prepReady, workerY, factor, colors.hkl, 'HKL parse/merge');
    if (workerIdle > 0) {
        svg += segment(prepReady, modelPosted, workerY, factor, colors.wait, 'Idle for model');
    }
    svg += segment(Math.max(modelPosted, prepReady), calculationStarted, workerY, factor, colors.join, 'Join delay');
    svg += segment(calculationStarted, setupEnd, workerY, factor, colors.dataset, 'Dataset setup');
    svg += segment(setupEnd, iamEnd, workerY, factor, colors.iam, 'IAM model');
    svg += segment(iamEnd, fcalcEnd, workerY, factor, colors.fcalc, 'Fcalc');
    svg += segment(fcalcEnd, correctionEnd, workerY, factor, colors.corrections, 'Corrections');
    svg += segment(correctionEnd, Math.min(datasetEnd, correctionEnd + coefficientMs),
        workerY, factor, colors.coefficients, 'Coefficients');
    svg += segment(datasetEnd, mapPosted, workerY, factor, colors.fft, 'FFT/map');
    svg += segment(mapPosted, mapReceived, workerY, factor, colors.transfer, 'Transfer');

    const modelX = 255 + modelPosted * factor;
    const readyX = 255 + prepReady * factor;
    const mapX = 255 + mapReceived * factor;
    const synchronizationLabel = workerIdle > 0
        ? `model posted · worker idle ${workerIdle.toFixed(1)} ms · join ${joinDelay.toFixed(1)} ms`
        : `model posted · model waited ${modelWait.toFixed(1)} ms · join ${joinDelay.toFixed(1)} ms`;
    svg += `<line x1="${modelX}" y1="${mainY + 32}" x2="${modelX}" y2="${workerY}" stroke="${colors.ink}" stroke-width="2"/>`;
    svg += `<line x1="${readyX}" y1="${workerY - 7}" x2="${readyX}" y2="${workerY + 39}" stroke="${colors.join}" stroke-width="2"/>`;
    svg += `<text class="small" x="${Math.min(modelX, readyX) + 6}" y="${mainY + 52}">${synchronizationLabel}</text>`;
    svg += `<line x1="${mapX}" y1="${workerY}" x2="${mapX}" y2="${mainY + 32}" stroke="${colors.surface}" stroke-width="2" stroke-dasharray="4 3"/>`;
    if (mapX - Math.min(modelX, readyX) > 350) {
        svg += `<text class="small" x="${mapX - 6}" y="${mainY + 52}" text-anchor="end">map returned</text>`;
    }
    svg += `<text class="label" x="1210" y="${top + 174}" text-anchor="end">${end.toFixed(1)} ms to applied surface</text>`;
});

svg += '<text class="small" x="54" y="874">Worker idle is time after HKL preparation while waiting for the model. Model wait is the opposite; join is dispatch latency after both inputs were ready.</text>';
svg += '<text class="small" x="54" y="892">Dataset substage medians are normalized to the measured dataset total so independently selected medians fit the lane exactly.</text></svg>';
writeFileSync(output, svg);
writeFileSync(dataOutput, `${JSON.stringify({
    generatedAt: source.generatedAt,
    results: results.map(row => ({
        ...Object.fromEntries(Object.entries(row).filter(([name]) =>
            name === 'codId' || name === 'reflectionCount' ||
            (name.startsWith('browser') && name !== 'browserRuns'))),
        ...Object.fromEntries(Object.entries(synchronizedWaits(row.browserTimings))
            .map(([name, value]) => [`browser${name[0].toUpperCase()}${name.slice(1)}`, value])),
        browserRuns: row.browserRuns.map(run => ({
            ...run,
            ...synchronizedWaits(run.browserTimings),
        })),
    })),
}, null, 2)}\n`);
console.log(`Wrote ${output}`);
console.log(`Wrote ${dataOutput}`);
