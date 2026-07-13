import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import defaultSettings from './structure-settings.js';
import { inferElementFromLabel } from '../structure/crystal.js';
import { HBond, Bond } from '../structure/bonds.js';
import { UAnisoADP, UIsoADP } from '../structure/adp.js';
import { CrystalStructure, UnitCell, Atom } from '../structure/crystal.js';

const OCTANT_SIGNS = [
    [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
    [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
];

const BASE_OCTANT_SIGNS = [-1, 1, 1];

/**
 * Creates the hatched material used on the exposed principal planes of a
 * cutaway ellipsoid. CircleGeometry UVs keep the stripes horizontal on each
 * disc without adding extra geometry.
 * @param {object} elementProperty - Atom and ring colours for the element
 * @param {object} options - ORTEP rendering options
 * @returns {THREE.MeshStandardMaterial} Hatched cutaway-plane material
 */
export function createCutawayPlaneMaterial(elementProperty, options) {
    const stripeColor = new THREE.Color(elementProperty.atomColor);
    const stripeCount = Math.max(1, options.atomCutawayStripeCount);
    const stripeHalfWidth = THREE.MathUtils.clamp(
        options.atomCutawayStripeWidth,
        0.01,
        1,
    ) / 2;
    const material = new THREE.MeshStandardMaterial({
        color: elementProperty.ringColor,
        roughness: options.atomColorRoughness,
        metalness: options.atomColorMetalness,
        side: THREE.DoubleSide,
    });

    material.userData.cutawayStripes = {
        color: stripeColor,
        count: stripeCount,
        width: stripeHalfWidth * 2,
    };
    material.onBeforeCompile = shader => {
        shader.uniforms.cutawayStripeColor = { value: stripeColor };
        shader.uniforms.cutawayStripeCount = { value: stripeCount };
        shader.uniforms.cutawayStripeHalfWidth = { value: stripeHalfWidth };
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <uv_pars_vertex>',
                '#include <uv_pars_vertex>\nvarying vec2 vCutawayUv;',
            )
            .replace(
                '#include <uv_vertex>',
                '#include <uv_vertex>\nvCutawayUv = uv;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                '#include <common>\n' +
                'varying vec2 vCutawayUv;\n' +
                'uniform vec3 cutawayStripeColor;\n' +
                'uniform float cutawayStripeCount;\n' +
                'uniform float cutawayStripeHalfWidth;',
            )
            .replace(
                '#include <color_fragment>',
                '#include <color_fragment>\n' +
                'float cutawayStripeCoordinate = vCutawayUv.y * cutawayStripeCount;\n' +
                'float cutawayStripePhase = fract(cutawayStripeCoordinate);\n' +
                'float cutawayStripeDistance = abs(cutawayStripePhase - 0.5);\n' +
                'float cutawayStripeEdge = max(fwidth(cutawayStripeCoordinate), 0.001);\n' +
                'float cutawayStripeMask = 1.0 - smoothstep(\n' +
                '    cutawayStripeHalfWidth - cutawayStripeEdge,\n' +
                '    cutawayStripeHalfWidth + cutawayStripeEdge,\n' +
                '    cutawayStripeDistance\n' +
                ');\n' +
                'diffuseColor.rgb = mix(\n' +
                '    diffuseColor.rgb, cutawayStripeColor, cutawayStripeMask\n' +
                ');',
            );
    };
    material.customProgramCacheKey = () => 'cutaway-horizontal-stripes-v1';

    return material;
}

/**
 * Creates the element-coloured hatch material for the three principal-plane
 * faces in the publication-style 2D renderer.
 * @param {object} options - ORTEP rendering options
 * @param {THREE.ColorRepresentation} lineColor - Element colour for hatch lines
 * @returns {THREE.MeshBasicMaterial} Hatched 2D plot material
 */
export function create2DPlotHatchMaterial(options, lineColor = options.plot2DLineColor) {
    const stripeColor = new THREE.Color(lineColor);
    const stripeCount = Math.max(1, options.plot2DStripeCount);
    const stripeHalfWidth = THREE.MathUtils.clamp(
        options.plot2DStripeWidth,
        0.01,
        1,
    ) / 2;
    const material = new THREE.MeshBasicMaterial({
        color: options.plot2DAtomColor,
        side: THREE.DoubleSide,
    });

    material.userData.plot2DHatch = {
        color: stripeColor,
        count: stripeCount,
        width: stripeHalfWidth * 2,
    };
    material.onBeforeCompile = shader => {
        shader.uniforms.plot2DStripeColor = { value: stripeColor };
        shader.uniforms.plot2DStripeCount = { value: stripeCount };
        shader.uniforms.plot2DStripeHalfWidth = { value: stripeHalfWidth };
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <uv_pars_vertex>',
                '#include <uv_pars_vertex>\nvarying vec2 vPlot2DUv;',
            )
            .replace(
                '#include <uv_vertex>',
                '#include <uv_vertex>\nvPlot2DUv = uv;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                '#include <common>\n' +
                'varying vec2 vPlot2DUv;\n' +
                'uniform vec3 plot2DStripeColor;\n' +
                'uniform float plot2DStripeCount;\n' +
                'uniform float plot2DStripeHalfWidth;',
            )
            .replace(
                '#include <color_fragment>',
                '#include <color_fragment>\n' +
                'float plot2DStripeCoordinate = vPlot2DUv.y * plot2DStripeCount;\n' +
                'float plot2DStripePhase = fract(plot2DStripeCoordinate);\n' +
                'float plot2DStripeDistance = abs(plot2DStripePhase - 0.5);\n' +
                'float plot2DStripeEdge = max(fwidth(plot2DStripeCoordinate), 0.001);\n' +
                'float plot2DStripeMask = 1.0 - smoothstep(\n' +
                '    plot2DStripeHalfWidth - plot2DStripeEdge,\n' +
                '    plot2DStripeHalfWidth + plot2DStripeEdge,\n' +
                '    plot2DStripeDistance\n' +
                ');\n' +
                'diffuseColor.rgb = mix(\n' +
                '    diffuseColor.rgb, plot2DStripeColor, plot2DStripeMask\n' +
                ');',
            );
    };
    material.customProgramCacheKey = () => '2d-plot-curved-octant-hatch-v1';

    return material;
}

/**
 * Reflects the shared base octant into a requested sign combination.
 * @param {THREE.Object3D} object - Octant mesh to transform
 * @param {number[]} signs - Requested signs for the local X, Y and Z axes
 */
function setOctantTransform(object, signs) {
    object.scale.set(
        signs[0] / BASE_OCTANT_SIGNS[0],
        signs[1] / BASE_OCTANT_SIGNS[1],
        signs[2] / BASE_OCTANT_SIGNS[2],
    );
}

