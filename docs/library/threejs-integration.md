# Using CifVis structures in Three.js

`CrystalViewer` bundles a whole scene: camera, controls, lighting, selection, the filter
pipeline. If you already have your own Three.js scene and just want the molecule
geometry, `ORTEP3JsStructure` is the layer underneath `CrystalViewer` that does exactly
that — it turns a `CrystalStructure` into a plain `THREE.Group` of atoms, bonds, and
hydrogen bonds, with no scene/camera/renderer of its own.

```js
import * as THREE from 'three';
import { CIF, CrystalStructure, ORTEP3JsStructure } from 'cifvis';

const cif = new CIF(cifText);
const structure = CrystalStructure.fromCIF(cif.getBlock(0));

const ortep = new ORTEP3JsStructure(structure);   // options merge over the same
                                                   // defaults CrystalViewer uses
const group = ortep.getGroup();                   // THREE.Group: atoms + bonds + hBonds

const scene = new THREE.Scene();
scene.add(group);
// ...your own camera, renderer, lights, and controls
```

- `new ORTEP3JsStructure(crystalStructure, options)` builds the meshes immediately in
  the constructor; `options` is the same shape as `CrystalViewer`'s constructor options
  (`renderStyle`, `bondRadius`, `elementProperties`, etc. — see the
  [Options Reference](../reference/index.md)).
- `getGroup()` returns a fresh `THREE.Group` each call, containing every atom/bond/hbond
  mesh.
- `ortep.dispose()` frees the cached geometries/materials — call it when you're done
  with this structure (e.g. before building a new one), the same way
  `CrystalViewer.dispose()` does internally.
- It only renders what you hand it — it does not run the Filters pipeline. Apply
  `HydrogenFilter`, `SymmetryGrower`, etc. to your `CrystalStructure` yourself first if
  you want filtered/grown output (see [Filters](./filters.md)).
- You still own the rest of the scene: camera, renderer, lighting, and orbit/selection
  controls aren't provided. The materials use physically-based rendering
  (roughness/metalness), so at least one light is needed for atoms/bonds to be visible —
  a simple `THREE.AmbientLight` plus a `THREE.DirectionalLight` is enough to start.

## Try it live

A bare Three.js scene (own renderer, camera, light, and a simple drag-to-rotate handler)
with no `CrystalViewer` involved — just `ORTEP3JsStructure`.

<ThreeJsDemo />
