/**
 * Resolves either a CrystalViewer or a cifview-widget to its viewer instance.
 * @param {object} participant - Viewer or widget
 * @returns {object} CrystalViewer-like instance
 */
function resolveViewer(participant) {
    const viewer = participant?.viewer || participant;
    if (!viewer?.controls?.onInteraction ||
        typeof viewer.controls.applyCoupledInteraction !== 'function' ||
        typeof viewer.requestRender !== 'function') {
        throw new Error('Coupled participants must be CrystalViewer or initialized cifview-widget instances');
    }
    return viewer;
}

/**
 * Requests one browser frame, with a timer fallback for non-browser consumers.
 * @param {function(): void} callback - Frame callback
 * @returns {number} Frame or timer identifier
 */
function requestFrame(callback) {
    return typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(callback)
        : setTimeout(callback, 0);
}

/**
 * Cancels a frame requested by requestFrame.
 * @param {number} frame - Frame or timer identifier
 */
function cancelFrame(frame) {
    if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frame);
    } else {
        clearTimeout(frame);
    }
}

const COUPLED_MODIFIER_NAMES = ['hydrogen', 'disorder', 'symmetry'];

/**
 * Couples complete structure transforms, pan, zoom, and camera-reset
 * interactions between viewers.
 * Input events are replayed at most once per animation frame and targets render
 * once after the complete batch. Selection remains local to each viewer.
 */
export class ViewerInteractionCoupling {
    /**
     * @param {object[]} [participants] - CrystalViewer and/or cifview-widget instances
     */
    constructor(participants = []) {
        this.viewers = new Map();
        this.pendingInteractions = [];
        this.pendingFrame = null;
        this.pendingModeUpdate = Promise.resolve();
        participants.forEach(participant => this.add(participant));
    }

    /**
     * Adds a viewer or widget to the coupled group.
     * @param {object} participant - CrystalViewer or initialized cifview-widget
     * @returns {ViewerInteractionCoupling} This coupling
     */
    add(participant) {
        const viewer = resolveViewer(participant);
        if (this.viewers.has(viewer)) {
            return this;
        }
        const stopInteraction = viewer.controls.onInteraction(interaction => {
            this.enqueue(viewer, interaction);
        });
        const stopMode = viewer.onModifierModeChange?.(change => {
            this.enqueueModeChange(viewer, change);
        }) ?? (() => {});
        this.viewers.set(viewer, { stopInteraction, stopMode });
        return this;
    }

    /**
     * Aligns every peer to one viewer's current display modes, molecular
     * transform, pan, and absolute camera framing. Unsupported modes are
     * skipped per peer.
     * @param {object} participant - Source CrystalViewer or initialized widget
     * @returns {Promise<ViewerInteractionCoupling>} This coupling after peer rebuilds
     */
    async synchronizeFrom(participant) {
        const source = resolveViewer(participant);
        if (!this.viewers.has(source)) {
            throw new Error('The synchronization source must belong to this coupling');
        }
        const modes = Object.fromEntries(
            COUPLED_MODIFIER_NAMES.map(name => [name, source.modifiers[name]?.mode])
                .filter(([, mode]) => mode !== undefined),
        );
        await Promise.all([...this.viewers.keys()]
            .filter(target => target !== source)
            .map(target => target.setModifierModes?.(modes, { broadcast: false })));
        this.synchronizeViewFrom(source);
        return this;
    }

    /**
     * Copies the current spatial view without changing structure modes.
     * @param {object} source - Source viewer
     * @private
     */
    synchronizeViewFrom(source) {
        source.moleculeContainer.updateMatrix();
        const structureMatrix = source.moleculeContainer.matrix.toArray();
        const cameraState = source.cameraController.getCoupledViewState();
        for (const target of this.viewers.keys()) {
            if (target === source) {
                continue;
            }
            target.controls.setStructureTransform(structureMatrix);
            target.cameraController.applyCoupledViewState(cameraState);
            target.requestRender();
        }
    }

