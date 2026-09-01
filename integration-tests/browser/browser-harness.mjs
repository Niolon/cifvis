import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const browserCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    chromium.executablePath(),
    '/run/current-system/sw/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);

/** @returns {Promise<string>} Available Chromium executable. */
async function findChromium() {
    for (const candidate of browserCandidates) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next supported system location.
        }
    }
    throw new Error(
        'No Chromium/Chrome executable found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE.',
    );
}

/**
 * Starts one Vite origin and real Chromium instance for browser contract tests.
 * @returns {Promise<object>} Browser harness
 */
export async function startBrowserHarness() {
    const root = resolve(import.meta.dirname, '../..');
    const server = await createServer({
        root,
        logLevel: 'error',
        server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    await server.listen();
    const address = server.httpServer.address();
    const browser = await chromium.launch({
        executablePath: await findChromium(),
        headless: true,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
    });
    return {
        browser,
        server,
        fixtureUrl: `http://127.0.0.1:${address.port}/integration-tests/browser/fixture.html`,
        async newPage() {
            const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error') {
                    errors.push(message.text());
                }
            });
            await page.goto(this.fixtureUrl);
            return { page, errors };
        },
        async close() {
            await browser.close();
            await server.close();
        },
    };
}