/**
 * Rotates a disc's UV coordinates around its centre so each principal plane
 * can use a distinct hatch direction with the same stripe material.
 * @param {THREE.BufferGeometry} geometry - Disc geometry whose UVs to rotate
 * @param {number} angle - UV rotation in radians
 */
function rotateCutawayUVs(geometry, angle) {
    const uv = geometry.getAttribute('uv');
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let index = 0; index < uv.count; index++) {
        const u = uv.getX(index) - 0.5;
        const v = uv.getY(index) - 0.5;
        uv.setXY(
            index,
            u * cos - v * sin + 0.5,
            u * sin + v * cos + 0.5,
        );
    }
    uv.needsUpdate = true;
}

/**
 * Examines a THREE.Object3D and its children for NaN values in position, rotation, scale, and matrix properties.
 * @param {THREE.Object3D} object3D - The 3D object to check for NaN values
 * @returns {object} Count of NaN values found by property type (position, rotation, scale, matrix)
 */
function checkForNaN(object3D) {
    const nanCounts = {
        position: 0,
        rotation: 0,
        scale: 0,
        matrix: 0,
    };

    /**
     * Inner function to travel through objects children iteratively
     * @param {THREE.Object3D} obj - The 3D object to check for NaN values
     */
    function checkObject(obj) {
        const position = obj.position;
        const rotation = obj.rotation;
        const scale = obj.scale;
        const matrix = obj.matrix.elements;

        if ([position.x, position.y, position.z].some(isNaN)) {
            console.log('pos');
            console.log(position);
            console.log(obj.userData);
            nanCounts.position++;
        }
        if ([rotation.x, rotation.y, rotation.z].some(isNaN)) {
            nanCounts.rotation++;
            console.log('rot');
            console.log(rotation);
            console.log(obj.userData);
        }
        if ([scale.x, scale.y, scale.z].some(isNaN)) {
            console.log('scale');
            console.log(scale);
            console.log(obj.userData);
            nanCounts.scale++;
        }
        if (matrix.some(isNaN)) {
            nanCounts.matrix++;
            console.log('matrix');
            console.log(matrix);
            console.log(obj.userData);
        }

        for (const child of obj.children) {
            checkObject(child);
        }
    }

    checkObject(object3D);
    return nanCounts;
}

/**
 * Calculates the transformation matrix for ellipsoid visualization from anisotropic displacement parameters.
 * @param {UAnisoADP} uAnisoADPobj - Anisotropic displacement parameters object
 * @param {UnitCell} unitCell - Unit cell object containing crystallographic parameters
 * @returns {THREE.Matrix4} Transformation matrix for ellipsoid visualization
 */
export function getThreeEllipsoidMatrix(uAnisoADPobj, unitCell) {
    const transformationMatrix = uAnisoADPobj.getEllipsoidMatrix(unitCell);
    const matrixArray = transformationMatrix.toArray();

    return new THREE.Matrix4(
        matrixArray[0][0], matrixArray[0][1], matrixArray[0][2], 0,
        matrixArray[1][0], matrixArray[1][1], matrixArray[1][2], 0,
        matrixArray[2][0], matrixArray[2][1], matrixArray[2][2], 0,
        0, 0, 0, 1,
    );
}

/**
 * Calculates transformation matrix for bond placement between two points.
 * @param {THREE.Vector3} position1 - Start position
 * @param {THREE.Vector3} position2 - End position
 * @returns {THREE.Matrix4} Transformation matrix
 */
export function calcBondTransform(position1, position2) {
    const direction = position2.clone().sub(position1);
    const length = direction.length();
    if (length === 0.0) {
        throw new Error('Error in ORTEP Bond Creation. Trying to create a zero length bond.');
    }
    const unit = direction.divideScalar(length);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const rotationAxis = new THREE.Vector3().crossVectors(unit, yAxis);
    const angle = -Math.acos(unit.dot(yAxis));

    return new THREE.Matrix4()
        .makeScale(1, length, 1)
        .premultiply(new THREE.Matrix4().makeRotationAxis(
            rotationAxis.normalize(),
            angle,
        ))
        .setPosition(
            position1.clone().add(position2).multiplyScalar(0.5),
        );
}

/**
 * Moves bond endpoints from atom centres to their rendered surfaces.
 * @param {THREE.Vector3} position1 - First atom centre
 * @param {THREE.Vector3} position2 - Second atom centre
 * @param {ORTEPAtom} atom1 - Rendered first atom
 * @param {ORTEPAtom} atom2 - Rendered second atom
 * @returns {THREE.Vector3[]} Trimmed start and end positions
 */
