# Contour section

Instead of a 3D isosurface, the difference map is drawn as line-only contours in the
best-fit molecular plane — the traditional way density is presented in print. No plane
fill is drawn, so the viewer background stays clean. Typical applications: deformation
density figures, comparing density along a bond.

<CifDemo src="/cif/urea.cif" options='{"differenceDensity":{"autoLoad":true},"contourLines":{"enabled":true,"plane":{"mode":"best-fit"},"contourCount":20}}' caption="Urea Fo−Fc density as planar contours in the best-fit molecular plane." style="aspect-ratio: 16 / 9;" />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="coordinates-and-reflections.cif"
    options='{
      "differenceDensity": {"autoLoad": true},
      "contourLines": {
        "enabled": true,
        "plane": {"atoms": ["C1", "O1", "N1"]},
        "contourCount": 20
      }
    }'>
</cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    differenceDensity: { autoLoad: true },
    contourLines: {
        enabled: true,
        plane: { mode: 'best-fit' },   // or { atoms: ['C1','O1','N1'] }
        contourCount: 20,
    },
});
await viewer.loadCIF(cifText);

// Move the section afterwards without recalculating the field:
viewer.updateContourLineOptions({
    plane: { coordinateSystem: 'fractional', origin: [0, 0, 0.5], normal: [0, 0, 1] },
});
```

:::

## Related docs

- [Widget → Density maps](../widget/density.md#planar-contour-lines)
- [Library → Density maps](../library/density.md#planar-contour-lines)
- [Options Reference → Density](../reference/density.md) — the `contourLines.*` options
