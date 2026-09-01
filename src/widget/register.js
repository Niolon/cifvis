// @ts-check

import { CifViewWidget } from '../lib/widget.js';

const tagName = 'cifview-widget';

if (!globalThis.customElements) {
    throw new Error('cifvis/widget/register requires the browser Custom Elements API');
}

if (!globalThis.customElements.get(tagName)) {
    globalThis.customElements.define(tagName, CifViewWidget);
}
