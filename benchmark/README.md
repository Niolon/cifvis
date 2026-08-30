# Benchmark scope

This directory contains small, repeatable benchmarks useful for detecting performance
regressions in the library:

- `speed.mjs`: end-to-end browser loading and rendering;
- `labels.mjs`: atom-label layout and draw-call behaviour;
- `iam.mjs`: scalar, prepared-direct, and separable-phase IAM structure-factor calculation;
- `iam-cod.mjs`: the same three IAM kernels over a stratified real-reflection COD sample;
- `fcalc-dwf-cod.mjs`: direct Debye–Waller evaluation versus exact shared Uiso
  reflection vectors over a frozen, stratified real-reflection COD cohort;
- `contour-lines.mjs`: contour sampling and extraction;
- `difference-density-symmetry.mjs`: direct versus symmetry-aware density surfaces;
- `surface-extractor.mjs`: Three.js versus CifVis typed-array polygonization across
  lattice sizes and active-cell fractions;
- `surface-sampler.mjs`: generic `ScalarFieldGrid.sample()` versus prepared batch
  trilinear interpolation across density-grid and coordinate counts;
- `density-optimization-cod.mjs`: deterministic COD comparison of FFT modes, cold
  surface extractors, and warm expansion caches. Use `analyze-density-optimization.mjs`
  to summarize its CSV output by size, symmetry and active-cell occupancy.

The `lib/` directory holds shared sampling, statistics, and browser-harness utilities
used by these benchmarks and by workspace analysis scripts.

`speed.mjs` accepts `--render-style`, `--adp-representation`, and
`--peanut-grid-pole-axis`, allowing direct
comparison of solid ellipsoids with clean, explanatory, and publication PEANUT modes.
Its CSV includes draw calls, Three.js geometry/texture counts, unique GPU attribute
bytes, and browser heap usage when Chrome exposes that metric.

Population-scale profiling, factorial sweeps, heuristic fitting, and report generation
are exploratory work rather than regression checks. Those scripts live in the workspace
`analysis/` directory.

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
