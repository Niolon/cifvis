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
- `getAtomLabelLayout().placementPolicy` reports `quality-omit`, `performance-omit`, `complete`, or `none`, so applications and benchmarks can observe which branch adaptive `auto-omit` selected.
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

A requested label participates only while some part of its projected atom footprint intersects the viewport and its depth lies inside the camera clip range. Once zoom or pan moves the atom completely off-screen, both its label and connector disappear; an off-screen anchor is never allowed to pull a callout back into view. A partially clipped atom remains eligible to avoid visible popping at the boundary.

## Placement strategy

Four placement policies are supported:

- `auto-omit` is the adaptive default. It selects quality omission for up to `autoPerformanceLabelThreshold` currently visible requested labels and performance omission above that threshold. The default threshold is 500. It uses visible requests rather than total structure size, so zoom and clipping can change the selected policy.
- `quality-omit` forces the former exact omission policy. It uses short local leaders, bounded displacement repair, rejects confusing crossings, and omits a label rather than produce a confusing figure.
- `performance-omit` retains exact collision validation for every label it places and uses the same short candidates, but disables displacement repair and processes equal-priority labels front-to-back. When a front label proves that every candidate in a small screen tile is blocked by static geometry, deeper anchors in that tile are omitted without repeating the candidate search.
- `complete` searches farther from the atom and then uses ordered callout lanes. By default those lanes sit just outside the projected structure bounds, keeping the combined drawing compact; `calloutPlacement: "viewport"` retains full-width edge lanes. Its leader lines may cross bonds and other leaders. Label text still may not cover atoms, bonds, or other labels, so a physically overfull viewport can still report `viewport-capacity`; "complete" means completeness is preferred, not that an impossible packing is forced.

- Sixteen angular candidates are generated at each search distance: two distances in all omission policies, and six by default in `complete` (`completeDistanceSteps`). The additional moderate-distance positions give bounded repair somewhere useful to move earlier labels before perimeter callouts are considered.
- The preferred direction points away from the projected bonded neighbours. Terminal atoms therefore label away from their bond; atoms in ordinary rings normally label outward.
- Isolated atoms and geometrically balanced atoms use a deterministic direction derived from their unique ID.
- Candidates outside the viewport, overlapping an atom, or overlapping an already placed label are rejected.
- Candidate rectangles intersecting a projected covalent- or hydrogen-bond corridor are rejected.
- Farther candidates receive an automatic leader line.
- In all omission policies, leader lines crossing bonds, atoms other than their anchor, placed labels, or other leader lines are rejected. `complete` relaxes bond and leader crossings but never lets a leader pass through an unrelated atom or label.
- Explicit priority is considered first. Equal-priority labels use atom ID ordering in quality placement/`complete` and projected near-to-far depth followed by atom ID in performance placement.
- Except in performance placement, before omitting a label or assigning a distant callout, bounded local repair may move an earlier equal-priority label to its next-best candidate. Repair can follow a short displacement chain (`repairDepth`) and shares a strict candidate budget (`repairSearchLimit`). Higher-priority labels are never displaced by lower-priority labels.
- Complete-mode callouts optimize for the worst connector as well as total movement: equal-priority labels with the greatest unavoidable callout distance receive inner lanes first, and occupied nearby lanes can displace earlier callouts through the same repair chain. This intentionally prefers several modest connector increases over one extreme line.
- `maxConnectorLength` provides a hard CSS-pixel ceiling when compactness matters more than completeness. Candidates beyond it are rejected before repair, so a label is omitted rather than silently creating an extreme connector.
- Previous-frame direction is included in the score to reduce jumping while rotating.
- If no candidate is valid, the label is reported as hidden with reason `no-space` in omission modes or `viewport-capacity` in `complete`. A deeper performance-placement label rejected by a previously proven tile reports `static-no-space`. The implementation does not violate the no-overlap rule to force every label onto the figure.

The solver remains deterministic and mostly greedy, with bounded local repair rather than exhaustive global optimization. Repair only follows one blocker at each level and stops at its configured depth/budget. It can therefore still omit a label, or retain a longer connector, when improvement would require moving several mutually blocking labels at once. This bound is deliberate: global label placement is combinatorial and must not monopolize the worker on large structures.

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
- Slow layouts show an accessible `Laying out labels…` status after `loadingIndicatorDelayMs`; the delay prevents a flash for ordinary fast layouts. The indicator is cancelled while interaction defers layout, when no requested atoms are visible, and when the accepted layout arrives. It can be disabled with `showLoadingIndicator: false`.
- Three.js projection and canvas text measurement remain on the main thread. The DOM-free collision solver runs in a self-contained inline Web Worker by default. `useWorker: false` is an escape hatch, and worker creation/runtime failures fall back to the main thread.
- Only one worker request may be in flight. Camera changes are coalesced rather than queued, and results for obsolete transforms, viewports, structures, or options are discarded.
- Whenever the camera or molecule pose changes, the old label canvas is cleared immediately. This clean sweep deliberately shows a temporarily label-free rotating structure instead of leaving labels ghosted at their previous coordinates.
- `complete` layouts and layouts above `interactionLabelLimit` are deferred while dragging. The overlay is hidden by default and one fresh layout is requested when interaction ends. Smaller omission-mode layouts may update during interaction, bounded by `layoutThrottleMs`.
- Text widths are cached by font and string. Bond adjacency is cached per displayed structure. Atom, bond, ring, placed-label, and leader collision queries use a uniform screen-space spatial hash.
- Layout runs only on frames the viewer already renders in `onDemand` mode. Unchanged transform/projection state reuses the accepted layout.
- `maxVisible` bounds the number of attempted labels. Labels excluded by this limit are reported with reason `max-visible`.
- Label-only ring topology and bond-neighbour caches are built lazily after the first structure paint and only when labels are enabled. They are recalculated when the displayed structure changes; ring polygons are projected for each accepted pose.
- The overlay follows device-pixel ratio while layout remains in CSS pixels.

