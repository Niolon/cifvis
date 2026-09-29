// @vitest-environment node

import { describe, expect, test } from 'vitest';

describe('cifvis/core in Node', () => {
    test('imports without browser globals or browser-only exports', async () => {
        expect(globalThis.window).toBeUndefined();
        expect(globalThis.document).toBeUndefined();
        expect(globalThis.HTMLElement).toBeUndefined();
        const core = await import('./core.js');
        expect(core.CIF).toBeTypeOf('function');
        expect(core.CrystalStructure).toBeTypeOf('function');
        expect(core.CrystalViewer).toBeUndefined();
        expect(core.CifViewWidget).toBeUndefined();
    });
});
