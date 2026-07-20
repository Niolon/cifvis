# Density concepts

CifVis can overlay crystal structures with **difference electron density**
(Fo−Fc), **deformation density**, and arbitrary scalar fields from Gaussian
Cube files. This page explains the concepts; the how-to lives in
[Widget → Density maps](../widget/density.md) and
[Library → Density maps](../library/density.md).

## What is difference density?

A difference-density map shows where the measured electron density differs from the
density predicted by the refined structural model: positive regions (by default green)
mark density the model misses, negative regions (red) mark density the model overstates.
It is calculated as a Fourier sum over reflections with coefficients Fo−Fc — observed
minus calculated structure factors.

**Deformation density** instead compares an elaborate model (e.g. a multipole or other
quantum-crystallographic model) against a neutral spherical-atom (IAM) reference,
showing chemical bonding features. CifVis displays any explicitly configured or
self-described custom coefficient loop as deformation density, with light-blue/orange
colours to distinguish it from green/red Fo−Fc maps.

## Where the coefficients come from

Density work is deliberately separate from basic structure loading, and opt-in. The
pipeline can read several sources:

- **FCF coefficients** — standard SHELXL LIST 6/8 FCF data with explicit Fo/Fc columns.
- **Observed reflections plus IAM** — merged `_refln` intensities, unmerged
  `_diffrn_refln` intensities, embedded `_iucr_refine_fcf_details`, or multiline SHELX
  HKL data. Unmerged sources are symmetry-merged and systematic absences are removed.
- **Custom coefficient loops** — one or two amplitudes with common or split phases, or
  direct crystallographic A/B columns, for deformation-density work.
- **Gaussian Cube files** — pre-calculated scalar fields (density, orbitals,
  potentials) on a grid matching the unit cell.

With `inputMode: "auto"`, explicit FCF coefficients are preferred. If none are
advertised, CifVis fits an observed-intensity scale, calculates IAM structure
factors/phases from the already-built coordinate model, applies supported SHELXL
extinction correction (EXTI), and forms an Fo−Fc map. The IAM uses occupancies, literal
isotropic/anisotropic ADPs (non-positive-definite ADPs are reported but not changed),
symmetry mates, and special-position deduplication.

An uncorrected anomalous contribution can be detected from inversion/Friedel
constraints, with Olex metadata as fallback; f′/f″ values from the coordinate CIF take
precedence over the internal Cu/Mo tables.

If the structure was refined with a SHELXL solvent mask (`MASK`, e.g. via Olex2's
"bypass" or PLATON SQUEEZE-style workflows) and the CIF embeds the resulting
`_shelx_fab_file`, CifVis adds that per-reflection mask contribution to the IAM Fcalc
before forming Fo−Fc, matching what SHELXL used during refinement. This only applies to
the observed-reflections-plus-IAM path: an explicit FCF's `F_calc` column already
includes any mask contribution baked in. A `_smtbx_masks_void_*` void summary, when
present, is surfaced alongside the correction for context but is not itself used
numerically.

## Progressive display

Reflection parsing, IAM calculation, FFT, and surface generation run in a dedicated Web
Worker by default (with a main-thread fallback). The first display uses all selected
reflections on the initial FFT grid; the worker then installs the final oversampled grid
and increases surface tessellation step by step — later steps refine detail but never
move the density. Surface resolution grows with the physical draw size, bounded by a
maximum.

Exactly symmetry-equivalent disconnected regions can reuse geometry, while intersecting
clipping masks are polygonized as one field so bridges have no internal seams.

## Isosurfaces and planar contours

Two renderings of the same scalar field are available:

- **3D isosurfaces** — wireframe (or solid) surfaces at ±nσ (or absolute levels),
  clipped to a radius around the displayed atoms.
- **Planar contour lines** — line-only contours sampled on a plane (three atoms,
  best-fit, or an explicit origin/normal). No plane fill is drawn, so the viewer or
  widget background stays visible.

Internally, every source produces the same renderer-independent `ScalarFieldGrid`, with
separate source, field-kind, units, contour, and boundary metadata. Multiple fields form
an ordered collection you can cycle through — each retains its own contour levels,
colours, and appearance.

## Where to go next

- Enable density on the widget: [Widget → Density maps](../widget/density.md)
- Drive the pipeline from code, load Cube files, custom coefficients:
  [Library → Density maps](../library/density.md)
- Every setting: [Options Reference → Density & scalar fields](../reference/density.md)
