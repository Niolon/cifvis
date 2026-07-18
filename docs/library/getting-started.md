# Getting started with the library

CifVis is available on npm; installing it into a project is as simple as:

```bash
npm install cifvis
```

Three.js is the only runtime dependency. Two entry points are exposed:

| Entry | Purpose |
|---|---|
| `cifvis` | Browser entry. Exports everything, and registers `<cifview-widget>` as a custom element. |
| `cifvis/nobrowser` | Same core exports (CIF/structure APIs, Filters, density calculation, IAM, reflection readers), but `CrystalViewer`/`CifViewWidget` are stubs that throw — safe to import in Node/SSR/test environments with no `window`. |

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
