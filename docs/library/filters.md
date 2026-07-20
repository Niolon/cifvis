# Filters

The concept — six structure modifiers run in a fixed pipeline before display — is
introduced in [General → The structure model](../general/structure-model.md). This page
covers driving them from code.

```
removeatoms → addhydrogen → missingbonds → disorder → symmetry → hydrogen
```

| Key in `viewer.modifiers` | Class | Modes | Purpose |
|---|---|---|---|
| `removeatoms` | `AtomLabelFilter` | `on`, `off` | Strips explicitly excluded atoms (comma list, supports `"A1>A10"` ranges). |
| `addhydrogen` | `IsolatedHydrogenFixer` | `on`, `off` | Bonds orphan hydrogen atoms to a nearby heavy atom. |
| `missingbonds` | `BondGenerator` | `keep`, `add`, `replace`, `create`, `ignore` | Generates bonds from interatomic distances when the CIF doesn't list them. |
| `disorder` | `DisorderFilter` | `all`, `group<rank>of<total>` | Shows only one disorder group (plus non-disordered atoms) at a time. |
| `symmetry` | `SymmetryGrower` | `none`, `hbonds`, `fragment`, `fragment-hbonds`, `cell`, `fragment-cell` | Grows one additional symmetry sphere via bonds, H-bonds, or the whole unit cell. |
| `hydrogen` | `HydrogenFilter` | `none`, `constant`, `anisotropic` | Controls hydrogen atom display (hidden, constant-radius sphere, or real ADP). |

## Via a viewer

```js
viewer.modifiers.hydrogen.mode = 'constant';
await viewer.updateStructure();
```

For filters whose mode change alters the structure's extent (`symmetry`,
`removeatoms`), call `viewer.loadStructure()` instead so the camera resets — see
[CrystalViewer](./crystal-viewer.md#camera-updates-when-filters-change).

## Standalone, without a viewer

`HydrogenFilter`, `DisorderFilter`, `SymmetryGrower`, `AtomLabelFilter`, and
`BondGenerator` are all exported from the package root, so you can filter a
`CrystalStructure` directly — useful for batch processing or non-visual tooling (they
also work in Node via `cifvis/nobrowser`):

```js
import { CIF, CrystalStructure, SymmetryGrower } from 'cifvis';

const cif = new CIF(cifText);
const structure = CrystalStructure.fromCIF(cif.getBlock(0));

const grower = new SymmetryGrower('fragment');
const grownStructure = grower.apply(structure);
```

## Related utility exports

A few small helpers are exported alongside the filters:

| Export | Purpose |
|---|---|
| `formatValueEsd(value, su)` | Formats a value and its standard uncertainty back into `1.234(5)` notation. |
| `tryToFixCifBlock(block)` | Attempts common CIF repairs before `CrystalStructure.fromCIF` — see [CIF files](../general/cif-files.md#malformed-files). |
| `getDisorderIcon(mode)` | Returns the built-in SVG icon for a disorder mode button. |
| `generateDisorderGroupIcon(rank, total)` | Generates an SVG icon for an arbitrary `group<rank>of<total>` disorder mode. |
