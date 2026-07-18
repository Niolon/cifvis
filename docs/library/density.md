# Density maps from code

Density work is deliberately separate from basic structure loading (the background is in
[General → Density concepts](../general/density-concepts.md)). In a browser it runs
after the coordinate structure has been built and rendered, using a dedicated worker by
default. The worker can read standard FCF coefficients, merged `_refln` intensities,
unmerged `_diffrn_refln` intensities, embedded `_iucr_refine_fcf_details`, and multiline
SHELX HKL data. Unmerged sources are symmetry-merged and systematic absences are
removed.

```js
const loaded = await viewer.loadCIF(cifText, 0, {
    differenceDensity: true,
});

// Coordinates are already installed here; density finishes asynchronously.
const density = await loaded.differenceDensity;
```

With `inputMode: "auto"`, explicit FCF coefficients are preferred. If none are
advertised, CifVis fits an observed-intensity scale, calculates IAM structure
factors/phases from the already-built coordinate model, applies supported SHELXL
extinction correction, and forms an Fo−Fc map. The IAM uses occupancies, literal
isotropic/anisotropic ADPs (non-positive-definite ADPs are reported but not changed),
symmetry mates, and special-position deduplication.

```js
const stop = viewer.onScalarFieldUpdate(update => {
    if (update.type === 'update') {
        console.log(update.progress, update.polygonCount, update.sigma);
    }
});

viewer.updateIsosurfaceOptions({ sigmaLevel: 2.5 });
viewer.updateContourLineOptions({
    enabled: true,
    plane: { atoms: ['C1', 'C2', 'O1'] },
    contourCount: 20,
});
viewer.setIsosurfaceVisibility(false); // instant: retains field + meshes
viewer.setIsosurfaceVisibility(true);
viewer.clearScalarField();
stop();
```

## Multiple fields and source types

Source loaders append to an ordered collection. The density button cycles through each
field and then through a hidden state. Every field retains its own absolute or sigma
contour, colours, opacity, and tessellation options. Reusing a `fieldId` updates that
entry instead of adding a duplicate.

```js
await viewer.loadScalarFieldSources([
    {
        type: 'difference-density',
        id: 'fo-fc',
        name: 'Fo-Fc',
        text: fcfText,
        options: { sigmaLevel: 3 },
    },
    {
        type: 'cube',
        id: 'homo',
        name: 'HOMO',
        text: cubeText,
        options: { property: 'orbital', level: 0.03 },
    },
]);

viewer.setActiveScalarField('fo-fc');
viewer.cycleScalarField();
console.log(viewer.getScalarFields());
```

## Gaussian Cube grids

Load the coordinate CIF first, then overlay a Cube whose three voxel-axis spans describe
the same unit cell. Positive voxel counts use Bohr coordinates and negative counts use
Å. For `property: "density"` or `"signed-density"`, Bohr-based values are converted from
e/bohr³ to e/Å³. Cube parsing remains in the density worker and emits the same
progressive events as reflection-derived maps.

```js
await viewer.loadCIF(coordinateCif);
const result = await viewer.loadCube(cubeText, {
    property: 'density',
    level: 0.3,
    datasetIndex: 0,
});
```

The supported property modes are `density`, `signed-density`, `orbital`, `potential`,
and `generic`. Electron density defaults to one positive contour; the other modes are
signed. Use `valueScale`, `displayLabel`, and `quantityName` when the Cube property or
units are not encoded in the file. Multi-orbital files use `datasetIndex`. The viewer
validates the Cube cell before appending or updating the collection entry.

## The event boundary

UI code should treat the scalar-field events as the public boundary. Progress events
include `stepIndex`/`totalSteps`; display-bearing events include `available`, `visible`,
`level`, `sigmaLevel`, `fieldCount`, `activeFieldIndex`, `activeFieldId`, and
`activeFieldName`. The `display` event reports contour, appearance, and active-entry
changes. A UI therefore does not need to inspect renderer groups, grid objects, or other
fields under `viewer.state`.

## Planar contour lines

Set `contourLines.enabled` to replace the 3D mesh with marching-squares lines sampled on
a Cartesian plane. Define the plane with three or more atom labels, use the best-fit
plane through all displayed atoms, or provide an explicit origin and normal. The contour
adapter never draws a filled plane, so existing viewer and widget background colours are
preserved. The default plane grid uses tricubic interpolation, and four line intervals
fit inside the ordinary surface level. For a 3σ map this begins at 0.75σ instead of
jumping from 3σ directly to 6σ. For progressive worker loads, plane sampling and
Marching Squares are renderer-independent worker tasks. The main thread receives packed
endpoints and only creates the Three.js line objects.

```js
const viewer = new CrystalViewer(container, {
    contourLines: {
        enabled: true,
        plane: { atoms: ['C1', 'C2', 'O1'] },
        contourCount: 20,
    },
});

// Alternatives:
// plane: { mode: 'best-fit' }
// plane: { coordinateSystem: 'fractional', origin: [0,0,0.5], normal: [0,0,1] }

viewer.updateContourLineOptions({ plane: { atoms: ['N1', 'C2', 'C3'] } });
```

