/**
 * DOM layer of the playground settings overlay.
 *
 * Renders the searchable option editor described by the schema from
 * playground-settings.js and delegates every decision (labels, controls,
 * diffing, persistence, validation, live-vs-recreate classification) to that
 * module. The overlay owns one `partial` options object — the minimal
 * non-default diff — which is saved to localStorage on every change and
 * applied to the viewer after a short debounce.
 */
import { SVG_ICONS } from '../../src/lib/generated/svg-icons.js';
import {
    buildSettingsSchema,
    classifyChangedPaths,
    clearStoredOptions,
    deletePath,
    filterSchema,
    getPath,
    loadStoredOptions,
    mergedValue,
    normalizePartial,
    saveStoredOptions,
    serializePartial,
    deserializePartial,
    setPath,
    validateImportedOptions,
} from './playground-settings.js';

const APPLY_DEBOUNCE_MS = 300;

/**
 * Wires the settings cogwheel button and overlay into the playground.
 * @param {object} host - Playground integration callbacks
 * @param {function(): object} host.getViewer - Returns the current viewer
 * @param {function(object): Promise<void>} host.recreateViewer - Rebuilds the
 *  viewer with the given non-default options
 * @param {function(): void} host.adaptButtons - Refreshes the toolbar icons
 * @param {function(string, string=): void} host.updateStatus - Status toast
 * @param {function(): string} [host.getStructureName] - Base name for exported files
 */
