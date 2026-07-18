import { COVALENT_RADII, FALLBACK_RADII } from '../structure/covalent-radii.js';

const elementColors = {
    'H': { 'atomColor': '#ffffff', 'ringColor': '#000000' },
    'D': { 'atomColor': '#ffffff', 'ringColor': '#000000' },
    'He': { 'atomColor': '#d9ffff', 'ringColor': '#000000' },
    'Li': { 'atomColor': '#cc80ff', 'ringColor': '#000000' },
    'Be': { 'atomColor': '#c2ff00', 'ringColor': '#000000' },
    'B': { 'atomColor': '#ffb5b5', 'ringColor': '#000000' },
    'C': { 'atomColor': '#000000', 'ringColor': '#ffffff' },
    'N': { 'atomColor': '#3050f8', 'ringColor': '#ffffff' },
    'O': { 'atomColor': '#ff0d0d', 'ringColor': '#ffffff' },
    'F': { 'atomColor': '#90e050', 'ringColor': '#000000' },
    'Ne': { 'atomColor': '#b3e3f5', 'ringColor': '#000000' },
    'Na': { 'atomColor': '#ab5cf2', 'ringColor': '#ffffff' },
    'Mg': { 'atomColor': '#8aff00', 'ringColor': '#000000' },
    'Al': { 'atomColor': '#bfa6a6', 'ringColor': '#000000' },
    'Si': { 'atomColor': '#f0c8a0', 'ringColor': '#000000' },
    'P': { 'atomColor': '#ff8000', 'ringColor': '#000000' },
    'S': { 'atomColor': '#ffff30', 'ringColor': '#000000' },
    'Cl': { 'atomColor': '#1ff01f', 'ringColor': '#000000' },
    'Ar': { 'atomColor': '#80d1e3', 'ringColor': '#000000' },
    'K': { 'atomColor': '#8f40d4', 'ringColor': '#ffffff' },
    'Ca': { 'atomColor': '#3dff00', 'ringColor': '#000000' },
    'Sc': { 'atomColor': '#e6e6e6', 'ringColor': '#000000' },
    'Ti': { 'atomColor': '#bfc2c7', 'ringColor': '#000000' },
    'V': { 'atomColor': '#a6a6ab', 'ringColor': '#000000' },
    'Cr': { 'atomColor': '#8a99c7', 'ringColor': '#000000' },
    'Mn': { 'atomColor': '#9c7ac7', 'ringColor': '#000000' },
    'Fe': { 'atomColor': '#e06633', 'ringColor': '#ffffff' },
    'Co': { 'atomColor': '#f090a0', 'ringColor': '#000000' },
    'Ni': { 'atomColor': '#50d050', 'ringColor': '#000000' },
    'Cu': { 'atomColor': '#c88033', 'ringColor': '#000000' },
    'Zn': { 'atomColor': '#7d80b0', 'ringColor': '#000000' },
    'Ga': { 'atomColor': '#c28f8f', 'ringColor': '#000000' },
    'Ge': { 'atomColor': '#668f8f', 'ringColor': '#000000' },
    'As': { 'atomColor': '#bd80e3', 'ringColor': '#000000' },
    'Se': { 'atomColor': '#ffa100', 'ringColor': '#000000' },
    'Br': { 'atomColor': '#a62929', 'ringColor': '#ffffff' },
    'Kr': { 'atomColor': '#5cb8d1', 'ringColor': '#000000' },
    'Rb': { 'atomColor': '#702eb0', 'ringColor': '#ffffff' },
    'Sr': { 'atomColor': '#00ff00', 'ringColor': '#000000' },
    'Y': { 'atomColor': '#94ffff', 'ringColor': '#000000' },
    'Zr': { 'atomColor': '#94e0e0', 'ringColor': '#000000' },
    'Nb': { 'atomColor': '#73c2c9', 'ringColor': '#000000' },
    'Mo': { 'atomColor': '#54b5b5', 'ringColor': '#000000' },
    'Tc': { 'atomColor': '#3b9e9e', 'ringColor': '#000000' },
    'Ru': { 'atomColor': '#248f8f', 'ringColor': '#000000' },
    'Rh': { 'atomColor': '#0a7d8c', 'ringColor': '#000000' },
    'Pd': { 'atomColor': '#006985', 'ringColor': '#ffffff' },
    'Ag': { 'atomColor': '#c0c0c0', 'ringColor': '#000000' },
    'Cd': { 'atomColor': '#ffd98f', 'ringColor': '#000000' },
    'In': { 'atomColor': '#a67573', 'ringColor': '#000000' },
    'Sn': { 'atomColor': '#668080', 'ringColor': '#000000' },
    'Sb': { 'atomColor': '#9e63b5', 'ringColor': '#ffffff' },
    'Te': { 'atomColor': '#d47a00', 'ringColor': '#000000' },
    'I': { 'atomColor': '#940094', 'ringColor': '#ffffff' },
    'Xe': { 'atomColor': '#429eb0', 'ringColor': '#000000' },
    'Cs': { 'atomColor': '#57178f', 'ringColor': '#ffffff' },
    'Ba': { 'atomColor': '#00c900', 'ringColor': '#000000' },
    'La': { 'atomColor': '#70d4ff', 'ringColor': '#000000' },
    'Ce': { 'atomColor': '#ffffc7', 'ringColor': '#000000' },
    'Pr': { 'atomColor': '#d9ffc7', 'ringColor': '#000000' },
    'Nd': { 'atomColor': '#c7ffc7', 'ringColor': '#000000' },
    'Pm': { 'atomColor': '#a3ffc7', 'ringColor': '#000000' },
    'Sm': { 'atomColor': '#8fffc7', 'ringColor': '#000000' },
    'Eu': { 'atomColor': '#61ffc7', 'ringColor': '#000000' },
    'Gd': { 'atomColor': '#45ffc7', 'ringColor': '#000000' },
    'Tb': { 'atomColor': '#30ffc7', 'ringColor': '#000000' },
    'Dy': { 'atomColor': '#1fffc7', 'ringColor': '#000000' },
    'Ho': { 'atomColor': '#00ff9c', 'ringColor': '#000000' },
    'Er': { 'atomColor': '#00e675', 'ringColor': '#000000' },
    'Tm': { 'atomColor': '#00d452', 'ringColor': '#000000' },
    'Yb': { 'atomColor': '#00bf38', 'ringColor': '#000000' },
    'Lu': { 'atomColor': '#00ab24', 'ringColor': '#000000' },
    'Hf': { 'atomColor': '#4dc2ff', 'ringColor': '#000000' },
    'Ta': { 'atomColor': '#4da6ff', 'ringColor': '#000000' },
    'W': { 'atomColor': '#2194d6', 'ringColor': '#000000' },
    'Re': { 'atomColor': '#267dab', 'ringColor': '#000000' },
    'Os': { 'atomColor': '#266696', 'ringColor': '#ffffff' },
    'Ir': { 'atomColor': '#175487', 'ringColor': '#ffffff' },
    'Pt': { 'atomColor': '#d0d0e0', 'ringColor': '#000000' },
    'Au': { 'atomColor': '#ffd123', 'ringColor': '#000000' },
    'Hg': { 'atomColor': '#b8b8d0', 'ringColor': '#000000' },
    'Tl': { 'atomColor': '#a6544d', 'ringColor': '#ffffff' },
    'Pb': { 'atomColor': '#575961', 'ringColor': '#ffffff' },
    'Bi': { 'atomColor': '#9e4fb5', 'ringColor': '#ffffff' },
    'Po': { 'atomColor': '#ab5c00', 'ringColor': '#ffffff' },
    'At': { 'atomColor': '#754f45', 'ringColor': '#ffffff' },
    'Rn': { 'atomColor': '#428296', 'ringColor': '#000000' },
    'Fr': { 'atomColor': '#420066', 'ringColor': '#ffffff' },
    'Ra': { 'atomColor': '#007d00', 'ringColor': '#000000' },
    'Ac': { 'atomColor': '#70abfa', 'ringColor': '#000000' },
    'Th': { 'atomColor': '#00baff', 'ringColor': '#000000' },
    'Pa': { 'atomColor': '#00a1ff', 'ringColor': '#000000' },
    'U': { 'atomColor': '#008fff', 'ringColor': '#000000' },
    'Np': { 'atomColor': '#0080ff', 'ringColor': '#000000' },
    'Pu': { 'atomColor': '#006bff', 'ringColor': '#ffffff' },
    'Am': { 'atomColor': '#545cf2', 'ringColor': '#ffffff' },
    'Cm': { 'atomColor': '#785ce3', 'ringColor': '#ffffff' },
    'Bk': { 'atomColor': '#8a4fe3', 'ringColor': '#ffffff' },
    'Cf': { 'atomColor': '#a136d4', 'ringColor': '#ffffff' },
};

