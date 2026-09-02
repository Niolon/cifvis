# Benchmark scope

This directory contains small, repeatable benchmarks useful for detecting performance
regressions in the library:

- `speed.mjs`: end-to-end browser loading and rendering;
- `labels.mjs`: atom-label layout and draw-call behaviour;
- `contour-lines.mjs`: contour sampling and extraction;
- `difference-density-symmetry.mjs`: direct versus symmetry-aware density surfaces;
- `surface-sampler.mjs`: generic `ScalarFieldGrid.sample()` versus prepared batch
  trilinear interpolation across density-grid and coordinate counts;
- `browser-node-fcalc-comparison.mjs`: browser-only density pipeline timings. Its
  `--representative-csv`, `--representative-root`, and `--representative-count` options
  select equal-count stratum midpoints from a population census for reproducible
  consistency runs. `analyze-browser-density-consistency.mjs` reports every named main
  thread and worker component separately, including run-to-run spread.
- `browser-density-structure-impact.mjs`: paired browser comparison of structure-display
  time with no worker, an idle worker, early reflection parsing with density deferred,
  or fully concurrent density work. It also accepts `CIFVIS_BUNDLES` for balanced
  production-bundle comparisons. Every variant receives the same reflection-bearing
  CIF and timing stops at the molecular-scene-ready milestone.

The `lib/` directory holds shared sampling, statistics, and browser-harness utilities
used by these benchmarks and by workspace analysis scripts.

Correctness testing across COD is exposed separately through `npm run test:cod`. It
reuses the deterministic sampling helper but does not mix browser timings or performance
thresholds into modifier and ORTEP findings.

For a paper campaign, run `../run-paper-campaign.sh` from the workspace root. It writes
the complete integration logs, timing CSVs, selected COD identifiers, environment
provenance, per-stage status, and campaign analysis artifacts into a new dated
directory. Integration and timing stages are deliberately sequential to avoid
contaminating wall-time measurements with database-test load.

`speed.mjs` accepts `--render-style`, `--adp-representation`, and
`--peanut-grid-pole-axis`, allowing direct
comparison of solid ellipsoids with clean, explanatory, and publication PEANUT modes.
Its CSV includes draw calls, Three.js geometry/texture counts, unique GPU attribute
bytes, and browser heap usage when Chrome exposes that metric.

Population-scale profiling, factorial sweeps, heuristic fitting, and report generation
are exploratory work rather than regression checks. Those scripts live in the workspace
`analysis/` directory. The completed FFT, IAM, DWF, extractor, patch-cache, and symmetry
crossover winner-selection campaigns have been moved there as historical analysis;
production benchmarks exercise only the selected implementations.

`density-pipeline-heuristic.json` records the latest frozen 5,000-structure COD
calibration. The 2026-08 campaign established the specialized CifVis Marching Cubes
path as the production extractor and changed the default progressive schedule to a
single final surface. A full Flying Edges implementation is intentionally closed for
now: clipping plus prepared lattice interpolation captures the material benefit, while
the remaining classification/interpolation work is too small to justify edge reuse.

`iam-cod-summary.json` records the frozen 1,000-structure real-reflection IAM kernel
campaign. Its separable phase-table kernel won across atom, reflection, and symmetry
buckets; a rotated-order recheck of every substantial apparent loss found no stable
crossover, so the production difference-density path uses that kernel unconditionally.
