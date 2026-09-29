/**
 * Maps the legacy public render-style names to representation-independent intent.
 * @param {string} renderStyle - Public render-style enum
 * @returns {'clean-3d'|'explanatory-3d'|'publication-2d'} Presentation intent
 */
export function getPresentationIntent(renderStyle: string): "clean-3d" | "explanatory-3d" | "publication-2d";
/**
 * Adds common PEANUT deformation and optional grid/line presentation to a material.
 * @param {THREE.Material} material - Material to decorate
 * @param {object} config - Shader configuration
 * @param {'clean-3d'|'explanatory-3d'|'publication-2d'|'depth'|'outline'} config.presentation - Presentation mode
 * @param {THREE.ColorRepresentation} [config.gridColor] - Grid/line colour
 * @param {number[]} [config.uniformShape] - Standalone shape; omit for instancing
 * @param {number[][]} [config.gridRotation] - Principal-to-structure rotation
 * @param {string} [config.gridPoleAxis] - Structure-fixed or principal grid pole
 * @param {number} [config.silhouetteWidth] - Publication silhouette width
 * @param {number} [config.gridLineWidth] - Grid stroke width in structure-space Angstrom
 * @param {number} [config.meridianCount] - Number of longitudinal grid intervals
 * @param {number} [config.latitudeIntervals] - Number of latitudinal grid intervals
 * @param {{value:number}} [config.outlinePixelUniform] - Outline width uniform
 * @param {{value:THREE.Vector2}} [config.outlineViewport] - CSS viewport uniform
 * @returns {THREE.Material} The decorated material
 */
export function decoratePeanutMaterial(material: THREE.Material, config: {
    presentation: "clean-3d" | "explanatory-3d" | "publication-2d" | "depth" | "outline";
    gridColor?: THREE.ColorRepresentation | undefined;
    uniformShape?: number[] | undefined;
    gridRotation?: number[][] | undefined;
    gridPoleAxis?: string | undefined;
    silhouetteWidth?: number | undefined;
    gridLineWidth?: number | undefined;
    meridianCount?: number | undefined;
    latitudeIntervals?: number | undefined;
    outlinePixelUniform?: {
        value: number;
    } | undefined;
    outlineViewport?: {
        value: THREE.Vector2;
    } | undefined;
}): THREE.Material;
/**
 * Creates the hatched material used on the exposed principal planes of a
 * cutaway ellipsoid. CircleGeometry UVs keep the stripes horizontal on each
 * disc without adding extra geometry.
 * @param {object} elementProperty - Atom and ring colours for the element
 * @param {object} options - ORTEP rendering options
 * @returns {THREE.MeshStandardMaterial} Hatched cutaway-plane material
 */
export function createCutawayPlaneMaterial(elementProperty: object, options: object): THREE.MeshStandardMaterial;
/**
 * Creates the element-coloured hatch material for the three principal-plane
 * faces in the publication-style 2D renderer.
 * @param {object} options - ORTEP rendering options
 * @param {THREE.ColorRepresentation} lineColor - Element colour for hatch lines
 * @returns {THREE.MeshBasicMaterial} Hatched 2D plot material
 */
export function create2DPlotHatchMaterial(options: object, lineColor?: THREE.ColorRepresentation): THREE.MeshBasicMaterial;
/**
 * Calculates the transformation matrix for ellipsoid visualization from anisotropic displacement parameters.
 * @param {UAnisoADP} uAnisoADPobj - Anisotropic displacement parameters object
 * @param {UnitCell} unitCell - Unit cell object containing crystallographic parameters
 * @returns {THREE.Matrix4} Transformation matrix for ellipsoid visualization
 */
export function getThreeEllipsoidMatrix(uAnisoADPobj: UAnisoADP, unitCell: UnitCell): THREE.Matrix4;
/**
 * Calculates transformation matrix for bond placement between two points.
 * @param {THREE.Vector3} position1 - Start position
 * @param {THREE.Vector3} position2 - End position
 * @returns {THREE.Matrix4} Transformation matrix
 */
export function calcBondTransform(position1: THREE.Vector3, position2: THREE.Vector3): THREE.Matrix4;
/**
 * Builds cylinder and sphere transforms for a line of round-capped dashes.
 * @param {THREE.Vector3} start - Visible interaction start point
 * @param {THREE.Vector3} end - Ring centroid endpoint
 * @param {object} options - Dash layout options
 * @param {number} radius - Capsule radius
 * @returns {{bodies:object[], caps:object[]}} Instancing transforms and colour positions
 */