The performance no-space map exists only inside one worker layout. Its default 24 CSS-pixel tiles are therefore rebuilt for every accepted zoom, rotation, pan, viewport, or structure state; obsolete worker results are rejected through the normal transform checks. A tile is recorded only when the first/front label has no candidate which clears the viewport and static atom/bond geometry. Failure caused only by an already placed label or leader does not poison the tile. This remains a deliberate heuristic: another label in the same tile can have different text width, radius, or exact anchor position and might have found a narrow opening. `performanceNoSpaceCellSize` controls the trade-off; smaller values approach ordinary exact omission, while larger values save more work and may suppress more viable rear labels.

### Presentation-fixture stress check

A July 2026 headless-Chrome check used a 1200×900 viewport, `cutout-2d`, `show: "all"`, `auto-omit`, and six forced cold end-to-end label updates per structure. The figures include projection, worker messaging, placement, and drawing. They are development-machine observations, not stable CI thresholds:

| Presentation fixture | Displayed atoms | Post-modifier bonds | Placed / hidden | Median layout |
| --- | ---: | ---: | ---: | ---: |
| `capsaicin.cif` | 22 | 22 | 22 / 0 | 4.3 ms |
| `fullerene.cif` | 237 | 297 | 86 / 151 | 37.9 ms |
| `large_nobonds.cif` | 1,701 | 3,775 | 63 / 1,638 | 292.9 ms |
| `large_bonds.cif` | 1,701 | 3,787 | 63 / 1,638 | 298.1 ms |

`large_nobonds.cif` has thousands of post-modifier bonds because the normal missing-bond generator is part of the displayed-structure pipeline. Spatial indexing substantially reduces total computation, but bounded repair adds work for every unresolved label and a cold layout for 1,701 requested labels still takes much longer than a frame. The worker and interaction deferral therefore improve responsiveness and time-to-first-structure without pretending that the labels themselves are immediately available.

For the same `large_bonds.cif` view, a three-run complete-mode comparison produced:

| Complete policy | Placed / hidden | Callouts | Maximum connector | Median layout |
| --- | ---: | ---: | ---: | ---: |
| Compact structure lanes, uncapped | 89 / 1,612 | 7 | 455.8 px | 1,582.9 ms |
| Compact structure lanes, 250 px cap | 84 / 1,617 | 2 | 248.7 px | 1,035.0 ms |
| Viewport lanes, uncapped | 92 / 1,609 | 10 | 490.8 px | 1,882.9 ms |

The 250 px compact policy is the practical all-label preset from this fixture: relative to uncapped compact mode it gives up five labels, reduces the worst connector by 45%, and reduces median solve time by 35%. This is still an explicit compactness trade-off rather than a universal threshold; applications can choose the connector ceiling appropriate for their figure.

### Adaptive omission and forced performance mode

The recommended user-facing preset is simply:

```js
atomLabels: {
    show: 'non-hydrogen',
    placementMode: 'auto-omit',
    useWorker: true,
    interactionLabelLimit: 0,
    hideLabelsDuringDeferredLayout: true,
    maxVisible: Infinity,
}
```

`show: "non-hydrogen"` avoids unexpectedly expanding the workload if the viewer later enables displayed hydrogens; it is equivalent to `"all"` while the viewer's default `hydrogenMode: "none"` remains active. `interactionLabelLimit: 0` means every non-empty label layout is deferred during dragging. It does not make a stationary layout faster, but preserves rotation responsiveness. The worker, clean-sweep overlay, and delayed loading indicator retain the first-structure and interaction behavior described above.

With the default threshold, `auto-omit` uses quality placement for capsaicin, fullerene, and all four concrete percentile fixtures below; it selects performance placement for each 1,701-atom network. Applications can force `quality-omit` when maximum stable label recovery matters, or `performance-omit` when predictable dense-view latency matters more than a few additional labels.

