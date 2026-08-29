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

## Ready-made DOM bindings

Persistent geometry is hidden by default so overlapping measurements do not compete in
the scene. `MeasurementControls` supplies the common UI behavior without deciding where
the controls belong on your page.

Bind any existing button and result container. The controller keeps both synchronized,
including selection counts, context-sensitive actions, hover and keyboard previews,
atom highlighting, removal, and teardown:

```js
import { CrystalViewer, MeasurementControls } from 'cifvis';

const viewer = new CrystalViewer(document.querySelector('#viewer'));
await viewer.loadCIF(cifText);

const controls = new MeasurementControls(viewer, {
    measurements: [['C1', 'O1']],
    onError: error => console.error(error),
});

const unbindAction = controls.bindAction(document.querySelector('#measure'));
const unbindResults = controls.bindResults(document.querySelector('#measurements'));

// Remove individual bindings when their DOM is replaced.
unbindAction();
unbindResults();

// Or remove every binding and subscription during application teardown.
controls.dispose();
```

The default renderer creates compact, wrapping result chips. Style its stable
`cifvis-measurement-*` classes or the `--cifvis-measurement-*` CSS custom properties to
match the surrounding application. Disposing the controller never removes scientific
measurement state from the viewer.

## Custom result markup

Pass `renderItem` when your application needs different markup. Return an element for
one result and add data hooks only where the corresponding behavior is wanted. The
returned root automatically receives measurement hover and focus preview behavior.

```js
controls.bindResults(document.querySelector('#measurements'), {
    renderItem(measurement) {
        const card = document.createElement('article');
        card.className = 'measurement-card';

        const atom = document.createElement('button');
        atom.type = 'button';
        atom.dataset.cifvisAtomId = measurement.atomIds[0];
        atom.textContent = measurement.labels[0];

        const value = document.createElement('span');
        value.textContent = `${measurement.value.toFixed(3)} ${measurement.unit}`;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.cifvisDismiss = '';
        remove.setAttribute('aria-label', 'Remove measurement');
        remove.textContent = '×';

        card.append(atom, value, remove);
        return card;
    },
});
```

- `data-cifvis-atom-id="…"` enables atom hover and keyboard-focus highlighting.
- `data-cifvis-hover-color="16711935"` optionally overrides that atom's preview colour.
- `data-cifvis-dismiss` turns an element into the result's removal control.

Use DOM construction or correctly escaped framework output for untrusted labels; the
supplied renderer uses `textContent` and does not interpret atom labels as HTML.

## Headless framework integration

React, Vue, Svelte, and other state-driven interfaces can subscribe without letting the
controller render any DOM:

```js
const controls = new MeasurementControls(viewer);

const unsubscribe = controls.subscribe(state => {
    // state.measurements
    // state.selectedAtomCount
    // state.action = { enabled, symbol, title }
    updateApplicationState(state);
});

// Wire these actions to framework event handlers.
controls.measureSelected();
controls.preview(measurementId); // show one overlay
controls.preview(null);          // hide all overlays
controls.remove(measurementId);

unsubscribe();
controls.dispose();
```

`subscribe()` invokes the callback immediately and returns an unsubscribe function.
Direct `measureSelected()` calls return the created result and throw calculation errors
normally. Errors originating from a bound button call `onError` and dispatch a bubbling
`cifvis-measurement-error` event; successful creation dispatches the existing bubbling
`cifvis-measurement` event.

The lower-level viewer methods remain available when no controller is needed:
`viewer.getMeasurements()`, `viewer.onMeasurementChange(callback)`,
`viewer.setHoveredMeasurement(id)`, and `viewer.clearMeasurement(id)`.

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