export function initializeSettingsOverlay(host) {
    const schema = buildSettingsSchema();
    let partial = loadStoredOptions();
    let overlay = null;
    let pendingPaths = new Set();
    let applyTimer = null;
    let applying = false;
    let applyQueued = false;
    const exportConfig = { scale: 2, longEdge: 2000, useLongEdge: false, background: 'transparent', labels: true };

    const button = document.getElementById('settings-button');
    button.innerHTML = SVG_ICONS['settings'];
    button.addEventListener('click', () => {
        if (!overlay) {
            overlay = buildOverlay();
            document.body.appendChild(overlay);
        }
        overlay.hidden = false;
        overlay.querySelector('.settings-search').focus();
    });

    // ---- change handling ---------------------------------------------------

    /**
     * Commits one changed option value, persists, and schedules an apply.
     * @param {string} path - Dotted option path
     * @param {unknown} value - New value; undefined resets to the default
     */
    function commit(path, value) {
        if (value === undefined) {
            deletePath(partial, path);
        } else {
            setPath(partial, path, value);
        }
        partial = normalizePartial(partial);
        saveStoredOptions(partial);
        pendingPaths.add(path);
        refreshModifiedMarkers();
        clearTimeout(applyTimer);
        applyTimer = setTimeout(applyPending, APPLY_DEBOUNCE_MS);
    }

    /** Applies all pending changes: live setters where possible, else recreate. */
    async function applyPending() {
        if (applying) {
            applyQueued = true;
            return;
        }
        applying = true;
        const paths = [...pendingPaths];
        pendingPaths = new Set();
        try {
            const buckets = classifyChangedPaths(paths);
            const viewer = host.getViewer();
            if (buckets.recreate) {
                await host.recreateViewer(partial);
            } else {
                if (buckets.atomLabels) {
                    viewer.updateAtomLabelOptions(subOptions(paths, 'atomLabels.'));
                }
                if (buckets.isosurface) {
                    viewer.updateIsosurfaceOptions(subOptions(paths, 'isosurface.'));
                }
                if (buckets.contourLines) {
                    viewer.updateContourLineOptions(subOptions(paths, 'contourLines.'));
                }
                if (buckets.modifierModes.length > 0) {
                    const modes = {};
                    for (const modifier of buckets.modifierModes) {
                        modes[modifier] = mergedValue(partial, `${modifier}Mode`);
                    }
                    await viewer.setModifierModes(modes);
                    host.adaptButtons();
                }
            }
        } catch (error) {
            console.error('Applying settings failed:', error);
            host.updateStatus(`Applying settings failed: ${error.message}`, 'error');
        } finally {
            applying = false;
            if (applyQueued) {
                applyQueued = false;
                applyPending();
            }
        }
    }

    /**
     * Builds the partial passed to a live update method. Reset paths must be
     * sent explicitly with their default value because the update methods
     * merge instead of replacing.
     * @param {string[]} paths - Pending dotted paths
     * @param {string} prefix - Bucket prefix such as "atomLabels."
     * @returns {object} Nested options fragment relative to the prefix
     */
    function subOptions(paths, prefix) {
        const fragment = {};
        for (const path of paths.filter((p) => p.startsWith(prefix))) {
            setPath(fragment, path.slice(prefix.length), mergedValue(partial, path));
        }
        return fragment;
    }

    // ---- overlay construction ---------------------------------------------

    /**
     * Builds the overlay DOM once, on first open.
     * @returns {HTMLElement} The overlay root
     */
    function buildOverlay() {
        const root = document.createElement('div');
        root.className = 'settings-overlay';
        root.addEventListener('click', (event) => {
            if (event.target === root) {
                root.hidden = true;
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && overlay && !overlay.hidden) {
                overlay.hidden = true;
            }
        });

        const panel = document.createElement('div');
        panel.className = 'settings-panel';
        panel.appendChild(buildHeader(root));

        const body = document.createElement('div');
        body.className = 'settings-body';
        panel.appendChild(body);
        root.appendChild(panel);
        renderBody(body, '');
        return root;
    }

    /**
     * Builds the sticky header: title, search, actions, import area.
     * @param {HTMLElement} root - Overlay root (for closing)
     * @returns {HTMLElement} Header element
     */
    function buildHeader(root) {
        const header = document.createElement('div');
        header.className = 'settings-header';

        const titleRow = document.createElement('div');
        titleRow.className = 'settings-title-row';
        const title = document.createElement('span');
        title.className = 'settings-title';
        title.textContent = 'Viewer settings';
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        const copyButton = actionButton('Copy JSON', copyToClipboard);
        const importButton = actionButton('Import JSON', () => {
            const importArea = header.querySelector('.settings-import');
            importArea.hidden = !importArea.hidden;
            if (!importArea.hidden) {
                importArea.querySelector('textarea').focus();
            }
        });
        const resetButton = actionButton('Reset all', resetAll);
        const closeButton = actionButton('✕', () => {
            root.hidden = true;
        });
        closeButton.classList.add('settings-close');
        closeButton.setAttribute('aria-label', 'Close settings');
        titleRow.append(title, spacer, copyButton, importButton, resetButton, closeButton);

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'settings-search';
        search.placeholder = 'Search options (name, label, or description)…';
        search.addEventListener('input', () => {
            renderBody(overlay.querySelector('.settings-body'), search.value);
        });

        const hint = document.createElement('div');
        hint.className = 'settings-hint';
        hint.textContent = 'Changes apply automatically and are stored in this browser. ' +
            'Copy JSON gives the equivalent options object for <cifview-widget> or CrystalViewer.';

        header.append(titleRow, search, hint, buildImportArea());
        return header;
    }

    /**
     * Builds the collapsible import area.
     * @returns {HTMLElement} Import container (initially hidden)
     */
    function buildImportArea() {
        const container = document.createElement('div');
        container.className = 'settings-import';
        container.hidden = true;

        const textarea = document.createElement('textarea');
        textarea.rows = 5;
        textarea.placeholder = '{"renderStyle": "cutout-2d", "bondColor": "#555555"}';
        const errorList = document.createElement('div');
        errorList.className = 'settings-import-errors';
        const apply = actionButton('Apply imported options', () => {
            errorList.textContent = '';
            let imported;
            try {
                imported = deserializePartial(textarea.value);
            } catch (error) {
                errorList.textContent = `Invalid JSON: ${error.message}`;
                return;
            }
            const result = validateImportedOptions(imported, schema);
            if (!result.ok) {
                errorList.textContent = result.errors.join('\n');
                return;
            }
            partial = result.sanitized;
            saveStoredOptions(partial);
            container.hidden = true;
            rerenderControls();
            host.recreateViewer(partial);
            host.updateStatus('Options imported', 'success');
        });
        container.append(textarea, apply, errorList);
        return container;
    }

    /** Copies the minimal non-default options JSON to the clipboard. */
    async function copyToClipboard() {
        const text = serializePartial(partial);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        host.updateStatus('Options JSON copied to clipboard', 'success');
    }

    /** Clears everything back to library defaults. */
    async function resetAll() {
        partial = {};
        clearStoredOptions();
        rerenderControls();
        await host.recreateViewer(partial);
        host.updateStatus('Settings reset to defaults', 'success');
    }

    /**
     * Renders (or re-renders) the grouped option rows.
     * @param {HTMLElement} body - Body container
     * @param {string} query - Current search query
     */
    function renderBody(body, query) {
        body.replaceChildren();
        const searching = query.trim().length > 0;
        if (!searching) {
            body.appendChild(buildExportSection());
        }
        const groups = filterSchema(schema, query);
        for (const group of groups) {
            const details = document.createElement('details');
            details.className = 'settings-group';
            details.open = searching || group.id === 'style';
            const summary = document.createElement('summary');
            summary.textContent = group.title;
            details.appendChild(summary);
            if (group.special === 'elements') {
                details.appendChild(buildElementSection(group));
            } else {
                for (const row of group.rows) {
                    details.appendChild(row.divider ? buildDivider(row) : buildRow(row));
                }
            }
            body.appendChild(details);
        }
        refreshModifiedMarkers();
    }

    /** Re-renders the body preserving the current search query. */
    function rerenderControls() {
        if (!overlay) {
            return;
        }
        renderBody(overlay.querySelector('.settings-body'), overlay.querySelector('.settings-search').value);
    }

    /**
     * Builds a sub-heading divider row.
     * @param {object} row - {divider, label}
     * @returns {HTMLElement} Divider element
     */
    function buildDivider(row) {
        const divider = document.createElement('div');
        divider.className = 'settings-divider';
        divider.textContent = row.label;
        return divider;
    }

    /**
     * Builds one option row: label, control, reset, and description toggle.
     * @param {object} row - Schema row
     * @returns {HTMLElement} Row element
     */
    function buildRow(row) {
        const container = document.createElement('div');
        container.className = 'settings-row';
        container.dataset.path = row.path;

        const label = document.createElement('label');
        label.className = 'settings-row-label';
        label.textContent = row.label;
        label.title = row.path;

        const control = buildControl(row);

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'settings-row-reset';
        reset.textContent = '↺';
        reset.title = `Reset to default (${formatDefault(row.default)})`;
        reset.addEventListener('click', () => {
            commit(row.path, undefined);
            setControlValue(control, row, mergedValue(partial, row.path));
        });

        const help = document.createElement('button');
        help.type = 'button';
        help.className = 'settings-row-help';
        help.textContent = '?';
        help.title = 'Show description';

        const description = document.createElement('div');
        description.className = 'settings-row-description';
        description.hidden = true;
        description.textContent = `${row.description} Default: ${formatDefault(row.default)}. (${row.path})`;
        help.addEventListener('click', () => {
            description.hidden = !description.hidden;
        });

        container.append(label, control, reset, help, description);
        return container;
    }

    /**
     * Formats a default value for row tooltips.
     * @param {unknown} value - Typed default value
     * @returns {string} Short display string
     */
    function formatDefault(value) {
        if (value === Infinity) {
            return '∞';
        }
        if (typeof value === 'string') {
            return value === '' ? '""' : value;
        }
        return JSON.stringify(value);
    }

    /**
     * Builds the input element for a row and wires its change handling.
     * @param {object} row - Schema row
     * @returns {HTMLElement} Control element
     */
    function buildControl(row) {
        const current = mergedValue(partial, row.path);
        let control;
        if (row.control === 'select') {
            control = document.createElement('select');
            if (row.nullable) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '(auto)';
                control.appendChild(option);
            }
            for (const value of row.enumValues) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                control.appendChild(option);
            }
            control.addEventListener('change', () => {
                commit(row.path, control.value === '' && row.nullable ? null : control.value);
            });
        } else if (row.control === 'checkbox') {
            control = document.createElement('input');
            control.type = 'checkbox';
            control.addEventListener('change', () => {
                commit(row.path, control.checked);
            });
        } else if (row.control === 'number') {
            control = document.createElement('input');
            control.type = 'number';
            if (row.min !== undefined) {
                control.min = String(row.min);
            }
            if (row.max !== undefined) {
                control.max = String(row.max);
            }
            control.step = row.step !== undefined ? String(row.step) : 'any';
            if (row.allowsInfinity) {
                control.placeholder = '∞';
            }
            control.addEventListener('change', () => {
                if (control.value === '') {
                    commit(row.path, row.allowsInfinity ? Infinity : row.nullable ? null : undefined);
                    return;
                }
                const parsed = Number(control.value);
                if (Number.isFinite(parsed)) {
                    commit(row.path, parsed);
                }
            });
        } else if (row.control === 'color') {
            control = document.createElement('input');
            control.type = 'color';
            control.addEventListener('input', () => {
                commit(row.path, control.value);
            });
        } else if (row.control === 'json') {
            control = document.createElement('input');
            control.type = 'text';
            control.spellcheck = false;
            control.classList.add('settings-json-input');
            control.addEventListener('change', () => {
                if (control.value.trim() === '') {
                    commit(row.path, undefined);
                    control.classList.remove('settings-input-invalid');
                    setControlValue(control, row, mergedValue(partial, row.path));
                    return;
                }
                try {
                    commit(row.path, JSON.parse(control.value));
                    control.classList.remove('settings-input-invalid');
                } catch {
                    control.classList.add('settings-input-invalid');
                }
            });
        } else {
            control = document.createElement('input');
            control.type = 'text';
            control.spellcheck = false;
            control.addEventListener('change', () => {
                if (control.value === '') {
                    commit(row.path, row.nullable ? null : undefined);
                    return;
                }
                commit(row.path, control.value);
            });
        }
        control.classList.add('settings-row-control');
        setControlValue(control, row, current);
        return control;
    }

    /**
     * Writes the current effective value into a control.
     * @param {HTMLElement} control - Control element
     * @param {object} row - Schema row
     * @param {unknown} value - Effective value
     */
    function setControlValue(control, row, value) {
        if (row.control === 'checkbox') {
            control.checked = Boolean(value);
        } else if (row.control === 'select') {
            control.value = value === null ? '' : String(value);
        } else if (row.control === 'number') {
            control.value = value === null || value === Infinity ? '' : String(value);
        } else if (row.control === 'json') {
            control.value = value === null || value === undefined ? '' : JSON.stringify(value);
        } else {
            control.value = value === null || value === undefined ? '' : String(value);
        }
    }

    /** Highlights every row whose value differs from the library default. */
    function refreshModifiedMarkers() {
        if (!overlay) {
            return;
        }
        for (const rowElement of overlay.querySelectorAll('.settings-row[data-path]')) {
            rowElement.classList.toggle('modified', hasOverride(rowElement.dataset.path));
        }
    }

    /**
     * Checks whether a path (or any child of it) is overridden.
     * @param {string} path - Dotted option path
     * @returns {boolean} True when the partial stores a value for it
     */
    function hasOverride(path) {
        return getPath(partial, path) !== undefined;
    }

    /**
     * Builds the "Export image" section: resolution, background, and a
     * download button for a high-resolution PNG of the current view.
     * @returns {HTMLElement} Export section (an open <details>)
     */
    function buildExportSection() {
        const details = document.createElement('details');
        details.className = 'settings-group';
        details.open = true;
        const summary = document.createElement('summary');
        summary.textContent = 'Export image';
        details.appendChild(summary);

        const hint = document.createElement('div');
        hint.className = 'settings-hint';
        hint.textContent = 'Downloads a high-resolution PNG of the current view, including atom labels.';
        details.appendChild(hint);

        // Resolution: a scale multiplier or an explicit long-edge pixel target.
        const resolutionRow = settingsRow('Resolution');
        const scaleSelect = document.createElement('select');
        scaleSelect.className = 'settings-row-control';
        for (const value of ['1', '2', '4', 'custom']) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value === 'custom' ? 'Custom long edge…' : `${value}× on-screen`;
            scaleSelect.appendChild(option);
        }
        scaleSelect.value = exportConfig.useLongEdge ? 'custom' : String(exportConfig.scale);
        resolutionRow.append(scaleSelect);
        details.appendChild(resolutionRow);

        const longEdgeRow = settingsRow('Long edge (px)');
        const longEdgeInput = document.createElement('input');
        longEdgeInput.type = 'number';
        longEdgeInput.min = '64';
        longEdgeInput.max = '16384';
        longEdgeInput.step = '1';
        longEdgeInput.className = 'settings-row-control';
        longEdgeInput.value = String(exportConfig.longEdge);
        longEdgeRow.append(longEdgeInput);
        longEdgeRow.hidden = !exportConfig.useLongEdge;
        details.appendChild(longEdgeRow);

        const dimensionNote = document.createElement('div');
        dimensionNote.className = 'settings-hint';
        details.appendChild(dimensionNote);

        scaleSelect.addEventListener('change', () => {
            exportConfig.useLongEdge = scaleSelect.value === 'custom';
            if (!exportConfig.useLongEdge) {
                exportConfig.scale = Number(scaleSelect.value);
            }
            longEdgeRow.hidden = !exportConfig.useLongEdge;
            updateDimensionNote();
        });
        longEdgeInput.addEventListener('change', () => {
            const value = Number(longEdgeInput.value);
            if (Number.isFinite(value) && value >= 64) {
                exportConfig.longEdge = value;
                updateDimensionNote();
            }
        });

        const backgroundRow = settingsRow('Background');
        const backgroundSelect = document.createElement('select');
        backgroundSelect.className = 'settings-row-control';
        for (const [value, label] of [['transparent', 'Transparent'], ['#ffffff', 'White'], ['#000000', 'Black']]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            backgroundSelect.appendChild(option);
        }
        backgroundSelect.value = exportConfig.background;
        backgroundSelect.addEventListener('change', () => {
            exportConfig.background = backgroundSelect.value;
        });
        backgroundRow.append(backgroundSelect);
        details.appendChild(backgroundRow);

        const labelsRow = settingsRow('Include atom labels');
        const labelsInput = document.createElement('input');
        labelsInput.type = 'checkbox';
        labelsInput.className = 'settings-row-control';
        labelsInput.checked = exportConfig.labels;
        labelsInput.addEventListener('change', () => {
            exportConfig.labels = labelsInput.checked;
        });
        labelsRow.append(labelsInput);
        details.appendChild(labelsRow);

        const downloadRow = document.createElement('div');
        downloadRow.className = 'settings-row';
        const downloadButton = actionButton('Download PNG', downloadImage);
        downloadButton.classList.add('settings-download');
        downloadRow.appendChild(downloadButton);
        details.appendChild(downloadRow);

        /** Updates the estimated output-size note from the live viewer. */
        function updateDimensionNote() {
            const viewer = host.getViewer();
            const w = viewer?.container?.clientWidth ?? 0;
            const h = viewer?.container?.clientHeight ?? 0;
            if (!w || !h) {
                dimensionNote.textContent = '';
                return;
            }
            const scale = exportConfig.useLongEdge
                ? exportConfig.longEdge / Math.max(w, h)
                : exportConfig.scale;
            const capped = Math.min(scale, 16384 / Math.max(w, h));
            dimensionNote.textContent =
                `Output: ${Math.round(w * capped)} × ${Math.round(h * capped)} px`;
        }
        updateDimensionNote();
        return details;
    }

    /**
     * Builds a settings row shell with a label.
     * @param {string} labelText - Row label
     * @returns {HTMLElement} Row element
     */
    function settingsRow(labelText) {
        const row = document.createElement('div');
        row.className = 'settings-row';
        const label = document.createElement('label');
        label.className = 'settings-row-label';
        label.textContent = labelText;
        row.append(label);
        return row;
    }

    /** Renders the current view and triggers a PNG download. */
    async function downloadImage() {
        try {
            const viewer = host.getViewer();
            const blob = await viewer.captureImageBlob({
                scale: exportConfig.scale,
                longEdge: exportConfig.useLongEdge ? exportConfig.longEdge : null,
                background: exportConfig.background,
                includeLabels: exportConfig.labels,
            });
            const name = (host.getStructureName?.() || 'structure').replace(/[^\w.-]+/g, '_');
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${name}.png`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            host.updateStatus('Image downloaded', 'success');
        } catch (error) {
            console.error('Image export failed:', error);
            host.updateStatus(`Image export failed: ${error.message}`, 'error');
        }
    }

    /**
     * Builds the element colours & radii section.
     * @param {object} group - Elements schema group
     * @returns {HTMLElement} Section element
     */
    function buildElementSection(group) {
        const container = document.createElement('div');
        container.className = 'settings-elements';

        const summaryLine = document.createElement('div');
        summaryLine.className = 'settings-hint';

        const updateSummary = () => {
            const customised = Object.keys(partial.elementProperties ?? {});
            summaryLine.textContent = customised.length > 0
                ? `Customised: ${customised.join(', ')}`
                : 'No element overrides yet. Pick an element and adjust its properties.';
        };

        const select = document.createElement('select');
        select.className = 'settings-row-control';
        for (const element of group.elements) {
            const option = document.createElement('option');
            option.value = element;
            option.textContent = element;
            select.appendChild(option);
        }
        select.value = 'C';

        const rows = group.elementKeys.map((keySpec) => {
            const row = document.createElement('div');
            row.className = 'settings-row';
            const label = document.createElement('label');
            label.className = 'settings-row-label';
            label.textContent = keySpec.label;
            const input = document.createElement('input');
            input.className = 'settings-row-control';
            input.type = keySpec.control === 'number' ? 'number' : 'color';
            if (keySpec.step) {
                input.step = String(keySpec.step);
            }
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'settings-row-reset';
            reset.textContent = '↺';
            reset.title = 'Reset to default';
            const path = () => `elementProperties.${select.value}.${keySpec.key}`;
            const refresh = () => {
                const value = mergedValue(partial, path());
                input.value = keySpec.control === 'number' ? String(value) : String(value);
                row.classList.toggle('modified', getPath(partial, path()) !== undefined);
                updateSummary();
            };
            input.addEventListener(keySpec.control === 'number' ? 'change' : 'input', () => {
                const value = keySpec.control === 'number' ? Number(input.value) : input.value;
                if (keySpec.control !== 'number' || Number.isFinite(value)) {
                    commit(path(), value);
                    refresh();
                }
            });
            reset.addEventListener('click', () => {
                commit(path(), undefined);
                refresh();
            });
            row.append(label, input, reset);
            row.refresh = refresh;
            return row;
        });

        select.addEventListener('change', () => {
            rows.forEach((row) => row.refresh());
        });
        rows.forEach((row) => row.refresh());
        updateSummary();

        const pickerRow = document.createElement('div');
        pickerRow.className = 'settings-row';
        const pickerLabel = document.createElement('label');
        pickerLabel.className = 'settings-row-label';
        pickerLabel.textContent = 'Element';
        pickerRow.append(pickerLabel, select);

        container.append(summaryLine, pickerRow, ...rows);
        return container;
    }

    /**
     * Creates a small header action button.
     * @param {string} text - Button caption
     * @param {function(): void} onClick - Click handler
     * @returns {HTMLButtonElement} Button
     */
    function actionButton(text, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-action';
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }
}
