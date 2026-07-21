# Benchmark scope

This directory contains small, repeatable benchmarks useful for detecting performance
regressions in the library:

- `speed.mjs`: end-to-end browser loading and rendering;
- `labels.mjs`: atom-label layout and draw-call behaviour;
- `iam.mjs`: IAM structure-factor construction and calculation;
- `contour-lines.mjs`: contour sampling and extraction;
- `difference-density-symmetry.mjs`: direct versus symmetry-aware density surfaces.

The `lib/` directory holds shared sampling, statistics, and browser-harness utilities
used by these benchmarks and by workspace analysis scripts.

Population-scale profiling, factorial sweeps, heuristic fitting, and report generation
are exploratory work rather than regression checks. Those scripts live in the workspace
`analysis/` directory.
