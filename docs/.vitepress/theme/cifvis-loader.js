let cifvisPromise = null;

/**
 * Loads the cifvis library on the client only and explicitly registers the
 * <cifview-widget> custom element for the demo components.
 * @returns {Promise<object>|null} The cifvis module promise, or null during SSR.
 */
export function loadCifvis() {
    if (import.meta.env.SSR) {
        return null;
    }
    if (!cifvisPromise) {
        cifvisPromise = Promise.all([
            import('cifvis/widget/register'),
            import('cifvis'),
        ]).then(([, cifvis]) => cifvis);
    }
    return cifvisPromise;
}
