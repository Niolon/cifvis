/** @vi-environment jsdom */

import { MeasurementControls, renderMeasurementResult } from './measurement-controls.js';

const distance = (id = 'measurement-1', overrides = {}) => ({
    id,
    color: 0x00b7ff,
    type: 'distance',
    value: 1.234,
    unit: 'Å',
    labels: ['C1', 'O1'],
    atomIds: ['C1|1_555', 'O1|1_555'],
    ...overrides,
});

/** @returns {object} Minimal reactive viewer mock. */
function createViewer() {
    const selectionCallbacks = new Set();
    const measurementCallbacks = new Set();
    let selections = [];
    let measurements = [];
    let sequence = 0;
    const viewer = {
        options: { atomLabels: { subscriptNonElement: false } },
        selections: {
            getSelections: vi.fn(() => [...selections]),
            onChange: vi.fn(callback => {
                selectionCallbacks.add(callback);
                return () => selectionCallbacks.delete(callback);
            }),
        },
        getMeasurements: vi.fn(() => [...measurements]),
        onMeasurementChange: vi.fn(callback => {
            measurementCallbacks.add(callback);
            return () => measurementCallbacks.delete(callback);
        }),
        measureSelectedAtoms: vi.fn(() => {
            const measurement = distance(`measurement-${++sequence}`);
            measurements.push(measurement);
            measurementCallbacks.forEach(callback => callback([...measurements]));
            return measurement;
        }),
        measureAtomsById: vi.fn(atomIds => {
            if (atomIds.includes('missing')) {
                throw new Error('Missing atom');
            }
            const measurement = distance(`measurement-${++sequence}`, {
                labels: [...atomIds], atomIds: [...atomIds],
            });
            measurements.push(measurement);
            measurementCallbacks.forEach(callback => callback([...measurements]));
            return measurement;
        }),
        clearMeasurement: vi.fn(id => {
            measurements = id === null || id === undefined
                ? []
                : measurements.filter(item => item.id !== id);
            measurementCallbacks.forEach(callback => callback([...measurements]));
        }),
        setHoveredMeasurement: vi.fn(),
        setHoveredAtom: vi.fn(),
        emitSelections(next) {
            selections = next;
            selectionCallbacks.forEach(callback => callback([...selections]));
        },
        emitMeasurements(next) {
            measurements = next;
            measurementCallbacks.forEach(callback => callback([...measurements]));
        },
        callbackCounts() {
            return { selections: selectionCallbacks.size, measurements: measurementCallbacks.size };
        },
    };
    return viewer;
}

describe('MeasurementControls state', () => {
    test('subscribes immediately and tracks selection actions and measurements', () => {
        const viewer = createViewer();
        const controls = new MeasurementControls(viewer);
        const states = [];
        const unsubscribe = controls.subscribe(state => states.push(state));
        expect(states.at(-1)).toMatchObject({ selectedAtomCount: 0, action: { enabled: false } });

        viewer.emitSelections([
            { type: 'atom' }, { type: 'bond' }, { type: 'atom' },
        ]);
        expect(states.at(-1)).toMatchObject({
            selectedAtomCount: 2,
            action: { enabled: true, title: 'Measure distance' },
        });
        viewer.emitMeasurements([distance()]);
        expect(states.at(-1).measurements).toHaveLength(1);

        unsubscribe();
        viewer.emitSelections([]);
        expect(states.at(-1).selectedAtomCount).toBe(2);
        controls.dispose();
        expect(viewer.callbackCounts()).toEqual({ selections: 0, measurements: 0 });
        expect(viewer.setHoveredMeasurement).toHaveBeenLastCalledWith(null);
    });

    test('prepopulates valid constructor IDs and reports invalid entries independently', () => {
        const viewer = createViewer();
        const onError = vi.fn();
        const controls = new MeasurementControls(viewer, {
            measurements: [['C1', 'O1'], 'invalid', ['missing', 'O1'], ['N1', 'C1', 'O1']],
            onError,
        });
        expect(viewer.measureAtomsById).toHaveBeenCalledTimes(3);
        expect(controls.getState().measurements).toHaveLength(2);
        expect(onError).toHaveBeenCalledTimes(2);
        expect(onError.mock.calls[1][1]).toEqual(['missing', 'O1']);
        controls.dispose();
    });

    test('throws when reused after disposal without clearing viewer measurements', () => {
        const viewer = createViewer();
        viewer.emitMeasurements([distance()]);
        const controls = new MeasurementControls(viewer);
        controls.dispose();
        expect(viewer.clearMeasurement).not.toHaveBeenCalled();
        expect(() => controls.measureSelected()).toThrow('has been disposed');
    });
});