Performance placement retains both short search distances, atom/bond/label/leader avoidance, ring preference, and deterministic placement. Its compromises are front-surface preference, no displacement repair, and the 2D tile heuristic above. In the fitted 1200×900 presentation view it placed all 22 capsaicin labels, 75 fullerene labels, and 59 labels on each 1,701-atom network. Forced `quality-omit` placed 22, 86, and 63 respectively. The measured performance medians were 3.1 ms, 20.0 ms, and approximately 104–106 ms; the corresponding dense quality check was approximately 241–245 ms. On each dense network, 983 rear labels were rejected through proven static no-space tiles rather than full candidate searches.

The map responds to zoom rather than sticking to the structure. On `large_bonds.cif`, zooming out to 0.6× increased tile rejections from 983 to 1,371 and placed 36 labels in 105.4 ms. Zooming in to 1.5× moved part of the structure outside the viewport and rebuilt the performance map. At 4× zoom only 425 requested atoms remained visible, so adaptive `auto-omit` switched back to `quality-omit` and reported that choice through `placementPolicy`. These are behavior checks, not stable performance thresholds.

The same July 2026 run included the concrete CifVis p50/p90/p95/p99 structures recorded in `analysis/percentile-files.json`. Their load-time ranks come from the earlier clean serial load benchmark; the label figures below are eight forced layouts in the current 1200×900 label harness, so the two timings are contextual rather than directly additive:

| Historical load rank | Displayed atoms | Recorded load | Quality omit | Performance omit | Performance placed / hidden |
| --- | ---: | ---: | ---: | ---: | ---: |
| p50 | 34 | 53.1 ms | 4.1 ms | 4.8 ms | 30 / 4 |
| p90 | 183 | 119.6 ms | 24.3 ms | 23.1 ms | 92 / 91 |
| p95 | 135 | 151.3 ms | 17.1 ms | 16.4 ms | 98 / 37 |
| p99 | 374 | 194.1 ms | 48.9 ms | 40.3 ms | 83 / 291 |

The larger publication-scale load study in `analysis/overnight-summary.txt` is the better population reference: over 9,000 real COD structures, disk load was 44.5 ms at p50, 56.9 ms at p90, 64.1 ms at p95, 89.3 ms at p99, and 131.3 ms at p99.9. It did not record corresponding label layouts, so no structure-by-structure combined percentile should be inferred from those aggregate values. The concrete percentile fixtures nevertheless show forced performance label work at or below 40.3 ms through the selected p99 example; the 1,701-atom presentation structures remain intentionally harsher label-density cases than those four load-time picks.

`maxVisible` was also tested as a hard-budget control with repair disabled. On `large_bonds.cif`, caps of 128, 256, and 512 produced medians of 48.9, 61.4, and 98.0 ms, but placed only 9, 30, and 37 labels respectively, versus 60 at 179.9 ms without a cap. Equal-priority requests are deterministically ordered by atom ID, so a blind prefix can be spatially clustered. For that reason `maxVisible` is not part of the recommended general preset. It remains useful when the application supplies an explicitly prioritized label list, or when a strict upper bound matters more than even spatial coverage. A future spatially stratified cap would be needed before a finite limit could serve as a good automatic default.

Run the persistent harness with `npm run bench:labels`; pass `-- --mode quality-omit`, `--mode performance-omit`, `--mode complete`, `--auto-threshold`, `--performance-cell`, `--zoom`, `--callouts viewport`, `--show non-hydrogen`, `--max-visible`, `--repair-depth`, `--repair-limit`, a CIF path/directory, or the documented sizing and iteration flags to change the workload. It reports static no-space rejection count, callout count, and maximum connector length as well as timing. With no paths it discovers the four sibling `cifvis_presentation` fixtures above.

## Lifecycle decisions

- The label manager is owned and disposed by `CrystalViewer`.
- It receives the post-filter/post-growth `displayStructure`, so hydrogen, disorder, symmetry, and atom-removal modes affect labels consistently with atoms.
- A standalone viewer container whose computed position is `static` is temporarily changed to `position: relative`; its inline value is restored on disposal.
- Changing the widget's `atom-labels` attribute does not recreate the viewer or reload the CIF.
- Changing the general widget `options` attribute still follows the existing full-viewer recreation behavior.

## Known follow-up work

1. Evaluate a time-bounded global refinement pass if bounded displacement still leaves visible connector outliers in publication-sized figures.
2. Move projection off the main thread only if a compact camera/anchor representation proves faster than its serialization overhead; canvas text measurement must remain browser-dependent or use precomputed metrics.
3. Calculate exact projected ellipsoid footprints if the conservative circles prove too wasteful.
4. Sample perspective bond thickness at more than the midpoint if this approximation proves visible.
5. Add an export API which composites WebGL and labels.
6. Add an accessible visible-label summary to the widget.
7. Add browser screenshot regression fixtures at several rotations, sizes, cameras, and render styles.
8. Consider per-label preferred side or manually pinned offsets, with an explicit policy for conflicting pins.
