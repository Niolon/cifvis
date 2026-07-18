import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { CrystalViewer } from './crystal-viewer.js';

const MINIMAL_CIF_WITH_STRUCTURE = `data_structure
loop_
 _space_group_symop_operation_xyz
 'x,y,z'
_cell_length_a 10
_cell_length_b 10
_cell_length_c 10
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
loop_
 _atom_site_label
 _atom_site_type_symbol
 _atom_site_fract_x
 _atom_site_fract_y
 _atom_site_fract_z
 _atom_site_U_iso_or_equiv
 C1 C 0 0 0 0
`;

describe('CrystalViewer rendering option validation', () => {
    test('rejects an invalid render style before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, { renderStyle: 'print' })).toThrow(
            'Invalid render style: "print". Must be one of: solid-3d, cutout-3d, cutout-2d',
        );
    });

    test('rejects invalid atom-label callout placement before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { calloutPlacement: 'corners' },
        })).toThrow(
            'Invalid atom label callout placement: "corners". ' +
            'Must be one of: structure, viewport',
        );
    });

    test('lists all omission policies when rejecting an invalid placement mode', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { placementMode: 'instant' },
        })).toThrow(
            'Invalid atom label placement mode: "instant". ' +
            'Must be one of: auto-omit, quality-omit, performance-omit, maximum-coverage',
        );
    });

    test.each([
        ['placementMode', ''],
        ['placementMode', null],
        ['calloutPlacement', ''],
        ['calloutPlacement', false],
    ])('rejects falsy invalid atom-label %s values', (option, value) => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { [option]: value },
        })).toThrow(`Invalid atom label ${option === 'placementMode' ?
            'placement mode' : 'callout placement'}`);
    });

    test('rejects invalid constructor label selections before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { show: 'C1' },
        })).toThrow(
            'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
        );
    });

    test('rejects a non-positive connector ceiling before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { maxConnectorLength: 0 },
        })).toThrow('atomLabels.maxConnectorLength must be a positive number');
    });

    test('rejects a non-positive performance tile size before initializing WebGL', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { performanceNoSpaceCellSize: 0 },
        })).toThrow('atomLabels.performanceNoSpaceCellSize must be a positive number');
    });

    test('rejects a fractional automatic performance threshold', () => {
        expect(() => new CrystalViewer({}, {
            atomLabels: { autoPerformanceLabelThreshold: 2.5 },
        })).toThrow('atomLabels.autoPerformanceLabelThreshold must be a non-negative integer');
    });
});

describe('CrystalViewer atom-label runtime option validation', () => {
    test.each([
        ['placementMode', ''],
        ['calloutPlacement', null],
    ])('rejects falsy invalid %s updates', (option, value) => {
        expect(() => CrystalViewer.prototype.updateAtomLabelOptions.call({}, {
            [option]: value,
        })).toThrow(`Invalid atom label ${option === 'placementMode' ?
            'placement mode' : 'callout placement'}`);
    });

    test('rejects a scalar atom selector instead of silently hiding labels', () => {
        expect(() => CrystalViewer.prototype.setAtomLabels.call({}, 'C1')).toThrow(
            'atomLabels.show must be "none", "all", "non-hydrogen", or an array of label requests',
        );
    });

    test('rejects malformed entries in a label request array', () => {
        expect(() => CrystalViewer.prototype.setAtomLabels.call({}, ['C1', { text: 'oxygen' }]))
            .toThrow(
                'atomLabels.show must be "none", "all", "non-hydrogen", ' +
                'or an array of label requests',
            );
    });

    test('does not replace active options with explicit undefined partial values', () => {
        const viewer = {
            options: {
                atomLabels: {
                    placementMode: 'quality-omit',
                    calloutPlacement: 'structure',
                    text: {},
                },
            },
            atomLabelManager: { setOptions: () => {} },
            requestRender: () => {},
        };

        CrystalViewer.prototype.updateAtomLabelOptions.call(viewer, {
            placementMode: undefined,
            calloutPlacement: undefined,
        });

        expect(viewer.options.atomLabels.placementMode).toBe('quality-omit');
        expect(viewer.options.atomLabels.calloutPlacement).toBe('structure');
    });
});

