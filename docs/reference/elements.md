# Element properties

The `elementProperties` option customizes the appearance of specific elements. It maps
element symbols to per-element properties; built-in defaults cover H–Cf with standard
CPK-style colours and covalent radii, and anything you pass is merged over them, so you
only specify what you want to change.

| Element property | Type | Description |
|---|---|---|
| `elementProperties.X.radius` | Number | Radius of element X in Å. Used for bond distance calculation and visualization. |
| `elementProperties.X.atomColor` | String | Color of element X. Can be any valid CSS color. |
| `elementProperties.X.ringColor` | String | Color of the anisotropic-displacement-parameter rings for element X. |

Example of customizing element properties:

```json
{
  "elementProperties": {
    "Fe": {
      "radius": 1.4,
      "atomColor": "#FF5733",
      "ringColor": "#ffffff"
    },
    "O": {
      "atomColor": "#0088ff",
      "radius": 0.7
    }
  }
}
```

A live recolouring example is in the
[Gallery → Custom theming](../gallery/custom-theming.md) entry.
