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

## Related docs

- [General → The structure model](../general/structure-model.md) — symmetry growing modes
- [Options Reference → Unit cell](../reference/cell.md) — box and arrow styling