The playground query flag accepts `?contours=best-fit`, `?contours=atoms:C1,C2,O1`,
`?contours=frac:0,0,0.5:0,0,1`, or the equivalent `cart:` form.

## Custom quantum-crystallographic coefficients

`coefficientColumns` accepts one or two amplitudes with a common or split phase, or
direct crystallographic A/B columns. Any explicitly configured or self-described custom
loop is classified as deformation density, giving it light-blue/orange defaults distinct
from green/red Fo−Fc maps. Custom coefficients retain F(000) unless explicitly omitted.

```js
await viewer.loadDifferenceDensity(cifText, 0, {
    coefficientColumns: {
        amplitudes: ['_refln_F_multipole', '_refln_F_iam'],
        phases: ['_refln_phase_multipole', '_refln_phase_iam'],
        phaseUnit: 'degrees',
    },
});

// Equivalent direct-complex form:
// a: ['_refln_A_multipole', '_refln_A_iam']
// b: ['_refln_B_multipole', '_refln_B_iam']
```

A self-contained CIF can map a custom loop with `_cifvis_difference_density_loop`, `_h`,
`_k`, `_l`, `_a`, and `_b` tags. Anomalous-dispersion correction supports CIF-preferred
site/type values, internal Cu/Mo tables, exact inversion/Friedel phase tests,
configurable operands, and `phaseDetection: false` for deliberate deformation
coefficients.

```bash
npm run generate:deformation-cif -- coordinates.cif calculated.fcf deformation.cif
```

The generator preserves the coordinate CIF's positions and ADPs, calculates a
neutral-atom IAM at that model, and appends a self-described calculated-minus-IAM
complex coefficient loop. The output is a single distributable CIF; source filenames are
recorded as basenames, not parent-directory paths.

## Progressive display and symmetry

The first display uses all selected reflections on the initial FFT grid. The worker then
installs the final oversampled grid and increases surface tessellation according to
`progressiveSteps`; later steps do not move the density. Surface resolution grows with
the Cartesian draw size up to `maxResolution`. Exactly symmetry-equivalent disconnected
regions can reuse geometry, while intersecting clipping masks are polygonized as one
field so bridges have no internal seams. Planar-line mode applies the same progressive
fractions to its investigation grid in the worker, so the first contour plot is cheaper
and later updates add line detail without blocking plane sampling on the rendering
thread.

Internally, every source produces the same renderer-independent `ScalarFieldGrid`, with
separate source, field-kind, units, contour, and boundary metadata. Dedicated Three.js
isosurface and contour-line adapters (`ThreeIsosurfaceLayer`, `ThreeContourLineLayer`)
own rendering and disposal; `CrystalViewer` only coordinates the source, displayed
structure, events, and render requests. This keeps Cube density, deformation density,
orbitals, potentials, and future scalar fields out of the Fo−Fc-specific API.

## Advanced: the numerical toolbox

The package root and `cifvis/nobrowser` export the lower-level building blocks the
pipeline is made of, so batch tooling and research code can use them without a viewer.
All of them carry full JSDoc (`npm run docs`):

| Export | Purpose |
|---|---|
| `parseDifferenceDensitySource` | Parses FCF/CIF/custom-coefficient sources into reflection coefficients. |
| `calculateDifferenceDensityMap` | Runs the Fourier/FFT pipeline from coefficients to a density grid. |
| `createCifDifferenceDensityDataset` | Builds a complete dataset (coefficients + metadata) from a CIF block. |
| `ScalarFieldGrid` | The renderer-independent periodic scalar grid every source produces. |
| `parseCube`, `BOHR_TO_ANGSTROM` | Gaussian Cube parsing and unit conversion. |
| `createIsosurfaces`, `createSymmetryAwareIsosurfaces` | Marching-cubes surface extraction, optionally reusing symmetry-equivalent regions. |
| `isosurfaceBounds`, `isosurfaceResolution`, `connectedIsosurfaceRegions` | Bounds, draw-size-dependent resolution, and region connectivity helpers. |
| `calculatePlanarContours`, `resolveContourPlane` | Marching-squares planar contours and plane-definition resolution. |
| `calculateIAMStructureFactors`, `createIAMStructureFactorCalculator` | Independent-atom-model structure factors for a `CrystalStructure`. |
| `evaluateCromerMann`, `lookupCromerMann` | Cromer–Mann scattering-factor evaluation and coefficient lookup. |
| `lookupAnomalousDispersion` | f′/f″ lookup from the internal Cu/Mo tables. |
| `readReflectionIntensities`, `mergeReflectionIntensities`, `isSystematicAbsence` | Reflection reading, symmetry merging, and absence tests. |
| `DEFAULT_DIFFERENCE_DENSITY_OPTIONS`, `DEFAULT_SCALAR_FIELD_OPTIONS`, `DEFAULT_ISOSURFACE_OPTIONS`, `DEFAULT_CONTOUR_LINE_OPTIONS` | The frozen default option objects the viewer merges over. |

See [Options Reference → Density & scalar fields](../reference/density.md) for every
setting.
