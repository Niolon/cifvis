# Disorder handling

A disordered structure shown three ways: all disorder groups at once (PART 2 bonds drawn
open), then each group separately. The widget's disorder toggle button cycles the same
modes interactively — its icon is generated per group count. Typical applications:
communicating disorder models in supporting information, teaching occupancy refinement.

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">All parts:</span>
    <CifDemo src="/cif/disorder.cif" disorder-mode="all" options='{"renderStyle":"cutout-2d"}' caption="Both disorder groups; PART 2 bonds are open." />
  </div>
  <div>
    <span class="cifvis-example-label">Group 1 of 2:</span>
    <CifDemo src="/cif/disorder.cif" disorder-mode="group1of2" options='{"renderStyle":"cutout-2d"}' caption="First disorder group plus ordered atoms." />
  </div>
  <div>
    <span class="cifvis-example-label">Group 2 of 2:</span>
    <CifDemo src="/cif/disorder.cif" disorder-mode="group2of2" options='{"renderStyle":"cutout-2d"}' caption="Second disorder group plus ordered atoms." />
  </div>
</div>

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget src="disorder.cif" disorder-mode="all"></cifview-widget>
<cifview-widget src="disorder.cif" disorder-mode="group1of2"></cifview-widget>
<cifview-widget src="disorder.cif" disorder-mode="group2of2"></cifview-widget>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

const viewer = new CrystalViewer(container, { disorderMode: 'all' });
await viewer.loadCIF(cifText);

// Cycle through the applicable modes (wired to a button):
await viewer.cycleModifierMode('disorder');

// Or use the DisorderFilter standalone, without any viewer:
// const filtered = new DisorderFilter('group1of2').apply(structure);
```

:::

## Related docs

- [General → The structure model](../general/structure-model.md) — the disorder-group naming
- [Library → Filters](../library/filters.md)
