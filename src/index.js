// Export core functionality that doesn't depend on DOM
export { CIF } from './lib/cif/read-cif';
export { CrystalStructure } from './lib/structure/crystal';
export { ORTEP3JsStructure } from './lib/ortep3d/ortep';
export { formatValueEsd } from './lib/formatting';

// Default exports for environments without DOM
let CrystalViewer = class {
    constructor() {
        throw new Error('CrystalViewer is not available in non-DOM environments');
    }
};

let CifViewWidget = class {
    constructor() {
        throw new Error('CifViewWidget is not available in non-DOM environments');
    }
};

// Check if we're in a browser environment with DOM support
if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined') {
    try {
        // Import DOM-dependent features
        const viewer = await import('./lib/ortep3d/crystal-viewer.js');
        const widget = await import('./lib/widget.js');
        
        CrystalViewer = viewer.CrystalViewer;
        CifViewWidget = widget.CifViewWidget;
        
        // Register web component if custom elements are supported
        if (window.customElements) {
            try {
                window.customElements.define('cifview-widget', CifViewWidget);
            } catch (e) {
                // Ignore errors if component is already defined
                if (!e.message.includes('already been defined')) {
                    console.warn('Failed to register cifview-widget:', e);
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load DOM-dependent modules:', error);
    }
}

// Export possibly DOM-dependent features
export { CrystalViewer, CifViewWidget };