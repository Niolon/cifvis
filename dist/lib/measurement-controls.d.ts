/**
 * Default safe DOM renderer for a persistent measurement.
 * @param {object} measurement - Measurement result.
 * @param {object} [options] - Display options.
 * @param {boolean} [options.subscriptNonElement] - Whether numeric non-element parts use subscripts.
 * @returns {HTMLElement} Result chip.
 */
export function renderMeasurementResult(measurement: object, options?: {
    subscriptNonElement?: boolean | undefined;
}): HTMLElement;
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
    constructor(viewer: object, options?: {
        measurements?: string[][] | undefined;
        onError?: ((arg0: Error, arg1: string[] | null) => void) | undefined;
    });
    viewer: object;
    onError: (arg0: Error, arg1: string[] | null) => void;
    subscribers: Set<any>;
    unbinders: Set<any>;
    disposed: boolean;
    selections: any;
    measurements: any;
    stopSelectionUpdates: any;
    stopMeasurementUpdates: any;
    /** @returns {{measurements: object[], selectedAtomCount: number, action: object}} Current UI state. */
    getState(): {
        measurements: object[];
        selectedAtomCount: number;
        action: object;
    };
    /**
     * @param {function(object): void} callback - State listener.
     * @returns {function(): void} Unsubscribe function.
     */
    subscribe(callback: (arg0: object) => void): () => void;
    /** Notifies a stable snapshot so subscribers may safely bind/unbind during an update. */
    notify(): void;
    /** @returns {object} Newly created measurement. */
    measureSelected(): object;
    /** @param {string} measurementId - Measurement to remove. */
    remove(measurementId: string): void;
    /** @param {string|null} measurementId - Measurement to preview, or null to hide all. */
    preview(measurementId: string | null): void;
    /**
     * Binds an existing button to the current measurement action.
     * @param {HTMLButtonElement} button - Button owned by the caller.
     * @returns {function(): void} Unbind function.
     */
    bindAction(button: HTMLButtonElement): () => void;
    /**
     * Binds a result container using the default or a caller-provided DOM renderer.
     * @param {HTMLElement} container - Result-list container.
     * @param {object} [options] - Rendering options.
     * @param {function(object): HTMLElement} [options.renderItem] - Custom item renderer.
     * @returns {function(): void} Unbind function.
     */
    bindResults(container: HTMLElement, options?: {
        renderItem?: ((arg0: object) => HTMLElement) | undefined;
    }): () => void;
    /**
     * Applies shared preview and dismissal behavior to one rendered item.
     * @param {HTMLElement} item - Rendered result root.
     * @param {object} measurement - Owning measurement.
     * @returns {function(): void} Interaction cleanup function.
     */
    prepareResult(item: HTMLElement, measurement: object): () => void;
    /**
     * @param {function(): void} unbind - Cleanup callback.
     * @returns {function(): void} Tracked callback.
     */
    trackUnbinder(unbind: () => void): () => void;
    /**
     * @param {Error} error - Integration error.
     * @param {string[]|null} atomIds - Related IDs.
     */
    reportError(error: Error, atomIds: string[] | null): void;
    /** Throws when a disposed controller is used. */
    assertActive(): void;
    /** Removes subscriptions and DOM bindings without clearing viewer measurements. */
    dispose(): void;
    #private;
}
//# sourceMappingURL=measurement-controls.d.ts.map