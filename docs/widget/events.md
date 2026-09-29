# Events and state

Listen for standard DOM events on `<cifview-widget>` to respond to loading, selections,
measurements, view changes, and density updates.

```js
const widget = document.querySelector('cifview-widget');

widget.addEventListener('cifvis-load', ({ detail }) => {
    console.log('Loaded block', detail.block, detail.structure);
});

widget.addEventListener('cifvis-error', ({ detail }) => {
    console.error(detail.message, detail.error);
});

widget.addEventListener('cifvis-selection-change', ({ detail }) => {
    console.log(detail.selections);
});
```

Every event bubbles, is composed, and is not cancelable. This allows a containing page
or framework component to listen above the widget in the DOM.

## Observable properties

| Property | Type | Meaning |
|---|---|---|
| `loading` | `boolean` | `true` while the current structure request is in progress. |
| `error` | `Error \| null` | Most recent structure-loading error; reset to `null` when a new load begins. |
| `structure` | `CrystalStructure \| null` | Current browser-independent structure model, or `null` before a successful load. |

These properties are read-only. `aria-busy` follows `loading` as the strings `"true"`
and `"false"`.

## Event reference

| Event | `detail` |
|---|---|
| `cifvis-loading-change` | `{ loading, source, block, url? }` when loading starts or finishes. |
| `cifvis-load` | `{ structure, result, source, block, url? }` after the structure and widget controls are ready. `result` is the successful `CrystalViewer.loadCIF()` result. |
| `cifvis-error` | `{ error, message, source, block, url? }` after a fetch, parse, block-selection, or structure-loading failure. |
| `cifvis-selection-change` | `{ selections }`, containing a snapshot of the viewer's public selection records. |
| `cifvis-measurement-change` | `{ measurements, selectedAtomCount, action }`, matching `MeasurementControls` state. |
| `cifvis-view-change` | `{ viewState, interaction }`; emitted for rotation and camera updates. `viewState` is the serializable state returned by `CrystalViewer.getViewState()`. |
| `cifvis-density-change` | `{ update, state }`; `update` is the original scalar-field event and `state` is the widget's reduced display-state snapshot. |

The `source` value for loading events is `url`, `data`, `block`, or `options`. A newer
load supersedes an older in-flight load; stale completions do not emit `cifvis-load` or
`cifvis-error`.

## Framework usage

The events are ordinary `CustomEvent` instances. In frameworks that normalize event
names, attach a native listener or use the framework's custom-element event syntax.
The payload is always available through `event.detail`.
