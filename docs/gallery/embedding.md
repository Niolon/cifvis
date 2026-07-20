# Embedding with other JS

CifVis is designed to coexist with the rest of your page's JavaScript: the viewer emits
selection events, and your code reacts. Here a fullerene structure (with solvent) sits
next to a plain-canvas bar chart of its element counts — clicking atoms highlights their
element in the chart. Typical applications: database front-ends, dashboards combining
structure and analysis, teaching pages.

<EmbeddingDemo />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget id="structure" src="structure.cif"></cifview-widget>
<canvas id="chart"></canvas>

<script type="module">
    import { CifViewWidget } from 'cifvis';

    const widget = document.getElementById('structure');
    // Wait for the widget's internal viewer, then hook selections:
    while (!widget.viewer?.state?.baseStructure) {
        await new Promise(r => requestAnimationFrame(r));
    }
    widget.viewer.selections.onChange(selections => {
        const elements = selections
            .filter(s => s.type === 'atom')
            .map(s => s.data.atomType);
        updateMyChart(elements);   // your own chart code
    });
</script>
```

```js [Library (JS)]
import { CIF, CrystalStructure, CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container);
await viewer.loadCIF(cifText);

// Analyse the structure with the same parsed model the viewer uses:
const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
const counts = {};
for (const atom of structure.atoms) {
    counts[atom.atomType] = (counts[atom.atomType] ?? 0) + 1;
}
drawMyChart(counts);   // any chart library — or a plain canvas

viewer.selections.onChange(selections => {
    const elements = selections.filter(s => s.type === 'atom').map(s => s.data.atomType);
    highlightInMyChart(elements);
});
```

:::

## Related docs

- [Library → CrystalViewer](../library/crystal-viewer.md) — the selection API and `onDemand` rendering
- [Library → Three.js integration](../library/threejs-integration.md) — going deeper, into your own scene
