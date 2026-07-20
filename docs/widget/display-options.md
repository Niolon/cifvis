# Display options

The CifVis widget provides several display options that can be controlled via
attributes. Mode attributes use kebab-case; if a display mode is incompatible with a
structure, the widget falls back to an applicable mode. The concepts behind these modes
are explained in [General → The structure model](../general/structure-model.md).

## Hydrogen modes

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">Hydrogen atoms hidden:</span>
    <CifDemo src="/cif/sucrose.cif" caption="Structure with hydrogens hidden" hydrogen-mode="none" />
  </div>
  <div>
    <span class="cifvis-example-label">Hydrogen atoms displayed:</span>
    <CifDemo src="/cif/sucrose.cif" caption="Structure with hydrogens displayed (constant radius)" hydrogen-mode="constant" />
  </div>
  <div>
    <span class="cifvis-example-label">Anisotropic hydrogens:</span>
    <CifDemo src="/cif/hani.cif" caption="Structure with anisotropic hydrogens" hydrogen-mode="anisotropic" />
  </div>
</div>

## Disorder modes

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">2D disorder — all parts shown:</span>
    <CifDemo src="/cif/disorder.cif" caption="Non-disordered/PART 1 bonds are solid; PART 2 bonds are open" disorder-mode="all" options='{"renderStyle":"cutout-2d"}' />
  </div>
  <div>
    <span class="cifvis-example-label">2D disorder — group1of2 only:</span>
    <CifDemo src="/cif/disorder.cif" caption="Non-disordered atoms plus the first disorder group only" disorder-mode="group1of2" options='{"renderStyle":"cutout-2d"}' />
  </div>
  <div>
    <span class="cifvis-example-label">2D disorder — group2of2 only:</span>
    <CifDemo src="/cif/disorder.cif" caption="Non-disordered atoms plus the second disorder group only" disorder-mode="group2of2" options='{"renderStyle":"cutout-2d"}' />
  </div>
</div>

## ORTEP render modes {#ortep-render-modes}

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">Solid</span>
    <CifDemo src="/cif/urea.cif" options='{"renderStyle":"solid-3d"}' caption="Standard solid ellipsoids." />
  </div>
  <div>
    <span class="cifvis-example-label">Cutout</span>
    <CifDemo src="/cif/urea.cif" options='{"renderStyle":"cutout-3d"}' caption="Camera-facing cutout with three hatched faces." />
  </div>
  <div>
    <span class="cifvis-example-label">2D</span>
    <CifDemo src="/cif/urea.cif" options='{"renderStyle":"cutout-2d"}' caption="Element-coloured publication style." />
  </div>
</div>

The render style is set through the JSON `options` attribute
(`options='{"renderStyle":"cutout-2d"}'`) — see
[Options Reference → Rendering](../reference/rendering.md) for the full description of
each style and the `plot2D*` tuning options.

## Growing symmetry

You can grow the symmetry one additional sphere using bonds or hydrogen bonds contained
in the CIF tables:

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">Asymmetric unit:</span>
    <CifDemo src="/cif/urea.cif" caption="Urea, asymmetric unit only" hydrogen-mode="constant" symmetry-mode="none" />
  </div>
  <div>
    <span class="cifvis-example-label">Grow with both bond types:</span>
    <CifDemo src="/cif/urea.cif" caption="Urea with symmetry expansion" hydrogen-mode="constant" symmetry-mode="fragment" />
  </div>
</div>

The full set of values is `none`, `hbonds`, `fragment`, `fragment-hbonds`, `cell`, and
`fragment-cell` — fragment modes grow through bonds, H-bonds, or both; cell modes
display the complete unit cell, optionally with connected fragments.

## Atom labels

Labels are opt-in and can be set through the `atom-labels` attribute or
`options.atomLabels`. They have their own dedicated section — see
[Atom Labels](../labels/index.md) and in particular
[Labels in the widget](../labels/widget.md).

## Everything else

All remaining appearance and behaviour settings go through the JSON `options`
attribute, which is passed unchanged to the internal `CrystalViewer` — see the
[attributes reference](./attributes-reference.md) and the
[Options Reference](../reference/index.md).
