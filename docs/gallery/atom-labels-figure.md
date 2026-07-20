# Labeled figures

`maximum-coverage` label placement tries to label *every* requested atom, moving labels
into callout lanes outside the structure when local space runs out. Combined with
per-element label colours, this produces a fully annotated figure. Typical applications:
numbering-scheme figures for papers and CSD deposits.

<CifDemo src="/cif/urea.cif" hydrogen-mode="constant" symmetry-mode="fragment" options='{"atomLabels":{"show":"all","placementMode":"maximum-coverage","calloutPlacement":"structure"}}' caption="Every atom labeled with maximum-coverage placement and structure-hugging callouts." style="aspect-ratio: 16 / 9;" />

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="structure.cif"
    hydrogen-mode="constant"
    atom-labels="all"
    options='{
        "atomLabels": {
            "placementMode": "maximum-coverage",
            "calloutPlacement": "structure"
        }
    }'>
</cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    hydrogenMode: 'constant',
    atomLabels: {
        show: 'all',
        placementMode: 'maximum-coverage',
        calloutPlacement: 'structure',   // 'viewport' spreads across the full width
    },
});
await viewer.loadCIF(cifText);

// Check what was placed vs. omitted:
console.log(viewer.getAtomLabelLayout());
```

:::

## Related docs

- [Atom Labels](../labels/index.md) — activation and modes
- [How placement works](../labels/how-it-works.md) — the callout algorithm
- [Options Reference → Atom labels](../reference/atom-labels.md)
