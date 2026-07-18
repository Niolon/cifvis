# Difference density

An Fo−Fc difference map calculated entirely in the browser: the urea sample CIF embeds
its observed reflections (SHELX HKL data), so CifVis fits a scale, computes IAM
structure factors, applies extinction correction, and displays the map progressively —
no pre-computed map file involved. Use the density button (top right, appears once
calculation starts) to hide/show the map. Typical applications: supplementary material
for papers, refinement quality checks, teaching Fourier maps.

<CifDemo src="/cif/urea.cif" options='{"differenceDensity":{"autoLoad":true}}' caption="Urea Fo−Fc difference density, green positive / red negative, ±3σ wireframe." style="aspect-ratio: 16 / 9;" />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="coordinates-and-reflections.cif"
    options='{"differenceDensity":{"autoLoad":true}}'>
</cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    differenceDensity: { autoLoad: true },
});
const loaded = await viewer.loadCIF(cifText);
// The structure renders immediately; density finishes asynchronously.
await loaded.differenceDensity;

// Tune the display afterwards without recalculating:
viewer.updateIsosurfaceOptions({ sigmaLevel: 2.5, wireframe: true });
```

:::

Explicit FCF files work the same way via `viewer.loadDifferenceDensity(fcfText, 0,
options)`, and pre-calculated grids via `viewer.loadCube(cubeText, options)` — see
[Library → Density maps](../library/density.md).

## Related docs

- [General → Density concepts](../general/density-concepts.md)
- [Widget → Density maps](../widget/density.md)
- [Options Reference → Density](../reference/density.md)
