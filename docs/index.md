---
layout: home

hero:
  name: CifVis
  text: Crystal structures in the browser
  tagline: Interactive 3D visualization of crystal structures from CIF files, powered by Three.js. Everything — CIF parsing, structure construction, density maps, display — runs locally in your browser.
  actions:
    - theme: brand
      text: I want the drop-in widget
      link: /widget/getting-started
    - theme: alt
      text: I'm building with the library
      link: /library/getting-started
    - theme: alt
      text: Show me examples
      link: /gallery/

features:
  - title: General
    details: What CifVis is and the concepts shared by widget and library — the CIF model, the structure model and its filters, and how density maps work.
    link: /general/introduction
  - title: Widget
    details: The <cifview-widget> web component — one HTML tag for an interactive structure on your page, with attributes for modes, density, filtering, and styling.
    link: /widget/getting-started
  - title: JS Library
    details: Parse CIF files, drive CrystalViewer to build a custom GUI, calculate density maps, run Filters standalone, or feed geometry into your own Three.js scene.
    link: /library/getting-started
  - title: Atom Labels
    details: Opt-in screen-space atom labels with collision-free placement — how to activate them and how the placement algorithms work.
    link: /labels/
  - title: Options Reference
    details: The full options schema shared by CrystalViewer and the widget, with tables generated directly from the source defaults.
    link: /reference/
  - title: Gallery
    details: Live examples of what you can build — comparison views, density maps, publication figures, theming, and integrating CifVis with other JavaScript.
    link: /gallery/
---

## More resources

- **[Interactive playground](https://niolon.github.io/cifvis/)** — load your own CIF file and explore it in the browser.
- **[Developing CifVis](./contributing/index.md)** — contributor guide: the lay of the land and how the layers depend on each other.
- **Generated API reference** — every exported class and function has a JSDoc comment; run `npm run docs` from the repo root to build the full browsable reference at `jsdoc-out/index.html`.
- **[GitHub](https://github.com/niolon/cifvis)** — source, issues, and releases. Released under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
