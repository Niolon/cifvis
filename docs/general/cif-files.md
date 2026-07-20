# CIF files: Blocks, entries, Loops

`CIF` parses raw CIF text into `CifBlock` objects, each holding scalar key/value entries
plus `CifLoop` objects for every `loop_` table. Neither `CifBlock` nor `CifLoop` is
exported from the package — you only ever reach them as return values from a `CIF`
instance.

```js
import { CIF, CrystalStructure } from 'cifvis';

const cif = new CIF(cifText);          // splitSU=true by default: "1.234(5)" -> {value, su}
const block = cif.getBlock(0);          // or cif.getBlockByName('crystal_a')
const structure = CrystalStructure.fromCIF(block);
```

## CIF1 and CIF2

Both CIF1 and CIF2 files are supported. The format is detected automatically from the
`#\#CIF_2.0` magic code on the first line (a leading UTF-8 byte-order mark is tolerated);
anything else — including `#\#CIF_1.1` or no version comment — is parsed as CIF1.
`cif.version` reports the detected version (`1` or `2`). CIF1 files take the original
line-based parser unchanged, so there is no behaviour or performance change for them.

On the CIF2 path the extra value types map to native JavaScript values: a CIF2 *list*
(`[ 1 2 3 ]`) becomes an `Array`, a CIF2 *table* (`{ 'a':1 'b':2 }`) becomes a `Map`
(both can nest and can appear as loop cells), and triple-quoted strings (`'''…'''`)
become plain strings. Scalars, standard uncertainties and `loop_` tables behave exactly
as in CIF1, so `CrystalStructure.fromCIF` works unchanged.

::: info Not yet decoded
The optional CIF2 text-field line-folding and text-prefix protocols are not yet decoded —
such fields are returned verbatim.
:::

## `CIF`

| Method | Returns |
|---|---|
| `getBlock(index = 0)` | The `CifBlock` at `index`. |
| `getAllBlocks()` | `CifBlock[]` for every block in the file. |
| `getBlockNames()` | `string[]` of block names (the token after `data_`). |
| `getBlockByName(name)` | The `CifBlock` matching `name`. |

## `CifBlock`

`block.get(keys, defaultValue)` reads one entry. `keys` can be a single tag or an array of
alternatives — useful because CIF has both classic dictionary tags (`_cell_length_a`) and
CIF2/mmCIF-style dotted tags (`_cell.length_a`). It returns either a scalar value or, if
the tag names a `loop_`, a `CifLoop`.

```js
const a = block.get(['_cell.length_a', '_cell_length_a']);
const atomSite = block.get('_atom_site');   // a CifLoop
```

## `CifLoop`

| Method | Returns |
|---|---|
| `get(keys, defaultValue)` | A whole column as an array (same multi-key fallback as `CifBlock.get`). |
| `getIndex(keys, rowIndex, defaultValue)` | A single value at one row — the usual way to read "one atom". |
| `getHeaders()` | `string[]` of all column headers. |
| `getName()` | The loop's common tag prefix, e.g. `_atom_site`. |

```js
const labels = atomSite.get('_atom_site.label');           // whole column
const firstLabel = atomSite.getIndex('_atom_site.label', 0); // one row
```

## Standard uncertainties

Values with a standard uncertainty (e.g. `1.234(5)`) are split into the value and a
sibling key with an `_su` suffix (e.g. `_cell_length_a_su`), both on blocks and loop
columns. `formatValueEsd(value, su)` formats them back into the conventional `1.234(5)`
notation for display.

## Malformed files

An unterminated final semicolon-delimited text field is accepted as ending at EOF so
embedded SHELX HKL data can still be inspected, but the parser emits a console warning
with the opening line number. This is recovery from a malformed CIF, not silent
validation of it.

If a CIF file is malformed, `tryToFixCifBlock(block)` attempts common repairs
(reconciling atom labels, guessing missing symmetry operations) before you retry
`CrystalStructure.fromCIF`:

```js
import { tryToFixCifBlock } from 'cifvis';

let structure;
try {
    structure = CrystalStructure.fromCIF(block);
} catch (e) {
    structure = CrystalStructure.fromCIF(tryToFixCifBlock(block));
}
```

The viewer/widget equivalent is the [`fixCifErrors` option](../reference/rendering.md).

## Try it live

Fetches `cif/urea.cif`, parses it, and prints the block name plus the first three rows of
the `_atom_site` loop.

<ParseDemo />
