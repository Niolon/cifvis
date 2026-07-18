import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
    layoutAtomLabels,
    pointInPolygon,
    rectangleOverlapsCircle,
    rectanglesOverlap,
    segmentIntersectsRectangle,
    segmentsOverlap,
    SpatialHash,
} from './atom-label-layout.js';
import {
    AtomLabelManager,
    findSmallRings,
    projectedAtomIntersectsViewport,
    resolveAtomLabelColor,
} from './atom-label-manager.js';
import defaultSettings from './structure-settings.js';
import { colorLuminance } from './color-utils.js';

const options = {
    placementMode: 'auto-omit',
    atomPadding: 3,
    labelPadding: 2,
    viewportPadding: 4,
    fallbackDistance: 18,
    maxConnectorLength: Infinity,
    ringPenalty: 1000,
    movementPenalty: 80,
    repairDepth: 2,
    repairSearchLimit: 48,
    autoPerformanceLabelThreshold: 500,
    performanceNoSpaceCellSize: 24,
    leaderWidth: 1,
    spatialCellSize: 32,
    calloutPlacement: 'structure',
    calloutGap: 12,
    maximumCoverageDistanceSteps: 6,
    calloutColumns: 3,
    calloutColumnGap: 8,
    calloutRowGap: 4,
    calloutSearchLimit: 64,
    calloutChoiceLimit: 4,
    leaderBondCrossingPenalty: 25,
    maxVisible: Infinity,
};

describe('atom label colors', () => {
    test('uses the configured uniform color by default', () => {
        const color = resolveAtomLabelColor(
            { atomType: 'S' },
            { colorMode: 'uniform', color: '#123456', atomColorLuminanceCeiling: 0.25 },
            defaultSettings.elementProperties,
        );

        expect(color).toBe('#123456');
    });

    test('scales atom colors as one palette without clustering at the ceiling', () => {
        const labelOptions = {
            colorMode: 'atom',
            color: '#111111',
            atomColorLuminanceCeiling: 0.25,
        };
        const hydrogen = resolveAtomLabelColor(
            { atomType: 'H' }, labelOptions, defaultSettings.elementProperties,
        );
        const sulfur = resolveAtomLabelColor(
            { atomType: 'S' }, labelOptions, defaultSettings.elementProperties,
        );
        const oxygen = resolveAtomLabelColor(
            { atomType: 'O' }, labelOptions, defaultSettings.elementProperties,
        );

        expect(colorLuminance(new THREE.Color(hydrogen))).toBeLessThanOrEqual(0.25);
        expect(colorLuminance(new THREE.Color(sulfur))).toBeLessThan(
            colorLuminance(new THREE.Color(hydrogen)),
        );
        expect(colorLuminance(new THREE.Color(oxygen))).toBeLessThan(
            colorLuminance(new THREE.Color(sulfur)),
        );
    });

    test('uses custom element atom colors and falls back to default partial properties', () => {
        const labelOptions = {
            colorMode: 'atom',
            color: '#111111',
            atomColorLuminanceCeiling: 1,
        };
        const customOxygen = resolveAtomLabelColor(
            { atomType: 'O' }, labelOptions, { O: { atomColor: '#336699' } },
        );
        const partialCarbon = resolveAtomLabelColor(
            { atomType: 'C' }, labelOptions, { C: { ringColor: '#ffffff' } },
        );

        expect(customOxygen).toBe('#336699');
        expect(partialCarbon).toBe('#000000');
    });
});

/**
 * Creates a compact projected-label fixture.
 * @param {string} id - Atom ID
 * @param {number} x - Anchor x
 * @param {number} y - Anchor y
 * @param {{x: number, y: number}} preferredDirection - Preferred direction
 * @param {number} priority - Label priority
 * @returns {object} Label fixture
 */
function label(id, x, y, preferredDirection = { x: 1, y: 0 }, priority = 0) {
    return {
        id,
        text: id,
        x,
        y,
        radius: 8,
        width: 20,
        height: 12,
        preferredDirection,
        priority,
    };
}

