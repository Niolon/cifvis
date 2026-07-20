let cifvisPromise = null;

/**
 * Loads the cifvis library on the client only. The import registers the
 * <cifview-widget> custom element as a side effect; the resolved module
 * exposes the full library API for the demo components.
 * @returns {Promise<object>|null} The cifvis module promise, or null during SSR.
 */
export function loadCifvis() {
    if (import.meta.env.SSR) {
        return null;
    }
    if (!cifvisPromise) {
        cifvisPromise = import('cifvis');
    }
    return cifvisPromise;
}