export function trimBondToAtomSurfaces(position1, position2, atom1, atom2) {
    const start = position1.clone();
    const end = position2.clone();
    const direction = end.clone().sub(start);
    const totalLength = direction.length();
    if (totalLength === 0 || !atom1 || !atom2) {
        return [start, end];
    }

    direction.divideScalar(totalLength);
    let startTrim = atom1.getSurfaceDistanceAlong(direction);
    let endTrim = atom2.getSurfaceDistanceAlong(direction.clone().negate());
    startTrim = Number.isFinite(startTrim) && startTrim > 0 ? startTrim : 0;
    endTrim = Number.isFinite(endTrim) && endTrim > 0 ? endTrim : 0;
    const totalTrim = startTrim + endTrim;

    if (totalTrim >= totalLength) {
        const trimScale = (totalLength * (1 - Number.EPSILON)) / totalTrim;
        startTrim *= trimScale;
        endTrim *= trimScale;
    }

    start.addScaledVector(direction, startTrim);
    end.addScaledVector(direction, -endTrim);
    return [start, end];
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
    constructor(options = {}) {
        const safeOptions = options || {};
        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: {
                ...defaultSettings.elementProperties,
                ...(safeOptions.elementProperties || {}),
            },
        };

        this.scaling = 1.5384;
        this.geometries = {};
        this.materials = {};
        this.elementMaterials = {};

        this.initializeGeometries();
        this.initializeMaterials();
    }

    /**
     * Creates and caches base geometries for atoms, ADP rings, bonds and H-bonds.
     * @private
     */
    initializeGeometries() {
        // Base atom geometry
        this.geometries.atom = new THREE.IcosahedronGeometry(
            this.scaling,
            this.options.atomDetail,
        );

        if (this.options.atomEllipsoidStyle === 'cutout' ||
            this.options.renderStyle === '2d') {
            const octantSections = Math.max(3, 2 ** this.options.atomDetail + 2);
            this.geometries.atomOctant = new THREE.SphereGeometry(
                this.scaling,
                octantSections,
                octantSections,
                0,
                Math.PI / 2,
                0,
                Math.PI / 2,
            );
            this.geometries.emptyAtom = new THREE.BufferGeometry();
            if (this.options.atomEllipsoidStyle === 'cutout' ||
                this.options.renderStyle === '2d') {
                this.geometries.cutawayPlanes = this.createCutawayPlanes(octantSections * 4);
            }
        }

        // ADP ring geometry
        this.geometries.adpRing = this.createADPHalfTorus();

        // Bond geometry
        this.geometries.bond = new THREE.CylinderGeometry(
            this.options.bondRadius,
            this.options.bondRadius,
            0.98,
            this.options.bondSections,
            1,
            true,
        );

        // H-bond geometry
        this.geometries.hbond = new THREE.CylinderGeometry(
            this.options.hbondRadius,
            this.options.hbondRadius,
            0.98,
            this.options.bondSections,
            1,
            true,
        );
    }

    /**
     * Creates and caches base materials for bonds and H-bonds.
     * @private
     */
    initializeMaterials() {
        if (this.options.renderStyle === '2d') {
            this.materials.bond = new THREE.MeshBasicMaterial({
                color: this.options.plot2DBondColor,
            });
            this.materials.openBond = new THREE.MeshBasicMaterial({
                color: this.options.plot2DAtomColor,
            });
            this.materials.openBondOutline = new THREE.MeshBasicMaterial({
                color: this.options.plot2DBondColor,
                side: THREE.BackSide,
            });
            this.materials.hbond = new THREE.MeshBasicMaterial({
                color: this.options.plot2DLineColor,
            });
            return;
        }

        // Base bond material
        this.materials.bond = new THREE.MeshStandardMaterial({
            color: this.options.bondColor,
            roughness: this.options.bondColorRoughness,
            metalness: this.options.bondColorMetalness,
        });

        // Base H-bond material
        this.materials.hbond = new THREE.MeshStandardMaterial({
            color: this.options.hbondColor,
            roughness: this.options.hbondColorRoughness,
            metalness: this.options.hbondColorMetalness,
        });
    }

    /**
     * Validates that properties exist for given element type.
     * @param {string} elementType - Chemical element symbol
     * @throws {Error} If element properties not found
     */
    validateElementType(elementType) {
        if (!this.options.elementProperties[elementType]) {
            throw new Error(
                `Unknown element type: ${elementType}. ` +
                'Please ensure element properties are defined.' +
                'Pass the type settings as custom options, if' +
                'they are element from periodic table',
            );
        }
    }

    /**
     * Gets or creates cached materials for given atom type.
     * @param {string} atomType - Chemical element symbol
     * @returns {[THREE.Material, THREE.Material]} Array containing [atomMaterial, ringMaterial]
     */
    getAtomMaterials(atomType) {
        let elementType = atomType;
        if (!this.options.elementProperties[elementType]) {
            elementType = inferElementFromLabel(atomType);
        }
        this.validateElementType(elementType);

        if (this.options.renderStyle === '2d') {
            const plotKey = `${elementType}_2d_materials`;
            if (!this.elementMaterials[plotKey]) {
                const elementProperty = this.options.elementProperties[elementType];
                const elementLineColor = ['H', 'D'].includes(elementType) ?
                    this.options.plot2DLineColor : elementProperty.atomColor;
                const outlineMaterial = new THREE.MeshBasicMaterial({
                    color: elementLineColor,
                    side: THREE.BackSide,
                });
                const atomMaterial = new THREE.MeshBasicMaterial({
                    color: this.options.plot2DAtomColor,
                });
                atomMaterial.userData.plot2DOutlineMaterial = outlineMaterial;
                atomMaterial.userData.plot2DOutlineScale = this.options.plot2DOutlineScale;
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: elementLineColor,
                });
                const hatchMaterial = create2DPlotHatchMaterial(
                    this.options,
                    elementLineColor,
                );
                this.elementMaterials[plotKey] = [
                    atomMaterial,
                    ringMaterial,
                    hatchMaterial,
                    outlineMaterial,
                ];
            }
            return this.elementMaterials[plotKey];
        }

        const key = `${elementType}_materials`;
        if (!this.elementMaterials[key]) {
            const elementProperty = this.options.elementProperties[elementType];

            const atomMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.atomColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness,
            });

            const ringMaterial = new THREE.MeshStandardMaterial({
                color: elementProperty.ringColor,
                roughness: this.options.atomColorRoughness,
                metalness: this.options.atomColorMetalness,
            });

            this.elementMaterials[key] = [atomMaterial, ringMaterial];
            if (this.options.atomEllipsoidStyle === 'cutout') {
                this.elementMaterials[key].push(
                    createCutawayPlaneMaterial(elementProperty, this.options),
                );
            }
        }

        return this.elementMaterials[key];
    }

    /**
     * Creates geometry for anisotropic displacement parameter visualisation,
     * by removing the inner vertices of a torus that would be obstructed by
     * the atom sphere anyway.
     * @private
     * @returns {THREE.BufferGeometry} Half torus geometry for ADP visualisation
     */
    createADPHalfTorus() {
        const fullRing = new THREE.TorusGeometry(
            this.scaling * this.options.atomADPRingWidthFactor,
            this.options.atomADPRingHeight,
            this.options.atomADPInnerSections,
            this.options.atomADPRingSections,
        );

        const positions = fullRing.attributes.position.array;
        const indices = fullRing.index.array;
        const newPositions = [];
        const newIndices = [];
        const keptIndices = new Set();

        // First pass: identify vertices to keep
        for (let i = 0; i < indices.length; i += 3) {
            const idx1 = indices[i] * 3;
            const idx2 = indices[i + 1] * 3;
            const idx3 = indices[i + 2] * 3;

            const vertices = [idx1, idx2, idx3].map(idx => ({
                index: idx / 3,
                distance: Math.sqrt(
                    positions[idx] * positions[idx] +
                    positions[idx + 1] * positions[idx + 1] +
                    positions[idx + 2] * positions[idx + 2],
                ),
            }));

            if (vertices.some(v => v.distance >= this.scaling)) {
                vertices.forEach(v => keptIndices.add(indices[i + v.index % 3]));
            }
        }

        // Second pass: create new vertex array and index mapping
        const indexMap = new Map();
        let newIndex = 0;

        keptIndices.forEach(oldIndex => {
            const idx = oldIndex * 3;
            newPositions.push(
                positions[idx],
                positions[idx + 1],
                positions[idx + 2],
            );
            indexMap.set(oldIndex, newIndex++);
        });

        // Third pass: create new index array using mapped indices
        for (let i = 0; i < indices.length; i += 3) {
            if (keptIndices.has(indices[i]) &&
                keptIndices.has(indices[i + 1]) &&
                keptIndices.has(indices[i + 2])) {
                newIndices.push(
                    indexMap.get(indices[i]),
                    indexMap.get(indices[i + 1]),
                    indexMap.get(indices[i + 2]),
                );
            }
        }

        const baseADPRing = new THREE.BufferGeometry();
        baseADPRing.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
        baseADPRing.setIndex(newIndices);
        baseADPRing.computeVertexNormals();
        baseADPRing.rotateX(0.5 * Math.PI);

        fullRing.dispose();
        return baseADPRing;
    }

    /**
     * Creates the three intersecting principal planes exposed by a missing octant.
     * @param {number} sections - Number of radial sections in each disc
     * @returns {THREE.BufferGeometry} Merged XY, XZ and YZ discs
     */
    createCutawayPlanes(sections) {
        const xyPlane = new THREE.CircleGeometry(this.scaling, sections);
        const xzPlane = new THREE.CircleGeometry(this.scaling, sections);
        const yzPlane = new THREE.CircleGeometry(this.scaling, sections);

        // Use each principal direction exactly once: X on XY, Z on XZ,
        // and Y on YZ. A quarter turn makes the latter two follow their
        // second local disc axis rather than the default first axis.
        rotateCutawayUVs(xzPlane, Math.PI / 2);
        rotateCutawayUVs(yzPlane, Math.PI / 2);

        xzPlane.rotateX(Math.PI / 2);
        yzPlane.rotateY(Math.PI / 2);

        const planes = mergeGeometries([xyPlane, xzPlane, yzPlane]);
        xyPlane.dispose();
        xzPlane.dispose();
        yzPlane.dispose();
        return planes;
    }

    /**
     * Cleans up all cached resources.
     */
    dispose() {
        Object.values(this.geometries).forEach(geometry => geometry.dispose());
        Object.values(this.materials).forEach(material => material.dispose());
        Object.values(this.elementMaterials).forEach(materials => {
            materials.forEach(material => material.dispose());
        });
    }
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
    constructor(crystalStructure, options = {}) {
        const safeOptions = options || {};

        // Handle deep merging of elementProperties
        const mergedElementProperties = { ...defaultSettings.elementProperties };
        if (safeOptions.elementProperties) {
            Object.entries(safeOptions.elementProperties).forEach(([element, props]) => {
                mergedElementProperties[element] = {
                    ...mergedElementProperties[element],
                    ...props,
                };
            });
        }

        this.options = {
            ...defaultSettings,
            ...safeOptions,
            elementProperties: mergedElementProperties,
        };

        this.crystalStructure = crystalStructure;
        this.cache = new GeometryMaterialCache(this.options);

        this.createStructure();
    }
    /**
     * Creates 3D representations of atoms, bonds and H-bonds.
     * @private
     */
    createStructure() {
        this.atoms3D = [];
        this.bonds3D = [];
        this.hBonds3D = [];

        const atomIds = new Set();
        const atomsById = new Map();
        for (const atom of this.crystalStructure.atoms) {
            const atomId = atom.uniqueId;
            atomIds.add(atomId);
            // getAtomById historically returns the first matching atom.
            if (!atomsById.has(atomId)) {
                atomsById.set(atomId, atom);
            }
        }
        const cartesianPositions = new Map();
        const renderedAtomsById = new Map();
        const getCartesianPosition = atomId => {
            let position = cartesianPositions.get(atomId);
            if (!position) {
                const atom = atomsById.get(atomId);
                const cartesian = atom.position.toCartesian(this.crystalStructure.cell);
                position = new THREE.Vector3(cartesian.x, cartesian.y, cartesian.z);
                cartesianPositions.set(atomId, position);
            }
            return position;
        };

        // Create atoms
        for (const atom of this.crystalStructure.atoms) {
            const [atomMaterial, ringMaterial, cutawayMaterial] =
                this.cache.getAtomMaterials(atom.atomType);

            let atom3D;
            if (atom.adp instanceof UAnisoADP) {
                atom3D = new ORTEPAniAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                    this.cache.geometries.adpRing,
                    ringMaterial,
                    this.options.atomEllipsoidStyle === 'cutout' ||
                        this.options.renderStyle === '2d' ? {
                            octantGeometry: this.cache.geometries.atomOctant,
                            emptyGeometry: this.cache.geometries.emptyAtom,
                            planeGeometry: this.cache.geometries.cutawayPlanes,
                            planeMaterial: cutawayMaterial,
                            hysteresis: this.options.atomCutawayHysteresis,
                        } : null,
                );
            } else if (atom.adp instanceof UIsoADP) {
                atom3D = new ORTEPIsoAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                );
            } else {
                atom3D = new ORTEPConstantAtom(
                    atom,
                    this.crystalStructure.cell,
                    this.cache.geometries.atom,
                    atomMaterial,
                    this.options,
                );
            }
            this.atoms3D.push(atom3D);
            if (!renderedAtomsById.has(atom.uniqueId)) {
                renderedAtomsById.set(atom.uniqueId, atom3D);
            }
        }

        const trimBondsToSurfaces = this.options.atomEllipsoidStyle === 'cutout' ||
            this.options.renderStyle === '2d';
        const getRenderedAtom = trimBondsToSurfaces ?
            atomId => renderedAtomsById.get(atomId) : null;

        // Handle regular bonds
        // Only draw bonds where both atoms are present in the current structure
        const drawnBonds = this.crystalStructure.bonds
            .filter(bond => {
                const atom1Present = atomIds.has(bond.atom1Id);
                const atom2Present = atomIds.has(bond.atom2Id);
                return atom1Present && atom2Present;
            });

        for (const bond of drawnBonds) {
            try {
                const atom1 = atomsById.get(bond.atom1Id);
                const atom2 = atomsById.get(bond.atom2Id);
                const isOpenDisorderBond = this.options.renderStyle === '2d' &&
                    [atom1, atom2].some(atom => Number(atom.disorderGroup) > 1);
                this.bonds3D.push(new ORTEPBond(
                    bond,
                    this.crystalStructure,
                    this.cache.geometries.bond,
                    isOpenDisorderBond ?
                        this.cache.materials.openBond : this.cache.materials.bond,
                    getCartesianPosition,
                    getRenderedAtom,
                    isOpenDisorderBond ? {
                        outlineMaterial: this.cache.materials.openBondOutline,
                        innerScale: this.options.plot2DOpenBondInnerScale,
                    } : null,
                ));
            } catch (e) {
                if (e.message !== 'Error in ORTEP Bond Creation. Trying to create a zero length bond.') {
                    throw e;
                }
            }
        }

        // Handle hydrogen bonds
        // Only draw h-bonds where all atoms are present in the current structure
        const drawnHBonds = this.crystalStructure.hBonds
            .filter(hBond => {
                const present = atomIds.has(hBond.donorAtomId) &&
                    atomIds.has(hBond.acceptorAtomId) &&
                    (hBond.hydrogenAtomId ? atomIds.has(hBond.hydrogenAtomId) : true);
                return present;
            });

        for (const hbond of drawnHBonds) {
            try {
                this.hBonds3D.push(new ORTEPHBond(
                    hbond,
                    this.crystalStructure,
                    this.cache.geometries.hbond,
                    this.cache.materials.hbond,
                    this.options.hbondDashSegmentLength,
                    this.options.hbondDashFraction,
                    getCartesianPosition,
                    getRenderedAtom,
                ));
            } catch (e) {
                if (e.message !== 'Error in ORTEP Bond Creation. Trying to create a zero length bond.') {
                    throw e;
                }
            }
        }
    }

    /**
     * Returns a THREE.Group containing all visualization objects (atoms, bonds, H-bonds).
     * @returns {THREE.Group} Group containing all structure objects ready for rendering
     */
    getGroup() {
        const group = new THREE.Group();

        for (const atom3D of this.atoms3D) {
            group.add(atom3D);
        }

        for (const bond3D of this.bonds3D) {
            group.add(bond3D);
        }

        for (const hBond3D of this.hBonds3D) {
            group.add(hBond3D);
        }
        checkForNaN(group);
        group.cutawayAtoms = this.atoms3D.filter(atom => atom.isCutaway);
        group.cameraFacingAtoms = group.cutawayAtoms;

        return group;
    }

    /**
     * Cleans up all resources.
     */
    dispose() {
        this.cache.dispose();
    }
}

