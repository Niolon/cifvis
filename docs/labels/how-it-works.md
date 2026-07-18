# How label placement works

This page explains the algorithms behind the `atomLabels` options in principle, so the
~40 tuning knobs in the [reference table](../reference/atom-labels.md) have context. You
rarely need to change any of them — but when a dense structure omits labels you wanted,
or a layout takes too long, this is the mental model to debug with.

## The problem

Labels live in **screen space**: 2D text boxes drawn over a 3D projection that changes
with every rotation and zoom. A good layout must
place each label close to its atom, avoid covering atoms, bonds, ADP rings, and other
labels, keep the viewport edges clear, and stay *stable* — labels should not jump around
between similar poses. Since a dense projection may simply have no room, every mode is
an *omission* mode at heart: a label with no acceptable position is dropped (and
reported via `getAtomLabelLayout()`) rather than drawn misleadingly.

## Candidate scoring

For each requested atom, the placer enumerates candidate positions around the projected
atom (near positions first, then farther fallback rings at `fallbackDistance` spacing).
Every candidate is scored: collisions with atoms, bonds, and existing labels are
rejected outright using the configured clearances (`atomPadding`, `bondPadding`,
`labelPadding`, `viewportPadding`), and soft penalties rank the survivors:

- `ringPenalty` — interference with ADP rings is strongly discouraged.
- `movementPenalty` — a candidate far from the label's previous position costs extra,
  which is what keeps layouts stable across interaction.
- `leaderBondCrossingPenalty` — a leader line that would cross a displayed bond costs
  extra.

If the winning candidate is farther than a comfortable distance, a **leader line** is
drawn from the text to the atom (`leaderLines: 'auto'`); `maxConnectorLength` caps how
far that may stretch before the label is omitted instead.

## Collision index

All occupied screen rectangles (atoms, bonds, placed labels) are kept in a uniform
spatial hash with `spatialCellSize`-pixel cells, so each candidate test only inspects
nearby occupants instead of the whole scene. This is what keeps quality placement
near-linear in the number of labels.

## Repair

Greedy placement can paint itself into a corner: an early label occupies the only good
spot of a later one. **Displacement repair** fixes this by backtracking — when a label
finds no valid candidate, the placer tries moving already-placed neighbours to their
alternative candidates to free space, up to `repairDepth` levels deep and at most
`repairSearchLimit` candidate evaluations. Setting either to 0 disables repair
(`performance-omit` never repairs).

## Quality vs. performance placement

Two strategies share this machinery:

- **Quality placement** (`quality-omit`) evaluates the full candidate set per label with
  repair. Best layouts, cost grows with density.
- **Performance placement** (`performance-omit`) walks atoms front-to-back and reuses
  **no-space tiles**: the screen is divided into `performanceNoSpaceCellSize`-pixel
  tiles, and when a front atom proves a tile has no room, deeper atoms in the same tile
  are omitted without their own search. Larger tiles reuse more of these negative
  results (faster) but may omit more deeper labels. Tiles are zoom-specific and rebuilt
  after camera changes. No repair is attempted.

The default **`auto-omit`** picks between them per layout: quality placement for
ordinary workloads, performance placement once more than
`autoPerformanceLabelThreshold` requested labels are visible in the current projection
(so zooming can switch the policy in either direction).

## Maximum coverage and callouts

`maximum-coverage` mode answers a different question: *label as many atoms as
possible*, accepting longer connectors — the mode for annotated figures. It searches
`maximumCoverageDistanceSteps` local radial distance bands around each atom (more bands
give repair additional moderate placements at added worker cost), and when local space
runs out it falls back to **callouts**: labels arranged in up to `calloutColumns` lanes
just outside the projected structure (`calloutPlacement: 'structure'`, clearance
`calloutGap`) or along the viewport edges (`'viewport'`), spaced by
`calloutColumnGap`/`calloutRowGap`, each connected to its atom by a leader line.
Callout search is bounded by `calloutSearchLimit` candidates examined and
`calloutChoiceLimit` retained per label.

## Workers, throttling, and indicators

The structure is always painted first; layout runs afterwards so it never delays the
first frame. With `useWorker: true` (default), collision placement runs in a Web Worker
and falls back to the main thread where workers are unsupported or fail.

During interaction, relayouts are throttled to `layoutThrottleMs`; layouts larger than
`interactionLabelLimit` labels are deferred until the interaction ends, and
`hideLabelsDuringDeferredLayout` clears the stale frame immediately so old labels never
ghost over the new pose. If an asynchronous layout takes longer than
`loadingIndicatorDelayMs`, an accessible status indicator appears
(`showLoadingIndicator`).

## Every knob

The complete generated table of `atomLabels.*` options, with defaults, is in
[Options Reference → Atom labels](../reference/atom-labels.md).
