# Difference and deformation density

Density loading is opt-in for the widget. Enable it when the selected CIF block contains
standard FCF coefficients, observed reflections suitable for an IAM Fo−Fc calculation,
or a self-described custom deformation-density loop (the concepts are explained in
[General → Density concepts](../general/density-concepts.md)):

```html
<cifview-widget
    src="coordinates-and-reflections.cif"
    options='{"differenceDensity":{"autoLoad":true}}'>
</cifview-widget>
```

The coordinate structure appears first; reflection parsing, IAM calculation, FFT, and
progressive surface generation then run in a worker by default, with a main-thread
fallback where workers are not available. As soon as calculation starts, a button
appears beside the ordinary display controls and shows the progressive step instead of
opening a large status box. Its first row reads `Δρ/eÅ³`; once complete, its second row
changes to the positive/negative contour magnitude. Clicking it cycles through all
loaded fields and then a hidden state without recalculating their grids. With one field
this remains a hide/show toggle. It is not shown when no density is loading or
available.

<CifDemo src="/cif/urea.cif" label="Live example — urea with embedded reflection data (the density button appears top right once the map is ready):" options='{"differenceDensity":{"autoLoad":true}}' caption="Fo−Fc difference density from the embedded SHELX HKL data, calculated in your browser." style="aspect-ratio: 16 / 9;" />

Standard difference maps use green/red wireframes by default; custom coefficient loops
are treated as deformation density and use light blue/orange. See
[Library → Density maps](../library/density.md) for supported reflection sources and
custom columns, and [Options Reference → Density](../reference/density.md) for contour,
colour, resolution, symmetry, and worker settings.

## Planar contour lines

A widget can replace the 3D isosurface with line-only contours in a molecular plane. The
contour layer has no filled plane or background object, so the widget's configured
page/viewer background remains visible:

```html
<cifview-widget
    src="coordinates-and-reflections.cif"
    options='{
      "differenceDensity":{"autoLoad":true},
      "contourLines":{
        "enabled":true,
        "plane":{"atoms":["C1","C2","O1"]},
        "contourCount":20
      }
    }'>
</cifview-widget>
```

Use `{"mode":"best-fit"}` for all displayed atoms, or provide `coordinateSystem`,
`origin`, and `normal` for an explicit Cartesian or fractional plane. During progressive
loading, field sampling and Marching Squares run in the scalar-field worker; the UI
thread only installs the packed line segments. The same density button continues to
hide/show or cycle loaded fields.

A live contour example is in the [Gallery → Contour section](../gallery/contour-section.md).
