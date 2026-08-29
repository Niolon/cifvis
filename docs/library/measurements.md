# Measurements with the JS library

`CrystalViewer` provides persistent measurements for ordered atom lists. Two atoms
produce a distance, three an angle, four a torsion, and five or more the last atom's
distance from the least-squares mean plane through the preceding atoms.

## Creating measurements

Measure the current atom selection or supply displayed atom IDs directly:

```js
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container);
await viewer.loadCIF(cifText);

// Uses atom selections in their selection order.
const selectedResult = viewer.measureSelectedAtoms();

// Does not change the current selection. Plain labels or exact unique IDs work.
const distance = viewer.measureAtomsById(['C1', 'O1']);
console.log(distance.value, distance.unit); // for example: 1.234, "Å"
```

Both methods create a persistent result and return it. Measurement objects include
`id`, `type`, `value`, `unit`, `labels`, `atomIds`, `points`, and the assigned `color`.
A plane-distance result additionally contains `planeLabels`, `probeLabel`, and plane
geometry.

## Results and hover previews

Persistent geometry is hidden by default. This keeps overlapping measurements from
competing in the scene. A UI can list all results and reveal the one under the pointer:

```js
const unsubscribe = viewer.onMeasurementChange(measurements => {
    renderMeasurementList(measurements, {
        enter: id => viewer.setHoveredMeasurement(id),
        leave: () => viewer.setHoveredMeasurement(null),
        remove: id => viewer.clearMeasurement(id),
    });
});

const measurements = viewer.getMeasurements();
viewer.clearMeasurement(measurements[0]?.id); // remove one
viewer.clearMeasurement();                    // remove all

// Call during teardown.
unsubscribe();
```

`viewer.setHoveredMeasurement(id)` shows only the matching overlay. Passing `null`
hides every measurement overlay again. `viewer.onMeasurementChange(callback)` returns
an unsubscribe function.

## Measuring without a viewer

The calculation and formatting helpers are also public exports:

```js
import { measureAtoms, formatMeasurement } from 'cifvis';

const result = measureAtoms([atom1, atom2], structure.cell);
console.log(formatMeasurement(result));
// Distance C1–O1: 1.234 Å
```

`measureAtoms(atoms, cell)` expects structure `Atom` objects in measurement order. It
does not create scene geometry. `formatMeasurement(result)` produces the same compact
text used by the supplied interfaces.

## Appearance updates

Set initial appearance in the viewer options or update it live:

```js
const viewer = new CrystalViewer(container, {
    measurement: {
        lineRadius: 0.075,
        markerRadius: 0.11,
        markerColors: [0xff9900, 0x00b7ff],
    },
});

viewer.updateMeasurementOptions({ lineRadius: 0.09, markerRadius: 0.13 });
```

See [Selection options](../reference/selection.md) for defaults and validation details,
or [Measurements in the widget](../widget/measurements.md) for the supplied HTML UI.
