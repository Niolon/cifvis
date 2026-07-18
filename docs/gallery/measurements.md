# Geometry measurements

A measurement tool built entirely on the public selection API: clicking atoms fills an
ordered list (clicking again removes an atom; the buttons remove the last entry or clear
the list). In **chain** mode the list yields consecutive distances, angles, and torsion
angles; in **plane** mode the first three atoms define a plane and every further atom
gets its signed distance to it. Typical applications: structure analysis front-ends,
teaching molecular geometry, quick checks without leaving the browser.

<MeasureDemo />

## How it works

Every selection callback delivers the full structure `Atom` objects in click order, and
`atom.position.toCartesian(cell)` gives Cartesian coordinates — everything else is
plain vector geometry, no library required.

## Reproduce it

::: code-group

```html [Widget (HTML)]
<cifview-widget id="structure" src="structure.cif"></cifview-widget>
<button id="clear">Clear list</button>
<output id="result"></output>

<script type="module">
    import { CifViewWidget } from 'cifvis';

    const widget = document.getElementById('structure');
    while (!widget.viewer?.state?.baseStructure) {
        await new Promise(r => requestAnimationFrame(r));
    }
    const viewer = widget.viewer;
    const cell = viewer.state.baseStructure.cell;

    viewer.selections.onChange(selections => {
        // Click order is preserved; use the same geometry helpers
        // as in the Library tab.
        const atoms = selections
            .filter(s => s.type === 'atom')
            .map(s => ({ label: s.data.label, xyz: [...s.data.position.toCartesian(cell)] }));
        document.getElementById('result').textContent = describe(atoms);
    });
    document.getElementById('clear').onclick = () => viewer.selections.clear();
</script>
```

```js [Library (JS)]
import { CrystalViewer } from 'cifvis';

// Plain vector helpers — selections deliver Cartesian coordinates,
// so the measurements are a few lines each.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = a => Math.hypot(...a);
const unit = a => a.map(c => c / norm(a));
const deg = r => r * 180 / Math.PI;

const distance = (a, b) => norm(sub(b, a));
const angle = (a, b, c) =>
    deg(Math.acos(dot(unit(sub(a, b)), unit(sub(c, b)))));
const torsion = (a, b, c, d) => {
    const b2 = sub(c, b);
    const n1 = cross(sub(b, a), b2);
    const n2 = cross(b2, sub(d, c));
    return deg(Math.atan2(dot(cross(n1, n2), unit(b2)), dot(n1, n2)));
};
// Signed distance of q to the plane through p1, p2, p3:
const planeDistance = (q, p1, p2, p3) =>
    dot(sub(q, p1), unit(cross(sub(p2, p1), sub(p3, p1))));

const viewer = new CrystalViewer(container, { hydrogenMode: 'constant' });
await viewer.loadCIF(cifText);
const cell = viewer.state.baseStructure.cell;

viewer.selections.onChange(selections => {
    const xyz = selections
        .filter(s => s.type === 'atom')
        .map(s => [...s.data.position.toCartesian(cell)]);
    if (xyz.length === 2) {
        console.log(`d = ${distance(...xyz).toFixed(3)} Å`);
    }
    if (xyz.length === 3) {
        console.log(`angle = ${angle(...xyz).toFixed(2)}°`);
    }
    if (xyz.length === 4) {
        console.log(`torsion = ${torsion(...xyz).toFixed(2)}°`);
        console.log(`plane distance = ${planeDistance(xyz[3], xyz[0], xyz[1], xyz[2]).toFixed(3)} Å`);
    }
});

// Programmatic filling and clearing of the list also works:
viewer.selectAtoms(['C1', 'C2', 'O1']);
viewer.selections.clear();
```

:::

::: tip Symmetry copies
When symmetry growing is active, a plain label selects every displayed copy of that
atom. The selection data carries the unique ID (`C1|2_555`) alongside the label, so a
measurement tool can distinguish copies when needed.
:::

## Related docs

- [Library → CrystalViewer](../library/crystal-viewer.md) — `selections.onChange`, `selectAtoms`, selection markers
- [General → The structure model](../general/structure-model.md) — atoms, positions, and the unit cell
