# The structure model

`CrystalStructure` is the crystallographic domain model at the heart of CifVis: unit
cell, atoms (with isotropic or anisotropic displacement parameters), bonds, hydrogen
bonds, and symmetry. It is built directly from a parsed CIF block:

```js
import { CIF, CrystalStructure } from 'cifvis';

const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
```

The structure model knows nothing about rendering — it is DOM- and Three.js-free, so it
works in Node just as well as in the browser (import from `cifvis/nobrowser` in
environments without a `window`).

## Filters: how the displayed structure is derived

What you *see* in a viewer is rarely the raw asymmetric unit from the CIF. Every time the
displayed structure needs to change, `CrystalViewer` runs the base structure through six
**Filters** (structure modifiers) in a fixed order, each one's output feeding the next:

```
removeatoms → addhydrogen → missingbonds → disorder → symmetry → hydrogen
```

| Filter | Class | Purpose |
|---|---|---|
| `removeatoms` | `AtomLabelFilter` | Strips explicitly excluded atoms. |
| `addhydrogen` | `IsolatedHydrogenFixer` | Bonds orphan hydrogen atoms to a nearby heavy atom. |
| `missingbonds` | `BondGenerator` | Generates bonds from interatomic distances when the CIF doesn't list them. |
| `disorder` | `DisorderFilter` | Shows only one disorder group (plus non-disordered atoms) at a time. |
| `symmetry` | `SymmetryGrower` | Grows one additional symmetry sphere via bonds, H-bonds, or the whole unit cell. |
| `hydrogen` | `HydrogenFilter` | Controls hydrogen display (hidden, constant-radius sphere, or real ADP). |

Each filter is a pure `CrystalStructure → CrystalStructure` transformation, so the same
classes work with a viewer, with the widget's attributes, or completely standalone in
batch tooling — see [Library → Filters](../library/filters.md) for modes and standalone
use, and the widget's [`hydrogen-mode` / `disorder-mode` / `symmetry-mode`
attributes](../widget/attributes-reference.md) for the declarative form.

## The three display concepts

Three of the filters correspond to the display modes you will meet throughout CifVis:

- **Hydrogen display** — hydrogens can be hidden (`none`), drawn as small constant-radius
  spheres (`constant`), or drawn with their real refined displacement ellipsoids
  (`anisotropic`).
- **Disorder groups** — structures with disorder carry `disorder_group` assignments in the
  CIF. CifVis shows all groups at once (`all`) or one group at a time
  (`group1of2`, `group2of2`, … — named by rank and total count, not by the raw CIF group
  number).
- **Symmetry growing** — the asymmetric unit can be expanded by one symmetry sphere,
  following bonds (`fragment`), hydrogen bonds (`hbonds`), both (`fragment-hbonds`), or by
  displaying the whole unit cell (`cell`, `fragment-cell`).

If a requested mode is not applicable to a structure (say, a disorder group mode on an
ordered structure), viewer and widget fall back to an applicable mode automatically.

<CifDemo src="/cif/urea.cif" caption="Urea with hydrogens shown and the fragment grown through symmetry." hydrogen-mode="constant" symmetry-mode="fragment" style="aspect-ratio: 16 / 9;" />
