export class CifViewWidget extends HTMLElement {
    static get observedAttributes(): string[];
    viewer: CrystalViewer | null;
    baseCaption: string;
    selections: any[];
    measurements: any[];
    prepopulatedMeasurements: any[];
    customIcons: {} | null;
    userOptions: {};
    scalarFieldDisplay: object;
    _loading: boolean;
    _error: any;
    _loadSequence: number;
    defaultCaption: string;
    /** @returns {boolean} Whether the widget is currently loading a structure. */
    get loading(): boolean;
    /** @returns {Error|null} The most recent structure-loading error. */
    get error(): Error | null;
    /** @returns {import('./structure/crystal.js').CrystalStructure|null} The loaded structure. */
    get structure(): import("./structure/crystal.js").CrystalStructure | null;
    get icons(): {
        disorder: {
            all: string;
            group1of2: string;
            group2of2: string;
        };
        hydrogen: {
            anisotropic: string;
            constant: string;
            none: string;
        };
        settings: string;
        symmetry: {
            cell: string;
            "fragment-cell": string;
            "fragment-hbonds": string;
            fragment: string;
            hbonds: string;
            none: string;
        };
        upload: string;
    };
    connectedCallback(): Promise<void>;
    buttonContainer: HTMLDivElement | undefined;
    captionElement: HTMLDivElement | undefined;
    /**
     * Resolves the raw `block` attribute value into a selector for CrystalViewer.loadCIF.
     * A value made up entirely of digits is treated as a block index, otherwise as a block name.
     * @param {string|null} rawValue - Raw attribute value
     * @returns {number|string} Block index (default 0) or block name
     */
    resolveBlockSelector(rawValue: string | null): number | string;
    /** Connects caption updates to the current viewer instance. */
    connectViewerEvents(): void;
    measurementControls: MeasurementControls | null | undefined;
    stopMeasurementState: (() => void) | null | undefined;
    stopWidgetMeasurementUpdates: (() => void) | null | undefined;
    stopScalarFieldUpdates: (() => void) | null | undefined;
    stopModifierModeUpdates: (() => void) | null | undefined;
    stopSelectionUpdates: (() => void) | null | undefined;
    stopViewUpdates: (() => void) | null | undefined;
    /** Disconnects subscriptions and measurement DOM bindings from the current viewer. */
    disconnectViewerEvents(): void;
    stopMeasurementResults: (() => void) | null | undefined;
    stopMeasurementAction: (() => void) | null | undefined;
    /**
     * Dispatches a public widget event across embedding boundaries.
     * @param {string} type - DOM event name
     * @param {object} detail - Stable event payload
     */
    emitWidgetEvent(type: string, detail: object): void;
    /**
     * Updates observable loading state and announces transitions.
     * @param {boolean} loading - New loading state
     * @param {object} context - Load source metadata
     */
    setLoadingState(loading: boolean, context?: object): void;
    parseOptions(): void;
    /** Parses the widget-only JSON measurement prepopulation attribute. */
    parseMeasurementsAttribute(): void;
    /** Creates option-defined measurements after the requested structure block is loaded. */
    prepopulateMeasurements(): void;
    mergeOptions(userOptions: any): {
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
    };
    parseInitialModes(): void;
    parseInitialAtomLabels(): void;
    clearButtons(): void;
    setupButtons(): void;
    /** Adds the shared selection-count-sensitive measurement action. */
    addMeasurementButton(): void;
    /** Adds or updates the compact density-level visibility control. */
    updateScalarFieldButton(): void;
    parseCustomIcons(): {} | null;
    updateFilteredAtoms(): Promise<void>;
    addButton(container: any, type: any, altText: any): void;
    /**
     * Renders a modifier button's icon and re-applies the accessibility
     * attributes (alt/role/aria-label) to the newly inserted SVG, since
     * replacing innerHTML drops whatever was set on the previous element.
     * @param {HTMLButtonElement} button - Button whose icon should be updated
     * @param {string} type - Modifier category, e.g. "disorder"
     * @param {string} mode - Mode name within that category
     * @param {string} altText - Accessible label for the icon
     */
    renderButtonIcon(button: HTMLButtonElement, type: string, mode: string, altText: string): void;
    /**
     * Resolves the icon markup for a modifier mode.
     * @param {string} type - Modifier category, e.g. "disorder"
     * @param {string} mode - Mode name within that category
     * @returns {string} SVG markup for the icon
     */
    getIcon(type: string, mode: string): string;
    attributeChangedCallback(name: any, oldValue: any, newValue: any): Promise<void>;
    /**
     * Clears any lingering error state (overlay + error caption) left over from a
     * previous failed load, so a new load attempt starts from a clean slate.
     */
    resetLoadState(): void;
    /**
     * Runs one observable structure load and normalizes its lifecycle events.
     * @param {function(): Promise<object>} operation - Viewer load operation
     * @param {object} context - Source and block metadata
     * @returns {Promise<object>} Viewer-compatible load result
     */
    runStructureLoad(operation: () => Promise<object>, context: object): Promise<object>;
    loadFromUrl(url: any, blockSelector?: number): Promise<object>;
    loadFromString(data: any, blockSelector?: number): Promise<object>;
    createErrorDiv(error: any, context?: {}): void;
    errorDiv: HTMLDivElement | null | undefined;
    clearErrorDiv(): void;
    /**
     * Sanitizes HTML strings to prevent XSS attacks
     * @param {string} html - The potentially unsafe HTML string
     * @returns {string} - Sanitized string with HTML entities escaped
     */
    sanitizeHTML(html: string): string;
    /**
     * Formats an atom label as safe typographic HTML.
     * @param {string} label - Raw atom label.
     * @returns {string} Safe label HTML.
     */
    atomLabelHTML(label: string): string;
    /**
     * Formats one atom as a hover-linked caption span.
     * @param {string} label - Atom label.
     * @param {string} atomId - Symmetry-resolved atom ID.
     * @param {number} color - Owning measurement colour.
     * @returns {string} Safe HTML span.
     */
    measurementAtomHTML(label: string, atomId: string, color: number): string;
    /**
     * Formats a measurement with individually hoverable atom names.
     * @param {object} measurement - Measurement to format.
     * @returns {string} Safe caption HTML.
     */
    measurementCaptionHTML(measurement: object): string;
    /**
     * Renders the widget's existing inline measurement presentation for the shared controller.
     * @param {object} measurement - Measurement to render.
     * @returns {HTMLElement} Inline result element.
     */
    renderMeasurementCaption(measurement: object): HTMLElement;
    updateCaption(): void;
    disconnectedCallback(): void;
}
import { CrystalViewer } from './ortep3d/crystal-viewer.js';
import { MeasurementControls } from './measurement-controls.js';
//# sourceMappingURL=widget.d.ts.map