/**
 * Base class for selectable THREE.js mesh objects with selection visualization capabilities.
 * @abstract
 * @augments THREE.Mesh
 */
export class ORTEPObject extends THREE.Mesh {
    /**
     * Creates a new selectable object.
     * @param {THREE.BufferGeometry} geometry - Object geometry
     * @param {THREE.Material} material - Object material
     * @throws {TypeError} If instantiated directly (abstract class)
     */
    constructor(geometry, material) {
        if (new.target === ORTEPObject) {
            throw new TypeError('ORTEPObject is an abstract class and cannot be instantiated directly.');
        }
        super(geometry, material);
        this._selectionColor = null;
        this.marker = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format
     * @returns {THREE.Material} Selection highlight material
     */
    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide,
        });
    }

    /**
     * Handles object selection, applying highlighting and creating selection markers.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options
     */
    select(color, options) {
        this._selectionColor = color;

        const highlightMaterial = this.material.clone();
        highlightMaterial.emissive?.setHex(options.selection.highlightEmissive);
        this.originalMaterial = this.material;
        this.material = highlightMaterial;

        const marker = this.createSelectionMarker(color, options);
        this.add(marker);
        this.marker = marker;
    }

    /**
     * Handles object deselection, removing highlighting and markers.
     */
    deselect() {
        this._selectionColor = null;
        this.removeSelectionMarker();
    }

    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} _color - Selection color in hex format
     * @param {object} _options - Selection options
     */
    createSelectionMarker(_color, _options) {
        throw new Error('createSelectionMarker needs to be implemented in a subclass');
    }

    /**
     * Removes selection marker and restores original material.
     * @private
     */
    removeSelectionMarker() {
        if (this.marker) {
            this.remove(this.marker);
            this.marker.geometry?.dispose();
            this.marker.material?.dispose();
            this.marker = null;
        }

        if (this.originalMaterial) {
            this.material.dispose();
            this.material = this.originalMaterial;
            this.originalMaterial = null;
        }
    }

    /**
     * Cleans up resources.
     */
    dispose() {
        this.deselect();
        this.geometry?.dispose();
        this.material?.dispose();
    }
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
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(baseAtom, atomMaterial);
        this.updateSurfaceRadius();
        const plot2DOutlineMaterial = atomMaterial.userData.plot2DOutlineMaterial;
        if (plot2DOutlineMaterial) {
            const outline = new THREE.Mesh(baseAtom, plot2DOutlineMaterial);
            outline.scale.multiplyScalar(atomMaterial.userData.plot2DOutlineScale);
            outline.userData = { selectable: false, type: '2d-atom-outline' };
            this.add(outline);
            this.plot2DOutline = outline;
        }
        const position = new THREE.Vector3(...atom.position.toCartesian(unitCell));

        this.position.copy(position);
        this.userData = {
            type: 'atom',
            atomData: atom,
            selectable: true,
        };
    }

    /**
     * Updates the untransformed radius used for bond-surface intersections.
     * @private
     */
    updateSurfaceRadius() {
        if (!this.geometry.boundingSphere) {
            this.geometry.computeBoundingSphere();
        }
        this.surfaceRadius = this.geometry.boundingSphere?.radius || 0;
    }

    /**
     * Finds the distance from this atom's centre to its rendered surface in a
     * structure-space direction.
     * @param {THREE.Vector3} direction - Direction from the atom centre
     * @returns {number} Distance to the atom surface
     */
    getSurfaceDistanceAlong(direction) {
        if (direction.lengthSq() === 0 || this.surfaceRadius === 0) {
            return 0;
        }

        this.updateMatrix();
        const inverseTransform = this.matrix.clone().setPosition(0, 0, 0).invert();
        const localDirection = direction.clone().normalize().applyMatrix4(inverseTransform);
        const localLength = localDirection.length();
        return Number.isFinite(localLength) && localLength > 0 ?
            this.surfaceRadius / localLength : 0;
    }

    /**
     * Creates visual marker for selection of atoms.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Mesh} Selection marker mesh
     */
    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry,
            this.createSelectionMaterial(color),
        );
        outlineMesh.scale.multiplyScalar(options.selection.markerMult);
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
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
     * @param {THREE.BufferGeometry} baseADPRing - ADP ring geometry
     * @param {THREE.Material} ADPRingMaterial - ADP ring material
     * @param {object|null} cutaway - Optional cutaway geometries and settings
     */
    constructor(
        atom,
        unitCell,
        baseAtom,
        atomMaterial,
        baseADPRing,
        ADPRingMaterial,
        cutaway = null,
    ) {
        super(atom, unitCell, baseAtom, atomMaterial);
        if ([atom.adp.u11, atom.adp.u3, atom.adp.u33].some(val => val <= 0)) {
            this.geometry = new THREE.TetrahedronGeometry(0.8);
            if (this.plot2DOutline) {
                this.plot2DOutline.geometry = this.geometry;
            }
            this.updateSurfaceRadius();
        } else {
            const ellipsoidMatrix = getThreeEllipsoidMatrix(atom.adp, unitCell);
            if (ellipsoidMatrix.toArray().includes(NaN)) {
                this.geometry = new THREE.TetrahedronGeometry(0.8);
                if (this.plot2DOutline) {
                    this.plot2DOutline.geometry = this.geometry;
                }
                this.updateSurfaceRadius();
            } else {
                if (cutaway) {
                    this.setupCutaway(cutaway, atomMaterial);
                }
                for (const matrix of this.adpRingMatrices) {
                    const ringMesh = new THREE.Mesh(baseADPRing, ADPRingMaterial);
                    ringMesh.applyMatrix4(matrix);
                    ringMesh.userData.selectable = false;
                    this.add(ringMesh);
                }

                this.applyMatrix4(ellipsoidMatrix);
            }
        }

        const position = new THREE.Vector3(...atom.position.toCartesian(unitCell));
        this.position.copy(position);
        this.userData = {
            type: 'atom',
            atomData: atom,
            selectable: true,
        };
    }

    /**
     * Replaces the solid shell with eight shared-geometry octant meshes and
     * adds the three internal principal planes.
     * @param {object} cutaway - Cutaway geometries and settings
     * @param {THREE.Material} atomMaterial - Material for the outer shell
     * @private
     */
    setupCutaway(cutaway, atomMaterial) {
        this.geometry = cutaway.emptyGeometry;
        this.isCutaway = true;
        this.cutawayHysteresis = cutaway.hysteresis;
        this.cutawaySigns = [1, 1, 1];
        this.cutawayViewDirection = new THREE.Vector3();
        this.cutawayWorldPosition = new THREE.Vector3();
        this.cutawayInverseRotation = new THREE.Matrix4();
        this.cutawayOctants = OCTANT_SIGNS.map((signs, index) => {
            const octant = new THREE.Mesh(cutaway.octantGeometry, atomMaterial);
            setOctantTransform(octant, signs);
            octant.userData = {
                selectable: false,
                type: 'ellipsoid-octant',
                octantIndex: index,
            };
            this.add(octant);
            return octant;
        });

        if (this.plot2DOutline) {
            this.remove(this.plot2DOutline);
            const outlineMaterial = atomMaterial.userData.plot2DOutlineMaterial;
            const outlineScale = atomMaterial.userData.plot2DOutlineScale;
            this.cutawayOutlines = OCTANT_SIGNS.map((signs, index) => {
                const outline = new THREE.Mesh(cutaway.octantGeometry, outlineMaterial);
                setOctantTransform(outline, signs);
                outline.scale.multiplyScalar(outlineScale);
                outline.userData = {
                    selectable: false,
                    type: '2d-ellipsoid-outline',
                    octantIndex: index,
                };
                this.add(outline);
                return outline;
            });
            this.plot2DOutline = null;
        }

        const planes = new THREE.Mesh(cutaway.planeGeometry, cutaway.planeMaterial);
        planes.userData = { selectable: false, type: 'ellipsoid-cutaway-planes' };
        this.add(planes);
        this.cutawayPlanes = planes;
        this.setMissingOctant(7);
    }

    /**
     * Finds the local ellipsoid octant facing the active camera.
     * @param {THREE.Camera} camera - Active viewer camera
     * @returns {number} Camera-facing octant index
     * @private
     */
    getCameraFacingOctant(camera) {
        const viewDirection = this.cutawayViewDirection;
        if (camera.isPerspectiveCamera) {
            camera.getWorldPosition(viewDirection);
            this.getWorldPosition(this.cutawayWorldPosition);
            viewDirection.sub(this.cutawayWorldPosition);
        } else {
            camera.getWorldDirection(viewDirection).negate();
        }
        this.cutawayInverseRotation.extractRotation(this.matrixWorld).invert();
        viewDirection.transformDirection(this.cutawayInverseRotation);

        const components = [viewDirection.x, viewDirection.y, viewDirection.z];
        components.forEach((component, axis) => {
            if (Math.abs(component) > this.cutawayHysteresis) {
                this.cutawaySigns[axis] = component < 0 ? -1 : 1;
            }
        });

        return (this.cutawaySigns[0] > 0 ? 4 : 0) +
            (this.cutawaySigns[1] > 0 ? 2 : 0) +
            (this.cutawaySigns[2] > 0 ? 1 : 0);
    }

    /**
     * Selects the missing local octant from the current camera direction.
     * @param {THREE.Camera} camera - Active viewer camera
     */
    updateCutawayOctant(camera) {
        if (!this.isCutaway) {
            return;
        }

        this.setMissingOctant(this.getCameraFacingOctant(camera));
    }

    /**
     * Shows every surface octant except the selected one.
     * @param {number} missingIndex - Index of the octant to hide
     * @private
     */
    setMissingOctant(missingIndex) {
        if (missingIndex === this.missingOctantIndex) {
            return;
        }
        this.missingOctantIndex = missingIndex;
        this.cutawayOctants.forEach((octant, index) => {
            octant.visible = index !== missingIndex;
        });
        this.cutawayOutlines?.forEach((outline, index) => {
            outline.visible = index !== missingIndex;
        });
        this.marker?.cutawayOctants?.forEach((octant, index) => {
            octant.visible = index !== missingIndex;
        });
    }

    createSelectionMarker(color, options) {
        if (!this.isCutaway) {
            return super.createSelectionMarker(color, options);
        }

        const marker = new THREE.Group();
        const markerMaterial = this.createSelectionMaterial(color);
        marker.cutawayOctants = OCTANT_SIGNS.map((signs, index) => {
            const octant = new THREE.Mesh(this.cutawayOctants[0].geometry, markerMaterial);
            setOctantTransform(octant, signs);
            octant.visible = index !== this.missingOctantIndex;
            octant.userData.selectable = false;
            marker.add(octant);
            return octant;
        });
        // ORTEPObject.removeSelectionMarker disposes this shared marker material.
        marker.material = markerMaterial;
        marker.scale.multiplyScalar(options.selection.markerMult);
        marker.userData.selectable = false;
        return marker;
    }

    select(color, options) {
        super.select(color, options);
        this.cutawayOctants?.forEach(octant => {
            octant.material = this.material;
        });
    }

    deselect() {
        super.deselect();
        this.cutawayOctants?.forEach(octant => {
            octant.material = this.material;
        });
    }

    /**
     * Raycasts the visible cutaway parts while returning this selectable atom
     * as the hit object.
     * @param {THREE.Raycaster} raycaster - Raycaster performing the hit test
     * @param {object[]} intersects - Array receiving ray intersections
     * @returns {boolean|undefined} False for cutaways to skip duplicate child raycasts
     */
    raycast(raycaster, intersects) {
        if (!this.isCutaway) {
            return super.raycast(raycaster, intersects);
        }

        const childIntersects = [];
        const raycastMeshes = [
            ...this.cutawayOctants.filter(octant => octant.visible),
            this.cutawayPlanes,
        ];
        raycastMeshes.forEach(mesh => {
            THREE.Mesh.prototype.raycast.call(mesh, raycaster, childIntersects);
        });
        childIntersects.forEach(intersection => {
            intersects.push({ ...intersection, object: this });
        });
        return false;
    }

    /**
     * Provides transformation matrices for positioning ADP rings in the three principal planes.
     * @returns {THREE.Matrix4[]} Array of matrices for the three orthogonal planes
     */
    get adpRingMatrices() {
        return [
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
            new THREE.Matrix4().set(
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, -1.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
            new THREE.Matrix4().set(
                0.0, -1.0, 0.0, 0.0,
                1.0, 0.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ),
        ];
    }
}

