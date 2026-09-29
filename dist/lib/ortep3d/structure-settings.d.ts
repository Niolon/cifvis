export const DEFAULT_VIEWER_OPTIONS: Readonly<{
    camera: {
        type: string;
        minDistance: number;
        maxDistance: number;
        wheelZoomSpeed: number;
        pinchZoomSpeed: number;
        initialPosition: number[];
        fov: number;
        near: number;
        far: number;
    };
    selection: {
        mode: string;
        markerMult: number;
        bondMarkerMult: number;
        haloWidth: number;
        highlightEmissive: number;
        markerColors: number[];
    };
    measurement: {
        lineRadius: number;
        markerRadius: number;
        markerColors: number[];
    };
    interaction: {
        rotationSpeed: number;
        lockRotation: boolean;
        lockZoom: boolean;
        clickThreshold: number;
        mouseRaycast: {
            lineThreshold: number;
            pointsThreshold: number;
            meshThreshold: number;
        };
        touchRaycast: {
            lineThreshold: number;
            pointsThreshold: number;
            meshThreshold: number;
        };
    };
    renderMode: string;
    debug: boolean;
    renderStyle: string;
    adpRepresentation: string;
    sealCutoutCavity: boolean;
    plot2DBackground: string;
    plot2DAtomColor: string;
    plot2DLineColor: string;
    plot2DBondColor: string;
    plot2DBondOutlineColor: string;
    plot2DBondOutlineWidth: number;
    plot2DColorLuminanceCeiling: number;
    plot2DColorLuminanceFloor: null;
    plot2DOpenBondInnerScale: number;
    plot2DStripeCount: number;
    plot2DStripeWidth: number;
    plot2DOutlineWidth: number;
    hydrogenMode: string;
    disorderMode: string;
    symmetryMode: string;
    packingCutoff: number;
    differenceDensity: Readonly<{
        autoLoad: false;
        inputMode: "auto";
        reflections: Readonly<{}>;
        iam: Readonly<{}>;
        intensityScale: null;
        extinctionCorrection: "auto";
        coefficientColumns: null;
        anomalousDispersion: false;
        reciprocalResolution: 1;
        initialGridOversampling: 1;
        gridOversampling: 2;
    }>;
    scalarField: Readonly<{
        useWorker: true;
    }>;
    isosurface: Readonly<{
        useSymmetry: true;
        progressiveSteps: readonly number[];
        visible: true;
        sigmaLevel: 3;
        radius: 1.5;
        resolution: 64;
        gridSpacing: 0.15;
        maxResolution: 96;
        stitchTolerance: 0.0001;
        positiveColor: "#267e47";
        negativeColor: "#992a3e";
        deformationPositiveColor: "#4FC3F7";
        deformationNegativeColor: "#FF9800";
        opacity: 0.55;
        wireframe: true;
        maxPolyCount: 100000;
        surfaceCacheMaxBytes: number;
    }>;
    contourLines: Readonly<{
        enabled: false;
        plane: Readonly<{
            mode: "best-fit";
        }>;
        padding: 1.5;
        maxAtomDistance: 2.5;
        resolution: 256;
        gridSpacing: 0.04;
        maxResolution: 512;
        interpolation: "tricubic";
        contourCount: 20;
        contourStep: null;
        levelSubdivisions: 4;
        levels: null;
        sign: null;
        zeroLine: false;
        zeroColor: "#666666";
        lineColor: null;
        lineWidth: 1.5;
        haloColor: "#ffffff";
        haloWidth: 1;
        opacity: 1;
        depthOffset: 0.02;
    }>;
    bondGrowTolerance: number;
    fixCifErrors: boolean;
    atomLabels: {
        show: string;
        subscriptNonElement: boolean;
        placementMode: string;
        text: {};
        fontSize: number;
        fontWeight: number;
        fontFamily: string;
        colorMode: string;
        color: string;
        atomColorLuminanceCeiling: number;
        atomColorLuminanceFloor: null;
        haloColor: string;
        haloWidth: number;
        leaderLines: string;
        leaderColor: string;
        leaderWidth: number;
        atomPadding: number;
        bondPadding: number;
        labelPadding: number;
        viewportPadding: number;
        fallbackDistance: number;
        maxConnectorLength: number;
        ringPenalty: number;
        movementPenalty: number;
        repairDepth: number;
        repairSearchLimit: number;
        autoPerformanceLabelThreshold: number;
        performanceNoSpaceCellSize: number;
        spatialCellSize: number;
        useWorker: boolean;
        showLoadingIndicator: boolean;
        loadingIndicatorDelayMs: number;
        layoutThrottleMs: number;
        interactionLabelLimit: number;
        hideLabelsDuringDeferredLayout: boolean;
        calloutPlacement: string;
        calloutGap: number;
        maximumCoverageDistanceSteps: number;
        calloutColumns: number;
        calloutColumnGap: number;
        calloutRowGap: number;
        calloutSearchLimit: number;
        calloutChoiceLimit: number;
        leaderBondCrossingPenalty: number;
        maxVisible: number;
    };
    ellipsoidProbability: number;
    peanutScale: number;
    peanutMeridianCount: number;
    peanutLatitudeIntervals: number;
    peanutGridPoleAxis: string;
    peanutGridLineWidth: number;
    peanutDetail: number;
    atomDetail: number;
    atomCutawayHysteresis: number;
    atomCutawayStripeCount: number;
    atomCutawayStripeWidth: number;
    atomColorRoughness: number;
    atomColorMetalness: number;
    atomADPRingWidthFactor: number;
    atomADPRingHeight: number;
    atomADPRingSections: number;
    atomADPInnerSections: number;
    atomConstantRadiusMultiplier: number;
    bondRadius: number;
    bondSections: number;
    bondColorMode: string;
    bondColor: string;
    bondDisorderColorsEnabled: boolean;
    bondColorPart1: string;
    bondColorPart2Plus: string;
    bondColorRoughness: number;
    bondColorMetalness: number;
    collapseMetalRingBonds: boolean;
    metalRingCentroidOptions: {
        centreElements: string[];
        ringElements: string[];
        minRingSize: number;
        maxRingSize: number;
        minBondedAtoms: number;
        minRingCoverage: number;
        requireGeometryCheck: boolean;
        maxRingPlanarityRatio: number;
        maxLateralDisplacementRatio: number;
        maxDistanceSpreadRatio: number;
        dashSegmentLength: number;
        dashFraction: number;
    };
    hbondRadius: number;
    hbondColor: string;
    hbondColorRoughness: number;
    hbondColorMetalness: number;
    hbondDashSegmentLength: number;
    hbondDashFraction: number;
    cell: {
        boxColor: string;
        boxOpacity: number;
        boxLineWidth: number;
        arrowColorA: string;
        arrowColorB: string;
        arrowColorC: string;
        arrowHeadLengthMult: number;
        arrowHeadWidthMult: number;
        arrowCylinderRadius: number;
    };
    elementProperties: {
        [k: string]: {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        } | {
            atomColor: string;
            ringColor: string;
            radius: any;
        };
    };
}>;
export default DEFAULT_VIEWER_OPTIONS;
//# sourceMappingURL=structure-settings.d.ts.map