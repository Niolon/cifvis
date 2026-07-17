# CifVis - Crystal Structure Visualisation

A JavaScript library and web components for visualizing crystal structures from CIF files, powered by Three.js. Atoms, bonds and hydrogen bonds are displayed as entered in the cif. If you want an interactive explanation how to quickly get a structure on your website, [click here](https://niolon.github.io/cifvis/docs/widget-usage.html), an interactive viewer that allows you to load your own structure from CIF is available [here](https://niolon.github.io/cifvis/). Everything from CIF parsing, to structure construction, to display, is done locally on your browser using JavaScript, there is no server component.

## Documentation

The [full documentation hub](https://niolon.github.io/cifvis/docs/index.html) (also under `site/docs/` in this repo) covers:

- [Developing with CifVis](https://niolon.github.io/cifvis/docs/using-cifvis.html) &mdash; parsing CIF files (Blocks, entries, Loops), driving `CrystalViewer` directly to build a custom GUI, using Filters, and using CifVis structures in your own Three.js scene.
- [Widget Usage](https://niolon.github.io/cifvis/docs/widget-usage.html) &mdash; the `<cifview-widget>` component: attributes, display modes, and styling it (light DOM, CSS custom properties).
- [Options Reference](https://niolon.github.io/cifvis/docs/options-reference.html) &mdash; the full `options` schema shared by `CrystalViewer` and the widget.
- [Developing CifVis](https://niolon.github.io/cifvis/docs/developing-cifvis.html) &mdash; the lay of the land for contributors: what lives in each source folder and how the layers depend on each other.

For the full generated API reference (every exported class/method), run `npm run docs` to build it locally at `jsdoc-out/index.html`.

## Features

- Interactive 3D visualisation of crystal structures
- Support for anisotropic displacement parameters (ADPs)
- Display of bonds and hydrogen bonds
- Disorder group handling
- Crystal symmetry growing of structures 
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

  const stopListening = viewer.onDifferenceDensityUpdate(update => {
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

#### Custom and deformation-density coefficients

Quantum-crystallographic reflection loops can select arbitrary columns through
`differenceDensity.coefficientColumns`. One or two amplitudes are accepted. A
single phase is shared; two phases form the full complex difference
`F1 exp(i phi1) - F2 exp(i phi2)`.

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
    zoomSpeed: 0.1,
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
    placementMode: 'auto-omit', // adaptive; or quality, performance, maximum coverage
    calloutPlacement: 'structure', // compact; 'viewport' uses the full width
    maxConnectorLength: 250, // optional hard CSS-pixel ceiling
    fontSize: 14,
  },
  renderStyle: 'solid-3d', // 'cutout-3d': camera-facing ORTEP octant cutaway; 'cutout-2d': publication plot (always cutaway; PART 2 bonds are outline-only)
  plot2DOpenBondInnerScale: 0.5, // Opaque white width inside open PART 2 bonds
  plot2DStripeCount: 7,
  plot2DStripeWidth: 0.18,
  hydrogenMode: 'none',    // 'none', 'constant', 'anisotropic'
  disorderMode: 'all',     // 'all', 'group1of2', 'group2of2', ... "group<rank>of<total>" per disorder group in the structure
  symmetryMode: 'bonds-no-hbonds-no' // See symmetry modes below
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

# benchmark atom-label layout (uses the shipped demo CIFs by default)
npm run bench:labels
```

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