export function computeCentroidDashTransforms(start: THREE.Vector3, end: THREE.Vector3, options: object, radius: number): {
    bodies: object[];
    caps: object[];
};
/**
 * Moves bond endpoints from atom centres to their rendered surfaces.
 * @param {THREE.Vector3} position1 - First atom centre
 * @param {THREE.Vector3} position2 - Second atom centre
 * @param {ORTEPAtom} atom1 - Rendered first atom
 * @param {ORTEPAtom} atom2 - Rendered second atom
 * @returns {THREE.Vector3[]} Trimmed start and end positions
 */
export function trimBondToAtomSurfaces(position1: THREE.Vector3, position2: THREE.Vector3, atom1: ORTEPAtom, atom2: ORTEPAtom): THREE.Vector3[];
/**
 * Fixed-size pool of InstancedMesh instances sharing one geometry/material
 * pair, filled sequentially via register(). Used to collapse many identical
 * per-object THREE.Mesh draw calls into a single instanced draw call.
 */
export class InstancedPool {
    /**
     * @param {THREE.BufferGeometry} geometry - Shared geometry for every instance
     * @param {THREE.Material} material - Shared material for every instance
     * @param {number} count - Maximum number of instances this pool can hold
     */
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material, count: number);
    mesh: THREE.InstancedMesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.Material<THREE.MaterialEventMap>, THREE.InstancedMeshEventMap>;
    nextIndex: number;
    /**
     * Registers a new instance transform, returning its stable index.
     * @param {THREE.Matrix4} matrix - World-space instance transform
     * @param {THREE.Color|null} [color] - Optional per-instance material colour
     * @returns {number} Index assigned to this instance
     */
    register(matrix: THREE.Matrix4, color?: THREE.Color | null): number;
    /**
     * Uploads all registered instance matrices to the GPU. Call once after
     * every register() call for a given structure load.
     */
    finalize(): void;
    /**
     * Hides an instance (used to visually replace it with a selection overlay).
     * @param {number} index - Instance index to hide
     */
    hideInstance(index: number): void;
    /**
     * Restores a previously hidden instance to its real transform.
     * @param {number} index - Instance index to restore
     * @param {THREE.Matrix4} matrix - World-space instance transform
     */
    restoreInstance(index: number, matrix: THREE.Matrix4): void;
}
/**
 * Instanced PEANUT pool with a per-instance normalized eigenvalue shape.
 * The wrapper geometry references the shared sphere's vertex/index attributes;
 * only the three-float instance attribute and instance matrices are pool-owned.
 */
export class PeanutInstancedPool extends InstancedPool {
    /**
     * @param {THREE.BufferGeometry} baseGeometry - Shared PEANUT sphere topology
     * @param {THREE.Material} material - Visible body/line material
     * @param {number} count - Instance count
     * @param {THREE.Material|null} [depthMaterial] - Optional publication depth pass
     * @param {THREE.Material|null} [outlineMaterial] - Optional expanded silhouette pass
     */
    constructor(baseGeometry: THREE.BufferGeometry, material: THREE.Material, count: number, depthMaterial?: THREE.Material | null, outlineMaterial?: THREE.Material | null);
    baseGeometry: THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>;
    shapeAttribute: THREE.BufferAttribute<THREE.BufferAttributeEventMap> | THREE.InterleavedBufferAttribute;
    meshes: THREE.InstancedMesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.Material<THREE.MaterialEventMap>, THREE.InstancedMeshEventMap>[];
    depthMesh: THREE.InstancedMesh<THREE.InstancedBufferGeometry, THREE.Material<THREE.MaterialEventMap>, THREE.InstancedMeshEventMap> | undefined;
    outlineMesh: THREE.InstancedMesh<THREE.InstancedBufferGeometry, THREE.Material<THREE.MaterialEventMap>, THREE.InstancedMeshEventMap> | undefined;
    /**
     * @param {THREE.Matrix4} matrix - Principal-frame instance transform
     * @param {number[]} normalizedShape - Three normalized eigenvalues
     * @returns {number} Stable instance index
     */
    registerPeanut(matrix: THREE.Matrix4, normalizedShape: number[]): number;
    dispose(): void;
}
/**
 * Cache for Three.js geometries and materials used in molecular visualisation.
 * Allows for reuse of geometries and materials, which is more efficient than
 * generating copies for every object.
 */
