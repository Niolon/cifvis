# Benchmark scope

This directory contains small, repeatable benchmarks useful for detecting performance
regressions in the library:

- `speed.mjs`: end-to-end browser loading and rendering;
- `labels.mjs`: atom-label layout and draw-call behaviour;
- `iam.mjs`: IAM structure-factor construction and calculation;
- `contour-lines.mjs`: contour sampling and extraction;
- `difference-density-symmetry.mjs`: direct versus symmetry-aware density surfaces;
- `surface-extractor.mjs`: Three.js versus CifVis typed-array polygonization across
  lattice sizes and active-cell fractions;
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
