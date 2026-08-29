import { measurementAction } from './structure/measurements.js';

const STYLE_ID = 'cifvis-measurement-controls-styles';
const DEFAULT_STYLES = `
  .cifvis-measurement-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 2.25rem;
    border: 1px solid var(--cifvis-measurement-border, #d6d9df);
    border-radius: var(--cifvis-measurement-radius, 0.55rem);
    padding: 0.4rem 0.7rem;
    background: var(--cifvis-measurement-button-bg, #fff);
    color: var(--cifvis-measurement-text, #24262b);
    font: inherit;
    cursor: pointer;
  }
  .cifvis-measurement-action:disabled { cursor: default; opacity: 0.5; }
  .cifvis-measurement-results {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cifvis-measurement-gap, 0.45rem);
    align-items: center;
  }
  .cifvis-measurement-result {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--cifvis-measurement-border, #d6d9df);
    border-bottom: 3px solid var(--cifvis-measurement-color, #3a7bd5);
    border-radius: var(--cifvis-measurement-radius, 0.55rem);
    padding: 0.3rem 0.45rem;
    background: var(--cifvis-measurement-result-bg, #fff);
    color: var(--cifvis-measurement-text, #24262b);
    font: inherit;
  }
  .cifvis-measurement-atom,
  .cifvis-measurement-dismiss {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .cifvis-measurement-atom {
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }
  .cifvis-measurement-dismiss { padding-inline: 0.15rem; font-size: 1.1em; }
`;

/** Adds the shared default measurement-control stylesheet once. */
function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = DEFAULT_STYLES;
    document.head.appendChild(style);
}

/**
 * @param {number} color - Numeric RGB colour.
 * @returns {string} CSS colour.
 */
function cssColor(color) {
    return `#${Number(color).toString(16).padStart(6, '0').slice(-6)}`;
}

/**
 * Creates one accessible atom control for the default result renderer.
 * @param {string} label - Displayed atom label.
 * @param {string} atomId - Symmetry-resolved atom ID.
 * @returns {HTMLButtonElement} Atom preview control.
 */
function createAtomButton(label, atomId) {
    const atom = document.createElement('button');
    atom.type = 'button';
    atom.className = 'cifvis-measurement-atom';
    atom.dataset.cifvisAtomId = atomId ?? '';
    atom.textContent = label;
    atom.title = `Highlight ${label}`;
    return atom;
}

/**
 * Appends atom controls separated by the requested text.
 * @param {HTMLElement} parent - Destination element.
 * @param {string[]} labels - Atom labels.
 * @param {string[]} atomIds - Atom unique IDs.
 * @param {string} separator - Separator text.
 */
function appendAtoms(parent, labels, atomIds, separator) {
    labels.forEach((label, index) => {
        if (index > 0) {
            parent.append(separator);
        }
        parent.append(createAtomButton(label, atomIds[index]));
    });
}

/**
 * Default safe DOM renderer for a persistent measurement.
 * @param {object} measurement - Measurement result.
 * @returns {HTMLElement} Result chip.
 */
