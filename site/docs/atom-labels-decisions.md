# Atom labels: prototype decisions and compromises

This document records the assumptions made while adding atom labels as a first-class CifVis feature. It describes the current implementation, not an idealized future design.

## Public behavior

- Labels are disabled by default. Existing figures therefore retain their appearance and do not pay the layout cost.
- `atomLabels.show` accepts `"none"`, `"all"`, `"non-hydrogen"`, or an array of atom selectors/label specifications.
- A plain selector such as `C1` matches every currently displayed symmetry copy. A qualified selector such as `C1|2_555` matches one copy.
- A request object has the form `{ id, text?, priority? }`. Higher-priority labels are placed first.
- `Atom.label` is never changed. Custom text is display state only, so selection, bonds, filters, CIF identity, and symmetry growth continue to use the original label.
- Unknown or currently hidden selectors are retained in configuration but produce no label. They can become visible after a structure modifier changes.
- Empty or `null` display text suppresses a label. Text is plain canvas text, is limited to 200 characters, and is not interpreted as HTML.
- The runtime API is `setAtomLabels()`, `updateAtomLabelOptions()`, `clearAtomLabels()`, and `getAtomLabelLayout()`.
- The widget supports the same configuration under `options.atomLabels` and the dynamic `atom-labels` attribute.

## Rendering choice

Labels are drawn on one transparent 2D canvas over the WebGL canvas.

This was chosen because it gives constant-size, horizontal, sharp text and makes collision checks operate in the same CSS-pixel coordinate system as the rendered result. One canvas also avoids a DOM element or WebGL texture per label. The canvas has `pointer-events: none`, so atom and bond selection continues to reach the WebGL canvas.

Compromises:

- Labels are not Three.js scene objects and are not depth-tested. A label for a rear atom remains visible if requested.
- Calling `viewer.renderer.domElement.toDataURL()` captures only WebGL. Browser screenshots capture both layers. A future package-level image export should composite the two canvases.
- Canvas text is not directly exposed to accessibility APIs. `getAtomLabelLayout()` exposes the visible text to host applications, but a proper accessible textual summary remains follow-up work.

## Atom avoidance

Every ORTEP atom now supplies a label anchor containing the atom data, local centre, and a conservative radius. This is generated for both instanced and individual atom renderers. The radius uses the largest transform scale, so anisotropic atoms are intentionally over-approximated by a circle in screen space.

This guarantees a safer clearance at the cost of sometimes placing a label farther away than an exact projected ellipsoid calculation would require. Selection markers are not currently added to the obstacle radius.

All displayed atom footprints are obstacles, not just atoms which themselves have labels. Labels that cannot avoid atoms and already placed labels are omitted.

## Placement strategy

- Sixteen angular candidates are generated close to each atom, followed by sixteen farther candidates.
- The preferred direction points away from the projected bonded neighbours. Terminal atoms therefore label away from their bond; atoms in ordinary rings normally label outward.
- Isolated atoms and geometrically balanced atoms use a deterministic direction derived from their unique ID.
- Candidates outside the viewport, overlapping an atom, or overlapping an already placed label are rejected.
- Candidate rectangles intersecting a projected covalent- or hydrogen-bond corridor are rejected.
- Farther candidates receive an automatic leader line.
- Leader lines crossing bonds, atoms other than their anchor, placed labels, or other leader lines are rejected.
- Explicit priority is considered first; equal-priority labels use atom ID ordering for deterministic output.
- Previous-frame direction is included in the score to reduce jumping while rotating.
- If no candidate is valid, the label is reported as hidden with reason `no-space`. The implementation does not violate the no-overlap rule to force every label onto the figure.

The current solver is deterministic greedy placement. It does not yet perform global backtracking or move an earlier label to make room for a later one. Consequently it can omit a label even when a different global arrangement exists. This is the principal prototype compromise and the clearest next algorithmic improvement.

Regular bonds are represented by their projected centre line plus the projected bond radius and `bondPadding`. Dashed hydrogen bonds are deliberately treated as continuous corridors: this can reject a usable gap between dashes, but prevents a label from visually sitting on the overall hydrogen-bond path. Bond thickness is sampled at the bond midpoint, so perspective views of unusually depth-aligned bonds remain an approximation.

## Ring handling

CIF bond rows used by CifVis do not contain reliable aromatic bond-order information. The implementation therefore does not claim to perceive aromaticity.

Instead it finds chordless five-, six-, and seven-member cycles in the post-modifier chemical bond graph. Projected cycle interiors larger than 25 square pixels receive a large soft placement penalty. This means:

- Typical aromatic rings are avoided.
- Saturated and non-aromatic small rings are treated the same way.
- A ring interior may be used when all preferable candidates clash, as requested.
- Nearly edge-on rings have negligible projected area and are ignored.
- Fused systems are handled as their chordless small cycles, but this is not a minimum-cycle-basis implementation.
- Ring discovery is capped at 512 cycles to bound work on pathological graphs.
- Structures without usable bond connectivity cannot receive ring-aware placement.

Planarity is not currently calculated. Applying the penalty only to the projected polygon makes the behavior useful for ordinary molecular rings but can classify a non-planar 5–7 member cycle as a ring obstacle.

## Interaction and performance

- Layout runs only on frames the viewer already renders in `onDemand` mode.
- Text measurement and full placement currently run again on each requested frame. Previous placement is used for stability but measurement and projection caches have not yet been added.
- Collision checks are linear scans, not a spatial index. This is appropriate for a prototype and moderate publication figures but is not intended for thousands of labels.
- `maxVisible` bounds the number of attempted labels. Labels excluded by this limit are reported with reason `max-visible`.
- Ring topology is recalculated only when the displayed structure changes; ring polygons are projected each frame.
- The overlay follows device-pixel ratio while layout remains in CSS pixels.

## Lifecycle decisions

- The label manager is owned and disposed by `CrystalViewer`.
- It receives the post-filter/post-growth `displayStructure`, so hydrogen, disorder, symmetry, and atom-removal modes affect labels consistently with atoms.
- A standalone viewer container whose computed position is `static` is temporarily changed to `position: relative`; its inline value is restored on disposal.
- Changing the widget's `atom-labels` attribute does not recreate the viewer or reload the CIF.
- Changing the general widget `options` attribute still follows the existing full-viewer recreation behavior.

## Known follow-up work

1. Add bounded local repair/backtracking so crowded layouts hide fewer labels.
2. Cache text metrics and add a screen-space spatial index.
3. Calculate exact projected ellipsoid footprints if the conservative circles prove too wasteful.
4. Sample perspective bond thickness at more than the midpoint if this approximation proves visible.
5. Add an export API which composites WebGL and labels.
6. Add an accessible visible-label summary to the widget.
7. Add browser screenshot regression fixtures at several rotations, sizes, cameras, and render styles.
8. Consider per-label preferred side or manually pinned offsets, with an explicit policy for conflicting pins.
