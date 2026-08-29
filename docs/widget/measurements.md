# Measurements in the widget

The widget can create measurements from the current atom selection and display saved
results in its caption. Enable the control with `measurement-button="true"`:

```html
<cifview-widget
    src="structure.cif"
    measurement-button="true">
</cifview-widget>
```

Select atoms in the required order and then click the measurement button. Its action
depends on the number of selected atoms:

| Selected atoms | Result |
|---:|---|
| 2 | Distance |
| 3 | Angle centred on the second atom |
| 4 | Torsion angle |
| 5 or more | Distance of the last atom from the least-squares mean plane through all preceding atoms |

The result remains in the caption, but its geometry stays hidden so several saved
measurements do not obscure the structure. Hover a result to reveal only that
measurement. Hovering an atom name highlights the corresponding atom, and the × button
removes the result.

<CifDemo
    measurement-button
    src="/cif/sucrose.cif"
    label="Try it: select two or more atoms in order, then click the measurement button."
    caption="Saved measurements appear here. Hover a result to reveal its geometry."
    style="aspect-ratio: 16 / 9;"
/>

The raw `<cifview-widget>` keeps the measurement button enabled by default for backward
compatibility. Set `measurement-button="false"` when a figure should offer only the
usual structure controls.

## Prepopulating measurements

Use the `measurements` attribute to create results immediately after the structure has
loaded. Its value is a JSON array whose inner arrays contain atom IDs in measurement
order:

```html
<cifview-widget
    src="structure.cif"
    measurement-button="false"
    measurements='[
        ["C1", "C2"],
        ["C1", "C2", "C7"],
        ["O1", "C1", "C2", "O2"]
    ]'>
</cifview-widget>
```

Plain atom labels select the first matching displayed atom. A symmetry-resolved unique
ID such as `C1|2_555` identifies an exact displayed copy. The attribute is
live-updatable; replacing or removing it replaces or clears the prepopulated results.

`measurements` describes widget content and is therefore its own HTML attribute. It is
not part of the general `options` object.

## Appearance

Measurement appearance uses the ordinary widget `options` attribute:

```html
<cifview-widget
    src="structure.cif"
    measurements='[["C1", "C2"]]'
    options='{
        "measurement": {
            "lineRadius": 0.075,
            "markerRadius": 0.11,
            "markerColors": [16737792, 65535]
        }
    }'>
</cifview-widget>
```

`lineRadius` and `markerRadius` are positive finite values in structure units (Å).
`markerColors` is the colour sequence used for saved measurements. See the
[Selection options](../reference/selection.md) for the generated option table.

## Events

Creating a result with the button dispatches a `cifvis-measurement` event from the
widget. The event's `detail` is the created measurement object:

```js
const widget = document.querySelector('cifview-widget');

widget.addEventListener('cifvis-measurement', event => {
    console.log(event.detail.type, event.detail.value, event.detail.unit);
});
```

For direct control over creation, hover previews, removal, and subscriptions, use the
[JavaScript measurement API](../library/measurements.md).