export class GeometryMaterialCache {
    /**
     * Creates a new geometry and material cache.
     * @param {object} [options] - Visualisation options with defaults from structure-settings.js
     */
    constructor(options?: object);
    options: {
        elementProperties: any;
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
    };
    scaling: number;
    geometries: {};
    materials: {};
    elementMaterials: {};
    outlineViewport: {
        value: THREE.Vector2;
    };
    outlinePixels: {
        atom: {
            value: number;
        };
        bond: {
            value: number;
        };
    };
    plot2DElementColorScale: number;
    plot2DElementColorLift: number;
    /**
     * Creates and caches base geometries for atoms, ADP rings, bonds and H-bonds.
     * @private
     */
    private initializeGeometries;
    /**
     * Creates and caches base materials for bonds and H-bonds.
     * @private
     */
    private initializeMaterials;
    /**
     * Validates that properties exist for given element type.
     * @param {string} elementType - Chemical element symbol
     * @throws {Error} If element properties not found
     */
    validateElementType(elementType: string): void;
    /**
     * Gets or creates cached materials for given atom type.
     * @param {string} atomType - Chemical element symbol
     * @param {boolean} [cutawayEllipsoid] - Restrict these passes to pixels
     *   not already claimed by a nearer cutaway ellipsoid
     * @returns {THREE.Material[]} Array containing [atomMaterial, ringMaterial]
     */
    getAtomMaterials(atomType: string, cutawayEllipsoid?: boolean): THREE.Material[];
    /**
     * Gets the publication line colour already used by ellipsoid drawings.
     * @param {string} atomType - Chemical element symbol or atom label
     * @param {'atomColor'|'ringColor'} colorProperty - Element colour to adjust
     * @returns {THREE.Color} Background-adjusted element line colour
     */
    getPlot2DElementLineColor(atomType: string, colorProperty?: "atomColor" | "ringColor"): THREE.Color;
    /**
     * Gets representation-specific anisotropic PEANUT materials.
     * @param {string} atomType - Chemical element symbol or atom label
     * @param {boolean} [complementary] - Swap atom/ring colours for negative RMSD
     * @returns {{body:THREE.Material, depth:THREE.Material|null,
     * outline:THREE.Material|null,
     * presentation:string}} Material bundle
     */
    getPeanutMaterials(atomType: string, complementary?: boolean): {
        body: THREE.Material;
        depth: THREE.Material | null;
        outline: THREE.Material | null;
        presentation: string;
    };
    /**
     * Creates geometry for anisotropic displacement parameter visualisation,
     * by removing the inner vertices of a torus that would be obstructed by
     * the atom sphere anyway.
     * @private
     * @returns {THREE.BufferGeometry} Half torus geometry for ADP visualisation
     */
    private createADPHalfTorus;
    /**
     * Creates the three intersecting principal planes exposed by a missing octant.
     * @param {number} sections - Number of radial sections in each disc
     * @returns {THREE.BufferGeometry} Merged XY, XZ and YZ discs
     */
    createCutawayPlanes(sections: number): THREE.BufferGeometry;
    /**
     * Bakes the three ADP ring placements (identical for every anisotropic
     * atom, see ADP_RING_LOCAL_MATRICES) into one merged geometry, so an atom
     * needs a single ring mesh instead of three.
     * @param {THREE.BufferGeometry} baseADPRing - Single half-torus ring geometry
     * @returns {THREE.BufferGeometry} Merged geometry with all three rings placed
     */
    createMergedADPRingSet(baseADPRing: THREE.BufferGeometry): THREE.BufferGeometry;
    /**
     * Updates the CSS viewport size used to keep screen-space outline widths
     * constant. Cheap: writes one shared uniform read by every outline material.
     * @param {number} width - Container width in CSS pixels
     * @param {number} height - Container height in CSS pixels
     */
    setOutlineViewport(width: number, height: number): void;
    /**
     * Cleans up all cached resources.
     */
    dispose(): void;
}
/**
 * Main class for creating 3D molecular structure visualizations using the ORTEP approach.
 * Creates atoms with correct displacement parameters and connects them with bonds.
 */
