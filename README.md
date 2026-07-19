# CifVis - Crystal Structure Visualisation

A JavaScript library and web component for visualising crystal structures from CIF files, powered by Three.js. Atoms, bonds and hydrogen bonds are displayed as entered in the CIF. Everything &mdash; CIF parsing, structure construction, and display &mdash; runs locally in the browser; there is no server component.

- **Try it:** [interactive viewer](https://niolon.github.io/cifvis/) &mdash; load your own CIF.
- **Add it to your site:** [interactive widget walkthrough](https://niolon.github.io/cifvis/docs/widget-usage.html).

## Features

- Interactive 3D visualisation of crystal structures
- Anisotropic displacement parameters (ADPs), bonds, and hydrogen bonds
- Disorder group handling and crystal symmetry growing
- Difference- and deformation-density maps and contour sections
- Gaussian Cube overlays
- Coupled comparison viewers
- Collision-free atom labels
- Touch and mouse controls
- Self-contained web component

## Documentation

The [full documentation site](https://niolon.github.io/cifvis/docs/) is the source of truth for everything below. It is a VitePress site under `docs/`; run `npm run docs:dev` to serve it locally.

- [General](https://niolon.github.io/cifvis/docs/general/introduction.html) &mdash; what CifVis is and the shared concepts (CIF model, structure model, Filters, density theory).
- [Widget](https://niolon.github.io/cifvis/docs/widget/getting-started.html) &mdash; the `<cifview-widget>` component: attributes, loading data, display modes, density, styling.
- [JS Library](https://niolon.github.io/cifvis/docs/library/getting-started.html) &mdash; parsing CIFs, driving `CrystalViewer`, density maps, Filters, coupled viewers, Three.js integration.
- [Atom Labels](https://niolon.github.io/cifvis/docs/labels/) &mdash; activating labels and how placement works.
- [Options Reference](https://niolon.github.io/cifvis/docs/reference/) &mdash; the full `options` schema shared by `CrystalViewer` and the widget.
- [Gallery](https://niolon.github.io/cifvis/docs/gallery/) &mdash; live examples with widget and library code.
- [Developing CifVis](https://niolon.github.io/cifvis/docs/contributing/) &mdash; source layout and how the layers fit together.

For the generated API reference (every exported class/method), run `npm run docs` to build it at `jsdoc-out/index.html`.

## Installation

```bash
npm install cifvis
```

## Quick start

### Web component

```html
<cifview-widget src="structure.cif" caption="Crystal Structure"></cifview-widget>

<script type="module">
  import { CifViewWidget } from 'cifvis';
</script>
```

See the [widget docs](https://niolon.github.io/cifvis/docs/widget/getting-started.html) for attributes, options, and styling.

### Library

```html
<div id="viewer"></div>
<script type="module">
  import { CrystalViewer } from 'cifvis';

  const viewer = new CrystalViewer(document.getElementById('viewer'));
  await viewer.loadCIF(cifContent);
</script>
```

The package also exports `CIF`, `CrystalStructure`, `ORTEP3JsStructure`, `formatValueEsd`, and `coupleViewerInteractions`. See the [library docs](https://niolon.github.io/cifvis/docs/library/getting-started.html) for the full API, density maps, and coupled viewers.

## Development

```bash
npm install       # install dependencies
npm run dev       # start development server
npm test          # run unit tests
npm run build     # build for production
npm run deploy    # build and publish the GitHub Pages deployment
```

Additional benchmark and integration-test scripts are documented in the [contributing guide](https://niolon.github.io/cifvis/docs/contributing/).

## Browser support

Chrome, Firefox, Safari, and Edge (latest). WebGL is required.

## License

Licensed under the Mozilla Public License Version 2.0 &mdash; see [LICENSE](LICENSE.md).

## Citation

If you use this software in academic work, please cite it like this until a proper publication is available:

```bibtex
@software{cifvis,
  author = {Paul Niklas Ruth},
  title = {CifVis: A JavaScript Library for Crystal Structure Visualisation},
  year = {2025},
  url = {https://github.com/niolon/cifvis}
}
```