describe('CrystalViewer structure centring', () => {
    test('does not let an existing density overlay displace the molecule on reload', async () => {
        const moleculeContainer = new THREE.Group();
        const viewer = {
            state: {
                baseStructure: {},
                currentStructure: null,
                structureCenter: new THREE.Vector3(),
            },
            selections: { clear: vi.fn() },
            moleculeContainer,
            cameraTarget: new THREE.Vector3(),
            camera: new THREE.PerspectiveCamera(),
            options: { camera: { initialPosition: new THREE.Vector3(0, 0, 10) } },
            container: { clientWidth: 800, clientHeight: 600 },
            scene: new THREE.Scene(),
            update3DOrtep() {
                const molecule = new THREE.Group();
                for (const position of [[10, 0, 0], [12, 0, 0], [11, 2, 1]]) {
                    const atom = new THREE.Mesh(new THREE.SphereGeometry(0.25));
                    atom.position.set(...position);
                    atom.userData.type = 'atom';
                    molecule.add(atom);
                }
                const density = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 2));
                density.position.set(100, 0, 0);
                this.moleculeContainer.add(molecule, density);
                this.state.currentStructure = molecule;
            },
            updateCamera: vi.fn(),
            requestRender: vi.fn(),
        };

        await CrystalViewer.prototype.loadStructure.call(viewer, viewer.state.baseStructure);

        moleculeContainer.updateMatrixWorld(true);
        const centre = new THREE.Vector3();
        new THREE.Box3().setFromObject(viewer.state.currentStructure).getCenter(centre);
        expect(centre.length()).toBeCloseTo(0, 10);
    });

    test('fits the camera to the molecule rather than the density container', () => {
        const molecule = new THREE.Group();
        const container = new THREE.Group();
        container.add(molecule);
        const viewer = {
            state: { currentStructure: molecule },
            moleculeContainer: container,
            controls: { handleResize: vi.fn() },
            cameraController: { fitToStructure: vi.fn() },
            requestRender: vi.fn(),
        };

        CrystalViewer.prototype.updateCamera.call(viewer);

        expect(viewer.cameraController.fitToStructure).toHaveBeenCalledWith(molecule);
    });
});

