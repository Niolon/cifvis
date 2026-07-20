# Labels in the widget

The widget exposes atom labels two ways: the dynamic `atom-labels` attribute, and the
`atomLabels` group inside the JSON `options` attribute (which is passed unchanged to the
internal `CrystalViewer`, so everything from [Activating labels](./index.md) applies).

## The `atom-labels` attribute

```html
<cifview-widget
    src="structure.cif"
    atom-labels='["C1", {"id":"O1", "text":"O(carbonyl)", "priority":10}]'>
</cifview-widget>
```

The shorthand values `all`, `non-hydrogen`, and `none` are also accepted. Plain
selectors match every displayed symmetry copy; use a qualified ID such as `C1|2_555` to
select one copy. Because it is an observed attribute, changing it later (e.g. from your
own JavaScript) re-labels the structure without reloading.

<CifDemo src="/cif/urea.cif" atom-labels="non-hydrogen" hydrogen-mode="constant" caption="atom-labels=&quot;non-hydrogen&quot; on the widget." style="aspect-ratio: 16 / 9;" />

## Placement and appearance via `options`

Placement mode and appearance use the same camelCase paths as the library:

```html
<cifview-widget
    src="structure.cif"
    atom-labels="non-hydrogen"
    options='{"atomLabels":{"placementMode":"maximum-coverage","calloutPlacement":"viewport"}}'>
</cifview-widget>
```

See [How placement works](./how-it-works.md) for what the modes do, and
[Options Reference → Atom labels](../reference/atom-labels.md) for all options.
