# Loading CIF data

You can load CIF data in two ways: from a URL, or directly from a string.

::: code-group

```html [From URL]
<cifview-widget
    src="https://example.com/path/to/structure.cif"
    caption="Structure from URL">
</cifview-widget>
```

```html [From string]
<cifview-widget
    data="data_
_cell.length_a 10.5
_cell.length_b 12.3
_cell.length_c 15.2
_cell.angle_alpha 90
_cell.angle_beta 90
_cell.angle_gamma 90
# ... rest of CIF data ...
"
    caption="Structure from data string">
</cifview-widget>
```

:::

Use either `src` or `data`, not both.

## Selecting a block

Multi-block CIF files are supported. The `block` attribute selects which data block to
display and defaults to the first block. Digits are treated as an index; any other value
is the name following `data_`:

```html
<cifview-widget src="structures.cif" block="crystal_a"></cifview-widget>
<cifview-widget src="structures.cif" block="1"></cifview-widget>
```

## Custom icons

The `icons` attribute accepts a JSON object that overrides the SVG markup used for the
named modifier-mode buttons (hydrogen, disorder, symmetry toggles):

```html
<cifview-widget src="structure.cif" icons='{"hydrogen": {"none": "<svg>…</svg>"}}'>
</cifview-widget>
```