    /**
     * Removes a viewer or widget from the coupled group.
     * @param {object} participant - CrystalViewer or initialized cifview-widget
     * @returns {boolean} Whether the viewer was present
     */
    delete(participant) {
        const viewer = participant?.viewer || participant;
        const subscriptions = this.viewers.get(viewer);
        if (!subscriptions) {
            return false;
        }
        subscriptions.stopInteraction();
        subscriptions.stopMode();
        this.viewers.delete(viewer);
        this.pendingInteractions = this.pendingInteractions
            .filter(entry => entry.source !== viewer);
        for (const peer of this.viewers.keys()) {
            peer.controls.clearCoupledInteraction(viewer);
            viewer.controls.clearCoupledInteraction(peer);
        }
        return true;
    }

    /**
     * @param {object} source - Viewer producing the interaction
     * @param {object} interaction - Replayable view interaction
     * @private
     */
    enqueue(source, interaction) {
        if (interaction.type === 'rotate' || interaction.type === 'camera') {
            for (let index = this.pendingInteractions.length - 1; index >= 0; index--) {
                const pending = this.pendingInteractions[index];
                if (pending.source === source && pending.interaction.type === interaction.type) {
                    this.pendingInteractions[index] = { source, interaction };
                    if (this.pendingFrame === null) {
                        this.pendingFrame = requestFrame(() => this.flush());
                    }
                    return;
                }
            }
        }
        this.pendingInteractions.push({ source, interaction });
        if (this.pendingFrame === null) {
            this.pendingFrame = requestFrame(() => this.flush());
        }
    }

    /**
     * Serializes an asynchronous semantic mode update and restores the source
     * framing after peers finish their single batched rebuild.
     * @param {object} source - Viewer producing the mode change
     * @param {object} change - Modifier mode change
     * @private
     */
    enqueueModeChange(source, change) {
        if (change.coupled || !COUPLED_MODIFIER_NAMES.includes(change.modifierName)) {
            return;
        }
        this.pendingModeUpdate = this.pendingModeUpdate.then(async () => {
            if (!this.viewers.has(source)) {
                return;
            }
            await Promise.all([...this.viewers.keys()]
                .filter(target => target !== source)
                .map(target => target.setModifierModes?.(
                    { [change.modifierName]: change.mode },
                    { broadcast: false },
                )));
            if (this.viewers.has(source)) {
                this.synchronizeViewFrom(source);
            }
        }).catch(error => {
            console.error('Coupled modifier mode update failed:', error);
        });
    }

    /** Waits for queued view and mode updates to finish. */
    async settled() {
        this.flush();
        await this.pendingModeUpdate;
    }

    /**
     * Immediately replays the queued interaction batch. Normally called by the
     * scheduled animation frame; exposed for deterministic host integrations.
     */
    flush() {
        if (this.pendingFrame !== null) {
            cancelFrame(this.pendingFrame);
            this.pendingFrame = null;
        }
        if (this.pendingInteractions.length === 0) {
            return;
        }

        const batch = this.pendingInteractions;
        this.pendingInteractions = [];
        const changedViewers = new Set();
        for (const { source, interaction } of batch) {
            if (!this.viewers.has(source)) {
                continue;
            }
            for (const target of this.viewers.keys()) {
                if (target === source) {
                    continue;
                }
                target.controls.applyCoupledInteraction(interaction, source);
                changedViewers.add(target);
            }
        }
        changedViewers.forEach(viewer => viewer.requestRender());
    }

    /** Stops synchronization and releases all listeners and queued work. */
    dispose() {
        if (this.pendingFrame !== null) {
            cancelFrame(this.pendingFrame);
            this.pendingFrame = null;
        }
        this.pendingInteractions = [];
        const viewers = [...this.viewers.keys()];
        this.viewers.forEach(({ stopInteraction, stopMode }) => {
            stopInteraction();
            stopMode();
        });
        this.viewers.clear();
        viewers.forEach(viewer => {
            viewers.forEach(source => viewer.controls.clearCoupledInteraction(source));
        });
    }
}

/**
 * Couples view interactions between CrystalViewer and/or cifview-widget instances.
 * @param {...object} participants - Viewers or initialized widgets
 * @returns {ViewerInteractionCoupling} Disposable coupling controller
 */
export function coupleViewerInteractions(...participants) {
    const resolvedParticipants = participants.length === 1 && Array.isArray(participants[0])
        ? participants[0] : participants;
    return new ViewerInteractionCoupling(resolvedParticipants);
}
