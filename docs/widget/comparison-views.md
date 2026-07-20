# Coupled comparison views

Widgets can share hydrogen, disorder, and symmetry modes together with the complete
molecular transform, right-drag panning, wheel/pinch zoom, and camera reset. Interaction
events are replayed once per animation frame, while selection stays independent.

Change a display mode, drag, right-drag, wheel, or pinch either viewer below — both
directions update the peer:

<ComparisonDemo />

```js
import { coupleViewerInteractions } from 'cifvis';

const coupling = coupleViewerInteractions(leftWidget, rightWidget);
await coupling.synchronizeFrom(leftWidget); // modes, molecular origin/orientation, and absolute framing
// coupling.add(otherViewer);
// coupling.delete(leftWidget);
// coupling.dispose();
```

Coupling works across any mixture of initialized `<cifview-widget>` elements and bare
`CrystalViewer` instances — see [Library → Coupled viewers](../library/coupling.md) for
the full API, and the [Gallery entry](../gallery/comparison-views.md) for a
side-by-side application example.