describe('CrystalViewer progressive difference-density events', () => {
    test('starts a Cube load with source-specific presentation metadata', async () => {
        const viewer = {
            state: {
                baseStructure: {},
                scalarField: null,
                scalarFields: [],
                activeScalarFieldIndex: -1,
            },
            options: {
                differenceDensity: {},
                scalarField: { useWorker: false },
                isosurface: { visible: true },
            },
            scalarFieldLoadSequence: 0,
            scalarFieldIdSequence: 0,
            defaultIsosurfaceOptions: { visible: true, progressiveSteps: [1] },
            cancelScalarFieldLoad: vi.fn(),
            prepareScalarFieldLoad(...args) {
                return CrystalViewer.prototype.prepareScalarFieldLoad.call(this, ...args);
            },
            scalarFieldCollectionState() {
                return CrystalViewer.prototype.scalarFieldCollectionState.call(this);
            },
            notifyScalarFieldUpdate: vi.fn(),
            loadCubeOnMainThread: vi.fn().mockResolvedValue({ success: true }),
        };

        const result = await CrystalViewer.prototype.loadCube.call(
            viewer,
            'cube text',
            { property: 'density', wireframe: false },
        );

        expect(result).toEqual({ success: true });
        expect(viewer.scalarFieldLoadTarget.isosurfaceOptions.wireframe).toBe(false);
        expect(viewer.loadCubeOnMainThread).toHaveBeenCalledWith(
            'cube text',
            { property: 'density' },
            1,
        );
        expect(viewer.notifyScalarFieldUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'started',
                sourceType: 'cube',
                displayLabel: 'ρ/eÅ⁻³',
                quantityName: 'electron density',
                signed: false,
            }),
        );
    });

    test('does not start density work during an ordinary structure load', async () => {
        const viewer = {
            state: { scalarField: null, scalarFields: [], activeScalarFieldIndex: -1 },
            options: {
                fixCifErrors: false,
                differenceDensity: { autoLoad: false },
            },
            cancelScalarFieldLoad: vi.fn(),
            isosurfaceLayer: { clear: vi.fn() },
            contourLineLayer: { clear: vi.fn() },
            notifyScalarFieldUpdate: vi.fn(),
            loadStructure: vi.fn(async structure => {
                viewer.state.baseStructure = structure;
            }),
            loadDifferenceDensity: vi.fn(),
        };

        const result = await CrystalViewer.prototype.loadCIF.call(
            viewer,
            MINIMAL_CIF_WITH_STRUCTURE,
        );

        expect(result).toEqual({ success: true });
        expect(viewer.loadDifferenceDensity).not.toHaveBeenCalled();
    });

    test('installs the structure before scheduling automatic density work', async () => {
        const order = [];
        const viewer = {
            state: { scalarField: null, scalarFields: [], activeScalarFieldIndex: -1 },
            options: {
                fixCifErrors: false,
                differenceDensity: { autoLoad: true },
            },
            cancelScalarFieldLoad: vi.fn(),
            isosurfaceLayer: { clear: vi.fn() },
            contourLineLayer: { clear: vi.fn() },
            notifyScalarFieldUpdate: vi.fn(),
            loadStructure: vi.fn(async structure => {
                order.push('structure');
                viewer.state.baseStructure = structure;
            }),
            loadDifferenceDensity: vi.fn(async () => {
                order.push('density');
                return { success: true };
            }),
        };

        const result = await CrystalViewer.prototype.loadCIF.call(
            viewer,
            MINIMAL_CIF_WITH_STRUCTURE,
        );

        expect(result).toMatchObject({ success: true, differenceDensityStarted: true });
        expect(order).toEqual(['structure']);
        expect(await result.differenceDensity).toEqual({ success: true });
        expect(order).toEqual(['structure', 'density']);
    });

    test('subscribes and unsubscribes update listeners', () => {
        const viewer = { scalarFieldUpdateCallbacks: new Set() };
        const updates = [];
        const unsubscribe = CrystalViewer.prototype.onScalarFieldUpdate.call(
            viewer,
            update => updates.push(update),
        );

        CrystalViewer.prototype.notifyScalarFieldUpdate.call(viewer, { type: 'update', stepIndex: 0 });
        unsubscribe();
        CrystalViewer.prototype.notifyScalarFieldUpdate.call(viewer, { type: 'update', stepIndex: 1 });

        expect(updates).toEqual([{ type: 'update', stepIndex: 0 }]);
    });

    test('normalizes progressive steps and always includes the final surface resolution', () => {
        const viewer = {
            options: { isosurface: { progressiveSteps: [1, 0.5, -1, 0.5, 2] } },
            defaultIsosurfaceOptions: { progressiveSteps: [1, 0.5, -1, 0.5, 2] },
        };
        expect(CrystalViewer.prototype.normalizedIsosurfaceSteps.call(viewer)).toEqual([0.5, 1]);
    });

    test('passes the active coordinate CIF to anomalous-dispersion correction', () => {
        const viewer = {
            state: { currentCifContent: 'data_model', currentCifBlock: 'model' },
            options: {
                differenceDensity: {
                    anomalousDispersion: { target: 'second', table: 'Mo' },
                },
            },
        };

        expect(CrystalViewer.prototype.differenceDensityAnomalousDispersionOptions.call(viewer))
            .toEqual({
                target: 'second',
                table: 'Mo',
                cifText: 'data_model',
                cifBlock: 'model',
            });
        viewer.options.differenceDensity.anomalousDispersion = false;
        expect(CrystalViewer.prototype.differenceDensityAnomalousDispersionOptions.call(viewer))
            .toBeNull();
    });

    test('reuses one density map while increasing only surface resolution', () => {
        const field = {
            cell: {},
            dimensions: [64, 128, 64],
            resolutionFraction: 1,
            reflectionCount: 100,
            coefficientCount: 200,
            sigma: 0.05,
            minimum: -0.2,
            maximum: 0.3,
        };
        const viewer = {
            state: {
                baseStructure: { cell: {} },
                displayStructure: {},
                scalarField: null,
                scalarFields: [],
                activeScalarFieldIndex: -1,
                isosurfaceResolutionFraction: 1,
            },
            options: {
                isosurface: { resolution: 64 },
                contourLines: { enabled: false },
            },
            defaultIsosurfaceOptions: { resolution: 64, visible: true },
            scalarFieldIdSequence: 0,
            scalarFieldLoadTarget: {
                fieldId: 'difference',
                fieldName: 'Difference density',
                activate: true,
                isosurfaceOptions: { resolution: 64, visible: true },
            },
            validateScalarFieldCell: vi.fn(),
            isosurfaceLayer: {
                group: { visible: true },
                setOptions: vi.fn(),
                setField: vi.fn(),
                setStructure: vi.fn(),
                rebuild() {
                    const fraction = viewer.state.isosurfaceResolutionFraction;
                    this.displayState = {
                        available: true,
                        visible: true,
                        level: 0.15,
                        sigmaLevel: 3,
                    };
                    return {
                        polygonCount: fraction * 1000,
                        resolution: fraction * 64,
                        level: 0.15,
                        sigmaLevel: 3,
                    };
                },
            },
            contourLineLayer: { clearMesh: vi.fn() },
            scalarFieldDisplayLayer() {
                return CrystalViewer.prototype.scalarFieldDisplayLayer.call(this);
            },
            rebuildScalarFieldDisplay() {
                return CrystalViewer.prototype.rebuildScalarFieldDisplay.call(this);
            },
            scalarFieldDisplayState() {
                return CrystalViewer.prototype.scalarFieldDisplayState.call(this);
            },
            scalarFieldCollectionState() {
                return CrystalViewer.prototype.scalarFieldCollectionState.call(this);
            },
            activateScalarFieldIndex(...args) {
                return CrystalViewer.prototype.activateScalarFieldIndex.call(this, ...args);
            },
            storeProgressiveScalarField(...args) {
                return CrystalViewer.prototype.storeProgressiveScalarField.call(this, ...args);
            },
            requestRender: vi.fn(),
            notifyScalarFieldUpdate: vi.fn(),
        };

        CrystalViewer.prototype.applyProgressiveScalarField.call(viewer, field, {
            stepIndex: 0,
            totalSteps: 2,
            final: false,
            surfaceResolutionFraction: 0.5,
        });
        CrystalViewer.prototype.applyProgressiveScalarField.call(viewer, field, {
            stepIndex: 1,
            totalSteps: 2,
            final: true,
            surfaceResolutionFraction: 1,
        });

        expect(viewer.state.scalarField).toBe(field);
        expect(viewer.state.scalarFields).toHaveLength(1);
        expect(viewer.notifyScalarFieldUpdate.mock.calls.map(call => call[0]))
            .toMatchObject([
                {
                    surfaceResolution: 32,
                    polygonCount: 500,
                    dimensions: [64, 128, 64],
                    available: true,
                    visible: true,
                    level: 0.15,
                    sigmaLevel: 3,
                },
                {
                    surfaceResolution: 64,
                    polygonCount: 1000,
                    dimensions: [64, 128, 64],
                    available: true,
                    visible: true,
                    level: 0.15,
                    sigmaLevel: 3,
                },
            ]);

        viewer.scalarFieldLoadTarget = {
            fieldId: 'orbital',
            fieldName: 'Orbital',
            activate: true,
            isosurfaceOptions: { resolution: 32, visible: true, level: 0.03 },
        };
        CrystalViewer.prototype.applyProgressiveScalarField.call(viewer, {
            ...field,
            fieldKind: 'orbital',
            displayLabel: 'ψ',
            quantityName: 'orbital',
        }, {
            stepIndex: 0,
            totalSteps: 1,
            final: true,
            surfaceResolutionFraction: 1,
        });
        expect(viewer.state.scalarFields).toHaveLength(2);
        expect(viewer.state.activeScalarFieldIndex).toBe(1);
    });

    test('toggles density visibility without rebuilding its surfaces', () => {
        const group = { visible: true };
        const viewer = {
            state: { scalarField: {}, scalarFields: [], activeScalarFieldIndex: -1 },
            options: {
                isosurface: { visible: true },
                contourLines: { enabled: false },
            },
            isosurfaceLayer: {
                setVisible(visible) {
                    group.visible = visible;
                    return visible;
                },
            },
            requestRender: vi.fn(),
            notifyScalarFieldUpdate: vi.fn(),
            scalarFieldDisplayLayer() {
                return CrystalViewer.prototype.scalarFieldDisplayLayer.call(this);
            },
            scalarFieldCollectionState() {
                return CrystalViewer.prototype.scalarFieldCollectionState.call(this);
            },
            setIsosurfaceVisibility(visible) {
                return CrystalViewer.prototype.setIsosurfaceVisibility.call(this, visible);
            },
        };

        const result = CrystalViewer.prototype.updateIsosurfaceOptions.call(
            viewer,
            { visible: false },
        );

        expect(result).toEqual({ success: true, visible: false });
        expect(group.visible).toBe(false);
        expect(viewer.options.isosurface.visible).toBe(false);
        expect(viewer.notifyScalarFieldUpdate)
            .toHaveBeenCalledWith(expect.objectContaining({ type: 'visibility', visible: false }));
    });

    test('cycles through multiple fields and then through a hidden state', () => {
        const viewer = {
            state: {
                scalarFields: [
                    {
                        id: 'difference',
                        name: 'Difference density',
                        field: { displayLabel: 'Δρ/eÅ⁻³', quantityName: 'difference density' },
                        resolutionFraction: 1,
                        isosurfaceOptions: { level: 0.1, visible: true },
                    },
                    {
                        id: 'orbital',
                        name: 'Orbital',
                        field: { displayLabel: 'ψ', quantityName: 'orbital' },
                        resolutionFraction: 1,
                        isosurfaceOptions: { level: 0.03, visible: true },
                    },
                ],
                activeScalarFieldIndex: -1,
                scalarField: null,
                displayStructure: {},
                isosurfaceResolutionFraction: 1,
            },
            options: { isosurface: {}, contourLines: { enabled: false } },
            isosurfaceLayer: {
                group: null,
                options: {},
                setOptions(options) {
                    this.options = options;
                },
                setField(field) {
                    this.field = field;
                },
                setStructure: vi.fn(),
                rebuild() {
                    this.group = { visible: this.options.visible !== false };
                    this.displayState = {
                        available: true,
                        visible: this.group.visible,
                        level: this.options.level,
                        displayLabel: this.field.displayLabel,
                        quantityName: this.field.quantityName,
                    };
                    return {};
                },
                setVisible(visible) {
                    this.group.visible = visible;
                    return visible;
                },
            },
            contourLineLayer: { clearMesh: vi.fn() },
            requestRender: vi.fn(),
            notifyScalarFieldUpdate: vi.fn(),
            scalarFieldDisplayLayer() {
                return CrystalViewer.prototype.scalarFieldDisplayLayer.call(this);
            },
            rebuildScalarFieldDisplay() {
                return CrystalViewer.prototype.rebuildScalarFieldDisplay.call(this);
            },
            scalarFieldCollectionState() {
                return CrystalViewer.prototype.scalarFieldCollectionState.call(this);
            },
            scalarFieldDisplayState() {
                return CrystalViewer.prototype.scalarFieldDisplayState.call(this);
            },
            resolveScalarFieldIndex(selector) {
                return CrystalViewer.prototype.resolveScalarFieldIndex.call(this, selector);
            },
            activateScalarFieldIndex(index, visible) {
                return CrystalViewer.prototype.activateScalarFieldIndex.call(this, index, visible);
            },
            setActiveScalarField(selector) {
                return CrystalViewer.prototype.setActiveScalarField.call(this, selector);
            },
            setIsosurfaceVisibility(visible) {
                return CrystalViewer.prototype.setIsosurfaceVisibility.call(this, visible);
            },
        };

        CrystalViewer.prototype.activateScalarFieldIndex.call(viewer, 0);
        expect(CrystalViewer.prototype.cycleScalarField.call(viewer)).toMatchObject({
            activeFieldId: 'orbital',
            visible: true,
        });
        expect(viewer.options.isosurface.level).toBe(0.03);

        expect(CrystalViewer.prototype.cycleScalarField.call(viewer)).toMatchObject({
            activeFieldId: 'orbital',
            visible: false,
        });
        expect(CrystalViewer.prototype.cycleScalarField.call(viewer)).toMatchObject({
            activeFieldId: 'difference',
            visible: true,
        });
        expect(viewer.options.isosurface.level).toBe(0.1);
    });

    test('switches an active field between isosurface and planar-line adapters', () => {
        const field = { displayLabel: 'Δρ/eÅ⁻³', quantityName: 'difference density' };
        const isosurfaceLayer = {
            clearMesh: vi.fn(),
            setOptions: vi.fn(),
            setField: vi.fn(),
            setStructure: vi.fn(),
            rebuild: vi.fn().mockReturnValue({ displayMode: 'isosurface' }),
        };
        const contourLineLayer = {
            clearMesh: vi.fn(),
            setOptions: vi.fn(),
            setField: vi.fn(),
            setStructure: vi.fn(),
            rebuild: vi.fn().mockReturnValue({ displayMode: 'contour-lines' }),
        };
        const viewer = {
            state: {
                scalarFields: [{
                    id: 'difference',
                    field,
                    resolutionFraction: 1,
                    isosurfaceOptions: { sigmaLevel: 3, visible: true },
                }],
                activeScalarFieldIndex: 0,
                displayStructure: {},
            },
            options: {
                isosurface: { sigmaLevel: 3 },
                contourLines: { enabled: true, plane: { mode: 'best-fit' } },
            },
            isosurfaceLayer,
            contourLineLayer,
        };

        const lineResult = CrystalViewer.prototype.rebuildScalarFieldDisplay.call(viewer);
        expect(lineResult.displayMode).toBe('contour-lines');
        expect(isosurfaceLayer.clearMesh).toHaveBeenCalled();
        expect(contourLineLayer.setOptions).toHaveBeenCalledWith(expect.objectContaining({
            enabled: true,
            sigmaLevel: 3,
            visible: true,
        }));

        viewer.options.contourLines.enabled = false;
        const surfaceResult = CrystalViewer.prototype.rebuildScalarFieldDisplay.call(viewer);
        expect(surfaceResult.displayMode).toBe('isosurface');
        expect(contourLineLayer.clearMesh).toHaveBeenCalled();
        expect(isosurfaceLayer.setField).toHaveBeenCalledWith(field, 1);
    });

    test('loads heterogeneous source definitions in their declared order', async () => {
        const viewer = {
            loadDifferenceDensity: vi.fn().mockResolvedValue({ success: true }),
            loadCube: vi.fn().mockResolvedValue({ success: true }),
            addScalarField: vi.fn().mockReturnValue({ success: true }),
            getScalarFields: vi.fn().mockReturnValue([{ id: 'difference' }, { id: 'orbital' }]),
            scalarFieldCollectionState: vi.fn().mockReturnValue({
                fieldCount: 2,
                activeFieldIndex: 1,
            }),
        };

        const result = await CrystalViewer.prototype.loadScalarFieldSources.call(viewer, [
            {
                type: 'difference-density',
                id: 'difference',
                name: 'Fo-Fc',
                text: 'data_fcf',
            },
            {
                type: 'cube',
                id: 'orbital',
                name: 'HOMO',
                text: 'cube',
                options: { property: 'orbital' },
            },
        ]);

        expect(result).toMatchObject({ success: true, fieldCount: 2, activeFieldIndex: 1 });
        expect(viewer.loadDifferenceDensity).toHaveBeenCalledWith(
            'data_fcf',
            0,
            expect.objectContaining({ fieldId: 'difference', fieldName: 'Fo-Fc', activate: false }),
        );
        expect(viewer.loadCube).toHaveBeenCalledWith(
            'cube',
            expect.objectContaining({
                property: 'orbital',
                fieldId: 'orbital',
                fieldName: 'HOMO',
                activate: true,
            }),
        );
    });
});
