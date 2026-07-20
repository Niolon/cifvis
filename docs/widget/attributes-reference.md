# Widget attributes reference

Widget attribute names consistently use kebab-case (the `an-option` form). Keys inside
the JSON `options` attribute remain camelCase because that object is passed unchanged to
the JavaScript `CrystalViewer` API. If a display mode is incompatible with a structure,
the widget falls back to an applicable mode.

```html
<cifview-widget
    src="structure.cif"
    caption="My Structure"
    hydrogen-mode="constant"
    disorder-mode="all"
    symmetry-mode="fragment">
</cifview-widget>
```

| Attribute | Values | Description |
|---|---|---|
| `src` | URL | Loads CIF text from a URL. Use either `src` or `data`. |
| `data` | CIF text | Loads CIF text directly from the attribute. Use either `data` or `src`. |
| `caption` | HTML string | Base caption shown below the viewer; selection information is appended to it. |
| `block` | numeric index (e.g. `0`) or block name (e.g. `crystal_a`) | Selects which CIF data block to display. Defaults to the first block. Digits are treated as an index; any other value is the name following `data_`. |
| `options` | JSON object | The camelCase `CrystalViewer` option object. See the [Options Reference](../reference/index.md). |
| `hydrogen-mode` | `none`, `constant`, `anisotropic` | Controls the display of hydrogen atoms. |
| `disorder-mode` | `all`, `group<rank>of<total>` (e.g. `group1of2`) | Controls which disorder groups are displayed. Group modes are named by rank and the total number of disorder groups present in the structure, not by their raw CIF `disorder_group` number. A structure with N disorder groups exposes modes `group1ofN` through `groupNofN`; each shows that group plus non-disordered atoms. |
| `symmetry-mode` | `none`, `hbonds`, `fragment`, `fragment-hbonds`, `cell`, `fragment-cell` | Controls symmetry-generated atoms and bonds. Fragment modes grow through bonds, H-bonds, or both; cell modes display the complete unit cell, optionally with connected fragments. |
| `filtered-atoms` | comma-separated labels/ranges | Excludes atom labels. Inclusive ranges use `>`, for example `C1,C5>C12`. See [Filtered atoms](./filtered-atoms.md). |
| `atom-labels` | `none`, `all`, `non-hydrogen`, or JSON array | Chooses labels dynamically; JSON entries may provide custom text and priority. See [Labels in the widget](../labels/widget.md). |
| `icons` | JSON object | Overrides SVG markup for named modifier modes. |

The mode attributes map to the camelCase options `hydrogenMode`, `disorderMode`, and
`symmetryMode` in the shared schema — see
[Options Reference → Display modes](../reference/display-modes.md).