/**
 * Class for atoms with isotropic displacement parameters.
 * Shows spherical representation scaled by the isotropic displacement parameter.
 * @augments ORTEPAtom
 */
export class ORTEPIsoAtom extends ORTEPAtom {
    /**
     * Creates a new isotropic atom visualisation.
     * @param {Atom} atom - Input atom data with isotropic displacement parameters
     * @param {UnitCell} unitCell - Unit cell parameters
     * @param {THREE.BufferGeometry} baseAtom - Base atom geometry
     * @param {THREE.Material} atomMaterial - Atom material
     * @throws {Error} If atom lacks isotropic displacement parameters
     */
    constructor(atom, unitCell, baseAtom, atomMaterial) {
        super(atom, unitCell, baseAtom, atomMaterial);
        if (!atom.adp || !('uiso' in atom.adp)) {
            throw new Error('Atom must have isotropic displacement parameters (UIsoADP)');
        }
        if (atom.adp.uiso <= 0.0) {
            this.geometry = new THREE.TetrahedronGeometry(1);
            this.updateSurfaceRadius();
        } else {
            this.scale.multiplyScalar(Math.sqrt(atom.adp.uiso));
        }
    }
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
    constructor(atom, unitCell, baseAtom, atomMaterial, options) {
        super(atom, unitCell, baseAtom, atomMaterial);
        let elementType = atom.atomType;
        try {
            if (!options.elementProperties[elementType]) {
                elementType = inferElementFromLabel(atom.atomType);
            }
        } catch {
            throw new Error(`Element properties not found for atom type: '${atom.atomType}'`);
        }
        this.scale.multiplyScalar(
            options.atomConstantRadiusMultiplier * options.elementProperties[elementType].radius,
        );
    }
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
     * @param {Function} [getCartesianPosition] - Cached atom-position resolver
     * @param {Function} [getRenderedAtom] - Rendered atom resolver for surface trimming
     * @param {object|null} [openStyle] - Optional opaque fill and outline setup
     */
    constructor(
        bond,
        crystalStructure,
        baseBond,
        baseBondMaterial,
        getCartesianPosition = null,
        getRenderedAtom = null,
        openStyle = null,
    ) {
        super(baseBond, baseBondMaterial);
        let atom1position;
        let atom2position;
        if (getCartesianPosition) {
            atom1position = getCartesianPosition(bond.atom1Id);
            atom2position = getCartesianPosition(bond.atom2Id);
        } else {
            const bondAtom1 = crystalStructure.getAtomById(bond.atom1Id);
            const bondAtom2 = crystalStructure.getAtomById(bond.atom2Id);
            atom1position = new THREE.Vector3(...bondAtom1.position.toCartesian(crystalStructure.cell));
            atom2position = new THREE.Vector3(...bondAtom2.position.toCartesian(crystalStructure.cell));
        }
        if (getRenderedAtom) {
            [atom1position, atom2position] = trimBondToAtomSurfaces(
                atom1position,
                atom2position,
                getRenderedAtom(bond.atom1Id),
                getRenderedAtom(bond.atom2Id),
            );
        }
        const bondTransform = calcBondTransform(atom1position, atom2position);

        this.applyMatrix4(bondTransform);
        if (openStyle) {
            const innerScale = THREE.MathUtils.clamp(openStyle.innerScale, 0.05, 0.95);
            this.scale.x *= innerScale;
            this.scale.z *= innerScale;

            const outline = new THREE.Mesh(baseBond, openStyle.outlineMaterial);
            outline.scale.set(1 / innerScale, 1, 1 / innerScale);
            outline.userData = { selectable: false, type: '2d-open-bond-outline' };
            this.add(outline);
            this.openBondOutline = outline;
        }
        this.userData = {
            type: 'bond',
            bondData: bond,
            selectable: true,
            isOpenDisorderBond: Boolean(openStyle),
        };
    }

