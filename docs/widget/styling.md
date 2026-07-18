# Styling the widget

- `<cifview-widget>` renders in **light DOM** — there is no Shadow DOM and no
  `::part()`/`<slot>`. Its internal elements are ordinary, fully selectable DOM.
- On first construction, it injects one `<style id="cifview-styles">` into
  `document.head` (guarded so multiple widget instances on a page don't duplicate it).
- All internal styling is scoped by tag name + class selector, e.g.
  `cifview-widget .control-button`.
- The root creates its own stacking context (`isolation: isolate`), so the widget's
  internal overlays (toggle buttons, error messages) can never paint over your page's
  sticky headers, menus, or modals — any positioned ancestor or sibling with a
  `z-index` above the widget's own stacks above *all* of it.

## Internal class names

| Selector | Targets |
|---|---|
| `cifview-widget` | The root element: background, border radius, flex layout. |
| `.crystal-container` | The 3D viewer's container (the flex-grow area holding the canvas). |
| `.crystal-caption` | The caption/selection-info bar under the viewer. |
| `.button-container` | The toggle-button group (top-right overlay). |
| `.control-button` | Each toggle button. |
| `.hydrogen-button`, `.disorder-button`, `.symmetry-button` | Added alongside `.control-button` per button type. No built-in rules target these — pure hooks for your own overrides. |

## Theming via CSS custom properties

The injected stylesheet reads its colors and radii through `var(--cifvis-*, fallback)`,
so you can theme the widget from your own page's CSS without writing any selector at
all — just set the custom properties on `cifview-widget` (or an ancestor):

| Custom property | Default | Affects |
|---|---|---|
| `--cifvis-bg` | `#fafafa` | Root background. |
| `--cifvis-radius` | `8px` | Root border radius. |
| `--cifvis-caption-bg` | `#ffffff` | Caption bar background. |
| `--cifvis-caption-border` | `#eaeaea` | Caption bar top border. |
| `--cifvis-caption-color` | `#333` | Caption text color. |
| `--cifvis-button-bg` | `rgba(255,255,255,0.9)` | Toggle button background. |
| `--cifvis-button-hover-bg` | `#ffffff` | Toggle button background on hover. |
| `--cifvis-button-radius` | `8px` | Toggle button border radius. |
| `--cifvis-icon-filter` | `none` (light) / `invert(1) brightness(0.88)` (dark) | CSS filter applied to the toggle-button icons; the built-in dark theme uses it to invert the grayscale default icons to a soft off-white matching the caption text. |

The defaults listed are the light-scheme values; the
[built-in dark theme](#default-dark-theme) below swaps them automatically.

```css
cifview-widget {
    --cifvis-bg: #1e1e2f;
    --cifvis-caption-bg: #2a2a3d;
    --cifvis-caption-color: #eee;
}
```

Direct selector overrides (e.g. `cifview-widget .crystal-caption { background: ...; }`)
still work too, since it's plain light DOM — but you'll need matching or higher
specificity to win against the injected stylesheet. Prefer the custom properties above;
they were added specifically to avoid that fight.

::: warning Name collisions with the playground's own CSS
If you are also looking at `site/src/style.css` for reference: that file styles the
*demo page's own* upload/toggle buttons, which happen to reuse the class names
`.button-container`/`.control-button` — it is not related to the widget's internal
styling, and copying it onto a page that also embeds the widget will cause the rules to
collide.
:::

## Built-in dark theme {#default-dark-theme}

The widget's injected stylesheet supports dark mode by default — no extra CSS needed.
The dark palette applies:

- **automatically** when the OS/browser prefers a dark color scheme
  (`prefers-color-scheme: dark`), or
- when the widget is inside an element with the common `dark` class (as used by this
  documentation's theme toggle, Tailwind, etc.), or carries/inherits the explicit
  `cifvis-dark` class; `cifvis-light` forces the light defaults back.

All dark rules have zero CSS specificity (they are wrapped in `:where()`), so anything
you set yourself — a `--cifvis-*` custom property or a direct rule — always wins. The
default grayscale button icons are inverted in dark mode via the
`--cifvis-icon-filter` custom property (set it to `none` if you supply colourful
[custom icons](./loading-data.md#custom-icons)).

```html
<!-- Forced dark, regardless of the OS scheme: -->
<cifview-widget class="cifvis-dark" src="structure.cif"
    options='{
        "atomLabels": {"colorMode": "atom", "atomColorLuminanceFloor": 0.35,
                       "haloColor": "#1e1e2f"},
        "bondColor": "#9a9aae"
    }'>
</cifview-widget>
```

CSS only reaches the widget chrome, so on dark pages pair it with viewer options for
the WebGL content. The key one is `atomLabels.atomColorLuminanceFloor`: where the
default luminance *ceiling* darkens the element palette so bright colours stay readable
on white, a configured *floor* replaces it and mixes the palette towards white so even
black carbon labels stay readable on dark backgrounds. The same pair exists for the 2D
publication style (`plot2DColorLuminanceCeiling` / `plot2DColorLuminanceFloor`,
combined with a dark `plot2DBackground`).

<CifDemo src="/cif/sucrose.cif" class="cifvis-dark" options='{"atomLabels":{"show":"non-hydrogen","colorMode":"atom","atomColorLuminanceFloor":0.35,"haloColor":"#1e1e2f"},"bondColor":"#9a9aae"}' caption="Forced dark theme (cifvis-dark class) plus a 0.35 label luminance floor." style="aspect-ratio: 16 / 9;" />

## Try it live

<ThemingDemo />

## Canvas-level appearance is not CSS

Colors like `bondColor`, `hbondColor`, and `elementProperties.X.atomColor` are baked
into WebGL materials via the `options` attribute/constructor option — a different
mechanism entirely, not reachable from CSS. See the
[Options Reference](../reference/index.md) for the full list, and the
[Gallery → Custom theming](../gallery/custom-theming.md) entry for both mechanisms
working together.