export class ORTEP3JsStructure {
    /**
     * Creates a new ORTEP structure visualization.
     * @param {CrystalStructure} crystalStructure - Input crystal structure with atoms, bonds, and unit cell
     * @param {object} [options] - Visualization options, extends defaults from structure-settings.js
     */
    constructor(crystalStructure: CrystalStructure, options?: object);
    options: {
        metalRingCentroidOptions: any;
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
    };
    crystalStructure: CrystalStructure;
    cache: GeometryMaterialCache;
    /**
     * Creates 3D representations of atoms, bonds and H-bonds.
     * @private
     */
    private createStructure;
    atoms3D: any[] | undefined;
    bonds3D: any[] | undefined;
    hBonds3D: any[] | undefined;
    centroidInteractions: any[] | object[] | undefined;
    atomPools: Map<any, any> | undefined;
    ringPools: Map<any, any> | undefined;
    bondPool: InstancedPool | null | undefined;
    centroidBodyPool: InstancedPool | null | undefined;
    centroidBodiesShareBondPool: boolean | undefined;
    centroidCapPool: InstancedPool | null | undefined;
    centroidOutlineBodyPool: SharedInstancedPass | null | undefined;
    centroidOutlineCapPool: SharedInstancedPass | null | undefined;
    hbondPool: InstancedPool | null | undefined;
    timings: {
        structurePreparationTimeMs: number;
        atomCreationTimeMs: number;
        bondCreationTimeMs: number;
        hydrogenBondCreationTimeMs: number;
        structureCreationTimeMs: number;
        groupAssemblyTimeMs: number;
    } | undefined;
    /**
     * Returns a THREE.Group containing all visualization objects (atoms, bonds, H-bonds).
     * @returns {THREE.Group} Group containing all structure objects ready for rendering
     */
    getGroup(): THREE.Group;
    /**
     * Cleans up all resources.
     */
    dispose(): void;
}
/**
 * Base class for selectable THREE.js mesh objects with selection visualization capabilities.
 * @abstract
 * @augments THREE.Mesh
 */
export class ORTEPObject extends THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.Material<THREE.MaterialEventMap> | THREE.Material<THREE.MaterialEventMap>[], THREE.Object3DEventMap> {
    /**
     * Creates a new selectable object.
     * @param {THREE.BufferGeometry} geometry - Object geometry
     * @param {THREE.Material} material - Object material
     * @throws {TypeError} If instantiated directly (abstract class)
     */
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material);
    _selectionColor: number | null;
    marker: void | null;
    get selectionColor(): number | null;
    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format
     * @returns {THREE.Material} Selection highlight material
     */
    createSelectionMaterial(color: number): THREE.Material;
    /**
     * Handles object selection, applying highlighting and creating selection markers.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options
     */
    select(color: number, options: object): void;
    originalMaterial: THREE.Material<THREE.MaterialEventMap> | THREE.Material<THREE.MaterialEventMap>[] | null | undefined;
    /**
     * Handles object deselection, removing highlighting and markers.
     */
    deselect(): void;
    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} _color - Selection color in hex format
     * @param {object} _options - Selection options
     */
    createSelectionMarker(_color: number, _options: object): void;
    /**
     * Removes selection marker and restores original material.
     * @private
     */
    private removeSelectionMarker;
    /**
     * Cleans up resources.
     */
    dispose(): void;
}
/**
 * Base class for atom visualizations.
 * @augments ORTEPObject
 */
export class ORTEPAtom extends ORTEPObject {
    /**
     * Creates a new atom visualisation.
     * @param {Atom} atom - Input atom data
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     */
    constructor(atom: Atom, unitCell: UnitCell, baseAtom: THREE.BufferGeometry, atomMaterial: THREE.Material);
    plot2DOutline: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, any, THREE.Object3DEventMap> | undefined;
    userData: {
        type: string;
        atomData: Atom;
        selectable: boolean;
    };
    /**
     * Updates the untransformed radius used for bond-surface intersections.
     * @private
     */
    private updateSurfaceRadius;
    surfaceRadius: number | undefined;
    /**
     * Finds the distance from this atom's centre to its rendered surface in a
     * structure-space direction.
     * @param {THREE.Vector3} direction - Direction from the atom centre
     * @returns {number} Distance to the atom surface
     */
    getSurfaceDistanceAlong(direction: THREE.Vector3): number;
    /**
     * Creates visual marker for selection of atoms.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Object3D} Selection marker object
     */
    createSelectionMarker(color: number, options: object): THREE.Object3D;
}
/**
 * Class for atoms with anisotropic displacement parameters (ADPs).
 * Shows ellipsoidal representation with additional ADP rings.
 * @augments ORTEPAtom
 */
