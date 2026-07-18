# Styling the widget

- `<cifview-widget>` renders in **light DOM** — there is no Shadow DOM and no
  `::part()`/`<slot>`. Its internal elements are ordinary, fully selectable DOM.
- On first construction, it injects one `<style id="cifview-styles">` into
  `document.head` (guarded so multiple widget instances on a page don't duplicate it).
- All internal styling is scoped by tag name + class selector, e.g.
  `cifview-widget .control-button`.

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

## Try it live

<ThemingDemo />

## Canvas-level appearance is not CSS

Colors like `bondColor`, `hbondColor`, and `elementProperties.X.atomColor` are baked
into WebGL materials via the `options` attribute/constructor option — a different
mechanism entirely, not reachable from CSS. See the
[Options Reference](../reference/index.md) for the full list, and the
[Gallery → Custom theming](../gallery/custom-theming.md) entry for both mechanisms
working together.
