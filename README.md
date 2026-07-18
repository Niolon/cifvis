# CifVis - Crystal Structure Visualisation

A JavaScript library and web components for visualizing crystal structures from CIF files, powered by Three.js. Atoms, bonds and hydrogen bonds are displayed as entered in the cif. If you want an interactive explanation how to quickly get a structure on your website, [click here](https://niolon.github.io/cifvis/docs/widget-usage.html), an interactive viewer that allows you to load your own structure from CIF is available [here](https://niolon.github.io/cifvis/). Everything from CIF parsing, to structure construction, to display, is done locally on your browser using JavaScript, there is no server component.

## Documentation

The [full documentation site](https://niolon.github.io/cifvis/docs/) (a VitePress site under `docs/` in this repo; `npm run docs:dev` serves it locally) covers:

- [General](https://niolon.github.io/cifvis/docs/general/introduction.html) &mdash; what CifVis is and the shared concepts: the CIF model, the structure model and its Filters, and density-map theory.
- [Widget](https://niolon.github.io/cifvis/docs/widget/getting-started.html) &mdash; the `<cifview-widget>` component: attributes, loading data, display modes, density, and styling it (light DOM, CSS custom properties).
- [JS Library](https://niolon.github.io/cifvis/docs/library/getting-started.html) &mdash; parsing CIF files, driving `CrystalViewer` directly to build a custom GUI, density maps from code, Filters, coupled viewers, and using CifVis structures in your own Three.js scene.
- [Atom Labels](https://niolon.github.io/cifvis/docs/labels/) &mdash; activating labels and how the collision-free placement algorithms work.
- [Options Reference](https://niolon.github.io/cifvis/docs/reference/) &mdash; the full `options` schema shared by `CrystalViewer` and the widget, with tables generated from the source defaults.
- [Gallery](https://niolon.github.io/cifvis/docs/gallery/) &mdash; live application examples, each with widget and library reproduction code.
- [Developing CifVis](https://niolon.github.io/cifvis/docs/contributing/) &mdash; the lay of the land for contributors: what lives in each source folder and how the layers depend on each other.

For the full generated API reference (every exported class/method), run `npm run docs` to build it locally at `jsdoc-out/index.html`.

## Features

- Interactive 3D visualisation of crystal structures
- Support for anisotropic displacement parameters (ADPs)
- Display of bonds and hydrogen bonds
- Disorder group handling
- Crystal symmetry growing of structures 
- Progressive difference-density maps from FCF data or observed reflections plus an IAM calculation
- Custom complex coefficients for deformation-density maps, with symmetry-aware surface reuse
- Multi-block CIF selection in the playground and widget API
- Touch and mouse controls
- Widget for complete packaged solution

## Usage
### Node library
CifVis is available on npm and installing it into a project is as simple as executing:

```bash
npm install cifvis
```

### Web Component
For a comprehensive list of options and the use of the widget, look at the interactive explanation [here](https://niolon.github.io/cifvis/docs/widget-usage.html).
Widget HTML attributes use kebab-case (for example `hydrogen-mode`); keys inside the JSON `options` attribute use the same camelCase paths as `CrystalViewer`.

```html
<cifview-widget 
  src="structure.cif"
  caption="Crystal Structure"
  hydrogen-mode="none">
</cifview-widget>

<script type="module">
  import { CifViewWidget } from 'cifvis';
</script>
```


### Basic Viewer
```html
<div id="viewer"></div>
<script type="module">
  import { CrystalViewer } from 'cifvis';
  
  const viewer = new CrystalViewer(document.getElementById('viewer'));
  await viewer.loadCIF(cifContent);

  const stopListening = viewer.onScalarFieldUpdate(update => {
    if (update.type === 'update') {
      console.log(update.surfaceResolution, update.polygonCount);
    }
  });

  // Optional SHELXL LIST 6/8 Fo-Fc difference density. A worker first uses all
  // reflections on the normal FFT grid, then replaces it with an oversampled
  // grid and emits increasingly detailed surface meshes.
  await viewer.loadDifferenceDensity(fcfContent, 0, {
    sigmaLevel: 3,
    radius: 1.5,
    useSymmetry: true, // reuse exact disconnected symmetry-equivalent regions
  });

  // The cached density grid is reused when symmetry-growth modes change.
  // Benchmark direct and symmetry-aware surface generation with:
  // npm run bench:density-symmetry -- structure.cif reflections.fcf 10
</script>
```

### Coupled comparison viewers

Hydrogen, disorder, and symmetry modes plus the complete molecular transform,
pan, zoom, and camera reset can be coupled across any mixture of `CrystalViewer` and initialized
`<cifview-widget>` instances. Inputs are batched per animation frame and every
peer renders only once for that batch.

```javascript
import { coupleViewerInteractions } from 'cifvis';

const coupling = coupleViewerInteractions(leftViewer, rightViewer, thirdWidget);

// After independent loads: match modes, orientation, and absolute framing.
await coupling.synchronizeFrom(leftViewer);

// Viewers can be attached or detached later.
coupling.add(fourthViewer);
coupling.delete(rightViewer);

// Release the listeners when the comparison UI is removed.
coupling.dispose();
```

Selection stays independent because compared structures need not share atom
identifiers. Rotation and camera framing are matched exactly, giving every
viewer the same initial distance/orthographic size and subsequent zoom.

When coordinates and observed reflections are in the same CIF, the viewer can
calculate IAM phases and an Fo-Fc map automatically:

```javascript
const viewer = new CrystalViewer(document.getElementById('viewer'), {
  differenceDensity: { autoLoad: true },
});

const loaded = await viewer.loadCIF(cifContent);
// The structure is installed and can render before density processing starts.
const density = await loaded.differenceDensity;
```

Alternatively, enable it for one load with
`viewer.loadCIF(cifContent, 0, { differenceDensity: true })`. Automatic loading
is off by default, so normal structure loads do not start a worker or parse any
reflections. When enabled in a browser, reflection extraction and merging, IAM
structure factors, scale fitting, FFT, and progressive map calculation all run
in the dedicated density worker after structure construction. `inputMode:
'auto'` uses explicit FCF coefficients when available and otherwise constructs
the coefficients from the CIF observations and IAM calculation; use `'fcf'` or
`'cif-iam'` to force either path.

Once a field is displayed, the widget and playground add a compact two-line
control beside the other display buttons. It shows the active quantity and
contour magnitude. Repeated clicks cycle through every loaded field and then a
hidden state, without rerunning source processing or the FFT. Code-driven UIs
can select or cycle fields with `setActiveScalarField()` and
`cycleScalarField()`, or control visibility directly with
`viewer.updateIsosurfaceOptions({ visible: false })` or
`viewer.setIsosurfaceVisibility(false)`. Use
`viewer.clearScalarField()` to discard one entry and `viewer.clearScalarFields()`
to discard the collection. Source calculation,
worker execution, and presentation defaults are configured separately through
`differenceDensity`, `scalarField`, `isosurface`, and `contourLines` constructor
options.

For a line-only section like a conventional molecular contour plot, enable
`contourLines` and define its plane. No filled plane or background mesh is
created, so the widget's existing background colour remains in use:

```javascript
const viewer = new CrystalViewer(container, {
  contourLines: {
    enabled: true,
    plane: { atoms: ['C1', 'C2', 'O1'] },
    contourCount: 20,
  },
});
```

`plane: { mode: 'best-fit' }` uses all displayed atoms. Explicit planes accept
`{ coordinateSystem: 'fractional'|'cartesian', origin: [x,y,z], normal:
[x,y,z] }`. The playground exposes the same forms through its settings overlay
(cogwheel button): enable contour lines and edit the contour-plane JSON there.
Planar plots use tricubic field sampling and four line intervals per ordinary
surface level by default; set `interpolation: 'linear'`, `levelSubdivisions: 1`,
or an explicit `contourStep`/`levels` array when exact legacy spacing is wanted.
During progressive browser loads, plane sampling and Marching Squares run in
the scalar-field worker. Only packed line endpoints and the small Three.js line
installation step remain on the rendering thread.

Different source types can be declared together. Each entry retains its own
contour and appearance options:

```javascript
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
    text: orbitalCubeText,
    options: { property: 'orbital', level: 0.03 },
  },
]);
```

Individual `loadDifferenceDensity()`, `loadCube()`, and `addScalarField()` calls
also append. Supply `fieldId` to update an existing entry instead, and
`fieldName` to give it a UI-facing name.

The playground inspects uploaded multi-block CIFs and shows a block selector
only when more than one top-level `data_` block is present. The widget uses its
existing `block="index-or-name"` attribute, and direct viewer calls pass the
same selector as the second argument to `loadCIF` or `loadDifferenceDensity`.
After a coordinate structure is loaded, dropping reflection-only `.cif`,
`.fcf`, or Cube files onto the playground appends fields without replacing the
structure. The viewer rejects an entry when its unit cell does not match.

Gaussian Cube grids can be overlaid in the same way after loading their
coordinate CIF. Parsing stays in the density worker, the Cube cell must match
the structure cell, and the original grid is reused while the surface is
progressively refined:

```javascript
await viewer.loadCIF(coordinateCif);
await viewer.loadCube(cubeText, {
  property: 'density', // density, signed-density, orbital, potential, or generic
  level: 0.3,          // absolute contour value; density is normalized to e/Å³
  datasetIndex: 0,     // for multi-dataset/orbital Cube files
});
```

Positive voxel counts use Bohr coordinates and negative counts use Å. Density
properties from Bohr-based files are converted from e/bohr³ to e/Å³; other
properties retain their raw values unless `valueScale` is supplied. The
playground accepts `.cube` and `.cub` drops without replacing the structure.
Files named like density/charge/rho are treated as electron density; other
names use a generic signed field.

#### Custom and deformation-density coefficients

Quantum-crystallographic reflection loops can select arbitrary columns through
`differenceDensity.coefficientColumns`. One or two amplitudes are accepted. A
single phase is shared; two phases form the full complex difference
`F1 exp(i phi1) - F2 exp(i phi2)`.

Any explicitly configured or self-described custom coefficient loop is treated
as a deformation density. Its default positive/negative colors are light blue
(`#4FC3F7`) and orange (`#FF9800`), distinct from the green/red defaults used
for standard FCF and IAM Fo-Fc difference maps. All four colors remain
individually configurable.

```javascript
await viewer.loadDifferenceDensity(reflectionCif, 0, {
  coefficientColumns: {
    amplitudes: ['_refln_F_multipole', '_refln_F_iam'],
    phases: ['_refln_phase_multipole', '_refln_phase_iam'],
    phaseUnit: 'degrees', // default; 'radians' is also supported
  },
});

// A common-phase difference uses one phase column:
// amplitudes: [F1, F2], phases: phase
```

Direct crystallographic A/B coefficients are an alternative. They use
`F = A + iB`; two columns of each kind produce
`(A1 - A2) + i(B1 - B2)`.

```javascript
await viewer.loadDifferenceDensity(reflectionCif, 0, {
  coefficientColumns: {
    a: ['_refln_A_multipole', '_refln_A_iam'],
    b: ['_refln_B_multipole', '_refln_B_iam'],
    omitF000: false,
  },
});
```

Scalar `amplitude`/`phase` or `a`/`b` values create a single coefficient set
instead of a difference. Custom loop layouts can additionally set `loop`, `h`,
`k`, and `l`. Custom coefficients retain F(000) by default; the legacy SHELXL
Fo-Fc loader continues to omit it.

A single CIF can make a custom complex-coefficient loop auto-loadable by
providing `_cifvis_difference_density_loop`, `_h`, `_k`, `_l`, `_a`, and `_b`
mapping tags in the same data block. Each mapping names a column in the custom
reflection loop, so the coordinate model and deformation-density coefficients
can be distributed and loaded as one self-contained CIF. Additional operand
amplitude/phase columns may be retained for provenance without affecting the
automatically selected A/B coefficients.

The bundled generator creates that self-contained layout from a coordinate CIF
and one calculated FCF. It preserves the coordinate CIF (including its reported
positions and ADPs), calculates a neutral-atom IAM at those coordinates, and
appends the complex calculated-minus-IAM coefficients and their mapping tags:

```bash
npm run generate:deformation-cif -- coordinates.cif calculated.fcf deformation.cif
```

#### Anomalous-dispersion correction

An anomalous contribution calculated from the loaded coordinate model can be
removed before reflection symmetry and Friedel expansion:

```javascript
await viewer.loadDifferenceDensity(reflectionCif, 0, {
  coefficientColumns: {
    a: ['_refln_A_experimental', '_refln_A_theoretical'],
    b: ['_refln_B_experimental', '_refln_B_theoretical'],
  },
  anomalousDispersion: {
    target: 'first', // custom columns: correct F1 before forming F1 - F2
  },
});
```

When the required calculated coefficients are present, correction is selected
by an exact generator-independent test. For a centrosymmetric structure, a
non-zero deviation from the phases permitted by the inversion operation marks
an uncorrected file. In non-centrosymmetric structures, unmerged calculated
Friedel mates are tested against `F(-h) = conj(F(h))`: their amplitudes must
match and their phases must be opposite modulo 360 degrees. SHELXL FCFs should
therefore test as already corrected. If the exact test is unavailable, only an
FCF identified as generated by `olex2.refine` is corrected; other files are
left unchanged. Observed Friedel differences are never used for this decision.

Set `anomalousDispersion: false` (the default) to disable correction entirely.
When retaining an anomalous-dispersion configuration for custom deformation
coefficients, `anomalousDispersion: { phaseDetection: false }` explicitly
disables both phase classification and correction for that load.

For the built-in FCF4 Fo-Fc reader, measured and calculated F-squared values
both contain the anomalous contribution, so `target: 'both'` is the automatic
default. The correction therefore cancels in the final difference coefficient,
while its phase classification and metadata still record that both operands
were treated consistently. Custom coefficient layouts retain `target: 'first'`
as their default and can override it explicitly.

The calculation includes site occupancies, isotropic or anisotropic ADPs, all
space-group mates, and special positions. Dispersion factors are resolved in
this order: site-specific `_atom_site_dispersion_*` values, generic
`_atom_type_scat_dispersion_real`/`imag` values, configured fallback values,
then the internal IUCr tables. The internal tables cover every neutral element
from H through Cf at Cu Kalpha and Mo Kalpha wavelengths. They are selected
only when the CIF wavelength matches; values are not interpolated across
absorption edges.

For a CIF without dispersion factors at another wavelength, provide fallback
values explicitly (CIF values still win):

```javascript
anomalousDispersion: {
  values: {
    Se: { real: -3.2, imaginary: 3.8 },
  },
}
```

`target` may also be `second`, `both`, or `result`. Correcting both operands of
a two-term difference cancels, as it should when both contain the same model
anomalous contribution. For amplitude/phase columns the correction acts on the
complex coefficient constructed from the supplied phase; an amplitude alone
does not contain enough information for an exact complex correction.

#### IAM structure factors

The same symmetry, occupancy, and ADP atom sum is available as an independent
atom model calculator:

```javascript
import { createIAMStructureFactorCalculator } from 'cifvis/nobrowser';

const calculator = createIAMStructureFactorCalculator(coordinateCif, 0, {
  includeAnomalous: true, // default; false gives normal scattering only
});

const coefficient = calculator.coefficientAt(1, 2, 3);
// { real, imaginary }

const reflections = calculator.calculate([[1, 2, 3], { h: -1, k: -2, l: -3 }]);
// Each result adds amplitude and phase in degrees.
```

The normal factor is evaluated as
`f0(s) = sum(ai exp(-bi s^2)) + c`, with `s = sin(theta) / wavelength`.
Atoms with numerically identical normal and anomalous scattering models share
one form-factor evaluation per reflection; position, occupancy, and ADP terms
remain atom-specific.
Complete CIF `_atom_type_scat_Cromer_Mann_*` rows take precedence over
configured `cromerMann` values and the internal neutral-atom H-Cf table.
Anomalous terms use site CIF values first, then type CIF values, configured
`dispersionValues`, and finally the wavelength-selected Cu/Mo table. Missing
anomalous terms are zero; missing normal factors are an error.

`calculateIAMStructureFactors(cif, reflections, options)` is the one-shot
equivalent. Run `npm run bench:iam -- structure.cif` to time model construction
and reflection calculation; when the CIF embeds an FCF, the benchmark also
reports agreement with its `_refln_F_squared_calc` values.

#### Observed reflection intensities

Observed intensities can be normalized for direct comparison with IAM
structure factors:

```javascript
import {
  createIAMStructureFactorCalculator,
  readReflectionIntensities,
} from 'cifvis/nobrowser';

const observed = readReflectionIntensities(coordinateCif);
const calculated = createIAMStructureFactorCalculator(coordinateCif)
  .calculate(observed.reflections);
```

The reader first uses an already merged `_refln` loop, including an embedded
`_iucr_refine_fcf_details` FCF when present. It accepts measured intensity,
F-squared, or F columns and converts amplitudes to intensity when necessary.
If no merged data are available, it reads `_diffrn_refln_intensity_net` with
its `_u`/`_sigma` uncertainty, or a fixed-width `_shelx_hkl_file` multiline
entry. SHELX zero terminators are not treated as observations.

Raw `_diffrn_refln` and SHELX observations are filtered using the full
space-group general-position phase sum, so centering, screw-axis, and glide
systematic absences are removed before merging. Remaining equivalents use
inverse-variance weights. Friedel pairs are merged by default; set
`mergeFriedel: false` when anomalous differences must be retained. For source
diagnostics, `source` can force `refln`, `diffrn_refln`, or `shelx_hkl_file`.
The result metadata reports input/output counts, invalid rows, removed
systematic absences, and whether the source was already merged.

For a non-viewer calculation, use
`calculateDifferenceDensityMap(parseDifferenceDensitySource(cif))`; it performs
the complete observed-intensity/IAM calculation. The fitted positive
intensity scale maps observed intensities onto IAM `|Fc|^2`; negative measured
intensities are retained during merging and contribute zero observed amplitude
when the final `Fo-Fc` coefficient is formed.

When the coordinate CIF reports the SHELXL isotropic extinction expression and
a positive `_refine_ls_extinction_coef`, raw observed intensities are corrected
automatically before forming `Fo-Fc`. The overall scale is fitted against the
extinction-attenuated IAM intensities, while the displayed observed amplitudes
are restored to the unextinguished scale. Embedded final FCF observations are
not corrected a second time. Set `differenceDensity.extinctionCorrection:
false` to retain deliberately uncorrected observed amplitudes, or provide
`{ coefficient, wavelength }` to override the CIF values.



### API Reference

The package exports the following:

```javascript
import { 
  CrystalViewer,   // Main viewer class
  CIF,             // CIF file parser
  CrystalStructure, // Crystal structure data model
  ORTEP3JsStructure, // ORTEP-style structure visualisation
  CifViewWidget,    // Web component
  formatValueEsd    // Utility for formatting values with ESDs
} from 'cifvis';
```

#### CrystalViewer Options

```javascript
const viewer = new CrystalViewer(container, {
  camera: {
    wheelZoomSpeed: 0.0008,
    fov: 45,
  },
  selection: {
    mode: 'multiple', // or 'single'
    markerMult: 1.3,
    bondMarkerMult: 1.7
  },
  interaction: {
    rotationSpeed: 5,
    clickThreshold: 200
  },
  atomCutawayStripeCount: 7, // Horizontal hatch lines across each cutaway disc
  atomCutawayStripeWidth: 0.5, // Equal atom-colour stripe and contrasting gap widths
  atomLabels: {
    show: ['C1', { id: 'O1', text: 'O(carbonyl)', priority: 10 }],
    colorMode: 'atom', // element palette scaled together to a readability ceiling
    atomColorLuminanceCeiling: 0.25,
    placementMode: 'auto-omit', // adaptive; or quality, performance, maximum coverage
    calloutPlacement: 'structure', // compact; 'viewport' uses the full width
    maxConnectorLength: 250, // optional hard CSS-pixel ceiling
    fontSize: 14,
  },
  renderStyle: 'solid-3d', // 'cutout-3d': camera-facing ORTEP octant cutaway; 'cutout-2d': publication plot (always cutaway; PART 2 bonds are outline-only)
  bondColorMode: 'uniform', // 'split': color each 3D bond half like its connected atom
  plot2DOpenBondInnerScale: 0.5, // Opaque white width inside open PART 2 bonds
  plot2DBondOutlineScale: 1.18, // Small depth-writing white halo at crossings
  plot2DStripeCount: 7,
  plot2DStripeWidth: 0.18,
  hydrogenMode: 'none',    // 'none', 'constant', 'anisotropic'
  disorderMode: 'all',     // 'all', 'group1of2', 'group2of2', ... "group<rank>of<total>" per disorder group in the structure
  symmetryMode: 'none' // 'none', 'hbonds', 'fragment', 'fragment-hbonds', 'cell', 'fragment-cell'
});
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Run test on a database folder (will create a logs subfolder in integration-tests)
npm run test:database-modifiers -- /folder/of/database && npm run test:database-ortep -- /folder/of/database

# Build for production
npm run build

# build for production including dependencies
npm run build:alldeps

# prepare, publish, and clean the self-contained GitHub Pages deployment
npm run deploy

# build deployment/ without publishing, or remove generated deployment files
npm run build:deployment
npm run clean:deployment

# benchmark atom-label layout (uses the shipped demo CIFs by default)
npm run bench:labels

# benchmark IAM factors and direct versus symmetry-aware density surfaces
npm run bench:iam -- structure.cif 20
npm run bench:density-symmetry -- structure.cif reflections.fcf 10

# calibrate the complete synthetic Fo-Fc pipeline on a size-stratified COD sample
npm run bench:density-cod -- /path/to/cod/cif --sample 5000 \
  --out benchmark/density-pipeline-cod.csv

# refit estimates and preview schedules from an existing calibration CSV
npm run bench:density-fit

# isolate worker-eligible plane sampling/extraction from main-thread line geometry
npm run bench:contours -- structure.cif scalar-field.cube 7
```

`bench:density-cod` generates an absence-filtered HKL set without timing it,
times IAM Fcalc, creates deterministic noisy Fobs without timing it, then times
the FFT density and symmetry-aware Marching Cubes stages separately. The CSV
records asymmetric-unit and symmetry-expanded unit-cell atom counts, cell
parameters, CIF file size and empirical size quantile, grid/mesh sizes, processor calibration at the beginning and end,
CPU-normalized work scores, fitted estimates, and bounded progressive-preview
fractions. Estimates below 300 ms run only once. Longer calculations may receive
up to five 100–200 ms previews, but preview work is capped at 750 ms and at 50%
of the estimated final calculation. Longer gaps should report progress without
starting another calculation. The robust log-linear component models and
held-out validation errors are written to
`benchmark/density-pipeline-heuristic.json`. Directory samples use one deterministic random entry from each
equal-probability stratum of the complete COD file-size distribution, then shuffle execution order to keep processor
drift independent of file size. The CSV is checkpointed every 25 structures.
`bench:density-fit` can rebuild the estimates, schedules, and model sidecar from
that CSV without rerunning the expensive COD benchmark.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

WebGL support is required.

## License

This project is licensed under the Mozilla Public License Version 2.0 - see the [LICENSE](LICENSE.md) file for details.

## Citation

If you use this software in academic work, please cite it like this until a proper publication has been written up:

```bibtex
@software{cifvis,
  author = {Paul Niklas Ruth},
  title = {CifVis: A JavaScript Library for Crystal Structure Visualisation},
  year = {2025},
  url = {https://github.com/niolon/cifvis}
}
```
