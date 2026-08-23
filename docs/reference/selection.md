# Selection settings

These options control the appearance and behavior of selections and persistent measurements.
Selection events reach your code through `viewer.selections.onChange(callback)`. Both palettes
can be changed at construction time; measurements can also be recolored live with
`viewer.updateMeasurementOptions({ markerColors: [...] })` — see
[CrystalViewer](../library/crystal-viewer.md).

<OptionsTable group="selection" />