describe('atom label layout geometry', () => {
    test('detects rectangle and atom intersections', () => {
        expect(rectanglesOverlap(
            { left: 0, right: 10, top: 0, bottom: 10 },
            { left: 9, right: 20, top: 9, bottom: 20 },
        )).toBe(true);
        expect(rectangleOverlapsCircle(
            { left: 0, right: 10, top: 0, bottom: 10 },
            { x: 12, y: 5, radius: 3 },
        )).toBe(true);
        expect(segmentIntersectsRectangle(
            { x1: 0, y1: 5, x2: 20, y2: 5, radius: 1 },
            { left: 8, right: 12, top: 0, bottom: 10 },
        )).toBe(true);
        expect(segmentsOverlap(
            { x1: 0, y1: 0, x2: 20, y2: 20, radius: 1 },
            { x1: 0, y1: 20, x2: 20, y2: 0, radius: 1 },
        )).toBe(true);
        expect(segmentsOverlap(
            { x1: 0, y1: 0, x2: 5, y2: 0, radius: 1 },
            { x1: 10, y1: 0, x2: 15, y2: 0, radius: 1 },
        )).toBe(false);
    });

    test('detects points in ring polygons', () => {
        const square = [
            { x: 0, y: 0 }, { x: 10, y: 0 },
            { x: 10, y: 10 }, { x: 0, y: 10 },
        ];
        expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    test('spatially indexes objects spanning multiple cells without duplicates', () => {
        const index = new SpatialHash(10);
        const item = { id: 'wide' };
        index.insert(item, { left: 5, right: 25, top: 5, bottom: 15 });
        expect(index.query({ left: 0, right: 30, top: 0, bottom: 20 })).toEqual([item]);
        expect(index.query({ left: 30, right: 40, top: 30, bottom: 40 })).toEqual([]);
    });

    test('never overlaps atom obstacles or other placed labels', () => {
        const obstacles = [
            { x: 80, y: 60, radius: 10 },
            { x: 120, y: 60, radius: 10 },
        ];
        const result = layoutAtomLabels(
            [label('C1', 80, 60), label('C2', 120, 60, { x: -1, y: 0 })],
            obstacles,
            [],
            [],
            { width: 200, height: 120 },
            options,
        );

        expect(result.placed).toHaveLength(2);
        for (const placed of result.placed) {
            expect(obstacles.some(atom => rectangleOverlapsCircle(placed.rect, atom))).toBe(false);
        }
        expect(rectanglesOverlap(result.placed[0].rect, result.placed[1].rect)).toBe(false);
    });

    test('uses a ring interior only as a soft penalty', () => {
        const ring = [[
            { x: 60, y: 20 }, { x: 145, y: 20 },
            { x: 145, y: 100 }, { x: 60, y: 100 },
        ]];
        const result = layoutAtomLabels(
            [label('C1', 55, 60, { x: 1, y: 0 })],
            [{ x: 55, y: 60, radius: 8 }],
            [],
            ring,
            { width: 200, height: 120 },
            options,
        );
        expect(result.placed).toHaveLength(1);
        expect(pointInPolygon(result.placed[0], ring[0])).toBe(false);
    });

    test('hides labels when collision-free placement is impossible', () => {
        const result = layoutAtomLabels(
            [label('C1', 10, 10)],
            [{ x: 10, y: 10, radius: 8 }],
            [],
            [],
            { width: 20, height: 20 },
            options,
        );
        expect(result.placed).toHaveLength(0);
        expect(result.hidden).toEqual([{ id: 'C1', text: 'C1', reason: 'no-space' }]);
    });

    test('honours priority when maxVisible is limited', () => {
        const result = layoutAtomLabels(
            [label('low', 50, 50), label('high', 150, 50, { x: 1, y: 0 }, 10)],
            [],
            [],
            [],
            { width: 240, height: 100 },
            { ...options, maxVisible: 1 },
        );
        expect(result.placed.map(item => item.id)).toEqual(['high']);
        expect(result.hidden).toContainEqual({ id: 'low', text: 'low', reason: 'max-visible' });
    });

    test('performance-omit gives front atoms precedence within an equal-priority group', () => {
        const result = layoutAtomLabels(
            [
                { ...label('A-back', 60, 50), z: 0.6 },
                { ...label('Z-front', 160, 50), z: -0.6 },
            ],
            [],
            [],
            [],
            { width: 240, height: 100 },
            { ...options, placementMode: 'performance-omit', maxVisible: 1 },
        );

        expect(result.placed.map(item => item.id)).toEqual(['Z-front']);
        expect(result.hidden).toContainEqual({
            id: 'A-back',
            text: 'A-back',
            reason: 'max-visible',
        });
    });

    test('performance-omit keeps explicit priority ahead of depth', () => {
        const result = layoutAtomLabels(
            [
                { ...label('important-back', 60, 50, { x: 1, y: 0 }, 10), z: 0.6 },
                { ...label('ordinary-front', 160, 50), z: -0.6 },
            ],
            [],
            [],
            [],
            { width: 240, height: 100 },
            { ...options, placementMode: 'performance-omit', maxVisible: 1 },
        );

        expect(result.placed.map(item => item.id)).toEqual(['important-back']);
    });

    test('auto-omit selects quality or performance behavior from visible label count', () => {
        const labels = [
            { ...label('A-back', 60, 50), z: 0.6 },
            { ...label('Z-front', 160, 50), z: -0.6 },
        ];
        const layout = threshold => layoutAtomLabels(
            labels,
            [],
            [],
            [],
            { width: 240, height: 100 },
            {
                ...options,
                placementMode: 'auto-omit',
                autoPerformanceLabelThreshold: threshold,
            },
        );

        const quality = layout(2);
        const performance = layout(1);
        expect(quality.placementPolicy).toBe('quality-omit');
        expect(quality.placed.map(item => item.id)).toEqual(['A-back', 'Z-front']);
        expect(performance.placementPolicy).toBe('performance-omit');
        expect(performance.placed.map(item => item.id)).toEqual(['Z-front', 'A-back']);
    });

    test('performance-omit reuses a nearer static no-space result for a deeper atom', () => {
        const labels = [
            { ...label('front', 10, 10), z: -0.5 },
            { ...label('back', 10, 10), z: 0.5 },
        ];
        const result = layoutAtomLabels(
            labels,
            labels.map(item => ({ id: item.id, x: item.x, y: item.y, radius: 8 })),
            [],
            [],
            { width: 20, height: 20 },
            { ...options, placementMode: 'performance-omit' },
        );

        expect(result.placed).toHaveLength(0);
        expect(result.hidden).toContainEqual({
            id: 'front',
            text: 'front',
            reason: 'no-space',
        });
        expect(result.hidden).toContainEqual({
            id: 'back',
            text: 'back',
            reason: 'static-no-space',
        });
    });

    test('performance no-space regions are rebuilt for a new zoom projection', () => {
        const crampedLabels = [
            { ...label('front', 10, 10), z: -0.5 },
            { ...label('back', 10, 10), z: 0.5 },
        ];
        const roomyLabels = [
            { ...label('front', 80, 60), z: -0.5 },
            { ...label('back', 80, 60), z: 0.5 },
        ];
        const performanceOptions = { ...options, placementMode: 'performance-omit' };
        const cramped = layoutAtomLabels(
            crampedLabels,
            crampedLabels.map(item => ({ id: item.id, x: item.x, y: item.y, radius: 8 })),
            [],
            [],
            { width: 20, height: 20 },
            performanceOptions,
        );
        const roomy = layoutAtomLabels(
            roomyLabels,
            roomyLabels.map(item => ({ id: item.id, x: item.x, y: item.y, radius: 8 })),
            [],
            [],
            { width: 200, height: 120 },
            performanceOptions,
        );

        expect(cramped.hidden.some(item => item.reason === 'static-no-space')).toBe(true);
        expect(roomy.placed.length).toBeGreaterThan(0);
        expect(roomy.hidden.some(item => item.reason === 'static-no-space')).toBe(false);
    });

    test('keeps label rectangles away from projected bonds', () => {
        const bonds = [{ x1: 108, y1: 60, x2: 190, y2: 60, radius: 4 }];
        const result = layoutAtomLabels(
            [label('C1', 100, 60, { x: 1, y: 0 })],
            [{ id: 'C1', x: 100, y: 60, radius: 8 }],
            bonds,
            [],
            { width: 220, height: 120 },
            options,
        );
        expect(result.placed).toHaveLength(1);
        expect(segmentIntersectsRectangle(bonds[0], result.placed[0].rect)).toBe(false);
    });

    test('maximum-coverage mode supports compact structure-relative callouts', () => {
        const centre = { x: 250, y: 120 };
        const radialBonds = Array.from({ length: 16 }, (_, index) => {
            const angle = index * Math.PI / 8;
            return {
                x1: centre.x,
                y1: centre.y,
                x2: centre.x + Math.cos(angle) * 80,
                y2: centre.y + Math.sin(angle) * 80,
                radius: 5,
            };
        });
        const compact = layoutAtomLabels(
            [label('C1', centre.x, centre.y)],
            [{ id: 'C1', ...centre, radius: 8 }],
            radialBonds,
            [],
            { width: 500, height: 240 },
            {
                ...options,
                placementMode: 'maximum-coverage',
                maximumCoverageDistanceSteps: 4,
            },
        );
        const viewportEdge = layoutAtomLabels(
            [label('C1', centre.x, centre.y)],
            [{ id: 'C1', ...centre, radius: 8 }],
            radialBonds,
            [],
            { width: 500, height: 240 },
            {
                ...options,
                placementMode: 'maximum-coverage',
                calloutPlacement: 'viewport',
                maximumCoverageDistanceSteps: 4,
            },
        );
        expect(compact.placed).toHaveLength(1);
        expect(compact.placed[0].isCallout).toBe(true);
        expect(compact.placed[0].leaderLine).toBe(true);
        expect(compact.hidden).toHaveLength(0);
        expect(viewportEdge.placed).toHaveLength(1);
        expect(Math.abs(compact.placed[0].x - centre.x)).toBeLessThan(
            Math.abs(viewportEdge.placed[0].x - centre.x),
        );
        const bounded = layoutAtomLabels(
            [label('C1', centre.x, centre.y)],
            [{ id: 'C1', ...centre, radius: 8 }],
            radialBonds,
            [],
            { width: 500, height: 240 },
            {
                ...options,
                placementMode: 'maximum-coverage',
                maximumCoverageDistanceSteps: 4,
                maxConnectorLength: 5,
            },
        );
        expect(bounded.placed).toHaveLength(0);
        expect(bounded.hidden[0].reason).toBe('viewport-capacity');
    });

    test('moves earlier labels locally to avoid one disproportionately long connector', () => {
        const fixture = [
            [36, 33, -1, -0.047],
            [77, 61, -1, -0.359],
            [80, 30, 1, -0.465],
            [48, 58, -1, -0.352],
            [50, 46, -1, 0.137],
            [26, 73, -1, -0.178],
            [88, 30, 1, -0.432],
        ];
        const labels = fixture.map(([x, y, dx, dy], index) => ({
            ...label(`L${index}`, x, y, { x: dx, y: dy }),
            radius: 7,
        }));
        const atoms = labels.map(item => ({
            id: item.id,
            x: item.x,
            y: item.y,
            radius: 9,
        }));
        const layout = repairSearchLimit => layoutAtomLabels(
            labels,
            atoms,
            [],
            [],
            { width: 120, height: 100 },
            {
                ...options,
                placementMode: 'maximum-coverage',
                repairSearchLimit,
            },
        );
        const connectorMaximum = result => Math.max(0, ...result.placed.map(item =>
            item.leaderSegment ? Math.hypot(
                item.leaderSegment.x2 - item.leaderSegment.x1,
                item.leaderSegment.y2 - item.leaderSegment.y1,
            ) : 0));
        const greedy = layout(0);
        const repaired = layout(48);

        expect(repaired.placed).toHaveLength(greedy.placed.length);
        expect(connectorMaximum(repaired)).toBeLessThan(connectorMaximum(greedy));
    });
});

describe('small-ring topology hint', () => {
    test('finds a six-member chordless cycle', () => {
        const atoms = Array.from({ length: 6 }, (_, index) => ({
            label: `C${index + 1}`,
            uniqueId: `C${index + 1}|1_555`,
            atomType: 'C',
        }));
        const bonds = atoms.map((atom, index) => ({
            atom1Id: atom.uniqueId,
            atom2Id: atoms[(index + 1) % atoms.length].uniqueId,
            atom1Label: atom.label,
            atom2Label: atoms[(index + 1) % atoms.length].label,
            bondLength: 1.4,
        }));
        const rings = findSmallRings({ atoms, bonds });
        expect(rings).toHaveLength(1);
        expect(new Set(rings[0])).toEqual(new Set(atoms.map(atom => atom.uniqueId)));
    });
});

describe('atom label frame lifecycle', () => {
    /**
     * Creates a minimal manager that can exercise update control-flow paths.
     * @param {object} [overrides] - Per-test manager replacements
     * @returns {AtomLabelManager} Test manager
     */
    function updateManager(overrides = {}) {
        const identity = new THREE.Matrix4();
        return Object.assign(Object.create(AtomLabelManager.prototype), {
            context: {
                setTransform: vi.fn(),
                clearRect: vi.fn(),
                measureText: vi.fn(() => ({ width: 12 })),
            },
            canvas: { style: {} },
            layout: { placed: [], hidden: [], placementPolicy: 'none' },
            layoutWaiters: [],
            pendingLayout: null,
            resize: vi.fn(),
            viewer: {
                container: { clientWidth: 320, clientHeight: 200 },
                camera: {
                    updateMatrixWorld: vi.fn(),
                    matrixWorld: identity,
                    projectionMatrix: identity,
                },
                moleculeContainer: { updateMatrixWorld: vi.fn(), matrixWorld: identity },
                controls: { state: { isDragging: false, isPanning: false } },
            },
            options: {
                placementMode: 'auto-omit',
                interactionLabelLimit: 500,
                layoutThrottleMs: 0,
                fontWeight: 400,
                fontSize: 12,
                fontFamily: 'sans-serif',
                atomPadding: 3,
            },
            forceNextLayout: true,
            lastLayoutTime: 0,
            measurementCache: new Map(),
            previousPlacements: new Map(),
            resolveRequests: vi.fn(() => []),
            transformsUnchanged: vi.fn(() => false),
            endLoadingIndicator: vi.fn(),
            beginLoadingIndicator: vi.fn(),
            rememberTransforms: vi.fn(),
            prepareTopology: vi.fn(),
            ...overrides,
        });
    }

    /**
     * Adds a promise representing a caller retained after a stale worker result.
     * @param {AtomLabelManager} manager - Manager receiving the waiter
     * @returns {Promise<object>} Carried update promise
     */
    function carriedWaiter(manager) {
        return new Promise(resolve => manager.layoutWaiters.push(resolve));
    }

    test('excludes atoms only after their projected footprint leaves the viewport', () => {
        const viewport = { width: 320, height: 200 };
        expect(projectedAtomIntersectsViewport(
            { x: -5, y: 100, z: 0, radius: 8 },
            viewport,
        )).toBe(true);
        expect(projectedAtomIntersectsViewport(
            { x: -9, y: 100, z: 0, radius: 8 },
            viewport,
        )).toBe(false);
        expect(projectedAtomIntersectsViewport(
            { x: 100, y: 100, z: 2, radius: 8 },
            viewport,
        )).toBe(false);
    });

    test('shows the loading indicator only after its delay and cancels it on completion', () => {
        vi.useFakeTimers();
        const manager = {
            options: { showLoadingIndicator: true, loadingIndicatorDelayMs: 120 },
            loadingIndicator: { style: { display: 'none' } },
            loadingIndicatorActive: false,
            loadingIndicatorTimer: null,
            disposed: false,
        };
        try {
            AtomLabelManager.prototype.beginLoadingIndicator.call(manager);
            vi.advanceTimersByTime(119);
            expect(manager.loadingIndicator.style.display).toBe('none');
            vi.advanceTimersByTime(1);
            expect(manager.loadingIndicator.style.display).toBe('flex');

            AtomLabelManager.prototype.endLoadingIndicator.call(manager);
            expect(manager.loadingIndicator.style.display).toBe('none');
        } finally {
            vi.useRealTimers();
        }
    });

    test('clears a label bitmap immediately when the molecule pose changes', () => {
        const identity = new THREE.Matrix4();
        const rotated = new THREE.Matrix4().makeRotationZ(0.1);
        const clearRect = vi.fn();
        const manager = {
            context: { setTransform: vi.fn(), clearRect },
            layout: { placed: [{}] },
            lastViewport: { width: 320, height: 200 },
            lastMoleculeMatrix: identity,
            lastCameraMatrix: identity,
            lastProjectionMatrix: identity,
            viewer: {
                container: { clientWidth: 320, clientHeight: 200 },
                moleculeContainer: { matrixWorld: rotated },
                camera: { matrixWorld: identity, projectionMatrix: identity },
            },
        };

        AtomLabelManager.prototype.clearStaleFrame.call(manager);

        expect(clearRect).toHaveBeenCalledWith(0, 0, 320, 200);
    });

    test('keeps the accepted label bitmap when transforms are unchanged', () => {
        const identity = new THREE.Matrix4();
        const clearRect = vi.fn();
        const manager = {
            context: { setTransform: vi.fn(), clearRect },
            layout: { placed: [{}] },
            lastViewport: { width: 320, height: 200 },
            lastMoleculeMatrix: identity,
            lastCameraMatrix: identity,
            lastProjectionMatrix: identity,
            viewer: {
                container: { clientWidth: 320, clientHeight: 200 },
                moleculeContainer: { matrixWorld: identity },
                camera: { matrixWorld: identity, projectionMatrix: identity },
            },
        };

        AtomLabelManager.prototype.clearStaleFrame.call(manager);

        expect(clearRect).not.toHaveBeenCalled();
    });

    test('settles carried worker waiters when a follow-up has no requested labels', async () => {
        const manager = updateManager();
        const waiter = carriedWaiter(manager);

        const layout = await manager.update();

        await expect(waiter).resolves.toBe(layout);
        expect(manager.layoutWaiters).toHaveLength(0);
    });

    test('settles carried worker waiters when no requested atom is visible', async () => {
        const manager = updateManager({
            resolveRequests: vi.fn(() => [{
                atom: { uniqueId: 'C1' },
                text: 'C1',
                priority: 0,
            }]),
            projectAnchors: vi.fn(() => new Map()),
        });
        const waiter = carriedWaiter(manager);

        const layout = await manager.update();

        await expect(waiter).resolves.toBe(layout);
        expect(manager.layoutWaiters).toHaveLength(0);
    });

    test('settles carried worker waiters after a main-thread follow-up layout', async () => {
        const calculatedLayout = {
            placed: [{ id: 'C1', text: 'C1' }],
            hidden: [],
            placementPolicy: 'quality-omit',
        };
        const manager = updateManager({
            resolveRequests: vi.fn(() => [{
                atom: { uniqueId: 'C1' },
                text: 'C1',
                priority: 0,
            }]),
            projectAnchors: vi.fn(() => new Map([['C1', {
                id: 'C1', x: 100, y: 100, z: 0, radius: 5,
            }]])),
            preferredDirection: vi.fn(() => ({ x: 1, y: 0 })),
            projectBonds: vi.fn(() => []),
            projectRings: vi.fn(() => []),
            captureLayoutState: vi.fn(() => ({})),
            getWorker: vi.fn(() => null),
            calculateLayout: vi.fn(() => calculatedLayout),
            applyLayout: vi.fn(),
            workerUnavailable: false,
        });
        const waiter = carriedWaiter(manager);

        const layout = await manager.update();

        expect(layout).toBe(calculatedLayout);
        await expect(waiter).resolves.toBe(calculatedLayout);
        expect(manager.layoutWaiters).toHaveLength(0);
    });
});
