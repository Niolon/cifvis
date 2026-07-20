# Getting started with the widget

CifVis provides a convenient web component (`<cifview-widget>`) that makes it easy to
display interactive 3D models of crystal structures in your web pages.

Adding a crystal structure visualization to your webpage is as simple as including the
CifVis library and adding the `<cifview-widget>` element:

```html
<script type="module" src="https://niolon.github.io/cifvis/dist/cifvis.alldeps.js"></script>

<cifview-widget
    src="path/to/structure.cif"
    caption="Crystal Structure">
</cifview-widget>
```

Consider uploading the library to your own webserver if you are after something
persistent. If you use a bundler, install [`cifvis` from npm](../library/getting-started.md)
instead and `import { CifViewWidget } from 'cifvis'` — the import registers the custom
element.

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
- **Reset view** — double right-click to reset the camera position

<CifDemo src="/cif/sucrose.cif" label="Interactive example (try selecting atoms and bonds):" caption="Try clicking on atoms and bonds to select them. The caption updates with selection information." style="aspect-ratio: 16 / 9;" />

## Where to go next

- [Loading data](./loading-data.md) — `src` vs `data`, picking a block
- [Display options](./display-options.md) — modes, render styles, symmetry growing
- [Attributes reference](./attributes-reference.md) — every widget attribute
- [Styling](./styling.md) — theming the widget with CSS custom properties
