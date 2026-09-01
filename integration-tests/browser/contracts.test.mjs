import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startBrowserHarness } from './browser-harness.mjs';

let harness;

before(async () => {
    harness = await startBrowserHarness();
});

after(async () => {
    await harness?.close();
});

test('widget registration, lifecycle state, and public DOM events work in a real browser', {
    timeout: 30_000,
}, async () => {
    const { page, errors } = await harness.newPage();
    try {
        const result = await page.evaluate(async () => {
            await import('/src/index.js');
            const registeredByRoot = Boolean(customElements.get('cifview-widget'));
            await import('/src/widget/register.js');
            const registeredExplicitly = Boolean(customElements.get('cifview-widget'));
            const eventNames = [
                'cifvis-loading-change',
                'cifvis-load',
                'cifvis-error',
                'cifvis-selection-change',
                'cifvis-measurement-change',
                'cifvis-view-change',
                'cifvis-density-change',
            ];
            const events = Object.fromEntries(eventNames.map(name => [name, []]));
            for (const name of eventNames) {
                document.addEventListener(name, event => {
                    events[name].push({
                        bubbles: event.bubbles,
                        composed: event.composed,
                        loading: event.detail.loading,
                        source: event.detail.source,
                        message: event.detail.message,
                        selectionCount: event.detail.selections?.length,
                        measurementCount: event.detail.measurements?.length,
                        interactionType: event.detail.interaction?.type,
                        densityType: event.detail.update?.type,
                        hasStructure: Boolean(event.detail.structure),
                    });
                });
            }

            const widget = document.createElement('cifview-widget');
            widget.setAttribute('src', '/docs/public/cif/urea.cif');
            widget.setAttribute('options', JSON.stringify({ renderMode: 'onDemand' }));
            const loaded = new Promise((resolve, reject) => {
                widget.addEventListener('cifvis-load', resolve, { once: true });
                widget.addEventListener('cifvis-error', event => reject(event.detail.error), { once: true });
            });
            document.body.appendChild(widget);
            await Promise.race([
                loaded,
                new Promise((_, reject) => setTimeout(
                    () => reject(new Error('Timed out waiting for cifvis-load')),
                    10_000,
                )),
            ]);

            const atomIds = widget.structure.atoms.slice(0, 2).map(atom => atom.uniqueId);
            widget.viewer.measureAtomsById(atomIds);
            let selectableAtom = null;
            widget.viewer.moleculeContainer.traverse(object => {
                if (!selectableAtom && object.userData?.atomData) {
                    selectableAtom = object;
                }
            });
            if (selectableAtom) {
                widget.viewer.selections.handle(selectableAtom);
            }
            widget.viewer.setViewState({ rotation: { x: 12, y: 8, z: 4 } });
            widget.viewer.notifyScalarFieldUpdate({
                type: 'started',
                sourceType: 'browser-contract',
                displayLabel: 'Test field',
                quantityName: 'test density',
                signed: true,
            });
            await new Promise(resolveFrame => requestAnimationFrame(resolveFrame));

            const loadedState = {
                loading: widget.loading,
                error: widget.error,
                atomCount: widget.structure.atoms.length,
                ariaBusy: widget.getAttribute('aria-busy'),
            };

            const failed = new Promise(resolve => {
                widget.addEventListener('cifvis-error', resolve, { once: true });
            });
            const originalConsoleError = console.error;
            console.error = () => {};
            widget.setAttribute('data', 'not a CIF');
            await Promise.race([
                failed,
                new Promise((_, reject) => setTimeout(
                    () => reject(new Error('Timed out waiting for cifvis-error')),
                    10_000,
                )),
            ]);
            console.error = originalConsoleError;

            return {
                registeredByRoot,
                registeredExplicitly,
                loadedState,
                failedState: {
                    loading: widget.loading,
                    message: widget.error?.message,
                    ariaBusy: widget.getAttribute('aria-busy'),
                },
                events,
            };
        });

        assert.equal(result.registeredByRoot, false);
        assert.equal(result.registeredExplicitly, true);
        assert.deepEqual(result.loadedState, {
            loading: false,
            error: null,
            atomCount: 5,
            ariaBusy: 'false',
        });
        assert.equal(result.failedState.loading, false);
        assert(result.failedState.message.length > 0);
        assert.equal(result.failedState.ariaBusy, 'false');
        assert.deepEqual(
            result.events['cifvis-loading-change'].map(event => event.loading),
            [true, false, true, false],
        );
        assert.equal(result.events['cifvis-load'].length, 1);
        assert.equal(result.events['cifvis-load'][0].hasStructure, true);
        assert.equal(result.events['cifvis-error'].length, 1);
        assert.equal(result.events['cifvis-measurement-change'].at(-1).measurementCount, 1);
        assert.equal(result.events['cifvis-view-change'].at(-1).interactionType, 'rotate');
        assert.equal(result.events['cifvis-density-change'].at(-1).densityType, 'started');
        for (const eventList of Object.values(result.events)) {
            assert(eventList.every(event => event.bubbles && event.composed));
        }
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});

test('experimental Three.js components construct, update, couple, and dispose', {
    timeout: 30_000,
}, async () => {
    const { page, errors } = await harness.newPage();
    try {
        const result = await page.evaluate(async () => {
            const api = await import('/integration-tests/browser/three-fixture.js');
            const cifText = await fetch('/docs/public/cif/urea.cif').then(response => response.text());
            const structure = api.CrystalStructure.fromCIF(new api.CIF(cifText).getBlock(0));

            const ortep = new api.ORTEP3JsStructure(structure, { renderStyle: 'solid-3d' });
            const ortepGroup = ortep.getGroup();
            const ortepStats = {
                atomCount: ortep.atoms3D.length,
                structureAtomCount: structure.atoms.length,
                childCount: ortepGroup.children.length,
                hasTimings: ortep.timings.constructorTimeMs >= 0,
            };
            ortep.dispose();

            const dimensions = [12, 12, 12];
            const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2]);
            for (let z = 0; z < dimensions[2]; z += 1) {
                for (let y = 0; y < dimensions[1]; y += 1) {
                    for (let x = 0; x < dimensions[0]; x += 1) {
                        const index = (z * dimensions[1] + y) * dimensions[0] + x;
                        values[index] = Math.sin(2 * Math.PI * x / dimensions[0]) +
                            Math.cos(2 * Math.PI * y / dimensions[1]) +
                            Math.sin(2 * Math.PI * z / dimensions[2]);
                    }
                }
            }
            const field = new api.ScalarFieldGrid(structure.cell, dimensions, values, {
                sigma: 1,
                contourMode: 'sigma',
                fieldKind: 'difference-density',
                sourceType: 'browser-contract',
                surfaceSign: 'signed',
            });

            const surfaceParent = new api.THREE.Group();
            const surface = new api.ThreeIsosurfaceLayer(surfaceParent, {
                ...api.DEFAULT_VIEWER_OPTIONS.isosurface,
                useSymmetry: false,
                resolution: 12,
                gridSpacing: 1,
                maxResolution: 12,
                radius: 2,
                sigmaLevel: 0.5,
                sign: 'both',
                maxPolyCount: 10000,
            });
            surface.setField(field);
            surface.setStructure(structure);
            const surfaceStatistics = surface.rebuild();
            surface.setOptions({ positiveColor: '#123456', opacity: 0.8 });
            const recoloredStatistics = surface.rebuild();
            const positiveSurface = surface.group.children.find(child =>
                child.userData.sign === 'positive');
            const surfaceStats = {
                childCount: surface.group.children.length,
                polygonCount: surfaceStatistics.polygonCount,
                appearanceCacheHits: recoloredStatistics.appearanceCacheHitCount,
                positiveColor: positiveSurface?.material.color.getHexString(),
                parentCountBeforeDispose: surfaceParent.children.length,
            };
            surface.dispose();
            surfaceStats.parentCountAfterDispose = surfaceParent.children.length;

            const contourParent = new api.THREE.Group();
            const contours = new api.ThreeContourLineLayer(contourParent, {
                ...api.DEFAULT_VIEWER_OPTIONS.contourLines,
                ...api.DEFAULT_VIEWER_OPTIONS.isosurface,
                visible: true,
            });
            contours.setField(field);
            const contourStatistics = contours.rebuildFromContours({
                positiveSegments: [[[0, 0, 0], [1, 0, 0]]],
                negativeSegments: [[[0, 1, 0], [1, 1, 0]]],
                zeroSegments: [],
                level: 0.5,
                levels: [-0.5, 0.5],
                dimensions: [12, 12],
                plane: { mode: 'browser-contract' },
                segmentCount: 2,
                timings: { planeSetupTimeMs: 0, samplingTimeMs: 0, contourExtractionTimeMs: 0, totalTimeMs: 0 },
            });
            const contourStats = {
                segmentCount: contourStatistics.segmentCount,
                lineCount: contours.group.children.length,
                allLines: contours.group.children.every(child => child.isLineSegments2),
                parentCountBeforeDispose: contourParent.children.length,
            };
            contours.dispose();
            contourStats.parentCountAfterDispose = contourParent.children.length;

            document.body.innerHTML = '<div id="left" class="viewer"></div><div id="right" class="viewer"></div>';
            const left = new api.CrystalViewer(document.querySelector('#left'), { renderMode: 'onDemand' });
            const right = new api.CrystalViewer(document.querySelector('#right'), { renderMode: 'onDemand' });
            const [leftLoad, rightLoad] = await Promise.all([left.loadCIF(cifText), right.loadCIF(cifText)]);
            const coupling = api.coupleViewerInteractions(left, right, { coupleModes: false });
            left.setViewState({ rotation: { x: 20, y: 10, z: 5 }, camera: { zoomScale: 0.8 } });
            await new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
            left.moleculeContainer.updateMatrix();
            right.moleculeContainer.updateMatrix();
            const leftMatrix = left.moleculeContainer.matrix.toArray();
            const rightMatrix = right.moleculeContainer.matrix.toArray();
            const couplingStats = {
                loaded: leftLoad.success && rightLoad.success,
                matrixDifference: Math.max(...leftMatrix.map((value, index) =>
                    Math.abs(value - rightMatrix[index]))),
                zoomDifference: Math.abs(
                    left.getViewState().camera.zoomScale - right.getViewState().camera.zoomScale,
                ),
            };
            coupling.dispose();
            left.dispose();
            right.dispose();

            return { ortepStats, surfaceStats, contourStats, couplingStats };
        });

        assert.equal(result.ortepStats.atomCount, result.ortepStats.structureAtomCount);
        assert(result.ortepStats.childCount > 0);
        assert.equal(result.ortepStats.hasTimings, true);
        assert(result.surfaceStats.childCount > 0);
        assert(result.surfaceStats.polygonCount > 0);
        assert(result.surfaceStats.appearanceCacheHits > 0);
        assert.equal(result.surfaceStats.positiveColor, '123456');
        assert.equal(result.surfaceStats.parentCountBeforeDispose, 1);
        assert.equal(result.surfaceStats.parentCountAfterDispose, 0);
        assert.equal(result.contourStats.segmentCount, 2);
        assert(result.contourStats.lineCount >= 2);
        assert.equal(result.contourStats.allLines, true);
        assert.equal(result.contourStats.parentCountBeforeDispose, 1);
        assert.equal(result.contourStats.parentCountAfterDispose, 0);
        assert.equal(result.couplingStats.loaded, true);
        assert(result.couplingStats.matrixDifference < 1e-8);
        assert(result.couplingStats.zoomDifference < 1e-8);
        assert.deepEqual(errors, []);
    } finally {
        await page.close();
    }
});
