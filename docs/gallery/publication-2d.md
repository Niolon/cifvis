# Publication-style 2D figure

The `cutout-2d` render style produces hatched, outlined ORTEP-style graphics in element
colours — the classic look of printed structure figures, but interactive. Combined with
element-coloured atom labels (`atomLabels.colorMode: "atom"`) it makes a figure you can
rotate into pose before capturing; the same luminance ceiling that keeps the 2D palette
readable is applied to the label colours, so bright elements stay legible on the white
background. Typical applications: thesis and paper figures, structure drawings for
posters.

<CifDemo src="/cif/urea.cif" options='{"renderStyle":"cutout-2d","atomLabels":{"show":"non-hydrogen","colorMode":"atom"}}' hydrogen-mode="constant" caption="Urea in the cutout-2d publication style with element-coloured non-hydrogen labels." style="aspect-ratio: 16 / 9;" />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="structure.cif"
    hydrogen-mode="constant"
    options='{
        "renderStyle": "cutout-2d",
        "atomLabels": {"show": "non-hydrogen", "colorMode": "atom"},
        "plot2DStripeCount": 7,
        "plot2DColorLuminanceCeiling": 0.25
    }'>
</cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    renderStyle: 'cutout-2d',
    hydrogenMode: 'constant',
    atomLabels: {
        show: 'non-hydrogen',
        colorMode: 'atom',   // element-coloured labels; luminance-limited for readability
    },
    // Tuning knobs for the 2D style:
    plot2DStripeCount: 7,          // hatch repeats per section face
    plot2DBondOutlineWidth: 2,     // constant-px silhouette separating crossing bonds
    plot2DColorLuminanceCeiling: 0.25,
});
await viewer.loadCIF(cifText);
```

:::

## Related docs

- [Options Reference → Rendering](../reference/rendering.md) — all `plot2D*` options
- [Atom Labels](../labels/index.md)
