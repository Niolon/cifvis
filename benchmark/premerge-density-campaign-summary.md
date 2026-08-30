# Difference-density pre-merge campaign

Run on 2026-08-30 from candidate `62c29a7` against `main` `8f782f4`, using Node
24.19.0, npm 11.17.0, Chrome 151.0.7922.173 and Linux 6.18.45 x86-64. Raw outputs
are intentionally ignored and stored under `/tmp`; this file records the curated result.

## Correctness

- Complete unit suite: 62 files and 1,266 tests passed; ESLint clean.
- Standard, all-dependencies, site and documentation builds passed. The site build has
  the existing Vite large-chunk advisory but no build failure.
- Math-lite parity: 200 randomized trials passed.
- Real COD-HKL FFT matrix: 98/100 usable pairs. The two rejected inputs had no unit-cell
  parameters. Mixed/Hermitian and optimized maps agreed exactly at the comparison
  samples; maximum direct-summation residual was `2.052e-7`.
- Real COD-HKL surface matrix: 46/50 usable pairs. All four rejected inputs lacked unit
  cells. Maximum direct-summation residual was `3.461e-8`; the largest patch cache was
  12.0 MiB, below the 64 MiB limit.
- Real COD-HKL IAM matrix: 199/200 usable pairs. One input contained no usable reflection
  intensities. Maximum absolute/relative kernel errors were `7.049e-12` and `4.037e-12`.
- First 1,000 COD structures: 998 structures generated successfully; the two rejected
  inputs contained placeholder coordinates only. ORTEP produced no NaNs or geometry
  failures. Across 3,018 modifier/growth runs there were no modifier, connectivity,
  bond-length, missing-atom or repeated-ID findings.
- Worker lifecycle: every p25/p50/p95/p99 load succeeded in recreate-lazy,
  persistent-lazy, prewarm-terminate and persistent-prewarm modes.
- Non-crystallographic rotation coefficients now have an explicit regression test and
  fail with a named non-integral reciprocal-rotation error.

## Browser scheduling

The balanced scheduling matrix used 50 equal-stratum structures, one discarded warm-up
and five measured runs per mode. Workers were prewarmed outside the timer.

| Mode | Structure-display p50 | Paired delta p50 | Paired delta p90 |
|---|---:|---:|---:|
| No worker | 31.1 ms | 0.0 ms | 0.0 ms |
| Prewarmed idle worker | 33.3 ms | +0.1 ms | +12.0 ms |
| Parse reflections early; defer density | 45.4 ms | +5.5 ms | +39.4 ms |
| Current early density | 50.5 ms | +13.7 ms | +48.2 ms |

Worker existence is effectively free. Reflection parsing accounts for part of the
structure delay; concurrent IAM/Fcalc/FFT accounts for the rest. A production prototype
that deferred the model handoff improved structure-first timing, but increased final
density wall time by 21.6 ms median (14%) and 79 ms p90 in the matched 50-case run.
Because `differenceDensity.autoLoad` defaults to false and deferral materially delayed
the requested density, the current early schedule is retained. A user-selectable
structure-priority policy should be considered separately rather than changing the
default during this merge.

## Main versus candidate

The no-density comparison loaded both production bundles in one browser process with
rotated order, one warm-up and five measured runs per structure.

| Structure display | main | candidate |
|---|---:|---:|
| p50 | 35.7 ms | 34.9 ms |
| p90 | 67.7 ms | 64.3 ms |
| p99 | 180.0 ms | 182.0 ms |

There is no population-level structure-only regression.

With first-worker startup included for both bundles, end-to-end structure plus density
over the same 50 structures was:

| Density display | main | candidate | Improvement |
|---|---:|---:|---:|
| p50 | 481.9 ms | 351.4 ms | 1.30x |
| p90 | 1,176.3 ms | 567.2 ms | 2.07x |
| p99 | 4,109.3 ms | 1,682.5 ms | 2.44x |

Five initially apparent regressions were rerun with five repetitions; every candidate
case was then 1.53-1.74x faster. A sixth file failed rapidly in both bundles because it
contains duplicate atom labels. The browser harness now records structure and density
success/error status so failed loads cannot be mistaken for fast results.

## Kernel and surface performance

- Real-data FFT median speedup: 2.08x on the 100-case matrix and 2.30x on the 50-case
  surface matrix.
- FFT allocation reduction: 3.69x and 4.06x respectively.
- Prepared IAM phase tables: 1.54x median speedup; fastest in 198/199 usable cases.
- CifVis cold surface extractor: 8.22x median speedup over Three.js.
- Warm patch return: 28.11x median speedup. Warm region-cache return was neutral at
  1.02x, validating the cold-cost fallback and direct production default.

## Bundle-size exception

The performance and correctness gates pass, but the planned 5% bundle-growth target is
not met. The all-dependencies ESM gzip grows from 470.01 to 504.76 KiB (+7.4%); the
standard ESM gzip grows from 275.18 to 299.97 KiB (+9.0%), and the split worker grows
from 189.69 to 223.79 KiB uncompressed (+18.0%). This is an explicit merge exception
for the new FFT kernels, extractor, cache paths and diagnostics. Further code splitting
is follow-up work because these synchronous runtime-selectable paths cannot be removed
without reducing the shipped feature set.

## Merge assessment

Correctness, structure-only performance, density performance, memory, surface, worker
lifecycle, build and lint gates pass. The current density scheduling remains intentional
and opt-in. The only acceptance exception requiring conscious sign-off is bundle size.