export class ORTEPAniAtom extends ORTEPAtom {
    /**
     * Creates a new anisotropic atom visualisation.
     * @param {Atom} atom - Input atom data with anisotropic displacement parameters
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @param {THREE.BufferGeometry} baseADPRingSet - Merged 3-ring geometry (see
     *   GeometryMaterialCache.createMergedADPRingSet)
     * @param {THREE.Material} ADPRingMaterial - ADP ring material
     * @param {object|null} cutaway - Optional cutaway geometries and settings
     */
    constructor(atom: Atom, unitCell: UnitCell, baseAtom: THREE.BufferGeometry, atomMaterial: THREE.Material, baseADPRingSet: THREE.BufferGeometry, ADPRingMaterial: THREE.Material, cutaway?: object | null);
    isSolidFallback: boolean | undefined;
    ringMesh: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.Material<THREE.MaterialEventMap>, THREE.Object3DEventMap> | undefined;
    /**
     * Replaces the solid shell with eight shared-geometry octant meshes and
     * adds the three internal principal planes.
     * @param {object} cutaway - Cutaway geometries and settings
     * @param {THREE.Material} atomMaterial - Material for the outer shell
     * @private
     */
    private setupCutaway;
    isCutaway: boolean | undefined;
    cutawayHysteresis: any;
    cutawaySigns: number[] | undefined;
    cutawayViewDirection: THREE.Vector3 | undefined;
    cutawayWorldPosition: THREE.Vector3 | undefined;
    cutawayInverseRotation: THREE.Matrix4 | undefined;
    cutawayOctants: THREE.Mesh<any, THREE.Material<THREE.MaterialEventMap>, THREE.Object3DEventMap>[] | undefined;
    cutawayOutlines: THREE.Mesh<any, any, THREE.Object3DEventMap>[] | undefined;
    cutawayPlanes: THREE.Mesh<any, any, THREE.Object3DEventMap> | undefined;
    cutawayDepthCap: THREE.Mesh<any, any, THREE.Object3DEventMap> | undefined;
    cutawayOcclusionMask: THREE.Mesh<any, any, THREE.Object3DEventMap> | undefined;
    /**
     * Finds the local ellipsoid octant facing the active camera.
     * @param {THREE.Camera} camera - Active viewer camera
     * @returns {number} Camera-facing octant index
     * @private
     */
    private getCameraFacingOctant;
    /**
     * Selects the missing local octant from the current camera direction.
     * @param {THREE.Camera} camera - Active viewer camera
     */
    updateCutawayOctant(camera: THREE.Camera): void;
    /**
     * Shows every surface octant except the selected one.
     * @param {number} missingIndex - Index of the octant to hide
     * @private
     */
    private setMissingOctant;
    missingOctantIndex: any;
    createSelectionMarker(color: any, options: any): THREE.Object3D<THREE.Object3DEventMap>;
    select(color: any, options: any): void;
    /**
     * Raycasts the visible cutaway parts while returning this selectable atom
     * as the hit object.
     * @param {THREE.Raycaster} raycaster - Raycaster performing the hit test
     * @param {object[]} intersects - Array receiving ray intersections
     * @returns {boolean|undefined} False for cutaways to skip duplicate child raycasts
     */
    raycast(raycaster: THREE.Raycaster, intersects: object[]): boolean | undefined;
    /**
     * Provides transformation matrices for positioning ADP rings in the three principal planes.
     * @returns {THREE.Matrix4[]} Array of matrices for the three orthogonal planes
     */
    get adpRingMatrices(): THREE.Matrix4[];
}
/**
 * Class for atoms with isotropic displacement parameters.
 * Shows spherical representation scaled by the isotropic displacement parameter.
 * @augments ORTEPAtom
 */
export class ORTEPIsoAtom extends ORTEPAtom {
    isSolidFallback: boolean | undefined;
}
/**
 * Class for atoms visualized with constant radius based on element type.
 * @augments ORTEPAtom
 */
export class ORTEPConstantAtom extends ORTEPAtom {
    /**
     * Creates a new constant radius atom visualization.
     * @param {Atom} atom - Input atom data
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @param {object} options - Must contain elementProperties for atom type
     * @throws {Error} If element properties not found
     */
    constructor(atom: Atom, unitCell: UnitCell, baseAtom: THREE.BufferGeometry, atomMaterial: THREE.Material, options: object);
}
/**
 * Abstract base for scene-graph objects whose rendered geometry lives in one
 * or more shared InstancedPool instances rather than in a mesh of their own.
 * Subclasses populate `this.segments` (an array of `{pool, matrix, index}`)
 * and get raycasting and hide-instance-and-overlay-mesh selection handling
 * for free.
 * @abstract
 * @augments THREE.Object3D
 */
