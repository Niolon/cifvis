# PEANUT difference between two CIF models

This example matches atoms by `_atom_site_label`, subtracts the reference ADP tensor
from the comparison tensor, and displays the signed result as an RMSD PEANUT surface.
Both source CIFs contain ordinary positive-definite ADPs; their tensor difference can
have positive and negative directions.

<PeanutDifferenceDemo />

The positive component uses each element's normal `atomColor` body and `ringColor`
grid. The complementary negative component switches those colours. The scale is raised
to `3` here because differences between two refined ADPs are smaller than either ADP.

## Reproduce it

```js
import { CIF, CrystalStructure, CrystalViewer, UAnisoADP } from 'cifvis';

const fields = ['u11', 'u22', 'u33', 'u12', 'u13', 'u23'];
const parse = text => CrystalStructure.fromCIF(new CIF(text).getBlock(0));

const reference = parse(referenceCifText);
const difference = parse(comparisonCifText);
const referenceByLabel = new Map(reference.atoms.map(atom => [atom.label, atom]));

for (const atom of difference.atoms) {
    const referenceAtom = referenceByLabel.get(atom.label);
    if (!(atom.adp instanceof UAnisoADP) || !(referenceAtom?.adp instanceof UAnisoADP)) {
        throw new Error(`Matched anisotropic ADPs are required for ${atom.label}`);
    }
    // The displayed tensor is comparison minus reference.
    atom.adp = new UAnisoADP(...fields.map(
        field => atom.adp[field] - referenceAtom.adp[field],
    ));
}

const viewer = new CrystalViewer(container, {
    adpRepresentation: 'rmsd-peanut',
    renderStyle: 'cutout-3d',
    peanutScale: 3,
});
await viewer.loadStructure(difference);
```

The two models must use the same Cartesian frame and matching atom labels. If their
unit cells or settings differ, transform the tensors into a common Cartesian frame
before subtracting them.

## Related docs

- [Rendering → RMSD PEANUT](../reference/rendering.md#render-styles)
- [General → CIF files](../general/cif-files.md)
