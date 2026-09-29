/**
 * Couples view interactions between CrystalViewer and/or cifview-widget instances.
 * @param {...object} participants - Viewers or initialized widgets
 * @returns {ViewerInteractionCoupling} Disposable coupling controller
 */
export function coupleViewerInteractions(...participants: object[]): ViewerInteractionCoupling;
/**
 * Couples complete structure transforms, pan, zoom, and camera-reset
 * interactions between viewers.
 * Input events are replayed at most once per animation frame and targets render
 * once after the complete batch. Selection remains local to each viewer.
 */
export class ViewerInteractionCoupling {
    /**
     * @param {object[]} [participants] - CrystalViewer and/or cifview-widget instances
     * @param {object} [options] - Coupling options
     * @param {boolean} [options.coupleModes] - Share hydrogen, disorder and
     *   symmetry modes between viewers (default true). Set false to couple only
     *   the camera and molecular transform, leaving each viewer to display what
     *   it was configured to display -- the case when coupled structures
     *   deliberately differ, such as an input model beside a refined one where
     *   only the latter has anisotropic hydrogens.
     */
    constructor(participants?: object[], options?: {
        coupleModes?: boolean | undefined;
    });
    coupleModes: boolean;
    viewers: Map<any, any>;
    pendingInteractions: any[];
    pendingFrame: number | null;
    pendingModeUpdate: Promise<void>;
    /**
     * Adds a viewer or widget to the coupled group.
     * @param {object} participant - CrystalViewer or initialized cifview-widget
     * @returns {ViewerInteractionCoupling} This coupling
     */
    add(participant: object): ViewerInteractionCoupling;
    /**
     * Aligns every peer to one viewer's current display modes, molecular
     * transform, pan, and absolute camera framing. Unsupported modes are
     * skipped per peer.
     *
     * Note that this copies DISPLAY MODES as well as the view: hydrogen,
     * disorder and symmetry. Peers therefore lose whatever they were
     * constructed with -- coupling a model that has anisotropic hydrogens to
     * one that does not will drop the first back to spheres. Where only the
     * camera and molecular transform should be shared, use
     * {@link ViewerInteractionCoupling#synchronizeViewFrom} instead.
     * @param {object} participant - Source CrystalViewer or initialized widget
     * @param {object} [options] - Synchronization options
     * @param {boolean} [options.modes] - Copy display modes as well as the view
     *   (default follows the coupling's coupleModes setting)
     * @returns {Promise<ViewerInteractionCoupling>} This coupling after peer rebuilds
     */
    synchronizeFrom(participant: object, options?: {
        modes?: boolean | undefined;
    }): Promise<ViewerInteractionCoupling>;
    /**
     * Copies the current spatial view -- molecular transform, pan and absolute
     * camera framing -- while leaving every peer's display modes alone.
     *
     * Use this rather than {@link ViewerInteractionCoupling#synchronizeFrom}
     * when the coupled viewers deliberately differ in what they show, for
     * example an input model beside a refined one where only the latter has
     * anisotropic hydrogens.
     * @param {object} participant - Source CrystalViewer or initialized widget
     * @returns {ViewerInteractionCoupling} This coupling
     */
    synchronizeViewFrom(participant: object): ViewerInteractionCoupling;
    /**
     * Removes a viewer or widget from the coupled group.
     * @param {object} participant - CrystalViewer or initialized cifview-widget
     * @returns {boolean} Whether the viewer was present
     */
    delete(participant: object): boolean;
    /**
     * @param {object} source - Viewer producing the interaction
     * @param {object} interaction - Replayable view interaction
     * @private
     */
    private enqueue;
    /**
     * Serializes an asynchronous semantic mode update and restores the source
     * framing after peers finish their single batched rebuild.
     * @param {object} source - Viewer producing the mode change
     * @param {object} change - Modifier mode change
     * @private
     */
    private enqueueModeChange;
    /** Waits for queued view and mode updates to finish. */
    settled(): Promise<void>;
    /**
     * Immediately replays the queued interaction batch. Normally called by the
     * scheduled animation frame; exposed for deterministic host integrations.
     */
    flush(): void;
    /** Stops synchronization and releases all listeners and queued work. */
    dispose(): void;
    #private;
}
//# sourceMappingURL=viewer-interaction-coupling.d.ts.map