const elementProperties = Object.fromEntries(
    Object.entries(elementColors).map(([symbol, colors]) => [
        symbol,
        { 'radius': COVALENT_RADII[symbol] ?? FALLBACK_RADII[symbol], ...colors },
    ]),
);

export default {
    'camera': {
        'type': 'orthographic',
        'minDistance': 1,
        'maxDistance': 100,
        'wheelZoomSpeed': 0.0008,
        'pinchZoomSpeed': 0.001,
        'initialPosition': [0, 0, 10],
        'fov': 45,
        'near': 0.1,
        'far': 1000,
    },
    'selection': {
        'mode': 'multiple',
        'markerMult': 1.3,
        'bondMarkerMult': 1.7,
        'highlightEmissive': 0xaaaaaa,
        'markerColors': [
            0x1f77b4,
            0xff7f0e,
            0x2ca02c,
            0xd62728,
            0x9467bd,
            0x8c564b,
            0xe377c2,
            0x7f7f7f,
            0xbcbd22,
            0x17becf,
        ],
    },
    'interaction': {
        'rotationSpeed': 5,
        'clickThreshold': 200,
        'mouseRaycast': {
            'lineThreshold': 0.5,
            'pointsThreshold': 0.5,
            'meshThreshold': 0.1,
        },
        'touchRaycast': {
            'lineThreshold': 2.0,
            'pointsThreshold': 2.0,
            'meshThreshold': 0.2,
        },
    },

    'renderMode': 'onDemand',
    // 'solid-3d': shared-geometry ellipsoids, the default and only style
    //   eligible for InstancedMesh batching.
    // 'cutout-3d': ellipsoids with a missing camera-facing octant, exposing
    //   the interior cutaway planes.
    // 'cutout-2d': hatched, outlined publication-style renderer (element
    //   colours retained); always cutaway, like 'cutout-3d', but with hatch
    //   materials instead of solid ones.
    'renderStyle': 'solid-3d',

    // 'cutout-2d' publication-style renderer settings (outline/hatch colours
    // below are neutral defaults; atom/ring hatch colours still follow
    // per-element colours, see GeometryMaterialCache.getAtomMaterials)
    'plot2DBackground': '#ffffff',
    'plot2DAtomColor': '#ffffff',
    'plot2DLineColor': '#000000',
    'plot2DBondColor': '#000000',
    'plot2DColorLuminanceCeiling': 0.25,
    'plot2DOpenBondInnerScale': 0.5,
    'plot2DStripeCount': 7,
    'plot2DStripeWidth': 0.18,
    'plot2DOutlineScale': 1.035,

    // starting values for hydrogen, disorder and symmetry display
    'hydrogenMode': 'none',
    'disorderMode': 'all',
    'symmetryMode': 'none',

    // Difference-electron-density maps are loaded separately from the
    // coordinate CIF and remain opt-in.
    'differenceDensity': {
        ...DEFAULT_DIFFERENCE_DENSITY_OPTIONS,
        // Structure construction always completes first. When enabled, density
        // parsing/calculation is scheduled afterwards in the density worker.
        // auto first tries explicit FCF coefficients and then CIF observations
        // plus an IAM Fcalc. The individual modes can be forced for diagnostics.
        // Correct raw observed intensities using a reported SHELXL EXTI model.
        // Set false for deliberately uncorrected/custom observed amplitudes.
        // null keeps SHELXL Fo-Fc auto-detection. Custom deformation-density
        // columns can provide amplitudes/phases or direct A/B coefficients.
        // Detect an uncorrected anomalous contribution from inversion/Friedel
        // constraints, with Olex metadata as fallback. Coordinate-CIF f'/f''
        // values take precedence over internal tables.
        // All reflections are used from the start. The normal grid gives a
        // quick first display; the worker then replaces it with the final
        // oversampled grid before refining only the surface tessellation.
        // Final surface resolution grows with physical draw size to maintain
        // approximately this spacing, bounded by resolution/maxResolution.
    },

    'scalarField': {
        ...DEFAULT_SCALAR_FIELD_OPTIONS,
    },

    'isosurface': {
        ...DEFAULT_ISOSURFACE_OPTIONS,
    },

    // Optional line-only section through any loaded scalar field. No plane
    // geometry or fill is rendered, so the viewer/widget background is kept.
    'contourLines': {
        ...DEFAULT_CONTOUR_LINE_OPTIONS,
    },

    'bondGrowTolerance': 0.45,

    'fixCifErrors': false,

    // Screen-space atom label settings. Labels are opt-in so existing viewers
    // retain their current appearance and rendering cost.
    'atomLabels': {
        'show': 'none',
        'placementMode': 'auto-omit',
        'text': {},
        'fontSize': 14,
        'fontWeight': 500,
        'fontFamily': 'system-ui, -apple-system, sans-serif',
        'colorMode': 'uniform',
        'color': '#111111',
        'atomColorLuminanceCeiling': 0.25,
        'haloColor': '#ffffff',
        'haloWidth': 2,
        'leaderLines': 'auto',
        'leaderColor': 'rgba(17, 17, 17, 0.55)',
        'leaderWidth': 1,
        'atomPadding': 3,
        'bondPadding': 2,
        'labelPadding': 2,
        'viewportPadding': 4,
        'fallbackDistance': 18,
        'maxConnectorLength': Infinity,
        'ringPenalty': 1000,
        'movementPenalty': 80,
        'repairDepth': 2,
        'repairSearchLimit': 48,
        'autoPerformanceLabelThreshold': 500,
        'performanceNoSpaceCellSize': 24,
        'spatialCellSize': 64,
        'useWorker': true,
        'showLoadingIndicator': true,
        'loadingIndicatorDelayMs': 120,
        'layoutThrottleMs': 32,
        'interactionLabelLimit': 300,
        'hideLabelsDuringDeferredLayout': true,
        'calloutPlacement': 'structure',
        'calloutGap': 12,
        'maximumCoverageDistanceSteps': 6,
        'calloutColumns': 3,
        'calloutColumnGap': 8,
        'calloutRowGap': 4,
        'calloutSearchLimit': 64,
        'calloutChoiceLimit': 4,
        'leaderBondCrossingPenalty': 25,
        'maxVisible': Infinity,
    },

    // atom visualisation Settings
    'atomDetail': 3,
    'atomCutawayHysteresis': 0.025,
    'atomCutawayStripeCount': 7,
    'atomCutawayStripeWidth': 0.5,
    'atomColorRoughness': 0.4,
    'atomColorMetalness': 0.5,
    'atomADPRingWidthFactor': 1.0,
    'atomADPRingHeight': 0.06,
    'atomADPRingSections': 18,
    'atomADPInnerSections': 7,
    'atomConstantRadiusMultiplier': 0.25,

    // Bond visualisation settings
    'bondRadius': 0.05,
    'bondSections': 15,
    'bondColorMode': 'uniform',
    'bondColor': '#666666',
    'bondColorRoughness': 0.3,
    'bondColorMetalness': 0.1,

    // Hydrogen bond visualisation settings
    'hbondRadius': 0.04,         
    'hbondColor': '#AAAAAA',     
    'hbondColorRoughness': 0.3,  
    'hbondColorMetalness': 0.1,  
    'hbondDashSegmentLength': 0.3, // Target length for each dash+gap segment
    'hbondDashFraction': 0.6,    // Fraction of segment that is solid (vs gap)

    // Cell visualisation settings
    'cell': {
        'boxColor': '#000000',
        'boxOpacity': 0.8,
        'boxLineWidth': 2,
        'arrowColorA': '#E74C3C', // Red',
        'arrowColorB': '#2ECC71', // Green',
        'arrowColorC': '#3498DB', // Blue',
        'arrowHeadLengthMult': 0.05,
        'arrowHeadWidthMult': 0.25,
        'arrowCylinderRadius': 0.04,
    },

    'elementProperties': elementProperties,
};
import { DEFAULT_DIFFERENCE_DENSITY_OPTIONS } from '../density/difference-density-options.js';
import { DEFAULT_SCALAR_FIELD_OPTIONS } from '../density/scalar-field-options.js';
import { DEFAULT_ISOSURFACE_OPTIONS } from '../density/isosurface-options.js';
import { DEFAULT_CONTOUR_LINE_OPTIONS } from '../density/contour-line-options.js';
