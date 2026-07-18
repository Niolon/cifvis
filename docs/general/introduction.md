# Introduction

CifVis is a JavaScript library and web component for visualizing crystal structures from
crystallographic information files (CIF), powered by Three.js. Atoms, bonds and hydrogen
bonds are displayed as entered in the CIF. Everything — from CIF parsing, to structure
construction, to display — runs locally in your browser; there is no server component.

<CifDemo src="/cif/sucrose.cif" caption="Sucrose — drag to rotate, wheel to zoom, click atoms and bonds to select them." style="aspect-ratio: 16 / 9;" />

## Features

- Interactive 3D visualization of crystal structures
- Support for anisotropic displacement parameters (ADPs)
- Display of bonds and hydrogen bonds
- Disorder group handling
- Crystal symmetry growing of structures
- Progressive difference-density maps from FCF data or observed reflections plus an IAM calculation
- Custom complex coefficients for deformation-density maps, with symmetry-aware surface reuse
- Multi-block CIF selection in the playground and widget API
- Collision-free, opt-in [atom labels](../labels/index.md)
- Touch and mouse controls
- Widget for a complete packaged solution

## Two ways to use CifVis

**The widget.** `<cifview-widget>` is a browser custom element: include one script, add one
HTML tag, and you have an interactive structure viewer with toggle buttons, captions, and
selection feedback. If you want a structure on a web page with minimal code, start with
[Widget → Getting started](../widget/getting-started.md).

**The library.** Underneath the widget sits a layered JavaScript library: a CIF parser, a
crystallographic structure model with filters, a density-map pipeline, and a Three.js
rendering layer orchestrated by `CrystalViewer`. If you are building your own GUI, batch
tooling, or embedding structures in an existing Three.js scene, start with
[JS Library → Getting started](../library/getting-started.md).

Both share one `options` schema — see the [Options Reference](../reference/index.md) — and
the [Gallery](../gallery/index.md) shows the kinds of applications you can build with either.

## Try it

The [interactive playground](https://niolon.github.io/cifvis/) lets you load your own CIF
file (plus FCF or Gaussian Cube files) and explore it directly. A subset of viewer options
can be set through URL query parameters, e.g. `?contours=best-fit` for a planar contour
section.

## License and citation

CifVis is written by Paul Niklas Ruth and released under the
[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). The source is on
[GitHub](https://github.com/niolon/cifvis); the package is published on npm as
[`cifvis`](https://www.npmjs.com/package/cifvis).
