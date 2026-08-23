# Rendering settings

These options control how the 3D structure is rendered.

## Render styles {#render-styles}

`adpRepresentation` selects the physical anisotropic-displacement surface:

- **`ellipsoid`** (default) — the conventional equal-probability ellipsoid;
- **`rmsd-peanut`** — a radial RMS displacement surface with
  `r(n) = peanutScale × sqrt(nᵀUn)`. Its radius has units of length after scaling and
  must not be interpreted as an enclosed probability.

PEANUT grid density and physical stroke width can be adjusted independently with
`peanutMeridianCount`, `peanutLatitudeIntervals`, and `peanutGridLineWidth`. The
line width is measured in &Aring;, so its apparent screen width changes naturally with zoom.
`peanutGridPoleAxis` selects either a common structure Y pole or an atom-local maximum,
intermediate, or minimum principal-displacement axis.

`renderStyle` independently selects how that surface is presented (live comparison in
[Widget → Display options](../widget/display-options.md#ortep-render-modes)):

- **`solid-3d`** — a smooth, lit solid surface.
- **`cutout-3d`** — a missing-octant ellipsoid, or a solid PEANUT with an orderly
  surface grid in the element's `ringColor`.
- **`cutout-2d`** — a hatched ellipsoid cutout, or a PEANUT grid with hidden rear
  lines removed and a separate expanded silhouette outline. PEANUT grid strokes have a
  physical structure-space width, while the silhouette keeps a constant screen-space
  width. Existing publication colour and bond rules apply.

All PEANUT modes use shared sphere topology and instancing. There are no PEANUT cutouts.

`renderMode: 'onDemand'` (the default) renders only when needed — call
`viewer.requestRender()` after changing external state from your own code;
`'constant'` renders continuously.

In the cutout styles, `sealCutoutCavity` (default on) fills the removed octant in the
depth buffer so a neighbouring atom or bond that lies inside the carved-open cavity is
occluded instead of showing through, while the exposed cross-section stays visible.

<OptionsTable group="rendering" />