    /**
     * Creates visual marker for selection of bonds.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Mesh} Selection marker mesh
     */
    createSelectionMarker(color, options) {
        const outlineMesh = new THREE.Mesh(
            this.geometry,
            this.createSelectionMaterial(color),
        );
        outlineMesh.scale.x *= options.selection.bondMarkerMult;
        outlineMesh.scale.z *= options.selection.bondMarkerMult;
        outlineMesh.userData.selectable = false;
        return outlineMesh;
    }
}

/**
 * Abstract base class for grouped objects like dashed hydrogen bonds.
 * Provides selection handling for compound objects composed of multiple meshes.
 * @abstract
 * @augments THREE.Group
 */
export class ORTEPGroupObject extends THREE.Group {
    /**
     * Creates a new group object.
     * @throws {TypeError} If instantiated directly (abstract class)
     */
    constructor() {
        if (new.target === ORTEPGroupObject) {
            throw new TypeError('ORTEPGroupObject is an abstract class and cannot be instantiated directly.');
        }
        super();
        this._selectionColor = null;
        this.marker = null;
    }

    get selectionColor() {
        return this._selectionColor;
    }

    /**
     * Adds objects with raycasting redirection to ensure proper selection handling.
     * @param {...THREE.Object3D} objects - Objects to add to the group
     * @returns {this} This group object for chaining
     */
    add(...objects) {
        objects.forEach(object => {
            if (object instanceof THREE.Mesh) {
                // Store original raycast method
                const originalRaycast = object.raycast;

                // Override raycast to redirect to parent
                object.raycast = (raycaster, intersects) => {
                    const meshIntersects = [];
                    originalRaycast.call(object, raycaster, meshIntersects);

                    if (meshIntersects.length > 0) {
                        const intersection = meshIntersects[0];
                        intersects.push({
                            distance: intersection.distance,
                            point: intersection.point,
                            object: this, // Return parent group
                            face: intersection.face,
                            faceIndex: intersection.faceIndex,
                            uv: intersection.uv,
                        });
                    }
                };
            }
        });

        return super.add(...objects);
    }

