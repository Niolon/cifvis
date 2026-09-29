import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const bundlePath = resolve('dist/cifvis.alldeps.js');
const fixturePath = resolve('docs/public/cif/urea.cif');
const screenshotRoot = process.env.CIFVIS_MEASUREMENT_SCREENSHOT ||
    '/tmp/cifvis-measurement-hover.png';
const browserCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    chromium.executablePath(),
    '/run/current-system/sw/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
].filter(Boolean);

await access(bundlePath).catch(() => {
    throw new Error('Missing dist/cifvis.alldeps.js; run npm run build:alldeps first');
});
await access(fixturePath);

let executablePath;
for (const candidate of browserCandidates) {
    try {
        await access(candidate);
        executablePath = candidate;
        break;
    } catch {
        // Try the next common browser location.
    }
}
assert(executablePath, 'No Chromium/Chrome executable found');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body, #viewer { margin: 0; width: 100%; height: 100%; overflow: hidden; background: white; }
</style></head><body><div id="viewer"></div></body></html>`;
const server = createServer((request, response) => {
    if (request.url === '/cifvis.alldeps.js') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        createReadStream(bundlePath).pipe(response);
    } else if (request.url === '/urea.cif') {
        response.writeHead(200, { 'content-type': 'chemical/x-cif' });
        createReadStream(fixturePath).pipe(response);
    } else {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(html);
    }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});

try {
    const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    for (const renderStyle of ['solid-3d', 'cutout-3d', 'cutout-2d']) {
        await page.goto(`http://127.0.0.1:${port}/`);
        const initial = await page.evaluate(async style => {
            const { CrystalViewer, measureAtoms } = await import('/cifvis.alldeps.js');
            const viewer = new CrystalViewer(document.querySelector('#viewer'), {
                renderMode: 'onDemand', renderStyle: style,
                measurement: { lineRadius: 0.09, markerRadius: 0.14 },
            });
            const loaded = await viewer.loadCIF(
                await fetch('/urea.cif').then(response => response.text()),
            );
            if (!loaded.success) {
                throw new Error(loaded.error);
            }
            const structure = viewer.state.displayStructure;
            const atoms = structure.atoms.slice(0, 3);
            const first = measureAtoms(atoms.slice(0, 2), structure.cell);
            const second = measureAtoms(atoms, structure.cell);
            viewer.displayMeasurement(first);
            viewer.displayMeasurement(second);
            window.__measurementHoverViewer = viewer;
            window.__measurementHoverIds = [first.id, second.id];
            return Array.from(viewer.measurementGroups, ([id, group]) => ({
                id,
                visible: group.visible,
                lineRadius: group.children.find(child =>
                    child.userData.measurementLineRadius)?.geometry.parameters.radiusTop,
                markerRadius: group.children.find(child =>
                    child.userData.measurementMarkerRadius)?.geometry.parameters.radius,
            }));
        }, renderStyle);
        assert.deepEqual(initial.map(item => item.visible), [false, false]);
        assert(initial.every(item => item.lineRadius === 0.09));
        assert(initial.every(item => item.markerRadius === 0.14));

        const hovered = await page.evaluate(() => {
            const viewer = window.__measurementHoverViewer;
            viewer.setHoveredMeasurement(window.__measurementHoverIds[1]);
            viewer.updateMeasurementOptions({ lineRadius: 0.12, markerRadius: 0.18 });
            return Array.from(viewer.measurementGroups, ([id, group]) => ({
                id,
                visible: group.visible,
                lineScale: group.children.find(child =>
                    child.userData.measurementLineRadius)?.scale.x,
                markerScale: group.children.find(child =>
                    child.userData.measurementMarkerRadius)?.scale.x,
            }));
        });
        assert.deepEqual(hovered.map(item => item.visible), [false, true]);
        assert(hovered.every(item => Math.abs(item.lineScale - 0.12 / 0.09) < 1e-9));
        assert(hovered.every(item => Math.abs(item.markerScale - 0.18 / 0.14) < 1e-9));
        await page.screenshot({
            path: screenshotRoot.replace(/\.png$/i, `-${renderStyle}.png`),
        });

        const cleared = await page.evaluate(() => {
            const viewer = window.__measurementHoverViewer;
            viewer.setHoveredMeasurement(null);
            return Array.from(viewer.measurementGroups.values(), group => group.visible);
        });
        assert.deepEqual(cleared, [false, false]);
    }
    await page.goto(`http://127.0.0.1:${port}/`);
    const widgetStats = await page.evaluate(async () => {
        const { CifViewWidget } = await import('/cifvis.alldeps.js');
        if (!customElements.get('cifview-widget')) {
            customElements.define('cifview-widget', CifViewWidget);
        }
        document.body.replaceChildren();
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('src', '/urea.cif');
        widget.setAttribute('options', JSON.stringify({
            measurement: { lineRadius: 0.09, markerRadius: 0.14 },
        }));
        widget.setAttribute('measurements', JSON.stringify([
            ['O', 'C'], ['O', 'C', 'N'],
        ]));
        document.body.appendChild(widget);
        const deadline = performance.now() + 5000;
        while (widget.measurements.length !== 2 && performance.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const captions = [...widget.querySelectorAll('.measurement-caption')];
        captions[1]?.dispatchEvent(new MouseEvent('mouseenter'));
        await new Promise(resolveFrame => requestAnimationFrame(resolveFrame));
        return {
            measurementCount: widget.measurements.length,
            captionCount: captions.length,
            buttonCount: widget.querySelectorAll('.measurement-button').length,
            groupVisibility: [...widget.viewer.measurementGroups.values()].map(group => group.visible),
            viewerReceivedWidgetMeasurements: Object.hasOwn(widget.userOptions, 'measurements'),
        };
    });
    assert.equal(widgetStats.measurementCount, 2);
    assert.equal(widgetStats.captionCount, 2);
    assert.equal(widgetStats.buttonCount, 1);
    assert.deepEqual(widgetStats.groupVisibility, [false, true]);
    assert.equal(widgetStats.viewerReceivedWidgetMeasurements, false);

    await page.goto(`http://127.0.0.1:${port}/`);
    const controllerStats = await page.evaluate(async () => {
        const { CrystalViewer, MeasurementControls } = await import('/cifvis.alldeps.js');
        document.body.innerHTML = `
            <div id="viewer" style="height:70vh"></div>
            <button id="measure" type="button"></button>
            <div id="default-results"></div>
            <div id="custom-results"></div>`;
        const viewer = new CrystalViewer(document.querySelector('#viewer'), {
            renderMode: 'onDemand',
        });
        const loaded = await viewer.loadCIF(
            await fetch('/urea.cif').then(response => response.text()),
        );
        if (!loaded.success) {
            throw new Error(loaded.error);
        }
        const controls = new MeasurementControls(viewer, {
            measurements: [['O', 'C']],
        });
        const button = document.querySelector('#measure');
        const defaultResults = document.querySelector('#default-results');
        const customResults = document.querySelector('#custom-results');
        controls.bindAction(button);
        controls.bindResults(defaultResults);
        controls.bindResults(customResults, {
            renderItem(measurement) {
                const item = document.createElement('article');
                const atom = document.createElement('button');
                atom.dataset.cifvisAtomId = measurement.atomIds[0];
                atom.textContent = measurement.labels[0];
                const dismiss = document.createElement('button');
                dismiss.dataset.cifvisDismiss = '';
                dismiss.textContent = 'remove';
                item.append(atom, dismiss);
                return item;
            },
        });

        const customItem = customResults.querySelector('article');
        customItem.dispatchEvent(new MouseEvent('mouseenter'));
        const visibleOnHover = [...viewer.measurementGroups.values()].map(group => group.visible);
        customItem.querySelector('[data-cifvis-atom-id]').focus();
        const defaultText = defaultResults.textContent;
        customItem.querySelector('[data-cifvis-dismiss]').click();
        const result = {
            buttonTitle: button.title,
            defaultText,
            customItemCount: customResults.children.length,
            measurementCount: viewer.getMeasurements().length,
            visibleOnHover,
        };
        controls.dispose();
        viewer.dispose();
        return result;
    });
    assert.match(controllerStats.buttonTitle, /0 selected/);
    assert.match(controllerStats.defaultText, /Distance O–C:/);
    assert.equal(controllerStats.customItemCount, 0);
    assert.equal(controllerStats.measurementCount, 0);
    assert.deepEqual(controllerStats.visibleOnHover, [true]);
    assert.equal(browserErrors.length, 0, `Browser errors: ${browserErrors.join('\n')}`);
} finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
}