export class PooledSelectableObject extends THREE.Object3D<THREE.Object3DEventMap> {
    /**
     * @throws {TypeError} If instantiated directly (abstract class)
     */
    constructor();
    _selectionColor: number | null;
    marker: void | null;
    segments: any[];
    get selectionColor(): number | null;
    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format
     * @returns {THREE.Material} Selection highlight material
     */
    createSelectionMaterial(color: number): THREE.Material;
    /**
     * Redirects raycasting to test each segment's instance transform against
     * its pool's geometry, reporting this object as the hit.
     * @param {THREE.Raycaster} raycaster - Raycaster performing the hit test
     * @param {object[]} intersects - Array receiving ray intersections
     */
    raycast(raycaster: THREE.Raycaster, intersects: object[]): void;
    /**
     * Handles selection: hides the pooled instances and replaces them with
     * individually highlighted meshes, plus a selection marker.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options
     */
    select(color: number, options: object): void;
    highlightMeshes: THREE.Mesh<any, any, THREE.Object3DEventMap>[] | null | undefined;
    /**
     * Handles deselection: restores the pooled instances and removes the
     * highlighted meshes and marker.
     */
    deselect(): void;
    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} _color - Selection color in hex format
     * @param {object} _options - Selection options
     * @throws {Error} If not implemented by subclass
     */
    createSelectionMarker(_color: number, _options: object): void;
    /**
     * Cleans up selection-related resources. Pool geometry/material are
     * cache-owned and disposed via GeometryMaterialCache.dispose().
     */
    dispose(): void;
}
/**
 * Base class for atom visualisations stored in a shared per-element
 * InstancedPool instead of owning a mesh.
 * @augments PooledSelectableObject
 */
export class ORTEPAtomInstance extends PooledSelectableObject {
    /**
     * @param {Atom} atom - Input atom data
     * @param {InstancedPool} pool - Shared per-element atom body pool
     * @param {THREE.Matrix4} matrix - Precomputed body transform
     * @param {number} surfaceRadius - Untransformed bounding-sphere radius of the atom geometry
     */
    constructor(atom: Atom, pool: InstancedPool, matrix: THREE.Matrix4, surfaceRadius: number);
    userData: {
        type: string;
        atomData: Atom;
        selectable: boolean;
    };
    segments: {
        pool: InstancedPool;
        matrix: THREE.Matrix4;
        index: number;
    }[];
    surfaceRadius: number;
    /**
     * Finds the distance from this atom's centre to its rendered surface in a
     * structure-space direction.
     * @param {THREE.Vector3} direction - Direction from the atom centre
     * @returns {number} Distance to the atom surface
     */
    getSurfaceDistanceAlong(direction: THREE.Vector3): number;
    /**
     * Creates visual marker for selection of atoms.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Object3D} Selection marker object
     */
    createSelectionMarker(color: number, options: object): THREE.Object3D;
}
/**
 * Class for instanced ellipsoid atoms in the clean 3D render style. In
 * addition to the pooled atom body, registers one instance into a
 * shared per-element ADP ring pool - using the exact same transform as the
 * body, since the three ring placements are already baked into the merged
 * ring geometry (see GeometryMaterialCache.createMergedADPRingSet). The ring
 * instance is intentionally excluded from `segments` (and therefore from
 * raycasting/selection): rings have always been non-selectable and
 * unaffected by selection highlighting, matching the legacy ORTEPAniAtom
 * behaviour where only the atom body's material changes on selection.
 * @augments ORTEPAtomInstance
 */
export class ORTEPAniAtomInstance extends ORTEPAtomInstance {
    /**
     * @param {Atom} atom - Input atom data with anisotropic displacement parameters
     * @param {InstancedPool} pool - Shared per-element atom body pool
     * @param {THREE.Matrix4} matrix - Precomputed ellipsoid transform
     * @param {number} surfaceRadius - Untransformed bounding-sphere radius of the atom geometry
     * @param {InstancedPool|null} ringPool - Shared per-element ADP ring pool
     */
    constructor(atom: Atom, pool: InstancedPool, matrix: THREE.Matrix4, surfaceRadius: number, ringPool: InstancedPool | null);
    ringPool: InstancedPool | undefined;
    ringIndex: number | undefined;
}
/**
 * Instanced anisotropic RMSD PEANUT atom with analytic surface queries and
 * CPU-deformed scratch geometry for accurate interaction.
 * @augments ORTEPAtomInstance
 */
export class ORTEPPeanutAtomInstance extends ORTEPAtomInstance {
    /**
     * @param {Atom} atom - Source anisotropic atom
     * @param {object[]} components - Signed PEANUT components and their pools
     * @param {THREE.Matrix4} matrix - Principal rotation and uniform max scale
     * @param {object} surface - RMSD surface descriptor
     * @param {string} presentation - Normalized presentation intent
     */
    constructor(atom: Atom, components: object[], matrix: THREE.Matrix4, surface: object, presentation: string);
    surfaceDescriptor: object;
    presentation: string;
    getSurfaceDistanceAlong(direction: any): any;
    /**
     * Creates a standalone material that reads this atom's shape from a uniform.
     * @param {THREE.Material} source - Pooled source material
     * @param {number[]} normalizedShape - Signed component shape
     * @returns {THREE.Material} Standalone decorated clone
     */
    createStandalonePeanutMaterial(source: THREE.Material, normalizedShape: number[]): THREE.Material;
    select(color: any, options: any): void;
    createSelectionMarker(color: any, options: any): THREE.Group<THREE.Object3DEventMap> | THREE.Mesh<any, THREE.Material<THREE.MaterialEventMap>, THREE.Object3DEventMap>;
}
/**
 * Class for chemical bond visualization.
 * Represents covalent bonds as cylinders between atoms.
 * @augments ORTEPObject
 */