    /**
     * Creates material for selection highlighting.
     * @param {number} color - Color in hex format (e.g., 0xFF0000 for red)
     * @returns {THREE.Material} Selection highlight material with transparency
     */
    createSelectionMaterial(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.BackSide,
        });
    }

    /**
     * Handles group selection, applying highlighting to all children and creating selection markers.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     */
    select(color, options) {
        this._selectionColor = color;

        // Handle materials for all children
        this.traverse(child => {
            if (child instanceof THREE.Mesh) {
                const highlightMaterial = child.material.clone();
                highlightMaterial.emissive?.setHex(options.selection.highlightEmissive);
                child.originalMaterial = child.material;
                child.material = highlightMaterial;
            }
        });

        // Create and add marker
        const marker = this.createSelectionMarker(color, options);
        this.add(marker);
        this.marker = marker;
    }

    /**
     * Handles group deselection, removing highlighting and markers.
     */
    deselect() {
        this._selectionColor = null;

        // Remove marker
        if (this.marker) {
            this.remove(this.marker);
            this.marker.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
            });
            this.marker = null;
        }

        // Restore original materials
        this.traverse(child => {
            if (child instanceof THREE.Mesh && child.originalMaterial) {
                child.material.dispose();
                child.material = child.originalMaterial;
                child.originalMaterial = null;
            }
        });
    }

    /**
     * Creates visual marker for selection.
     * @abstract
     * @param {number} _color - Selection color in hex format
     * @param {object} _options - Selection options containing visualization parameters
     * @throws {Error} If not implemented by subclass
     */
    createSelectionMarker(_color, _options) {
        throw new Error('createSelectionMarker needs to be implemented in a subclass');
    }

    /**
     * Cleans up resources to prevent memory leaks.
     */
    dispose() {
        // Clean up selection-related resources
        if (this.marker) {
            this.deselect();
        }

        // Clean up all mesh resources
        this.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                child.material?.dispose();
            }
        });
        this.clear();
    }
}

