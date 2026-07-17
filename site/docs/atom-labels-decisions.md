# Atom labels: implementation decisions and compromises

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

Two placement policies are supported:

- `auto-omit` is the default. It uses short local leaders, rejects leaders which cross bonds, and omits a label rather than produce a confusing figure.
- `complete` searches twice as far from the atom and then uses ordered callout lanes at the left and right viewport edges. Its leader lines may cross bonds and other leaders. Label text still may not cover atoms, bonds, or other labels, so a physically overfull viewport can still report `viewport-capacity`; "complete" means completeness is preferred, not that an impossible packing is forced.

- Sixteen angular candidates are generated at each search distance: two distances in `auto-omit`, four in `complete`.
- The preferred direction points away from the projected bonded neighbours. Terminal atoms therefore label away from their bond; atoms in ordinary rings normally label outward.
- Isolated atoms and geometrically balanced atoms use a deterministic direction derived from their unique ID.
- Candidates outside the viewport, overlapping an atom, or overlapping an already placed label are rejected.
- Candidate rectangles intersecting a projected covalent- or hydrogen-bond corridor are rejected.
- Farther candidates receive an automatic leader line.
- In `auto-omit`, leader lines crossing bonds, atoms other than their anchor, placed labels, or other leader lines are rejected. `complete` relaxes bond and leader crossings but never lets a leader pass through an unrelated atom or label.
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

- The WebGL structure is rendered first. Label preparation is scheduled for the following animation frame so the browser can present the structure before label work begins.
- Three.js projection and canvas text measurement remain on the main thread. The DOM-free collision solver runs in a self-contained inline Web Worker by default. `useWorker: false` is an escape hatch, and worker creation/runtime failures fall back to the main thread.
- Only one worker request may be in flight. Camera changes are coalesced rather than queued, and results for obsolete transforms, viewports, structures, or options are discarded.
- Whenever the camera or molecule pose changes, the old label canvas is cleared immediately. This clean sweep deliberately shows a temporarily label-free rotating structure instead of leaving labels ghosted at their previous coordinates.
- `complete` layouts and layouts above `interactionLabelLimit` are deferred while dragging. The overlay is hidden by default and one fresh layout is requested when interaction ends. Smaller `auto-omit` layouts may update during interaction, bounded by `layoutThrottleMs`.
- Text widths are cached by font and string. Bond adjacency is cached per displayed structure. Atom, bond, ring, placed-label, and leader collision queries use a uniform screen-space spatial hash.
- Layout runs only on frames the viewer already renders in `onDemand` mode. Unchanged transform/projection state reuses the accepted layout.
- `maxVisible` bounds the number of attempted labels. Labels excluded by this limit are reported with reason `max-visible`.
- Label-only ring topology and bond-neighbour caches are built lazily after the first structure paint and only when labels are enabled. They are recalculated when the displayed structure changes; ring polygons are projected for each accepted pose.
- The overlay follows device-pixel ratio while layout remains in CSS pixels.

### Presentation-fixture stress check

A July 2026 headless-Chrome check used a 1200×900 viewport, `cutout-2d`, `show: "all"`, `auto-omit`, and three forced cold end-to-end label updates per structure. The figures include projection, worker messaging, placement, and drawing. They are development-machine observations, not stable CI thresholds:

| Presentation fixture | Displayed atoms | Post-modifier bonds | Placed / hidden | Median layout |
| --- | ---: | ---: | ---: | ---: |
| `capsaicin.cif` | 22 | 22 | 22 / 0 | 2.0 ms |
| `fullerene.cif` | 237 | 297 | 83 / 154 | 21.6 ms |
| `large_nobonds.cif` | 1,701 | 3,775 | 60 / 1,641 | 203.5 ms |
| `large_bonds.cif` | 1,701 | 3,787 | 60 / 1,641 | 178.6 ms |

`large_nobonds.cif` has thousands of post-modifier bonds because the normal missing-bond generator is part of the displayed-structure pipeline. Spatial indexing substantially reduces total computation, but a cold layout for 1,701 requested labels still takes much longer than a frame. The worker and interaction deferral therefore improve responsiveness and time-to-first-structure without pretending that the labels themselves are immediately available.

Run the persistent harness with `npm run bench:labels`; pass `-- --mode complete`, a CIF path/directory, or the documented sizing and iteration flags to change the workload. With no paths it discovers the four sibling `cifvis_presentation` fixtures above.

## Lifecycle decisions

- The label manager is owned and disposed by `CrystalViewer`.
- It receives the post-filter/post-growth `displayStructure`, so hydrogen, disorder, symmetry, and atom-removal modes affect labels consistently with atoms.
- A standalone viewer container whose computed position is `static` is temporarily changed to `position: relative`; its inline value is restored on disposal.
- Changing the widget's `atom-labels` attribute does not recreate the viewer or reload the CIF.
- Changing the general widget `options` attribute still follows the existing full-viewer recreation behavior.

## Known follow-up work

1. Add bounded local repair/backtracking so crowded layouts hide fewer labels.
2. Move projection off the main thread only if a compact camera/anchor representation proves faster than its serialization overhead; canvas text measurement must remain browser-dependent or use precomputed metrics.
3. Calculate exact projected ellipsoid footprints if the conservative circles prove too wasteful.
4. Sample perspective bond thickness at more than the midpoint if this approximation proves visible.
5. Add an export API which composites WebGL and labels.
6. Add an accessible visible-label summary to the widget.
7. Add browser screenshot regression fixtures at several rotations, sizes, cameras, and render styles.
8. Consider per-label preferred side or manually pinned offsets, with an explicit policy for conflicting pins.