export class ORTEPBond extends ORTEPObject {
    /**
     * Creates a new bond visualization.
     * @param {Bond} bond - Bond data containing connected atoms
     * @param {CrystalStructure} crystalStructure - Parent structure containing atom information
     * @param {THREE.BufferGeometry} baseBond - Bond geometry
     * @param {THREE.Material} baseBondMaterial - Bond material
     * @param {function(string): THREE.Vector3} [getCartesianPosition] - Cached atom-position resolver
     * @param {function(string): THREE.Object3D} [getRenderedAtom] - Rendered atom resolver for surface trimming
     * @param {object|null} [openStyle] - Optional opaque fill and outline setup
     * @param {object|null} [depthOutlineStyle] - Optional depth-writing silhouette outline
     */
    constructor(bond: Bond, crystalStructure: CrystalStructure, baseBond: THREE.BufferGeometry, baseBondMaterial: THREE.Material, getCartesianPosition?: (arg0: string) => THREE.Vector3, getRenderedAtom?: (arg0: string) => THREE.Object3D, openStyle?: object | null, depthOutlineStyle?: object | null);
    openBondOutline: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, any, THREE.Object3DEventMap> | undefined;
    bondDepthOutline: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, any, THREE.Object3DEventMap> | undefined;
    userData: {
        type: string;
        bondData: Bond;
        selectable: boolean;
        isOpenDisorderBond: boolean;
    };
    /**
     * Creates visual marker for selection of bonds.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Mesh} Selection marker mesh
     */
    createSelectionMarker(color: number, options: object): THREE.Mesh;
}
/**
 * Abstract base class for grouped objects like dashed hydrogen bonds.
 * Provides selection handling for compound objects composed of multiple meshes.
 * @abstract
 * @augments THREE.Group
 */
export class ORTEPGroupObject extends THREE.Group<THREE.Object3DEventMap> {
    /**
     * Creates a new group object.
     * @throws {TypeError} If instantiated directly (abstract class)
     */
    constructor();
    _selectionColor: number | null;
    marker: void | null;
    get selectionColor(): number | null;
    /**
     * Adds objects with raycasting redirection to ensure proper selection handling.
     * @param {...THREE.Object3D} objects - Objects to add to the group
     * @returns {this} This group object for chaining
     */
    add(...objects: THREE.Object3D[]): this;
    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format (e.g., 0xFF0000 for red)
     * @returns {THREE.Material} Selection highlight material with transparency
     */
    createSelectionMaterial(color: number): THREE.Material;
    /**
     * Handles group selection, applying highlighting to all children and creating selection markers.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     */
    select(color: number, options: object): void;
    /**
     * Handles group deselection, removing highlighting and markers.
     */
    deselect(): void;
    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} _color - Selection color in hex format
     * @param {object} _options - Selection options containing visualization parameters
     * @throws {Error} If not implemented by subclass
     */
    createSelectionMarker(_color: number, _options: object): void;
    /**
     * Cleans up resources to prevent memory leaks.
     */
    dispose(): void;
}
/**
 * Class for chemical bond visualization in the default (non-2D) render
 * style. Registers into a shared InstancedPool instead of owning its own
 * mesh, since every regular bond shares one geometry and one material.
 * @augments PooledSelectableObject
 */
