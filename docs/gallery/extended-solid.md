# Extended solids

Molecular-fragment thinking breaks down for ionic and framework structures — there, the
unit cell is the natural display unit. The `cell` symmetry modes draw the full unit cell
with crystallographic axis arrows; fluorite (CaF₂) is shown here. Typical applications:
teaching solid-state chemistry, visualizing inorganic and framework materials.

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">Asymmetric unit only:</span>
    <CifDemo src="/cif/CaF2.cif" symmetry-mode="none" caption="The tiny asymmetric unit of fluorite." />
  </div>
  <div>
    <span class="cifvis-example-label">Full unit cell:</span>
    <CifDemo src="/cif/CaF2.cif" symmetry-mode="cell" caption="Complete unit cell with axis arrows (a red, b green, c blue)." />
  </div>
</div>

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="CaF2.cif"
    symmetry-mode="cell"
    options='{"cell": {"boxColor": "#000000", "boxOpacity": 0.8}}'>
</cifview-widget>
```

```js [Library (JS)]
import { CIF, CrystalStructure, CrystalViewer, SymmetryGrower } from 'cifvis';

const viewer = new CrystalViewer(container, { symmetryMode: 'cell' });
await viewer.loadCIF(cifText);

// Or grow the structure without any viewer, for batch tooling:
const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
const grown = new SymmetryGrower('cell').apply(structure);
console.log(grown.atoms.length);
```

:::

### Atoms on the cell border

By default the `cell` modes use a **packing cutoff** of `1.0`: the canonical unit cell, where
every atom has a single, Z-correct copy in `[0, 1)`. Raising the cutoff slightly (e.g. `1.001`)
additionally duplicates atoms that sit within that margin of a low cell face — 0, an edge, or a
corner — onto the matching high face(s), for a "closed" packing diagram with atoms visible on
every side of the box. These duplicates are atoms only (no new bonds are drawn for them), and Z
is no longer exact once they're included.

::: code-group

```html [Widget (HTML)]
<cifview-widget
    src="CaF2.cif"
    symmetry-mode="cell"
    options='{"packingCutoff": 1.001}'>
</cifview-widget>
```

```js [Library (JS)]
const viewer = new CrystalViewer(container, { symmetryMode: 'cell', packingCutoff: 1.001 });

// Or directly: new SymmetryGrower('cell', 1.001).apply(structure);
```

:::

## Related docs

- [General → The structure model](../general/structure-model.md) — symmetry growing modes
- [Options Reference → Unit cell](../reference/cell.md) — box and arrow styling