describe('MeasurementControls DOM bindings', () => {
    test('binds and independently unbinds a context-sensitive action button', () => {
        const viewer = createViewer();
        const controls = new MeasurementControls(viewer);
        const button = document.createElement('button');
        const measurements = [];
        button.addEventListener('cifvis-measurement', event => measurements.push(event.detail));
        const unbind = controls.bindAction(button);
        expect(button.disabled).toBe(true);
        expect(button.title).toContain('0 selected');

        viewer.emitSelections([{ type: 'atom' }, { type: 'atom' }, { type: 'atom' }]);
        expect(button.disabled).toBe(false);
        expect(button.title).toContain('Measure angle (3 selected)');
        button.click();
        expect(viewer.measureSelectedAtoms).toHaveBeenCalledOnce();
        expect(measurements).toHaveLength(1);

        unbind();
        viewer.emitSelections([]);
        expect(button.title).toContain('3 selected');
        button.click();
        expect(viewer.measureSelectedAtoms).toHaveBeenCalledOnce();
        controls.dispose();
    });

    test('dispatches a bubbling error event and reports button failures', () => {
        const viewer = createViewer();
        viewer.measureSelectedAtoms.mockImplementation(() => {
            throw new Error('No atoms');
        });
        const onError = vi.fn();
        const controls = new MeasurementControls(viewer, { onError });
        const parent = document.createElement('div');
        const button = document.createElement('button');
        parent.append(button);
        const errors = [];
        parent.addEventListener('cifvis-measurement-error', event => errors.push(event.detail));
        controls.bindAction(button);
        viewer.emitSelections([{ type: 'atom' }, { type: 'atom' }]);
        button.click();
        expect(onError).toHaveBeenCalledOnce();
        expect(errors[0].message).toBe('No atoms');
        controls.dispose();
    });

    test('renders safe default results and binds result, atom, focus, and dismiss behavior', () => {
        const viewer = createViewer();
        const controls = new MeasurementControls(viewer);
        const container = document.createElement('div');
        controls.bindResults(container);
        viewer.emitMeasurements([distance('measurement-safe', {
            labels: ['<img src=x onerror=alert(1)>', 'O1'],
        })]);
        const item = container.querySelector('.cifvis-measurement-result');
        expect(container.querySelector('img')).toBeNull();
        expect(item.textContent).toContain('<img src=x onerror=alert(1)>');

        item.dispatchEvent(new MouseEvent('mouseenter'));
        expect(viewer.setHoveredMeasurement).toHaveBeenLastCalledWith('measurement-safe');
        const atom = item.querySelector('[data-cifvis-atom-id]');
        atom.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        expect(viewer.setHoveredAtom).toHaveBeenLastCalledWith('C1|1_555', 0x00b7ff);
        atom.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
        expect(viewer.setHoveredAtom).toHaveBeenLastCalledWith(null);
        item.dispatchEvent(new MouseEvent('mouseleave'));
        expect(viewer.setHoveredMeasurement).toHaveBeenLastCalledWith(null);

        item.querySelector('[data-cifvis-dismiss]').click();
        expect(viewer.clearMeasurement).toHaveBeenCalledWith('measurement-safe');
        expect(container.children).toHaveLength(0);
        controls.dispose();
    });

    test('enhances arbitrary renderer markup through stable data hooks', () => {
        const viewer = createViewer();
        const controls = new MeasurementControls(viewer);
        const container = document.createElement('section');
        const renderItem = vi.fn(measurement => {
            const item = document.createElement('article');
            const atom = document.createElement('a');
            atom.href = '#';
            atom.dataset.cifvisAtomId = measurement.atomIds[1];
            atom.dataset.cifvisHoverColor = String(0xff00ff);
            atom.textContent = measurement.labels[1];
            const dismiss = document.createElement('button');
            dismiss.dataset.cifvisDismiss = '';
            item.append(atom, dismiss);
            return item;
        });
        const unbind = controls.bindResults(container, { renderItem });
        viewer.emitMeasurements([distance('custom')]);
        const item = container.querySelector('article');
        const atom = item.querySelector('a');
        item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        atom.dispatchEvent(new MouseEvent('mouseenter'));
        expect(viewer.setHoveredMeasurement).toHaveBeenLastCalledWith('custom');
        expect(viewer.setHoveredAtom).toHaveBeenLastCalledWith('O1|1_555', 0xff00ff);

        item.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: atom }));
        expect(viewer.setHoveredMeasurement).not.toHaveBeenLastCalledWith(null);
        unbind();
        viewer.setHoveredMeasurement.mockClear();
        item.dispatchEvent(new MouseEvent('mouseenter'));
        item.querySelector('[data-cifvis-dismiss]').click();
        expect(viewer.setHoveredMeasurement).not.toHaveBeenCalled();
        expect(viewer.clearMeasurement).not.toHaveBeenCalled();
        viewer.emitMeasurements([]);
        expect(container.children).toHaveLength(1);
        controls.dispose();
    });

    test('exports the default result renderer independently', () => {
        const item = renderMeasurementResult(distance());
        expect(item.textContent).toContain('Distance C1–O1: 1.234 Å');
        expect(item.querySelectorAll('[data-cifvis-atom-id]')).toHaveLength(2);
    });

    test('follows the viewer-wide atom-label subscript option', () => {
        const viewer = createViewer();
        viewer.options.atomLabels.subscriptNonElement = true;
        const controls = new MeasurementControls(viewer);
        const container = document.createElement('div');
        controls.bindResults(container);
        viewer.emitMeasurements([distance('measurement-1', {
            labels: ['Si1B', 'O1'], atomIds: ['Si1B|1_555', 'O1|1_555'],
        })]);
        expect(container.textContent).toContain('Distance Si1B–O1: 1.234 Å');
        expect([...container.querySelectorAll('.cifvis-measurement-atom sub')]
            .map(element => element.textContent)).toEqual(['1B', '1']);
        expect(controls.getState().measurements[0].labels).toEqual(['Si1B', 'O1']);
        controls.dispose();
    });
});
