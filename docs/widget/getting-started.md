# Getting started with the widget

CifVis provides a convenient web component (`<cifview-widget>`) that makes it easy to
display interactive 3D models of crystal structures in your web pages.

Adding a crystal structure visualization to your webpage is as simple as including the
CifVis library and adding the `<cifview-widget>` element:

```html
<script type="module">
import { CifViewWidget } from 'https://niolon.github.io/cifvis/dist/cifvis.alldeps.js';
if (!customElements.get('cifview-widget')) {
    customElements.define('cifview-widget', CifViewWidget);
}
</script>

<cifview-widget
    src="path/to/structure.cif"
    caption="Crystal Structure">
</cifview-widget>
```

Consider uploading the library to your own webserver if you are after something
persistent. If you use a bundler, install [`cifvis` from npm](../library/getting-started.md)
and explicitly register the element once in your application entry point:

```js
import 'cifvis/widget/register';
```

Importing `CifViewWidget` from `cifvis` only provides the class and does not modify the
custom-element registry.

This section covers the `<cifview-widget>` component specifically. For the lower-level
JS library (parsing CIF files, driving `CrystalViewer` directly, and using Filters), see
the [JS Library section](../library/getting-started.md).

## Interactive features

The CifVis widget provides several interactive features:

- **Rotation** — click and drag to rotate the structure
- **Zoom** — use the mouse wheel (or pinch) to zoom in/out
- **Selection** — click on atoms or bonds to select and view details; double click on the background to deselect all selections
- **Toggle display** — use buttons at the top right to toggle hydrogens, disorder, and symmetry
- **Density maps** — when present, use the compact contour-level button to hide or restore the map
- **Measurements** — select atoms in order, then use the context-sensitive measurement button
- **Reset view** — double right-click to reset the camera position

<CifDemo measurement-button src="/cif/sucrose.cif" label="Interactive example (try selecting atoms and bonds):" caption="Try clicking on atoms and bonds to select them. The caption updates with selection information." style="aspect-ratio: 16 / 9;" />

The measurement button is disabled until at least two atoms are selected. It measures a
distance for two atoms, an angle for three, a torsion for four, and the last atom's
distance from the least-squares mean plane through the preceding atoms for five or more.
Selection order is significant. Click the button to retain the result in the caption;
hover that result to reveal its geometry, or use its × control to remove it. See
[Measurements](./measurements.md) for prepopulating results and configuring the tool.

## Where to go next

- [Loading data](./loading-data.md) — `src` vs `data`, picking a block
- [Display options](./display-options.md) — modes, render styles, symmetry growing
- [Measurements](./measurements.md) — interactive and prepopulated measurements
- [Attributes reference](./attributes-reference.md) — every widget attribute
- [Styling](./styling.md) — theming the widget with CSS custom properties
