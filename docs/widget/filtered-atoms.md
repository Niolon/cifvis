# Filtered atoms

You can exclude specific atoms from the visualization using the `filtered-atoms`
attribute. This is particularly useful for removing solvent molecules or counter-ions to
focus on the main structure. Individual atoms are separated by a comma; a range
(inclusive) can be indicated by the `>` sign. The order used is determined by the
`atom_site` table:

<div class="cifvis-demo-grid">
  <div>
    <span class="cifvis-example-label">Complete structure with solvent:</span>
    <CifDemo src="/cif/fullerene.cif" caption="Complete structure including solvent molecules" />
  </div>
  <div>
    <span class="cifvis-example-label">Structure with solvent removed:</span>
    <CifDemo src="/cif/fullerene.cif" caption="Structure with solvent molecules removed" filtered-atoms="C200,H200,C201>H218" />
  </div>
</div>

```html
<cifview-widget
    src="structure.cif"
    caption="Structure with solvent removed"
    filtered-atoms="C200,H200,C201>H218">
</cifview-widget>
```

Under the hood this drives the `removeatoms` filter (`AtomLabelFilter`) — see
[Library → Filters](../library/filters.md) for using it programmatically.
