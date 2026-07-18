import { describe, expect, test } from 'vitest';
import {
    createDifferenceDensityDisplayState,
    reduceDifferenceDensityDisplayState,
} from './difference-density-display-state.js';

describe('difference density display state', () => {
    test('derives loading, level, and visibility only from public events', () => {
        let state = createDifferenceDensityDisplayState();
        state = reduceDifferenceDensityDisplayState(state, {
            type: 'started',
            visible: true,
            sigmaLevel: 3,
        });
        expect(state).toMatchObject({ loading: true, available: false, visible: true });

        state = reduceDifferenceDensityDisplayState(state, {
            type: 'update',
            stepIndex: 0,
            totalSteps: 3,
            displayLabel: 'Δρ/eÅ⁻³',
            quantityName: 'difference density',
            signed: true,
            level: 0.125,
            sigmaLevel: 3,
            visible: true,
            map: { values: new Float32Array(100) },
        });
        expect(state).toEqual({
            loading: true,
            available: true,
            visible: true,
            level: 0.125,
            sigmaLevel: 3,
            stepIndex: 0,
            totalSteps: 3,
            displayLabel: 'Δρ/eÅ⁻³',
            quantityName: 'difference density',
            signed: true,
        });
        expect(state).not.toHaveProperty('map');

        state = reduceDifferenceDensityDisplayState(state, {
            type: 'visibility',
            visible: false,
        });
        expect(state.visible).toBe(false);

        state = reduceDifferenceDensityDisplayState(state, {
            type: 'complete',
            level: 0.125,
            sigmaLevel: 3,
            visible: false,
        });
        expect(state).toMatchObject({ loading: false, available: true, visible: false });
    });

    test('carries Cube presentation metadata without exposing map internals', () => {
        let state = reduceDifferenceDensityDisplayState(
            createDifferenceDensityDisplayState(),
            {
                type: 'started',
                displayLabel: 'ρ/eÅ⁻³',
                quantityName: 'electron density',
                signed: false,
            },
        );
        state = reduceDifferenceDensityDisplayState(state, {
            type: 'complete',
            level: 0.3,
        });

        expect(state).toMatchObject({
            displayLabel: 'ρ/eÅ⁻³',
            quantityName: 'electron density',
            signed: false,
            level: 0.3,
        });
    });

    test.each(['error', 'cancelled', 'cleared'])('%s clears the UI state', type => {
        const loaded = {
            loading: false,
            available: true,
            visible: false,
            level: 0.2,
            sigmaLevel: 2,
            stepIndex: 2,
            totalSteps: 3,
        };
        expect(reduceDifferenceDensityDisplayState(loaded, { type }))
            .toEqual(createDifferenceDensityDisplayState());
    });
});
