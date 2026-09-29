#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { isValidStructure, seededRandom, walkCifFiles } from './lib/cod-sample.mjs';

const [codArg, sampleArg, metadataArg, knownBadArg, slowLogArg, tailSampleArg, tailMetadataArg] =
    process.argv.slice(2);
if (!codArg || !sampleArg || !metadataArg || !knownBadArg || !slowLogArg ||
    !tailSampleArg || !tailMetadataArg) {
    throw new Error(
        'usage: build-jsmol-comparison-sample.mjs COD_DIR SAMPLE.tsv METADATA.json ' +
        'KNOWN_BAD.txt SLOW.log TAIL_SAMPLE.tsv TAIL_METADATA.json',
    );
}
const codDir = resolve(codArg);
const samplePath = resolve(sampleArg);
const metadataPath = resolve(metadataArg);
const bucketCount = 100;
const picksPerBucket = 90;
const seed = 20260831;
const random = seededRandom(seed);
const knownBad = new Set(readFileSync(resolve(knownBadArg), 'utf8').trim().split(/\r?\n/).filter(Boolean));
const population = [...walkCifFiles(codDir)]
    .filter(file => !knownBad.has(basename(file.path)))
    .sort((left, right) => left.sizeBytes - right.sizeBytes || left.path.localeCompare(right.path));
const populationByPath = new Map(population.map(file => [file.path, file]));

const selectedBuckets = [];
let rejected = 0;
for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
    const start = Math.floor(bucketIndex * population.length / bucketCount);
    const end = Math.floor((bucketIndex + 1) * population.length / bucketCount);
    const candidates = population.slice(start, end);
    for (let index = candidates.length - 1; index > 0; index--) {
        const replacement = Math.floor(random() * (index + 1));
        [candidates[index], candidates[replacement]] = [candidates[replacement], candidates[index]];
    }
    const picks = [];
    for (const candidate of candidates) {
        if (isValidStructure(candidate.path)) {
            picks.push(candidate);
            if (picks.length === picksPerBucket) {
                break;
            }
        } else {
            rejected++;
        }
    }
    if (picks.length !== picksPerBucket) {
        throw new Error(`bucket ${bucketIndex} yielded ${picks.length}/${picksPerBucket} valid files`);
    }
    selectedBuckets.push(picks);
    if ((bucketIndex + 1) % 10 === 0) {
        console.log(`Validated ${bucketIndex + 1}/${bucketCount} size buckets`);
    }
}

const selected = [];
for (let round = 0; round < picksPerBucket; round++) {
    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
        selected.push({ ...selectedBuckets[bucketIndex][round], bucketIndex, round });
    }
}
writeFileSync(samplePath, selected.map(file =>
    `${relative(codDir, file.path)}\t${file.sizeBytes}`).join('\n') + '\n');
writeFileSync(metadataPath, `${JSON.stringify({
    schema_version: 1,
    generated_at: new Date().toISOString(),
    cod_dir: codDir,
    population_after_known_bad_exclusion: population.length,
    known_bad_entries: knownBad.size,
    bucket_count: bucketCount,
    picks_per_bucket: picksPerBucket,
    sample_size: selected.length,
    ordering: 'round-robin across ascending file-size quantile buckets',
    selection: 'seeded shuffle within each bucket, then first valid structures',
    seed,
    rejected_as_unparseable_or_atomless: rejected,
    population_size_range_bytes: [population[0].sizeBytes, population.at(-1).sizeBytes],
    sample_size_range_bytes: [
        Math.min(...selected.map(file => file.sizeBytes)),
        Math.max(...selected.map(file => file.sizeBytes)),
    ],
}, null, 2)}\n`);
console.log(`Wrote ${selected.length} files to ${samplePath} (${rejected} invalid candidates rejected)`);
console.log(`Wrote sampling metadata to ${metadataPath}`);

const selectedPaths = new Set(selected.map(file => file.path));
const slowByPath = new Map();
for (const line of readFileSync(resolve(slowLogArg), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\[[^\]]+\]\s+([0-9.]+)s\s+(.+\.cif)$/);
    if (!match) {
        continue;
    }
    const path = resolve(match[2]);
    const durationSeconds = Number(match[1]);
    if (!selectedPaths.has(path) && !knownBad.has(basename(path))) {
        slowByPath.set(path, Math.max(durationSeconds, slowByPath.get(path) ?? 0));
    }
}
const slowFiles = [...slowByPath].map(([path, durationSeconds]) => ({
    path,
    durationSeconds,
    sizeBytes: populationByPath.get(path)?.sizeBytes,
})).filter(file => Number.isFinite(file.sizeBytes))
    .sort((left, right) => left.durationSeconds - right.durationSeconds ||
        left.path.localeCompare(right.path));
const extremeTail = slowFiles.filter(file => file.durationSeconds > 30);
const moderateTail = slowFiles.filter(file => file.durationSeconds <= 30);
const moderateTarget = 500 - extremeTail.length;
const moderateSelected = [];
for (let stratum = 0; stratum < moderateTarget; stratum++) {
    const start = Math.floor(stratum * moderateTail.length / moderateTarget);
    const end = Math.max(start + 1, Math.floor((stratum + 1) * moderateTail.length / moderateTarget));
    moderateSelected.push(moderateTail[start + Math.floor(random() * (end - start))]);
}
const tailSelected = [...moderateSelected, ...extremeTail]
    .sort((left, right) => left.durationSeconds - right.durationSeconds ||
        left.path.localeCompare(right.path));
writeFileSync(resolve(tailSampleArg), tailSelected.map(file =>
    `${relative(codDir, file.path)}\t${file.sizeBytes}\t${file.durationSeconds}`).join('\n') + '\n');
writeFileSync(resolve(tailMetadataArg), `${JSON.stringify({
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: resolve(slowLogArg),
    threshold_seconds: 1,
    available_slow_files_excluding_primary_sample: slowFiles.length,
    selection: 'all >30-second files plus seeded timing-stratified picks from 1-30 seconds',
    seed,
    sample_size: tailSelected.length,
    files_over_30_seconds: extremeTail.length,
    timing_range_seconds: [tailSelected[0].durationSeconds, tailSelected.at(-1).durationSeconds],
}, null, 2)}\n`);
console.log(`Wrote ${tailSelected.length} timing-tail files to ${resolve(tailSampleArg)}`);
