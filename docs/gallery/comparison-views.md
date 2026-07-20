# Comparison views

Compare two refinements, two polymorphs, or — as here — two render styles of the same
structure, with rotation, zoom, pan, and display modes kept in sync while selection
stays independent. Typical applications: before/after refinement comparisons in reports,
or teaching pages contrasting displacement-ellipsoid conventions.

<ComparisonDemo />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget id="left" src="structure.cif"
    options='{"renderStyle":"solid-3d","renderMode":"onDemand"}'>
</cifview-widget>
<cifview-widget id="right" src="structure.cif"
    options='{"renderStyle":"cutout-3d","renderMode":"onDemand"}'>
</cifview-widget>

<script type="module">
    import { coupleViewerInteractions } from 'cifvis';

    const widgets = [document.getElementById('left'), document.getElementById('right')];
    // Widgets initialize asynchronously — wait for their structures.
    while (!widgets.every(w => w.viewer?.state?.baseStructure)) {
        await new Promise(r => requestAnimationFrame(r));
    }
    const coupling = coupleViewerInteractions(widgets);
    await coupling.synchronizeFrom(widgets[0]);
</script>
```

```js [Library (JS)]
import { CrystalViewer, coupleViewerInteractions } from 'cifvis';

const left = new CrystalViewer(leftContainer, { renderStyle: 'solid-3d' });
const right = new CrystalViewer(rightContainer, { renderStyle: 'cutout-3d' });
await left.loadCIF(cifText);
await right.loadCIF(cifText);

const coupling = coupleViewerInteractions(left, right);
await coupling.synchronizeFrom(left); // modes, orientation, absolute framing

// coupling.add(third); coupling.delete(right); coupling.dispose();
```

:::

## Related docs

- [Widget → Comparison views](../widget/comparison-views.md)
- [Library → Coupled viewers](../library/coupling.md)
