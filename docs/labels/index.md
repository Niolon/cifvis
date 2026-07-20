# Atom labels

CifVis can draw screen-space text labels next to atoms — for interactive exploration or
for publication-ready figures. Labels are **opt-in**, so existing viewers retain their
appearance and rendering cost, and placement is **collision-free**: text never overlaps
other text, atoms, or (by preference) bonds. If there is no acceptable spot, a label is
omitted or given a callout rather than drawn confusingly.

<CifDemo src="/cif/urea.cif" options='{"atomLabels":{"show":"non-hydrogen"}}' hydrogen-mode="constant" caption="Urea with non-hydrogen labels placed automatically." style="aspect-ratio: 16 / 9;" />

## Activating labels

With the library, labels are controlled by the `atomLabels` option group:

```js
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    atomLabels: {
        show: 'non-hydrogen',      // 'none' | 'all' | 'non-hydrogen' | selector array
        placementMode: 'auto-omit',
    },
});
await viewer.loadCIF(cifText);
```

`show` also accepts an array of atom selectors. Plain selectors match every displayed
symmetry copy; use a qualified ID such as `C1|2_555` to select one copy. Entries can
override the display text and priority:

```js
atomLabels: {
    show: ['C1', { id: 'O1', text: 'O(carbonyl)', priority: 10 }],
}
```

After loading, labels can be changed without rebuilding the structure:

```js
viewer.setAtomLabels('all');                   // or 'non-hydrogen', 'none', selector array
viewer.updateAtomLabelOptions({ fontSize: 16 }); // appearance/layout only
viewer.clearAtomLabels();
viewer.getAtomLabelLayout();                   // placed + omitted labels
```

In the widget, the same is available declaratively through the `atom-labels` attribute
and `options.atomLabels` — see [Labels in the widget](./widget.md).

## Choosing a placement mode

The default `auto-omit` placement prefers exact quality placement for ordinary views and
automatically uses depth-aware no-space regions when more than 500 requested atoms are
visible. Use `quality-omit` or `performance-omit` to force either policy. Set
`placementMode: 'maximum-coverage'` for longer searches and callouts which may cross
bonds — the mode to use when you want as many atoms as possible labeled in a figure.

Callouts stay just outside the structure by default; set `calloutPlacement` to
`viewport` to use all available width. Text never overlaps other text or atoms, so an
overfull viewport can still omit labels. Set `maxConnectorLength` to a CSS-pixel ceiling
when extreme connectors should be omitted rather than drawn.

How these modes actually work — candidate scoring, repair, no-space tiles, callout
lanes — is explained in [How placement works](./how-it-works.md).

## Appearance

Font, colour, halo, and leader-line appearance are all options in the same group:
uniform text colour or per-element colour (`colorMode: 'atom'`, with a luminance ceiling
so bright element colours stay readable on light backgrounds), a contrast halo, and
configurable leader lines. On dark backgrounds, set `atomColorLuminanceFloor` instead —
it replaces the ceiling and mixes the palette towards white so even black carbon labels
stay legible (see the
[default dark theme](../widget/styling.md#default-dark-theme)). The exhaustive option
table is in [Options Reference → Atom labels](../reference/atom-labels.md).

## Performance behaviour

Label collision placement runs after the structure is painted and uses a Web Worker when
available. During rotation an old label frame is cleared immediately, avoiding
after-images while the fresh layout is calculated. Slow layouts display a delayed status
indicator; atoms and their labels both disappear once the projected atom footprint is
completely outside the viewport.