export function renderMeasurementResult(measurement) {
    const item = document.createElement('span');
    const content = document.createElement('strong');
    const value = measurement.value.toFixed(measurement.unit === '°' ? 2 : 3);
    if (measurement.type === 'plane-distance') {
        content.append(createAtomButton(measurement.probeLabel, measurement.atomIds.at(-1)));
        content.append(' to mean plane (');
        appendAtoms(content, measurement.planeLabels, measurement.atomIds, ', ');
        content.append(`): ${value} Å`);
    } else {
        const title = measurement.type === 'distance' ? 'Distance ' :
            measurement.type === 'angle' ? 'Angle ' : 'Torsion ';
        content.append(title);
        appendAtoms(content, measurement.labels, measurement.atomIds, '–');
        content.append(`: ${value}${measurement.unit === '°' ? '' : ' '}${measurement.unit}`);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'cifvis-measurement-dismiss';
    dismiss.dataset.cifvisDismiss = '';
    dismiss.setAttribute('aria-label', 'Remove measurement');
    dismiss.title = 'Remove measurement';
    dismiss.textContent = '×';
    item.append(content, dismiss);
    return item;
}

/**
 * Framework-neutral state and DOM bindings for CrystalViewer measurements.
 */
export class MeasurementControls {
    /**
     * @param {object} viewer - Loaded CrystalViewer instance.
     * @param {object} [options] - Controller options.
     * @param {string[][]} [options.measurements] - Ordered atom IDs to measure initially.
     * @param {function(Error, string[]|null): void} [options.onError] - Integration error callback.
     */
    constructor(viewer, options = {}) {
        if (!viewer?.selections?.onChange || !viewer?.onMeasurementChange) {
            throw new TypeError('MeasurementControls requires a CrystalViewer instance');
        }
        ensureStyles();
        this.viewer = viewer;
        this.onError = options.onError ?? ((error) => console.warn('Measurement controls:', error));
        this.subscribers = new Set();
        this.unbinders = new Set();
        this.disposed = false;
        this.selections = viewer.selections.getSelections?.() ?? [];
        this.measurements = viewer.getMeasurements?.() ?? [];
        this.stopSelectionUpdates = viewer.selections.onChange(selections => {
            this.selections = selections;
            this.notify();
        }) ?? (() => {});
        this.stopMeasurementUpdates = viewer.onMeasurementChange(measurements => {
            this.measurements = [...measurements];
            this.notify();
        }) ?? (() => {});

        const initialMeasurements = options.measurements ?? [];
        if (!Array.isArray(initialMeasurements)) {
            throw new TypeError('measurements must be an array of atom-ID arrays');
        }
        for (const atomIds of initialMeasurements) {
            if (!Array.isArray(atomIds)) {
                this.reportError(new TypeError('Each measurements entry must be an array of atom IDs'), null);
                continue;
            }
            try {
                const measurement = viewer.measureAtomsById(atomIds);
                this.#includeMeasurement(measurement);
            } catch (error) {
                this.reportError(error, atomIds);
            }
        }
    }

    /** @returns {{measurements: object[], selectedAtomCount: number, action: object}} Current UI state. */
    getState() {
        const selectedAtomCount = this.selections.filter(selection => selection.type === 'atom').length;
        return {
            measurements: [...this.measurements],
            selectedAtomCount,
            action: { ...measurementAction(selectedAtomCount) },
        };
    }

    /**
     * @param {function(object): void} callback - State listener.
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(callback) {
        this.assertActive();
        this.subscribers.add(callback);
        callback(this.getState());
        return () => this.subscribers.delete(callback);
    }

    /** Notifies a stable snapshot so subscribers may safely bind/unbind during an update. */
    notify() {
        const state = this.getState();
        [...this.subscribers].forEach(callback => callback(state));
    }

    /** @param {object} measurement - Newly created measurement. */
    #includeMeasurement(measurement) {
        if (!this.measurements.some(existing => existing.id === measurement.id)) {
            this.measurements = [...this.measurements, measurement];
            this.notify();
        }
    }

    /** @returns {object} Newly created measurement. */
    measureSelected() {
        this.assertActive();
        const measurement = this.viewer.measureSelectedAtoms();
        this.#includeMeasurement(measurement);
        return measurement;
    }

    /** @param {string} measurementId - Measurement to remove. */
    remove(measurementId) {
        this.assertActive();
        this.viewer.clearMeasurement(measurementId);
        if (this.measurements.some(measurement => measurement.id === measurementId)) {
            this.measurements = this.measurements.filter(measurement => measurement.id !== measurementId);
            this.notify();
        }
    }

    /** @param {string|null} measurementId - Measurement to preview, or null to hide all. */
    preview(measurementId) {
        this.assertActive();
        this.viewer.setHoveredMeasurement(measurementId);
    }

    /**
     * Binds an existing button to the current measurement action.
     * @param {HTMLButtonElement} button - Button owned by the caller.
     * @returns {function(): void} Unbind function.
     */
    bindAction(button) {
        this.assertActive();
        if (!(button instanceof HTMLButtonElement)) {
            throw new TypeError('bindAction requires an HTMLButtonElement');
        }
        button.classList.add('cifvis-measurement-action');
        const stopState = this.subscribe(({ selectedAtomCount, action }) => {
            button.disabled = !action.enabled;
            button.title = `${action.title} (${selectedAtomCount} selected)`;
            button.setAttribute('aria-label', button.title);
            button.replaceChildren();
            const symbol = document.createElement('span');
            symbol.className = 'cifvis-measurement-symbol measurement-symbol';
            symbol.textContent = action.symbol;
            const count = document.createElement('span');
            count.className = 'cifvis-measurement-count measurement-count';
            count.textContent = String(selectedAtomCount);
            button.append(symbol, count);
        });
        const click = () => {
            try {
                const measurement = this.measureSelected();
                button.dispatchEvent(new CustomEvent('cifvis-measurement', {
                    detail: measurement,
                    bubbles: true,
                }));
            } catch (error) {
                this.reportError(error, null);
                button.dispatchEvent(new CustomEvent('cifvis-measurement-error', {
                    detail: error,
                    bubbles: true,
                }));
            }
        };
        button.addEventListener('click', click);
        return this.trackUnbinder(() => {
            stopState();
            button.removeEventListener('click', click);
        });
    }

    /**
     * Binds a result container using the default or a caller-provided DOM renderer.
     * @param {HTMLElement} container - Result-list container.
     * @param {object} [options] - Rendering options.
     * @param {function(object): HTMLElement} [options.renderItem] - Custom item renderer.
     * @returns {function(): void} Unbind function.
     */
    bindResults(container, options = {}) {
        this.assertActive();
        if (!(container instanceof HTMLElement)) {
            throw new TypeError('bindResults requires an HTMLElement');
        }
        container.classList.add('cifvis-measurement-results');
        const renderItem = options.renderItem ?? renderMeasurementResult;
        let stopItemInteractions = [];
        const stopState = this.subscribe(({ measurements }) => {
            stopItemInteractions.forEach(stop => stop());
            stopItemInteractions = [];
            const items = [];
            for (const measurement of measurements) {
                try {
                    const item = renderItem(measurement);
                    if (!(item instanceof HTMLElement)) {
                        throw new TypeError('renderItem must return an HTMLElement');
                    }
                    stopItemInteractions.push(this.prepareResult(item, measurement));
                    items.push(item);
                } catch (error) {
                    this.reportError(error, measurement.atomIds ?? null);
                }
            }
            container.replaceChildren(...items);
        });
        return this.trackUnbinder(() => {
            stopState();
            stopItemInteractions.forEach(stop => stop());
            stopItemInteractions = [];
        });
    }

    /**
     * Applies shared preview and dismissal behavior to one rendered item.
     * @param {HTMLElement} item - Rendered result root.
     * @param {object} measurement - Owning measurement.
     * @returns {function(): void} Interaction cleanup function.
     */
    prepareResult(item, measurement) {
        const listeners = [];
        const listen = (target, type, callback) => {
            target.addEventListener(type, callback);
            listeners.push(() => target.removeEventListener(type, callback));
        };
        item.classList.add('cifvis-measurement-result');
        item.dataset.cifvisMeasurementId = measurement.id;
        item.style.setProperty('--cifvis-measurement-color', cssColor(measurement.color));
        const show = () => this.preview(measurement.id);
        const hide = () => this.preview(null);
        listen(item, 'pointerenter', show);
        listen(item, 'pointerleave', hide);
        listen(item, 'mouseenter', show);
        listen(item, 'mouseleave', hide);
        listen(item, 'focusin', show);
        listen(item, 'focusout', event => {
            if (!item.contains(event.relatedTarget)) {
                hide();
            }
        });
        for (const atom of item.querySelectorAll('[data-cifvis-atom-id]')) {
            const showAtom = () => this.viewer.setHoveredAtom(
                atom.dataset.cifvisAtomId,
                atom.dataset.cifvisHoverColor === undefined
                    ? measurement.color
                    : Number(atom.dataset.cifvisHoverColor),
            );
            const hideAtom = () => this.viewer.setHoveredAtom(null);
            listen(atom, 'pointerenter', showAtom);
            listen(atom, 'pointerleave', hideAtom);
            listen(atom, 'mouseenter', showAtom);
            listen(atom, 'mouseleave', hideAtom);
            listen(atom, 'focusin', showAtom);
            listen(atom, 'focusout', event => {
                if (!atom.contains(event.relatedTarget)) {
                    hideAtom();
                }
            });
        }
        for (const dismiss of item.querySelectorAll('[data-cifvis-dismiss]')) {
            listen(dismiss, 'click', event => {
                event.preventDefault();
                event.stopPropagation();
                this.remove(measurement.id);
            });
        }
        return () => listeners.forEach(stop => stop());
    }

    /**
     * @param {function(): void} unbind - Cleanup callback.
     * @returns {function(): void} Tracked callback.
     */
    trackUnbinder(unbind) {
        let active = true;
        const tracked = () => {
            if (!active) {
                return;
            }
            active = false;
            this.unbinders.delete(tracked);
            unbind();
        };
        this.unbinders.add(tracked);
        return tracked;
    }

    /**
     * @param {Error} error - Integration error.
     * @param {string[]|null} atomIds - Related IDs.
     */
    reportError(error, atomIds) {
        this.onError(error, atomIds);
    }

    /** Throws when a disposed controller is used. */
    assertActive() {
        if (this.disposed) {
            throw new Error('MeasurementControls has been disposed');
        }
    }

    /** Removes subscriptions and DOM bindings without clearing viewer measurements. */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.preview(null);
        this.viewer.setHoveredAtom?.(null);
        [...this.unbinders].forEach(unbind => unbind());
        this.stopSelectionUpdates();
        this.stopMeasurementUpdates();
        this.subscribers.clear();
        this.disposed = true;
    }
}
