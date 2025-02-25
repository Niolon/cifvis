# CifVis - Crystal Structure Visualisation

A JavaScript library and web components for visualizing crystal structures from CIF files, powered by Three.js. Atoms, bonds and hydrogen bonds are displayed as entered in the cif. A preview of the widgets is available [here](https://niolon.github.io/cifvis/widget.html), an interactive viewer that allows you to load your own structure from CIF is available [here](https://niolon.github.io/cifvis/). Everything from CIF parsing, to structure construction, to display, is done locally on your browser using JavaScript, there is no server component.

## Features

- Interactive 3D visualisation of crystal structures
- Support for anisotropic displacement parameters (ADPs)
- Display of bonds and hydrogen bonds
- Disorder group handling
- Crystal symmetry growing of structures 
- Touch and mouse controls
- Widget for complete packaged solution

## Usage
### Web Component
```html
<cifview-widget 
  src="structure.cif"
  caption="Crystal Structure"
  hydrogen-mode="none">
</cifview-widget>

<script type="module">
  import { CifViewWidget } from 'cifvis';
</script>
```

### Basic Viewer
```html
<div id="viewer"></div>
<script type="module">
  import { CrystalViewer } from 'cifvis';
  
  const viewer = new CrystalViewer(document.getElementById('viewer'));
  viewer.loadStructure(cifContent);
</script>
```



### API Reference

The package exports the following:

```javascript
import { 
  CrystalViewer,   // Main viewer class
  CIF,             // CIF file parser
  CrystalStructure, // Crystal structure data model
  ORTEP3JsStructure, // ORTEP-style structure visualisation
  CifViewWidget,    // Web component
  formatValueEsd    // Utility for formatting values with ESDs
} from 'cifvis';
```

#### CrystalViewer Options

```javascript
const viewer = new CrystalViewer(container, {
  camera: {
    zoomSpeed: 0.1,
    fov: 45,
  },
  selection: {
    mode: 'multiple', // or 'single'
    markerMult: 1.3,
    bondMarkerMult: 1.7
  },
  interaction: {
    rotationSpeed: 5,
    clickThreshold: 200
  },
  hydrogenMode: 'none',    // 'none', 'constant', 'anisotropic'
  disorderMode: 'all',     // 'all', 'group1', 'group2'
  symmetryMode: 'bonds-no-hbonds-no' // See symmetry modes below
});
```

#### Web Component Attributes

```html
<cifview-widget
  src="path/to/structure.cif"  <!-- URL to load CIF from -->
  data="..."                   <!-- Direct CIF content, mutually exclusive with src -->
  caption="Structure Title"    <!-- Caption text -->
  hydrogen-mode="none"         <!-- Initial hydrogen display mode -->
  disorder-mode="all"         <!-- Initial disorder display mode -->
  symmetry-mode="bonds-no-hbonds-no" <!-- Initial symmetry mode -->
>
</cifview-widget>
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# build for production including dependencies
npm run build:alldeps
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

WebGL support is required.

## License

This project is licensed under the Mozilla Public License Version 2.0 - see the [LICENSE](LICENSE.md) file for details.

## Citation

If you use this software in academic work, please cite it like this until a proper publication has been written up:

```bibtex
@software{cifvis,
  author = {Paul Niklas Ruth},
  title = {CifVis: A JavaScript Library for Crystal Structure Visualisation},
  year = {2025},
  url = {https://github.com/niolon/cifvis}
}
```