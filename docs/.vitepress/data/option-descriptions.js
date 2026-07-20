/**
 * Hand-written descriptions for the generated options reference.
 *
 * The option paths, types, and defaults in options-data.json are generated
 * from the source defaults by scripts/gen-options-reference.mjs; this file
 * carries the prose. A CI test (scripts/gen-options-reference.test.js)
 * fails when a generated option path has no description here, so new
 * options cannot ship undocumented.
 *
 * Values may be a plain HTML string, or an object with a `description`
 * plus optional `type` override for cases the type inference cannot know.
 */

export const descriptions = {
    // Camera
    'camera.type': 'Camera projection type: <code>orthographic</code> (parallel projection, the ' +
        'crystallographic convention) or <code>perspective</code> (uses <code>camera.fov</code>).',
    'camera.minDistance': 'Minimum camera distance when zooming.',
    'camera.maxDistance': 'Maximum camera distance when zooming.',
    'camera.wheelZoomSpeed': 'Speed of zooming when using the mouse wheel.',
    'camera.pinchZoomSpeed': 'Speed of zooming when using pinch gestures on touch devices.',
    'camera.initialPosition': 'Initial camera position as [x, y, z] coordinates.',
    'camera.fov': 'Field of view in degrees.',
    'camera.near': 'Near clipping plane distance.',
    'camera.far': 'Far clipping plane distance.',

    // Selection
    'selection.mode': 'Selection mode, either <code>single</code> or <code>multiple</code>.',
    'selection.markerMult': 'Size multiplier for atom selection markers.',
    'selection.bondMarkerMult': 'Size multiplier for bond selection markers.',
    'selection.highlightEmissive': {
        type: 'Number (hex)',
        description: 'Emissive color value for highlighted selections.',
    },
    'selection.markerColors': {
        description: 'Array of colors (hex values) used for selection markers; ' +
            'a cycle of 10 different colors by default.',
    },

    // Interaction
    'interaction.rotationSpeed': 'Speed of rotation when dragging.',
    'interaction.clickThreshold': 'Maximum time in milliseconds for an interaction to be considered a click.',
    'interaction.mouseRaycast.lineThreshold': 'Threshold for line selection with the mouse.',
    'interaction.mouseRaycast.pointsThreshold': 'Threshold for point selection with the mouse.',
    'interaction.mouseRaycast.meshThreshold': 'Threshold for mesh selection with the mouse.',
    'interaction.touchRaycast.lineThreshold': 'Threshold for line selection with touch.',
    'interaction.touchRaycast.pointsThreshold': 'Threshold for point selection with touch.',
    'interaction.touchRaycast.meshThreshold': 'Threshold for mesh selection with touch.',

    // Rendering
    'renderMode': 'Rendering mode, either <code>constant</code> (render continuously) or ' +
        '<code>onDemand</code> (render only when needed; call <code>viewer.requestRender()</code> ' +
        'after external state changes).',
    'renderStyle': 'Rendering style: <code>solid-3d</code> (interactive, full ellipsoids), ' +
        '<code>cutout-3d</code> (interactive, camera-facing cutaway octant), or ' +
        '<code>cutout-2d</code> (publication-style, always cutaway). See ' +
        '<a href="./rendering.html#render-styles">render styles</a>.',
    'plot2DBackground': 'Canvas background colour for the 2D rendering style.',
    'plot2DAtomColor': 'Opaque atom and open-bond fill colour in the 2D rendering style.',
    'plot2DLineColor': 'Fallback line and hydrogen-bond colour in the 2D rendering style.',
    'plot2DBondColor': 'Solid bond and open-bond outline colour in the 2D rendering style.',
    'plot2DBondOutlineColor': 'Colour of the depth-writing silhouette around 2D bonds, used to ' +
        'separate crossing bonds and ADPs. It is inset at connected atoms to keep their ' +
        'silhouettes clean.',
    'plot2DBondOutlineWidth': 'Constant screen-space width, in CSS pixels, of the depth-writing bond ' +
        'silhouette. Added around every bond regardless of its thickness or the zoom; ' +
        '<code>0</code> disables it.',
    'plot2DColorLuminanceCeiling': 'Maximum relative luminance for element-coloured outlines and ' +
        'hatching in <code>cutout-2d</code>. The entire palette is scaled together so hue and ' +
        'relative brightness are preserved.',
    'plot2DColorLuminanceFloor': {
        type: 'Number|null',
        description: 'When set (0&ndash;1), replaces the ceiling: the element palette is mixed ' +
            'towards white so its darkest colour reaches this relative luminance &mdash; for ' +
            'dark <code>plot2DBackground</code> values. See the ' +
            '<a href="../widget/styling.html#default-dark-theme">default dark theme</a>.',
    },
    'plot2DOpenBondInnerScale': 'Opaque inner width of open PART 2 bonds relative to a solid bond.',
    'plot2DStripeCount': 'Number of hatch repeats across each 2D section face.',
    'plot2DStripeWidth': 'Element-coloured line width as a fraction of each repeat.',
    'plot2DOutlineWidth': 'Constant screen-space width, in CSS pixels, of the atom silhouette ' +
        'outline. Uniform across every atom regardless of ellipsoid size or zoom.',
    'sealCutoutCavity': 'For the cutout render styles, fills the removed octant in the depth buffer ' +
        'so neighbouring atoms or bonds inside the carved cavity are occluded rather than showing ' +
        'through, while the exposed cross-section stays visible. Set false to keep the cavity ' +
        'see-through.',
    'fixCifErrors': 'Whether to attempt to fix common errors in CIF files before building the structure.',

    // Initial display modes
    'hydrogenMode': '<code>none</code>, <code>constant</code>, or <code>anisotropic</code>.',
    'disorderMode': '<code>all</code> or a structure-dependent ' +
        '<code>group&lt;rank&gt;of&lt;total&gt;</code> value.',
    'symmetryMode': '<code>none</code>, <code>hbonds</code>, <code>fragment</code>, ' +
        '<code>fragment-hbonds</code>, <code>cell</code>, or <code>fragment-cell</code>.',
    'packingCutoff': '<code>1</code> (default) shows the canonical, Z-correct unit cell. A value ' +
        'above <code>1</code> (e.g. <code>1.001</code>) additionally duplicates atoms sitting ' +
        'within that margin of a low cell face onto the matching high face(s), for a "closed" ' +
        'packing diagram with atoms on every face, edge and corner. The duplicates are unbonded.',

    // Atom labels
    'atomLabels.show': {
        type: 'String or Array',
        description: '<code>none</code>, <code>all</code>, <code>non-hydrogen</code>, or an array ' +
            'of atom selectors/specifications.',
    },
    'atomLabels.placementMode': '<code>auto-omit</code> adaptively uses quality placement for ' +
        'ordinary visible workloads and performance placement for dense ones; ' +
        '<code>quality-omit</code> forces exact candidate evaluation with repair; ' +
        '<code>performance-omit</code> forces front-to-back, zoom-specific no-space reuse without ' +
        'repair; <code>maximum-coverage</code> searches farther and adds callouts. Omission modes ' +
        'reject confusing crossings.',
    'atomLabels.text': 'Optional display-text overrides keyed by base label or symmetry-qualified atom ID.',
    'atomLabels.fontSize': 'Canvas text font size in CSS pixels.',
    'atomLabels.fontWeight': 'Canvas text font weight.',
    'atomLabels.fontFamily': 'Canvas text font family.',
    'atomLabels.colorMode': '<code>uniform</code> uses <code>atomLabels.color</code>; ' +
        '<code>atom</code> uses each atom&#39;s element colour.',
    'atomLabels.color': 'Label text colour in uniform colour mode.',
    'atomLabels.atomColorLuminanceCeiling': 'In <code>atom</code> colour mode, the element palette ' +
        'is scaled so its brightest colour reaches this relative-luminance ceiling without ' +
        'clustering colours there.',
    'atomLabels.atomColorLuminanceFloor': {
        type: 'Number|null',
        description: 'When set (0&ndash;1), replaces the ceiling: in <code>atom</code> colour ' +
            'mode the palette is mixed towards white so its darkest element colour reaches this ' +
            'relative luminance &mdash; keeps labels readable on dark backgrounds. See the ' +
            '<a href="../widget/styling.html#default-dark-theme">default dark theme</a>.',
    },
    'atomLabels.haloColor': 'Contrast halo colour behind label text.',
    'atomLabels.haloWidth': 'Contrast halo width in CSS pixels.',
    'atomLabels.leaderLines': 'Controls when leader lines from a label to its atom are drawn.',
    'atomLabels.leaderColor': 'Leader-line colour.',
    'atomLabels.leaderWidth': 'Leader-line width in CSS pixels.',
    'atomLabels.atomPadding': 'Collision clearance around atoms in CSS pixels.',
    'atomLabels.bondPadding': 'Collision clearance around bonds in CSS pixels.',
    'atomLabels.labelPadding': 'Collision clearance between labels in CSS pixels.',
    'atomLabels.viewportPadding': 'Collision clearance to the viewport edges in CSS pixels.',
    'atomLabels.fallbackDistance': 'Farther fallback spacing when close placements are unavailable, in CSS pixels.',
    'atomLabels.maxConnectorLength': 'Hard connector-length ceiling in CSS pixels. Labels which ' +
        'cannot fit within the ceiling are omitted rather than drawn with extreme connectors.',
    'atomLabels.ringPenalty': 'Candidate scoring penalty for interference with ADP rings.',
    'atomLabels.movementPenalty': 'Candidate scoring penalty for movement between successive layouts.',
    'atomLabels.repairDepth': 'Maximum depth of displacement repair before a label is omitted or ' +
        'given a distant callout. Set to 0 to disable repair.',
    'atomLabels.repairSearchLimit': 'Maximum candidate evaluations during displacement repair. ' +
        'Set to 0 to disable repair.',
    'atomLabels.autoPerformanceLabelThreshold': 'Visible requested-label count above which ' +
        '<code>auto-omit</code> selects performance placement. Because this uses the current ' +
        'projection, zooming may switch policy.',
    'atomLabels.performanceNoSpaceCellSize': 'Screen-space tile size used by performance placement. ' +
        'Larger tiles reuse more front-atom no-space results but may omit more deeper labels. ' +
        'Tiles are rebuilt after zoom or other camera changes.',
    'atomLabels.spatialCellSize': 'Uniform screen-space collision-index cell size in CSS pixels.',
    'atomLabels.useWorker': 'Runs collision placement in a Web Worker after the structure&#39;s ' +
        'first paint. Unsupported or failed workers fall back to the main thread.',
    'atomLabels.showLoadingIndicator': 'Shows an accessible progress status when asynchronous ' +
        'layout exceeds the configured delay.',
    'atomLabels.loadingIndicatorDelayMs': 'Delay in milliseconds before the loading indicator appears.',
    'atomLabels.layoutThrottleMs': 'Minimum time between relayouts during interaction, in milliseconds.',
    'atomLabels.interactionLabelLimit': 'Label count above which relayout is deferred until ' +
        'interaction ends.',
    'atomLabels.hideLabelsDuringDeferredLayout': 'Hides stale labels while a deferred layout is ' +
        'recomputed after dragging, avoiding after-images.',
    'atomLabels.calloutPlacement': '<code>structure</code> keeps maximum-coverage callouts just ' +
        'outside the projected structure; <code>viewport</code> uses the full viewport edges.',
    'atomLabels.calloutGap': 'Compact structure clearance for callouts in CSS pixels.',
    'atomLabels.maximumCoverageDistanceSteps': 'Number of local radial distance bands searched in ' +
        '<code>maximum-coverage</code> mode before callouts. More bands give repair additional ' +
        'moderate placements at added worker cost.',
    'atomLabels.calloutColumns': 'Callout lane count used by <code>maximum-coverage</code> placement.',
    'atomLabels.calloutColumnGap': 'Horizontal spacing between callout lanes in CSS pixels.',
    'atomLabels.calloutRowGap': 'Vertical spacing between callout rows in CSS pixels.',
    'atomLabels.calloutSearchLimit': 'Maximum callout candidates examined per label.',
    'atomLabels.calloutChoiceLimit': 'Maximum callout candidates retained per label.',
    'atomLabels.leaderBondCrossingPenalty': 'Candidate-score penalty for a leader line crossing a ' +
        'displayed bond.',
    'atomLabels.maxVisible': 'Maximum labels attempted; excess labels are reported as hidden.',

    // Atom visualization
    'atomDetail': 'Level of detail for atom geometry (1&ndash;5).',
    'atomCutawayHysteresis': 'Direction threshold that prevents cutaway octants flickering near an axis.',
    'atomCutawayStripeCount': 'Number of hatch repeats across each cutaway disc.',
    'atomCutawayStripeWidth': 'Atom-colour stripe width as a fraction of each repeat.',
    'atomColorRoughness': 'Roughness of atom material (0&ndash;1).',
    'atomColorMetalness': 'Metalness of atom material (0&ndash;1).',
    'atomADPRingWidthFactor': 'Width factor for ADP (anisotropic displacement parameter) rings.',
    'atomADPRingHeight': 'Height of ADP rings.',
    'atomADPRingSections': 'Number of sections in ADP rings.',
    'atomADPInnerSections': 'Number of inner sections in ADP rings.',
    'atomConstantRadiusMultiplier': 'Multiplier for atom radius when using constant mode.',

    // Density: differenceDensity
    'differenceDensity.autoLoad': 'After installing the structure, automatically start density work ' +
        'from the loaded CIF.',
    'differenceDensity.inputMode': '<code>auto</code>, <code>fcf</code>, or <code>cif-iam</code>. ' +
        'Auto prefers explicit Fourier coefficients and otherwise uses observed intensities plus ' +
        'IAM phases.',
    'differenceDensity.reflections': 'Reflection-reader configuration; see the rows below.',
    'differenceDensity.iam': 'Independent-atom structure-factor configuration; see the rows below.',
    'differenceDensity.intensityScale': {
        type: 'Number|null',
        description: 'Explicit observed-to-IAM intensity scale; null fits a positive scale from ' +
            'the reflections.',
    },
    'differenceDensity.extinctionCorrection': {
        type: 'String|Boolean|Number|Object',
        description: 'Corrects observed amplitudes for a reported SHELXL isotropic EXTI model. ' +
            'Accepts <code>auto</code>, true/false, a coefficient, or a configuration object.',
    },
    'differenceDensity.coefficientColumns': {
        type: 'Object|null',
        description: 'Custom loop/index columns and either amplitude/phase or direct A/B columns. ' +
            'Any custom definition is displayed as deformation density.',
    },
    'differenceDensity.anomalousDispersion': {
        type: 'Boolean|Object',
        description: 'Optional anomalous-contribution correction and phase/Friedel detection.',
    },
    'differenceDensity.reciprocalResolution': 'Fraction of the available reciprocal resolution ' +
        'included in the Fourier map, in (0, 1].',
    'differenceDensity.initialGridOversampling': 'FFT-grid oversampling used for the first ' +
        'progressive display.',
    'differenceDensity.gridOversampling': 'Final real-space FFT-grid oversampling factor.',

    // Density: scalarField
    'scalarField.useWorker': 'Parse and calculate scalar fields in a Web Worker when available. ' +
        'Applies to reflection and Cube sources; in planar-line mode the worker also performs ' +
        'plane sampling and Marching Squares before transferring packed endpoints.',

    // Density: isosurface
    'isosurface.useSymmetry': 'Reuses meshes for exactly symmetry-equivalent disconnected regions; ' +
        'intersecting masks remain one field to avoid seams.',
    'isosurface.progressiveSteps': 'Ordered surface-resolution fractions emitted after the map is ' +
        'available; 1 is always included.',
    'isosurface.visible': 'Initial density-surface visibility. Changing only this option toggles ' +
        'the retained meshes without recalculation.',
    'isosurface.sigmaLevel': 'Positive and negative contour magnitude in map standard deviations.',
    'isosurface.radius': 'Cartesian clipping radius around displayed atoms, in &Aring;.',
    'isosurface.resolution': 'Minimum marching-cubes resolution.',
    'isosurface.gridSpacing': 'Target Cartesian surface-grid spacing in &Aring; used to increase ' +
        'resolution for larger displayed regions.',
    'isosurface.maxResolution': 'Upper bound for draw-size-dependent marching-cubes resolution.',
    'isosurface.stitchTolerance': 'Cartesian tolerance used while welding reused surface patches.',
    'isosurface.positiveColor': 'Positive standard difference-density colour.',
    'isosurface.negativeColor': 'Negative standard difference-density colour.',
    'isosurface.deformationPositiveColor': 'Positive custom/deformation-density colour.',
    'isosurface.deformationNegativeColor': 'Negative custom/deformation-density colour.',
    'isosurface.opacity': 'Surface opacity.',
    'isosurface.wireframe': 'Draws density surfaces as wireframes.',
    'isosurface.maxPolyCount': 'Maximum marching-cubes polygon allocation per generated field.',

    // Density: contourLines
    'contourLines.enabled': 'Replaces the 3D isosurface with line-only contours on a plane. It ' +
        'creates no plane fill/background, preserving the viewer or widget background.',
    'contourLines.plane': 'Plane definition. Use <code>{mode: "best-fit"}</code>, ' +
        '<code>{atoms: ["C1","C2","O1"]}</code>, the string <code>"best-fit"</code>, an atom-label ' +
        'array, or an explicit <code>coordinateSystem</code>/<code>origin</code>/<code>normal</code> ' +
        'definition (see below). Explicit atom lists require three non-collinear atoms; best-fit ' +
        'mode uses a stable crystallographic fallback for one- or two-atom structures.',
    'contourLines.padding': 'Automatic in-plane padding around all displayed atoms, in &Aring;.',
    'contourLines.maxAtomDistance': {
        type: 'Number|null',
        description: 'Discards samples farther than this distance from any displayed atom, in ' +
            '&Aring;, keeping the drawn contours from spanning empty space. Null or a negative ' +
            'value keeps the unclipped padded rectangle.',
    },
    'contourLines.resolution': 'Minimum samples per in-plane axis.',
    'contourLines.gridSpacing': 'Target Cartesian sample spacing in &Aring;.',
    'contourLines.maxResolution': 'Per-axis sample cap.',
    'contourLines.interpolation': '<code>tricubic</code> uses smooth slope-limited monotone ' +
        'sampling of the retained scalar grid without introducing local overshoot; ' +
        '<code>linear</code> uses its original trilinear sampler.',
    'contourLines.contourCount': 'Number of regularly spaced contour lines.',
    'contourLines.contourStep': {
        type: 'Number|null',
        description: 'Optional absolute contour step; takes precedence over ' +
            '<code>contourCount</code>.',
    },
    'contourLines.levelSubdivisions': 'Line intervals fitted within the ordinary field/isosurface ' +
        'level. A 3&sigma; field level starts at 0.75&sigma; by default.',
    'contourLines.levels': {
        type: 'Number[]|null',
        description: 'Explicit positive contour magnitudes; takes precedence over count and step.',
    },
    'contourLines.sign': {
        type: 'String|null',
        description: '<code>positive</code>, <code>negative</code>, or <code>both</code>; null ' +
            'follows the scalar-field source metadata.',
    },
    'contourLines.zeroLine': 'Draws an optional zero contour.',
    'contourLines.zeroColor': 'Colour of the zero contour.',
    'contourLines.lineColor': {
        type: 'Color|null',
        description: 'Overrides both signed line colours. Null inherits the standard/deformation ' +
            'positive and negative colours from <code>isosurface</code>.',
    },
    'contourLines.lineWidth': 'Screen-space line width in pixels.',
    'contourLines.haloColor': 'Colour of the outline drawn behind each contour line for ' +
        'legibility over the structure.',
    'contourLines.haloWidth': 'Additional screen-space width in pixels on each side of a contour ' +
        'line for its halo outline. Zero or a negative value disables the halo.',
    'contourLines.opacity': 'Contour line opacity.',
    'contourLines.depthOffset': 'Offset along the plane normal in &Aring; to reduce overlap artefacts.',

    // Bonds
    'bondGrowTolerance': 'Additive tolerance in &Aring;ngstr&ouml;ms added to the sum of covalent ' +
        'radii for bond generation (capped at 0.40 &Aring; for s-block element pairs, even if set ' +
        'higher).',
    'bondRadius': 'Radius of bond cylinders.',
    'bondSections': 'Number of sections in bond cylinders.',
    'bondColorMode': '<code>uniform</code> uses <code>bondColor</code>; <code>split</code> colors ' +
        'each 3D bond half like its connected atom. The split mode remains one instanced draw call.',
    'bondColor': 'Default color for bonds.',
    'bondColorRoughness': 'Roughness of bond material (0&ndash;1).',
    'bondColorMetalness': 'Metalness of bond material (0&ndash;1).',

    // Hydrogen bonds
    'hbondRadius': 'Radius of hydrogen bond cylinders.',
    'hbondColor': 'Default color for hydrogen bonds.',
    'hbondColorRoughness': 'Roughness of hydrogen bond material (0&ndash;1).',
    'hbondColorMetalness': 'Metalness of hydrogen bond material (0&ndash;1).',
    'hbondDashSegmentLength': 'Target length for each dash+gap segment.',
    'hbondDashFraction': 'Fraction of each segment that is solid (vs gap).',

    // Unit cell
    'cell.boxColor': 'Unit-cell edge colour.',
    'cell.boxOpacity': 'Unit-cell edge opacity.',
    'cell.boxLineWidth': 'Unit-cell edge line width.',
    'cell.arrowColorA': 'Colour of the <em>a</em> axis arrow.',
    'cell.arrowColorB': 'Colour of the <em>b</em> axis arrow.',
    'cell.arrowColorC': 'Colour of the <em>c</em> axis arrow.',
    'cell.arrowHeadLengthMult': 'Arrow-head length multiplier.',
    'cell.arrowHeadWidthMult': 'Arrow-head width multiplier.',
    'cell.arrowCylinderRadius': 'Axis-arrow shaft radius.',
};

