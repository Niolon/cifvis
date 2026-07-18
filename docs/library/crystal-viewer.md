# CrystalViewer — binding points for a custom GUI

`<cifview-widget>` is one reference implementation of a GUI around `CrystalViewer`; you
can build your own directly against the same public surface. The relevant parts of
`src/lib/widget.js` to read as a worked example are `connectedCallback` (construct
viewer, bind selection, load), `attributeChangedCallback` (toggle filters), and
`disconnectedCallback` (dispose).

```js
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, {
    renderMode: 'onDemand',   // call viewer.requestRender() after external state changes
    atomLabels: {
        show: 'non-hydrogen',
        placementMode: 'auto-omit', // adaptive; quality, performance, and maximum coverage are available
        calloutPlacement: 'structure', // compact; 'viewport' permits wider spreading
    },
});
const result = await viewer.loadCIF(cifText);   // or viewer.loadCIF(cifText, 'blockName')
if (!result.success) {
    console.error(result.error);
}
```

The structure is painted before label layout begins. Collision placement uses a Web
Worker when available, and stale label frames are cleared during rotation rather than
ghosting over the new pose. For the full `options` schema (camera, selection, rendering,
atoms, bonds, elements), see the [Options Reference](../reference/index.md).

## The GUI-facing surface

| Member | Use |
|---|---|
| `viewer.modifiers` | Map of the six [Filters](./filters.md). Set `.mode`, then re-render. |
| `viewer.cycleModifierMode(name)` | Advances a filter to its next applicable mode and re-renders correctly — the simplest way to wire a toggle button. |
| `viewer.numberModifierModes(name)` | Number of applicable modes for the current structure; use it to decide whether to show a toggle at all. |
| `viewer.updateStructure()` | Re-runs the filter pipeline and re-renders, preserving the current rotation. Call after directly mutating a modifier's `.mode`. |
| `viewer.selections.onChange(callback)` | Selection event hook. Callback receives `[{type: 'atom'\|'bond'\|'hbond', data, color}]`. |
| `viewer.selectAtoms(labels)` | Programmatic selection by atom label. |
| `viewer.setAtomLabels(show)` | Shows all, non-hydrogen, or selected atom labels. Selection entries may override text and priority. |
| `viewer.updateAtomLabelOptions(options)` | Updates label appearance/layout without rebuilding the structure. |
| `viewer.clearAtomLabels()` | Hides atom labels. |
| `viewer.getAtomLabelLayout()` | Returns placed labels and labels omitted because no space was available. |
| `coupleViewerInteractions(...viewers)` | Bidirectionally couples modes plus the complete molecular transform, pan, absolute zoom/framing, and camera reset. See [Coupled viewers](./coupling.md). |
| `viewer.loadDifferenceDensity(text, block, options)` | Loads explicit FCF/custom coefficients or observed reflections plus IAM phases and progressively displays the map. |
| `viewer.loadCube(text, options)` | Loads a cell-matched Gaussian Cube grid in the density worker and progressively displays its isosurface. |
| `viewer.addScalarField(field, options)` | Adds an already calculated `ScalarFieldGrid`. |
| `viewer.loadScalarFieldSources(sources)` | Loads an ordered mixture of difference-density, Cube, and direct scalar-field definitions. |
| `viewer.getScalarFields()` | Returns renderer-independent metadata for the loaded field collection. |
| `viewer.setActiveScalarField(indexOrId)` | Selects a field while restoring its own contour and appearance settings. |
| `viewer.cycleScalarField()` | Advances through the loaded fields and one hidden state. |
| `viewer.onScalarFieldUpdate(callback)` | Subscribes to source-independent `started`, `update`, `complete`, `display`, `visibility`, `cleared`, `cancelled`, and `error` events. |
| `viewer.updateIsosurfaceOptions(options)` | Changes contours/appearance while retaining the scalar grid. A visibility-only update does not rebuild surfaces. |
| `viewer.updateContourLineOptions(options)` | Enables/disables a line-only planar section or changes its plane, levels, and line appearance while retaining the scalar grid. |
| `viewer.setIsosurfaceVisibility(visible)` | Shows or hides the existing surface meshes without source parsing, FFT, or marching-cubes work. |
| `viewer.clearScalarField(indexOrId)` | Discards one field, defaulting to the active entry. |
| `viewer.clearScalarFields()` | Discards the complete field collection. |
| `viewer.requestRender()` | Forces a redraw when `renderMode: 'onDemand'`. |
| `viewer.controls.handleResize()` | Call after any layout change that resizes the container. |
| `viewer.dispose()` | Releases Three.js/GPU resources and event listeners. Required on teardown. |

## Camera updates when filters change

Some filters need more than a re-render when their mode changes — growing symmetry or
removing atoms can change the structure's extent, so the camera/orientation needs to
reset too. Each filter exposes this via `requiresCameraUpdate` (currently true for
`symmetry` and `removeatoms`, false for the rest). `cycleModifierMode` already checks
this for you; if you're setting `.mode` directly instead, call `viewer.loadStructure()`
(no argument needed — it defaults to the viewer's current base structure) for filters
where `requiresCameraUpdate` is true, or `viewer.updateStructure()` otherwise:

```js
viewer.modifiers.symmetry.mode = 'fragment';
await viewer.loadStructure();   // requiresCameraUpdate === true for SymmetryGrower
```

## Try it live

A minimal custom GUI: plain buttons wired directly to `viewer.modifiers`, no widget
involved.

<CustomGuiDemo />
