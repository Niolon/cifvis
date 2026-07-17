import { layoutAtomLabels } from './atom-label-layout.js';

/**
 * Runs the DOM-free part of atom-label placement away from the render thread.
 * Projection and canvas text measurement remain on the main thread because
 * they depend on the active Three.js scene and browser canvas.
 * @param {MessageEvent} event - Serializable projected label-layout input
 */
self.onmessage = event => {
    const {
        id,
        labels,
        atoms,
        bonds,
        rings,
        viewport,
        options,
        previousPlacements,
    } = event.data;

    try {
        const layout = layoutAtomLabels(
            labels,
            atoms,
            bonds,
            rings,
            viewport,
            options,
            new Map(previousPlacements),
        );
        self.postMessage({ id, layout });
    } catch (error) {
        self.postMessage({
            id,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
