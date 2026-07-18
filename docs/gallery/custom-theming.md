# Custom theming

Two mechanisms combine to brand a viewer: **CSS custom properties** style the widget
chrome (background, caption, buttons), while **viewer options** recolour the WebGL
content (element colours, bond colour, labels). The widget's
[built-in dark theme](../widget/styling.md#default-dark-theme) supplies the chrome
(forced here via the `cifvis-dark` class — it also engages automatically on dark-mode
systems), a **luminance floor** brightens the element-coloured labels for the dark
background, and `elementProperties` recolours the carbons. Typical applications:
matching a journal or group website's design system, dark-mode support.

<div style="max-width: 560px;">
<CifDemo
    src="/cif/sucrose.cif"
    class="cifvis-dark"
    style="aspect-ratio: 16 / 10;"
    options='{"elementProperties":{"C":{"atomColor":"#8be9fd","ringColor":"#000000"}},"bondColor":"#9a9aae","atomLabels":{"show":"non-hydrogen","colorMode":"atom","atomColorLuminanceFloor":0.35,"haloColor":"#1e1e2f"}}'
    caption="Dark chrome from themes/cifvis-dark.css; labels kept readable by the luminance floor.">
</CifDemo>
</div>

## Reproduce it

::: code-group

```html [Widget (HTML)]
<!-- The dark chrome is built into the widget: it applies automatically with
     prefers-color-scheme: dark, inside a .dark ancestor, or forced as here. -->
<cifview-widget
    class="cifvis-dark"
    src="structure.cif"
    options='{
        "elementProperties": {"C": {"atomColor": "#8be9fd", "ringColor": "#000000"}},
        "bondColor": "#9a9aae",
        "atomLabels": {
            "show": "non-hydrogen",
            "colorMode": "atom",
            "atomColorLuminanceFloor": 0.35,
            "haloColor": "#1e1e2f"
        }
    }'>
</cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

// The bare viewer has no chrome — style your own container with CSS,
// and recolour the scene through options. The luminance floor replaces
// the default ceiling so labels stay readable on the dark background:
const viewer = new CrystalViewer(container, {
    elementProperties: {
        C: { atomColor: '#8be9fd', ringColor: '#000000' },
    },
    bondColor: '#9a9aae',
    atomLabels: {
        show: 'non-hydrogen',
        colorMode: 'atom',
        atomColorLuminanceFloor: 0.35,
        haloColor: '#1e1e2f',
    },
});
await viewer.loadCIF(cifText);
```

:::

An interactive property editor is on [Widget → Styling](../widget/styling.md#try-it-live).

## Related docs

- [Widget → Styling](../widget/styling.md) — all `--cifvis-*` properties and class hooks
- [Options Reference → Element properties](../reference/elements.md)
