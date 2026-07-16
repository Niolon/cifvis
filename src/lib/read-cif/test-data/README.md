# read-cif test data

Original CIF fixtures authored for the cifvis test suite (MPL-2.0, same as the
rest of the project).

- `cif2_structure.cif` — a minimal, fictitious CIF2 crystal structure used to
  exercise the CIF2 parsing path end-to-end through `CrystalStructure.fromCIF`.

The CIF2 grammar tests (`tokenizer.test.js`, `cif2-values.test.js`,
`base.cif2.test.js`, `version.test.js`) use small inline CIF snippets rather
than files.
