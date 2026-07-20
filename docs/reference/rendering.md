# Rendering settings

These options control how the 3D structure is rendered.

## Render styles {#render-styles}

`renderStyle` selects one of three ORTEP styles (live comparison in
[Widget → Display options](../widget/display-options.md#ortep-render-modes)):

- **`solid-3d`** — shared-geometry ellipsoids, the default and the only style eligible
  for `InstancedMesh` batching.
- **`cutout-3d`** — ellipsoids with a missing camera-facing octant, exposing hatched
  interior cutaway planes.
- **`cutout-2d`** — hatched, outlined publication-style renderer (element colours
  retained); always cutaway like `cutout-3d`, but with hatch materials instead of solid
  ones. The `plot2D*` options below tune this style; a worked example is in the
  [Gallery](../gallery/publication-2d.md).

`renderMode: 'onDemand'` (the default) renders only when needed — call
`viewer.requestRender()` after changing external state from your own code;
`'constant'` renders continuously.

In the cutout styles, `sealCutoutCavity` (default on) fills the removed octant in the
depth buffer so a neighbouring atom or bond that lies inside the carved-open cavity is
occluded instead of showing through, while the exposed cross-section stays visible.

<OptionsTable group="rendering" />
