# Selection settings

These options control the appearance and behavior of selections and persistent measurements.
Selection events reach your code through `viewer.selections.onChange(callback)`. Both palettes
can be changed at construction time. Measurement colours can also be changed live with
`viewer.updateMeasurementOptions(...)` — see
[CrystalViewer](../library/crystal-viewer.md).

Persistent measurement geometry is hidden by default and appears while its corresponding
result or caption is hovered. Programmatic interfaces can use
`viewer.setHoveredMeasurement(measurementId)` and clear the preview with `null`.

<OptionsTable group="selection" />
