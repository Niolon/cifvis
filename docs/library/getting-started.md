# Getting started with the library

CifVis is available on npm; installing it into a project is as simple as:

```bash
npm install cifvis
```

Three.js is the only runtime dependency. The package exposes deliberately scoped entry points:

| Entry | Purpose |
|---|---|
| `cifvis` | Stable browser-facing viewer, widget, structure, measurement, formatting, and Filter API. It has no registration side effect. |
| `cifvis/core` | Stable browser-independent CIF, structure, measurement, formatting, repair, and Filter API. |
| `cifvis/density` | Supported numerical density, reflection, scalar-field, contour, and isosurface API. |
| `cifvis/experimental` | Unstable low-level Three.js integration APIs that may change before or after 1.0. |
| `cifvis/widget/register` | Browser-only side effect that registers `<cifview-widget>` idempotently. |

The former `cifvis/nobrowser` entry has been removed; use `cifvis/core` instead.

## TypeScript and editor support

Every package entry point ships generated TypeScript declarations derived from the
JavaScript source and its JSDoc. Import CifVis normally from JavaScript or TypeScript;
editors and TypeScript resolve the matching declaration through the package export map.
The runtime source remains JavaScript.

## A minimal viewer

```html
<div id="viewer"></div>
<script type="module">
  import { CrystalViewer } from 'cifvis';

  const viewer = new CrystalViewer(document.getElementById('viewer'));
  await viewer.loadCIF(cifContent);
</script>
```

That gives you the full interactive scene: orthographic camera, orbit/selection
controls, lighting, and the filter pipeline. From here:

- [CrystalViewer](./crystal-viewer.md) — the GUI-facing surface for building your own controls
- [Density maps](./density.md) — difference/deformation density and Cube files from code
- [Filters](./filters.md) — transforming structures with and without a viewer
- [Coupled viewers](./coupling.md) — synchronizing multiple viewers
- [Three.js integration](./threejs-integration.md) — just the geometry, in your own scene

Parsing CIF files and the structure model are covered in the General section:
[CIF files](../general/cif-files.md) and
[The structure model](../general/structure-model.md).
