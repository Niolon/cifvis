/** @returns {object} UI-owned state derived exclusively from public density events. */
export function createScalarFieldDisplayState() {
    return {
        loading: false,
        available: false,
        visible: true,
        level: null,
        sigmaLevel: null,
        stepIndex: null,
        totalSteps: null,
        displayLabel: 'Scalar field',
        quantityName: 'scalar field',
        signed: true,
    };
}

/**
 * Reduces one public CrystalViewer density event into compact UI state.
 * Deliberately copies only presentation fields, never renderer objects or map payloads.
 * @param {object} state - Previous display state.
 * @param {object} event - Public scalar-field event.
 * @returns {object} Next display state.
 */
export function reduceScalarFieldDisplayState(state, event) {
    if (event.type === 'started') {
        return {
            ...createScalarFieldDisplayState(),
            loading: true,
            visible: event.visible ?? true,
            sigmaLevel: event.sigmaLevel ?? null,
            stepIndex: 0,
            displayLabel: event.displayLabel ?? 'Scalar field',
            quantityName: event.quantityName ?? 'scalar field',
            signed: event.signed ?? true,
        };
    }
    if (['error', 'cancelled', 'cleared'].includes(event.type)) {
        return createScalarFieldDisplayState();
    }
    if (event.type === 'visibility') {
        return { ...state, visible: Boolean(event.visible) };
    }
    if (!['update', 'complete', 'display'].includes(event.type)) {
        return state;
    }
    const level = Number.isFinite(event.level) ? event.level : state.level;
    return {
        ...state,
        loading: event.type === 'update',
        available: Number.isFinite(level),
        visible: event.visible ?? state.visible,
        level,
        sigmaLevel: Number.isFinite(event.sigmaLevel) ? event.sigmaLevel : state.sigmaLevel,
        stepIndex: Number.isInteger(event.stepIndex) ? event.stepIndex : state.stepIndex,
        totalSteps: Number.isInteger(event.totalSteps) ? event.totalSteps : state.totalSteps,
        displayLabel: event.displayLabel ?? state.displayLabel,
        quantityName: event.quantityName ?? state.quantityName,
        signed: event.signed ?? state.signed,
    };
}