/**
 * Class for hydrogen bond visualization.
 * Represents hydrogen bonds as dashed lines between donor and acceptor atoms.
 * @augments ORTEPGroupObject
 */
export class ORTEPHBond extends ORTEPGroupObject {
    /**
     * Creates a new hydrogen bond visualization.
     * @param {HBond} hbond - H-bond data
     * @param {CrystalStructure} crystalStructure - Parent structure
     * @param {THREE.BufferGeometry} baseHBond - H-bond geometry
     * @param {THREE.Material} baseHBondMaterial - H-bond material
     * @param {number} targetSegmentLength - Approximate target length for dashed segments
     * @param {number} dashFraction - Fraction of segment that is solid
     * @param {Function} [getCartesianPosition] - Cached atom-position resolver
     * @param {Function} [getRenderedAtom] - Rendered atom resolver for surface trimming
     */
    constructor(
        hbond,
        crystalStructure,
        baseHBond,
        baseHBondMaterial,
        targetSegmentLength,
        dashFraction,
        getCartesianPosition = null,
        getRenderedAtom = null,
    ) {
        super();
        this.userData = {
            type: 'hbond',
            hbondData: hbond,
            selectable: true,
        };

        let hydrogenPosition;
        let acceptorPosition;
        if (getCartesianPosition) {
            hydrogenPosition = getCartesianPosition(hbond.hydrogenAtomId);
            acceptorPosition = getCartesianPosition(hbond.acceptorAtomId);
        } else {
            const hydrogenAtom = crystalStructure.getAtomById(hbond.hydrogenAtomId);
            const acceptorAtom = crystalStructure.getAtomById(hbond.acceptorAtomId);
            hydrogenPosition = new THREE.Vector3(...hydrogenAtom.position.toCartesian(crystalStructure.cell));
            acceptorPosition = new THREE.Vector3(...acceptorAtom.position.toCartesian(crystalStructure.cell));
        }

        if (getRenderedAtom) {
            [hydrogenPosition, acceptorPosition] = trimBondToAtomSurfaces(
                hydrogenPosition,
                acceptorPosition,
                getRenderedAtom(hbond.hydrogenAtomId),
                getRenderedAtom(hbond.acceptorAtomId),
            );
        }

        this.createDashedBondSegments(
            hydrogenPosition, acceptorPosition,
            baseHBond, baseHBondMaterial,
            targetSegmentLength, dashFraction,
        );
    }

    /**
     * Creates dashed line segments for hydrogen bond visualization.
     * @private
     * @param {THREE.Vector3} start - Start position
     * @param {THREE.Vector3} end - End position
     * @param {THREE.BufferGeometry} baseHBond - Base H-bond geometry
     * @param {THREE.Material} material - H-bond material
     * @param {number} targetLength - approximate target segment length
     * @param {number} dashFraction - Fraction of segment that is solid
     */
    createDashedBondSegments(start, end, baseHBond, material, targetLength, dashFraction) {
        const totalLength = start.distanceTo(end);
        const numSegments = Math.max(1, Math.floor(totalLength / targetLength));
        const segmentLength = totalLength / numSegments;
        const dashLength = segmentLength * dashFraction;

        for (let i = 0; i < numSegments; i++) {
            const startFraction = i / numSegments;
            const endFraction = startFraction + (dashLength / totalLength);

            const segStart = new THREE.Vector3().lerpVectors(start, end, startFraction);
            const segEnd = new THREE.Vector3().lerpVectors(start, end, endFraction);

            const segmentMesh = new THREE.Mesh(baseHBond, material.clone());
            segmentMesh.applyMatrix4(calcBondTransform(segStart, segEnd));
            segmentMesh.userData = this.userData;
            this.add(segmentMesh);
        }
    }

    /**
     * Creates visual marker for selection of hydrogen bond.
     * @param {number} color - Selection color in hex format
     * @param {object} options - Selection options containing visualization parameters
     * @returns {THREE.Group} Group containing selection marker meshes
     */
    createSelectionMarker(color, options) {
        const markerGroup = new THREE.Group();
        const material = this.createSelectionMaterial(color);

        this.children.forEach(segment => {
            const markerMesh = new THREE.Mesh(segment.geometry, material);
            markerMesh.applyMatrix4(segment.matrix);
            markerMesh.scale.x *= options.selection.bondMarkerMult;
            markerMesh.scale.y *= 0.8 * options.selection.bondMarkerMult;
            markerMesh.scale.z *= options.selection.bondMarkerMult;
            markerMesh.userData.selectable = false;
            markerGroup.add(markerMesh);
        });

        return markerGroup;
    }
}