/**
 * Documented options that have no static default in the defaults objects
 * (nested reader/correction configuration read at use time). Each entry is
 * inserted after the generated row named by `after`.
 */
export const extraRows = {
    density: [
        {
            after: 'differenceDensity.reflections',
            path: 'differenceDensity.reflections.source',
            type: 'String',
            default: '"auto"',
            description: '<code>auto</code>, <code>refln</code>, <code>diffrn_refln</code>, or ' +
                '<code>shelx_hkl_file</code>.',
        },
        {
            after: 'differenceDensity.reflections.source',
            path: 'differenceDensity.reflections.mergeFriedel',
            type: 'Boolean',
            default: 'automatic',
            description: 'Merges Friedel pairs for normal-scattering IAM maps; anomalous IAM ' +
                'defaults to keeping them separate.',
        },
        {
            after: 'differenceDensity.reflections.mergeFriedel',
            path: 'differenceDensity.reflections.removeSystematicAbsences',
            type: 'Boolean',
            default: 'true',
            description: 'Removes absent unmerged reflections before symmetry merging.',
        },
        {
            after: 'differenceDensity.reflections.removeSystematicAbsences',
            path: 'differenceDensity.reflections.absenceTolerance',
            type: 'Number',
            default: '1e-8',
            description: 'Complex general-position phase-sum tolerance used for absence detection.',
        },
        {
            after: 'differenceDensity.iam',
            path: 'differenceDensity.iam.includeAnomalous',
            type: 'Boolean',
            default: 'false',
            description: 'Includes f&prime; and f&Prime; in IAM factors. Difference maps use ' +
                'normal scattering unless explicitly enabled.',
        },
        {
            after: 'differenceDensity.iam.includeAnomalous',
            path: 'differenceDensity.iam.wavelength',
            type: 'Number',
            description: 'Fallback wavelength in &Aring;; a wavelength reported by the CIF takes precedence.',
        },
        {
            after: 'differenceDensity.iam.wavelength',
            path: 'differenceDensity.iam.cromerMann',
            type: 'Object',
            description: 'Fallback nine-coefficient Cromer&ndash;Mann arrays keyed by atom type or ' +
                'element; complete CIF rows take precedence.',
        },
        {
            after: 'differenceDensity.iam.cromerMann',
            path: 'differenceDensity.iam.dispersionValues',
            type: 'Object',
            description: 'Fallback f&prime;/f&Prime; values keyed by atom type or element; site ' +
                'and type CIF values take precedence.',
        },
        {
            after: 'differenceDensity.iam.dispersionValues',
            path: 'differenceDensity.iam.anomalous.table',
            type: 'String',
            default: 'automatic',
            description: 'Forces the internal <code>Cu</code> or <code>Mo</code> dispersion table.',
        },
        {
            after: 'differenceDensity.iam.anomalous.table',
            path: 'differenceDensity.iam.anomalous.wavelengthTolerance',
            type: 'Number',
            default: '0.005 Å',
            description: 'Controls automatic wavelength matching against the internal tables.',
        },
        {
            after: 'differenceDensity.coefficientColumns',
            path: 'differenceDensity.coefficientColumns.loop',
            type: 'String',
            default: '"_refln"',
            description: 'Custom loop category name.',
        },
        {
            after: 'differenceDensity.coefficientColumns.loop',
            path: 'differenceDensity.coefficientColumns.h / .k / .l',
            type: 'String',
            description: 'Miller-index column names; default to the standard index columns of the loop.',
        },
        {
            after: 'differenceDensity.coefficientColumns.h / .k / .l',
            path: 'differenceDensity.coefficientColumns.amplitudes / .phases',
            type: 'String or String[]',
            description: 'One or two amplitude columns with one common phase or matching split phases.',
        },
        {
            after: 'differenceDensity.coefficientColumns.amplitudes / .phases',
            path: 'differenceDensity.coefficientColumns.a / .b',
            type: 'String or String[]',
            description: 'One or two direct real/imaginary crystallographic coefficient columns; ' +
                'use instead of amplitudes/phases.',
        },
        {
            after: 'differenceDensity.coefficientColumns.a / .b',
            path: 'differenceDensity.coefficientColumns.phaseUnit',
            type: 'String',
            default: '"degrees"',
            description: '<code>degrees</code> or <code>radians</code>.',
        },
        {
            after: 'differenceDensity.coefficientColumns.phaseUnit',
            path: 'differenceDensity.coefficientColumns.omitF000',
            type: 'Boolean',
            default: 'false',
            description: 'Omits the mean term. Custom/deformation coefficients retain it by default.',
        },
        {
            after: 'differenceDensity.anomalousDispersion',
            path: 'differenceDensity.anomalousDispersion.target',
            type: 'String',
            default: 'source-dependent',
            description: '<code>first</code>, <code>second</code>, <code>both</code>, or ' +
                '<code>result</code>. Custom coefficients default to first; FCF4 to both.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.target',
            path: 'differenceDensity.anomalousDispersion.phaseDetection',
            type: 'Boolean',
            default: 'true',
            description: 'Enables exact inversion/Friedel phase tests. Set false for deliberate ' +
                'deformation coefficients.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.phaseDetection',
            path: 'differenceDensity.anomalousDispersion.phaseToleranceDegrees',
            type: 'Number',
            default: '0.05°',
            description: 'Phase tolerance of the inversion/Friedel tests.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.phaseToleranceDegrees',
            path: 'differenceDensity.anomalousDispersion.friedelAmplitudeToleranceRelative',
            type: 'Number',
            default: '1e-4',
            description: 'Relative amplitude tolerance of the Friedel tests.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.friedelAmplitudeToleranceRelative',
            path: 'differenceDensity.anomalousDispersion.generator',
            type: 'String',
            default: '"auto"',
            description: '<code>auto</code>, <code>olex</code>, or <code>shelxl</code>; normally ' +
                'inferred from CIF metadata.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.generator',
            path: 'differenceDensity.anomalousDispersion.wavelength / .table / .wavelengthTolerance',
            type: 'Number / String / Number',
            description: 'Fallback wavelength, optional forced <code>Cu</code>/<code>Mo</code> ' +
                'table, and automatic table-matching tolerance (default 0.005 &Aring;). The CIF ' +
                'wavelength wins.',
        },
        {
            after: 'differenceDensity.anomalousDispersion.wavelength / .table / .wavelengthTolerance',
            path: 'differenceDensity.anomalousDispersion.values',
            type: 'Object',
            description: 'Fallback f&prime;/f&Prime; values keyed by atom type or element; ' +
                'site/type CIF values take precedence.',
        },
        {
            after: 'differenceDensity.extinctionCorrection',
            path: 'differenceDensity.extinctionCorrection.coefficient',
            type: 'Number',
            description: 'Overrides the CIF extinction coefficient when the option is an object.',
        },
        {
            after: 'differenceDensity.extinctionCorrection.coefficient',
            path: 'differenceDensity.extinctionCorrection.wavelength',
            type: 'Number',
            description: 'Overrides the extinction-model wavelength when the option is an object.',
        },
        {
            after: 'contourLines.plane',
            path: 'contourLines.plane.coordinateSystem / .origin / .normal',
            type: 'String / Number[] / Number[]',
            description: 'Explicit <code>cartesian</code> (&Aring;) or <code>fractional</code> ' +
                'plane. Origin and normal are three-value vectors; a fractional normal is ' +
                'transformed as a reciprocal/covector normal.',
        },
        {
            after: 'contourLines.plane.coordinateSystem / .origin / .normal',
            path: 'contourLines.plane.bounds',
            type: 'Object',
            description: 'Optional in-plane <code>{u:[min,max], v:[min,max]}</code> bounds in ' +
                '&Aring;; otherwise automatic padding around all displayed atoms is used.',
        },
    ],
};
