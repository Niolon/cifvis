# Coupled viewers

Hydrogen, disorder, and symmetry modes plus the complete molecular transform, pan, zoom,
and camera reset can be coupled across any mixture of `CrystalViewer` and initialized
`<cifview-widget>` instances. Inputs are batched per animation frame and every peer
renders only once for that batch; semantic mode changes rebuild each peer at most once.
The coupling API currently lives in `cifvis/experimental` and may evolve independently
of the stable root API.

```js
import { coupleViewerInteractions } from 'cifvis/experimental';

const coupling = coupleViewerInteractions(leftViewer, rightViewer, thirdWidget);

// After independent loads: match modes, orientation, and absolute framing.
await coupling.synchronizeFrom(leftViewer);

// Viewers can be attached or detached later.
coupling.add(fourthViewer);
coupling.delete(rightViewer);

// Release the listeners when the comparison UI is removed.
coupling.dispose();
```

## Sharing the view without sharing the modes

Coupling propagates display modes as well as the camera, both when you call
`synchronizeFrom` and whenever a mode changes afterwards. That is usually what
you want — but it means peers lose whatever they were constructed with.

The case where it bites: two models that deliberately differ. Put a refined
structure carrying anisotropic hydrogens next to the input model that has none,
couple them, and the refined viewer is pulled back to `hydrogenMode: 'none'`
because that is what its peer has. Nothing errors; the ellipsoids simply
disappear, and whether they do can depend on which viewer finishes loading
first.

Pass `coupleModes: false` when the viewers are meant to show different things.
The camera, molecular transform, pan and zoom stay linked; the modes do not.

```js
const coupling = coupleViewerInteractions(refinedViewer, inputViewer, {
    coupleModes: false,
});
await coupling.synchronizeFrom(refinedViewer);
```

The same opt-out is available for a single call, and as an explicit method:

```js
// this synchronization only, whatever the coupling was constructed with
await coupling.synchronizeFrom(refinedViewer, { modes: false });

// equivalent, if the intent reads better as its own verb
coupling.synchronizeViewFrom(refinedViewer);
```

With `coupleModes: false` the peers also stop propagating each other's mode
changes, so toggling hydrogens in one viewer no longer toggles them in the
other. Leave it at the default when the coupled structures are variants of the
same model and should look alike.

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
