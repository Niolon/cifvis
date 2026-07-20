# Options Reference

This is **one options schema, read in two places**: pass it as the second argument to
`new CrystalViewer(container, options)` (see the
[JS Library section](../library/crystal-viewer.md)), or as a JSON string on
`<cifview-widget options='{...}'>` (see the [Widget section](../widget/getting-started.md)) —
the widget just parses the attribute and passes it straight through to its internal
`CrystalViewer`. Everything here applies to both.

Every option path is shown in the same `parent.child` format. Option object keys use
JavaScript camelCase. Dedicated widget HTML attributes use kebab-case, such as
`hydrogen-mode`; see the complete
[widget attribute table](../widget/attributes-reference.md). Values such as `auto-omit`
are written exactly as they must be supplied.

::: tip Generated from the source
The option names, types, and defaults in these tables are generated directly from the
library's default option objects by `npm run gen:options`, and a CI test fails when the
committed tables drift from the code or an option lacks a description — so this
reference cannot silently go stale. Use the search box (top of the page) to find an
option across all groups.
:::

## Groups

| Page | Covers |
|---|---|
| [Camera](./camera.md) | Projection, zoom limits and speeds, initial position. |
| [Selection](./selection.md) | Selection mode, marker sizes and colours. |
| [Interaction](./interaction.md) | Rotation speed, click threshold, raycast thresholds. |
| [Rendering](./rendering.md) | Render mode/style, the `plot2D*` publication options, CIF error fixing. |
| [Display modes](./display-modes.md) | Initial hydrogen/disorder/symmetry modes. |
| [Atom labels](./atom-labels.md) | The full `atomLabels` group. |
| [Atom visualization](./atom-visualization.md) | Atom geometry detail, materials, ADP rings, cutaways. |
| [Density & scalar fields](./density.md) | `differenceDensity`, `scalarField`, `isosurface`, `contourLines`, per-source options. |
| [Bonds](./bonds.md) | Bond geometry, colours, generation tolerance. |
| [Hydrogen bonds](./hydrogen-bonds.md) | H-bond geometry, colours, dashing. |
| [Unit cell](./cell.md) | Cell box and axis-arrow styling. |
| [Element properties](./elements.md) | Per-element radii and colours. |

## Complete configuration example

As a widget attribute:

```html
<cifview-widget
    src="structure.cif"
    caption="Customized Crystal Structure"
    options='{
        "camera": {
            "fov": 50,
            "initialPosition": [0, 0, 15],
            "wheelZoomSpeed": 0.001
        },
        "selection": {
            "mode": "multiple",
            "markerMult": 1.5,
            "bondMarkerMult": 2.0
        },
        "atomDetail": 4,
        "atomColorRoughness": 0.5,
        "atomColorMetalness": 0.3,
        "bondRadius": 0.08,
        "bondColor": "#555555",
        "elementProperties": {
            "Fe": {
                "atomColor": "#FF5733",
                "radius": 1.4,
                "ringColor": "#ffffff"
            },
            "O": {
                "atomColor": "#0088ff",
                "radius": 0.7
            }
        }
    }'>
</cifview-widget>
```

The same object passed directly to `CrystalViewer`:

```js
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    camera: { fov: 50, initialPosition: [0, 0, 15], wheelZoomSpeed: 0.001 },
    selection: { mode: 'multiple', markerMult: 1.5, bondMarkerMult: 2.0 },
    atomDetail: 4,
    atomColorRoughness: 0.5,
    atomColorMetalness: 0.3,
    bondRadius: 0.08,
    bondColor: '#555555',
    elementProperties: {
        Fe: { atomColor: '#FF5733', radius: 1.4, ringColor: '#ffffff' },
        O: { atomColor: '#0088ff', radius: 0.7 },
    },
});
```
