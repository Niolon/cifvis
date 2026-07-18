# Custom theming

Two mechanisms combine to brand a viewer: **CSS custom properties** style the widget
chrome (background, caption, buttons), while **viewer options** recolour the WebGL
content (element colours, bond colour). Here both make a dark-mode card with
non-standard carbon colouring. Typical applications: matching a journal or group
website's design system, dark-mode support.

<div style="max-width: 560px;">
<CifDemo
    src="/cif/sucrose.cif"
    style="--cifvis-bg:#1e1e2f;--cifvis-caption-bg:#2a2a3d;--cifvis-caption-color:#eeeeee;--cifvis-button-bg:#3a3a52;--cifvis-button-hover-bg:#4a4a66;aspect-ratio: 16 / 10;"
    options='{"elementProperties":{"C":{"atomColor":"#8be9fd","ringColor":"#000000"}},"bondColor":"#bbbbcc"}'
    caption="Dark chrome via --cifvis-* properties; cyan carbons via elementProperties.">
</CifDemo>
</div>

## Reproduce it

::: code-group

```html [Widget (HTML)]
<style>
    .dark-card cifview-widget {
        --cifvis-bg: #1e1e2f;
        --cifvis-caption-bg: #2a2a3d;
        --cifvis-caption-color: #eeeeee;
        --cifvis-button-bg: #3a3a52;
        --cifvis-button-hover-bg: #4a4a66;
    }
</style>

<div class="dark-card">
    <cifview-widget
        src="structure.cif"
        options='{
            "elementProperties": {"C": {"atomColor": "#8be9fd", "ringColor": "#000000"}},
            "bondColor": "#bbbbcc"
        }'>
    </cifview-widget>
</div>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

// The bare viewer has no chrome — style your own container with CSS,
// and recolour the scene through options:
const viewer = new CrystalViewer(container, {
    elementProperties: {
        C: { atomColor: '#8be9fd', ringColor: '#000000' },
    },
    bondColor: '#bbbbcc',
});
await viewer.loadCIF(cifText);
```

:::

An interactive property editor is on [Widget → Styling](../widget/styling.md#try-it-live).

## Related docs

- [Widget → Styling](../widget/styling.md) — all `--cifvis-*` properties and class hooks
- [Options Reference → Element properties](../reference/elements.md)
