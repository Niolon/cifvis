# Coupled viewers

Hydrogen, disorder, and symmetry modes plus the complete molecular transform, pan, zoom,
and camera reset can be coupled across any mixture of `CrystalViewer` and initialized
`<cifview-widget>` instances. Inputs are batched per animation frame and every peer
renders only once for that batch; semantic mode changes rebuild each peer at most once.

```js
import { coupleViewerInteractions } from 'cifvis';

const coupling = coupleViewerInteractions(leftViewer, rightViewer, thirdWidget);

// After independent loads: match modes, orientation, and absolute framing.
await coupling.synchronizeFrom(leftViewer);

// Viewers can be attached or detached later.
coupling.add(fourthViewer);
coupling.delete(rightViewer);

// Release the listeners when the comparison UI is removed.
coupling.dispose();
```

Selection stays independent because compared structures need not share atom
identifiers. Rotation and camera framing are matched exactly, giving every viewer the
same initial distance/orthographic size and subsequent zoom.

`coupleViewerInteractions(...)` is a convenience wrapper around the
`ViewerInteractionCoupling` class, which is also exported for cases where you want to
construct the coupling object yourself.

::: tip Waiting for widgets
A `<cifview-widget>` initializes asynchronously. Before synchronizing from a widget,
wait until its internal viewer has a structure, e.g.
`widget.viewer?.state?.baseStructure`.
:::

A live two-widget demo is embedded in
[Widget → Comparison views](../widget/comparison-views.md), and a full application
example in the [Gallery](../gallery/comparison-views.md).