export class ORTEPBondInstance extends PooledSelectableObject {
    /**
     * Splits a full bond transform into two exactly adjoining half transforms.
     * @param {THREE.Matrix4} matrix - Full bond transform
     * @returns {THREE.Matrix4[]} First-atom and second-atom half transforms
     */
    static computeSplitMatrices(matrix: THREE.Matrix4): THREE.Matrix4[];
    /**
     * Computes a bond's world-space transform, without creating any
     * rendering resources. Used both to size the shared InstancedPool before
     * any instance is registered, and to register into it.
     * @param {Bond} bond - Bond data containing connected atoms
     * @param {CrystalStructure} crystalStructure - Parent structure containing atom information
     * @param {function(string): THREE.Vector3} [getCartesianPosition] - Cached atom-position resolver
     * @param {function(string): THREE.Object3D} [getRenderedAtom] - Rendered atom resolver for surface trimming
     * @returns {THREE.Matrix4} World-space bond transform
     */
    static computeMatrix(bond: Bond, crystalStructure: CrystalStructure, getCartesianPosition?: (arg0: string) => THREE.Vector3, getRenderedAtom?: (arg0: string) => THREE.Object3D): THREE.Matrix4;
    /**
     * Creates a new bond visualisation, registering it into the shared bond InstancedPool.
     * @param {Bond} bond - Bond data
     * @param {InstancedPool} pool - Shared pool for all regular bonds
     * @param {THREE.Matrix4} matrix - Precomputed bond transform
     * @param {THREE.Color|THREE.Color[]|null} [colors] - One bond colour, or atom colours for two halves
     */
    constructor(bond: Bond, pool: InstancedPool, matrix: THREE.Matrix4, colors?: THREE.Color | THREE.Color[] | null);
    userData: {
        type: string;
        bondData: Bond;
        selectable: boolean;
        isOpenDisorderBond: boolean;
    };
    fullMatrix: THREE.Matrix4;
    segments: {
        pool: InstancedPool;
        matrix: THREE.Matrix4;
        index: number;
        color: any;
    }[];
    /**
     * Creates visual marker for selection of bonds.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Mesh} Selection marker mesh
     */
    createSelectionMarker(color: number, options: object): THREE.Mesh;
}
/**
 * Class for hydrogen bond visualization.
 * Represents hydrogen bonds as dashed lines between donor and acceptor atoms.
 * All dash segments across every h-bond in a structure share one geometry and
 * material, so they are rendered as instances of a single shared InstancedPool
 * rather than as individual meshes.
 * @augments PooledSelectableObject
 */
export class ORTEPHBond extends PooledSelectableObject {
    /**
     * Computes the world-space transform of every dash segment for an h-bond,
     * without creating any rendering resources. Used both to size the shared
     * InstancedPool before any instance is registered, and to register into it.
     * @param {HBond} hbond - H-bond data
     * @param {CrystalStructure} crystalStructure - Parent structure
     * @param {number} targetSegmentLength - Approximate target length for dashed segments
     * @param {number} dashFraction - Fraction of segment that is solid
     * @param {function(string): THREE.Vector3} [getCartesianPosition] - Cached atom-position resolver
     * @param {function(string): THREE.Object3D} [getRenderedAtom] - Rendered atom resolver for surface trimming
     * @returns {THREE.Matrix4[]} One transform per dash segment
     */
    static computeSegmentMatrices(hbond: HBond, crystalStructure: CrystalStructure, targetSegmentLength: number, dashFraction: number, getCartesianPosition?: (arg0: string) => THREE.Vector3, getRenderedAtom?: (arg0: string) => THREE.Object3D): THREE.Matrix4[];
    /**
     * Creates a new hydrogen bond visualisation, registering its dash segments
     * into the shared h-bond InstancedPool.
     * @param {HBond} hbond - H-bond data
     * @param {InstancedPool} pool - Shared pool for all h-bond dash segments
     * @param {THREE.Matrix4[]} segmentMatrices - Precomputed per-segment transforms
     */
    constructor(hbond: HBond, pool: InstancedPool, segmentMatrices: THREE.Matrix4[]);
    userData: {
        type: string;
        hbondData: HBond;
        selectable: boolean;
    };
    pool: InstancedPool;
    segments: {
        pool: InstancedPool;
        matrix: THREE.Matrix4;
        index: number;
    }[];
    /**
     * Creates visual marker for selection of hydrogen bond.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Group} Group containing selection marker meshes
     */
    createSelectionMarker(color: number, options: object): THREE.Group;
}
import * as THREE from 'three';
import { UAnisoADP } from '../structure/adp.js';
import { UnitCell } from '../structure/crystal.js';
import { CrystalStructure } from '../structure/crystal.js';
/**
 * Additional material pass over an existing instance pool. Geometry and the
 * instance-matrix GPU buffer are shared; only the material and draw call differ.
 */
declare class SharedInstancedPass {
    /**
     * @param {InstancedPool} sourcePool - Visible pool supplying geometry and transforms
     * @param {THREE.Material} material - Material for the additional pass
     */
    constructor(sourcePool: InstancedPool, material: THREE.Material);
    sourcePool: InstancedPool;
    mesh: THREE.InstancedMesh<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.Material<THREE.MaterialEventMap>, THREE.InstancedMeshEventMap>;
    finalize(): void;
}
import { Atom } from '../structure/crystal.js';
import { Bond } from '../structure/bonds.js';
import { HBond } from '../structure/bonds.js';
export {};
//# sourceMappingURL=ortep.d.ts.map