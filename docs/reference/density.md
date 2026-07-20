# Scalar fields, difference density, and isosurfaces

Density loading is opt-in. Standard FCF or observed-intensity/IAM maps use the green/red
colours; explicitly configured or self-described custom coefficient columns are treated
as deformation density and use light blue/orange. The periodic Fourier grid is retained
when display or symmetry-growth settings change.

The options split into four groups by responsibility:

- **`differenceDensity`** — source-specific calculation settings (input mode, reflection
  reading, IAM, corrections, FFT grids).
- **`scalarField`** — the shared worker policy.
- **`isosurface`** — 3D mesh presentation (contour level, colours, resolution,
  progressive steps, symmetry reuse).
- **`contourLines`** — planar line sections.

Narrative documentation: [General → Density concepts](../general/density-concepts.md)
and [Library → Density maps](../library/density.md) (which also covers custom
coefficient columns and anomalous correction layouts in detail).

<OptionsTable group="density" />

## Common per-source collection options

These accompany individual loads (`loadDifferenceDensity`, `loadCube`,
`addScalarField`) and entries of `loadScalarFieldSources`; they are per-call options,
not part of the defaults object above.

| Option | Type | Description |
|---|---|---|
| `fieldId` | String | Stable collection identifier. Reusing it updates the existing entry instead of appending a duplicate. Default: generated. |
| `fieldName` | String | Human-readable source name exposed by collection metadata and events. |
| `activate` | Boolean | Whether to display the entry as it loads. Default: true for individual loads; last entry for `loadScalarFieldSources`. |

## `loadCube` options

| Option | Type | Description |
|---|---|---|
| `property` | String | `density`, `signed-density`, `orbital`, `potential`, or `generic`. Controls unit conversion, label, default contour, and whether one or both signs are drawn. Default: `"density"`. |
| `level` | Number | Absolute Cube contour level. Electron density defaults to 0.3 e/Å³; signed density defaults to 0.05 e/Å³; other properties default to three map standard deviations. |
| `datasetIndex` | Integer | Zero-based dataset/orbital selection for a multi-dataset Cube. Default: 0. |
| `valueScale` | Number | Explicit scalar-value multiplier. By default, Bohr-based density properties are converted from e/bohr³ to e/Å³ and other properties remain unscaled. |
| `displayLabel`, `quantityName`, `valueUnit` | String | Presentation metadata for generic, potential, and orbital fields. These values are emitted in density display events so the UI need not inspect the map. |
| `periodic` | Boolean | Controls cell wrapping. Default: true. |
| `sign` | String | `positive`, `negative`, or `both` surface signs. Default: property-dependent. |
