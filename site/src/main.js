import { CIF, CrystalViewer } from '../../src';
import { formatValueEsd } from '../../src';
import { measurementAction } from '../../src';
import { getDisorderIcon } from '../../src';
import { SVG_ICONS } from '../../src/lib/generated/svg-icons.js';
import {
    createScalarFieldDisplayState,
    reduceScalarFieldDisplayState,
} from '../../src/lib/density/scalar-field-display-state.js';
import {
    classifyPlaygroundCif,
    hasSupportedReflectionData,
} from './playground-cif-routing.js';
import { clearStoredOptions, loadStartingView, loadStoredOptions } from './playground-settings.js';
import { initializeSettingsOverlay } from './settings-overlay.js';

/**
 * Updates the status message displayed to the user
 * @param {string} message - The message to display
 * @param {string} [type] - The type of message: 'info', 'success', or 'error'
 */
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `show ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            statusElement.className = statusElement.className.replace('show', '');
        }, 2000);
    }
}

/** Hides the transient playground status box. */
function clearStatus() {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = '';
    statusElement.className = '';
}

// --- Viewer lifecycle -------------------------------------------------------
// The viewer options come from the settings overlay (persisted in
// localStorage). Options without a live setter require disposing and
// recreating the viewer, so construction lives in createViewer() and the
// event handlers are named functions that can be re-registered.

let viewer = null;
let scalarFieldDisplay = createScalarFieldDisplayState();

/** Applies the optional browser-local starting view after the structure is fitted. */
function applySavedStartingView() {
    const startingView = loadStartingView();
    if (startingView !== null) {
        viewer.setViewState(startingView);
    }
}

/**
 * Creates the playground viewer and wires its event handlers.
 * Corrupt stored options are cleared and construction retried with defaults.
 * @param {object} optionsPartial - Non-default viewer options
 * @returns {CrystalViewer} Ready viewer instance
 */
function createViewer(optionsPartial) {
    let created;
    try {
        created = new CrystalViewer(document.body, optionsPartial);
    } catch (error) {
        console.error('Stored viewer options rejected, falling back to defaults:', error);
        clearStoredOptions();
        updateStatus('Stored settings were invalid and have been reset.', 'error');
        created = new CrystalViewer(document.body, {});
    }
    created.animate();
    created.onScalarFieldUpdate(handleScalarFieldUpdate);
    created.onMeasurementChange(handleMeasurementChange);
    created.selections.onChange(handleSelectionsChange);
    return created;
}

/** @returns {{level:number, full:string}|null} Formatted density contour description. */
function currentScalarFieldLevelText() {
    if (!Number.isFinite(scalarFieldDisplay.level)) {
        return null;
    }
    const level = Number(scalarFieldDisplay.level.toPrecision(3));
    const sigma = Number.isFinite(scalarFieldDisplay.sigmaLevel)
        ? ` · ${Number(scalarFieldDisplay.sigmaLevel.toPrecision(3))}σ`
        : '';
    const sign = scalarFieldDisplay.signed ? '±' : '';
    const full = scalarFieldDisplay.quantityName === 'difference density'
        ? `Δρ ±${level} e Å⁻³${sigma}`
        : `${scalarFieldDisplay.quantityName} ${sign}${level}${sigma}`;
    return {
        level,
        full,
    };
}

/** Keeps the playground's lower-right density badge synchronized. */
function updateScalarFieldLevelDisplay() {
    const element = document.getElementById('density-level');
    const labels = currentScalarFieldLevelText();
    const loading = scalarFieldDisplay.loading;
    element.hidden = labels === null && !loading;
    element.replaceChildren();
    if (labels || loading) {
        const unit = document.createElement('span');
        unit.className = 'density-unit';
        unit.textContent = scalarFieldDisplay.displayLabel;
        const value = document.createElement('span');
        value.className = 'density-value';
        value.textContent = loading
            ? scalarFieldDisplay.totalSteps
                ? `${scalarFieldDisplay.stepIndex + 1}/${scalarFieldDisplay.totalSteps}`
                : '…'
            : `${scalarFieldDisplay.signed ? '±' : ''}${labels.level}`;
        element.append(unit, value);
    }
    element.classList.toggle('density-loading', loading);
    element.setAttribute('aria-busy', String(loading));
    const visible = scalarFieldDisplay.visible;
    const fieldPosition = scalarFieldDisplay.fieldCount > 1 &&
        scalarFieldDisplay.activeFieldIndex >= 0
        ? ` · ${scalarFieldDisplay.activeFieldIndex + 1}/${scalarFieldDisplay.fieldCount}`
        : '';
    const action = visible
        ? scalarFieldDisplay.fieldCount > 1 ? 'Cycle/hide' : 'Hide'
        : 'Show';
    element.setAttribute('aria-pressed', String(visible));
    element.title = loading
        ? scalarFieldDisplay.totalSteps
            ? `Calculating ${scalarFieldDisplay.quantityName}: step ` +
                `${scalarFieldDisplay.stepIndex + 1} of ${scalarFieldDisplay.totalSteps}`
            : `Calculating ${scalarFieldDisplay.quantityName}`
        : labels
            ? `${action} ${scalarFieldDisplay.quantityName} ` +
                `(${labels.full}${fieldPosition})`
            : '';
}

/**
 * Keeps the density badge in sync with viewer scalar-field events.
 * @param {object} update - Scalar-field event
 */
function handleScalarFieldUpdate(update) {
    scalarFieldDisplay = reduceScalarFieldDisplayState(scalarFieldDisplay, update);
    updateScalarFieldLevelDisplay();
}

/**
 * Renders the top-right selection info boxes for the current selections.
 * @param {Array<object>} selections - Current viewer selections
 */
function handleSelectionsChange(selections) {
    const container = document.getElementById('selection-container');
    viewer.setHoveredAtom(null);
    updateMeasurementButton(selections);
    // Remove all existing selections
    while (container.firstChild) {
        container.firstChild.remove();
    }
    // Create all selection boxes anew
    selections.forEach(item => {
        const box = document.createElement('div');
        box.className = 'selection-box';
        box.style.border = `3px solid #${item.color.toString(16)}`;

        if (item.type === 'atom') {
            const title = document.createElement('div');
            title.className = 'selection-title';
            title.append('Atom: ');
            const name = document.createElement('span');
            name.className = 'atom-name';
            name.dataset.atomId = item.data.uniqueId;
            name.textContent = item.data.label;
            title.appendChild(name);
            box.appendChild(title);
        } else if (item.type === 'bond') {
            const lengthString = formatValueEsd(item.data.bondLength, item.data.bondLengthSU);
            box.innerHTML = `
                <div class="selection-title">Bond: ${item.data.atom1Label} - ${item.data.atom2Label}</div>
                <div class="selection-info">
                    <span>Length:</span><span>${lengthString} Å</span>
                </div>
            `;
        } else if (item.type === 'hbond') {
            // Format values with their standard uncertainties
            const dLabel = item.data.hydrogenAtomLabel;
            const hLabel = item.data.hydrogenAtomLabel;
            const aLabel = item.data.acceptorAtomLabel;
            const dhLength = formatValueEsd(item.data.donorHydrogenDistance, item.data.donorHydrogenDistanceSU);
            const haLength = formatValueEsd(item.data.acceptorHydrogenDistance, item.data.acceptorHydrogenDistanceSU);
            const daLength = formatValueEsd(item.data.donorAcceptorDistance, item.data.donorAcceptorDistanceSU);
            const angle = formatValueEsd(item.data.hBondAngle, item.data.hBondAngleSU);

            box.innerHTML = `
                <div class="selection-title">H-Bond: ${dLabel} - ${hLabel} ··· ${aLabel}</div>
                <div class="selection-info">
                    <span>D-H:</span><span>${dhLength} Å</span>
                    <span>H···A:</span><span>${haLength} Å</span>
                    <span>D···A:</span><span>${daLength} Å</span>
                    <span>D-H···A:</span><span>${angle}°</span>
                </div>
            `;
        }

        container.appendChild(box);
    });
    renderMeasurementResults(viewer.getMeasurements());
}

/**
 * Updates the context-sensitive measurement action for the atom selection count.
 * @param {Array<object>} selections - Current viewer selections.
 */
function updateMeasurementButton(selections) {
    const button = document.getElementById('measurement-button');
    const atomCount = selections.filter(selection => selection.type === 'atom').length;
    const action = measurementAction(atomCount);
    button.disabled = !action.enabled;
    button.title = `${action.title} (${atomCount} selected)`;
    button.setAttribute('aria-label', button.title);
    button.replaceChildren();
    const symbol = document.createElement('span');
    symbol.className = 'measurement-symbol';
    symbol.textContent = action.symbol;
    const count = document.createElement('span');
    count.className = 'measurement-count';
    count.textContent = String(atomCount);
    button.append(symbol, count);
}

/**
 * Displays a persistent measurement alongside the selection details.
 * @param {object} measurement - Measurement returned by the viewer.
 * @returns {HTMLElement} Measurement result card.
 */
function createMeasurementResult(measurement) {
    const result = document.createElement('div');
    result.className = 'selection-box measurement-result';
    result.dataset.measurementId = measurement.id;
    result.style.borderLeftColor = `#${measurement.color.toString(16).padStart(6, '0')}`;
    const text = document.createElement('span');
    appendMeasurementDescription(text, measurement);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'measurement-dismiss';
    close.setAttribute('aria-label', 'Remove measurement');
    close.title = 'Remove measurement';
    close.textContent = '×';
    close.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        viewer.clearMeasurement(measurement.id);
    });
    result.append(text, close);
    return result;
}

/**
 * Adds one hover-linked atom name to a measurement description.
 * @param {HTMLElement} parent - Destination element.
 * @param {string} label - Displayed atom label.
 * @param {string} atomId - Symmetry-resolved atom ID.
 * @param {number} color - Owning measurement colour.
 */
function appendMeasurementAtomName(parent, label, atomId, color) {
    const name = document.createElement('span');
    name.className = 'atom-name';
    name.dataset.atomId = atomId;
    name.dataset.hoverColor = String(color);
    name.textContent = label;
    parent.appendChild(name);
}

/**
 * Builds a measurement description with individually hoverable atom names.
 * @param {HTMLElement} parent - Destination element.
 * @param {object} measurement - Measurement to describe.
 */
function appendMeasurementDescription(parent, measurement) {
    const value = measurement.value.toFixed(measurement.unit === '°' ? 2 : 3);
    if (measurement.type === 'plane-distance') {
        appendMeasurementAtomName(
            parent, measurement.probeLabel, measurement.atomIds.at(-1), measurement.color,
        );
        parent.append(' to mean plane (');
        measurement.planeLabels.forEach((label, index) => {
            if (index > 0) {
                parent.append(', ');
            }
            appendMeasurementAtomName(parent, label, measurement.atomIds[index], measurement.color);
        });
        parent.append(`): ${value} Å`);
        return;
    }
    const title = measurement.type === 'distance' ? 'Bond length ' :
        measurement.type === 'angle' ? 'Angle ' : 'Torsion ';
    parent.append(title);
    measurement.labels.forEach((label, index) => {
        if (index > 0) {
            parent.append('–');
        }
        appendMeasurementAtomName(parent, label, measurement.atomIds[index], measurement.color);
    });
    parent.append(`: ${value}${measurement.unit === '°' ? '' : ' '}${measurement.unit}`);
}

/**
 * Renders every persistent measurement alongside selection details.
 * @param {object[]} measurements - Current viewer measurements.
 */
function renderMeasurementResults(measurements) {
    const container = document.getElementById('selection-container');
    for (const result of container.querySelectorAll('.measurement-result')) {
        result.remove();
    }
    for (const measurement of measurements) {
        container.appendChild(createMeasurementResult(measurement));
    }
    bindAtomNameHover(container);
}

/** @param {object[]} measurements - Current viewer measurements. */
function handleMeasurementChange(measurements) {
    renderMeasurementResults(measurements);
}

/**
 * Binds atom-name hover elements to their exact displayed atom instances.
 * @param {HTMLElement} root - Selection UI containing atom names.
 */
function bindAtomNameHover(root) {
    for (const name of root.querySelectorAll('.atom-name[data-atom-id]')) {
        name.addEventListener('mouseenter', () => {
            if (name.dataset.hoverColor === undefined) {
                viewer.setHoveredAtom(name.dataset.atomId);
            } else {
                viewer.setHoveredAtom(name.dataset.atomId, Number(name.dataset.hoverColor));
            }
        });
        name.addEventListener('mouseleave', () => viewer.setHoveredAtom(null));
    }
}

viewer = createViewer(loadStoredOptions());

/**
 * Disposes the viewer and rebuilds it with new options, restoring the
 * current structure, block, and display modes. Used by the settings overlay
 * for options that have no live setter.
 * @param {object} optionsPartial - Non-default viewer options
 * @returns {Promise<void>}
 */
async function recreateViewer(optionsPartial) {
    const previousModes = {
        hydrogen: viewer.modifiers.hydrogen.mode,
        disorder: viewer.modifiers.disorder.mode,
        symmetry: viewer.modifiers.symmetry.mode,
    };
    const block = Number(document.getElementById('cif-block-select').value || 0);
    viewer.dispose();
    scalarFieldDisplay = createScalarFieldDisplayState();
    updateScalarFieldLevelDisplay();
    viewer = createViewer(optionsPartial);
    if (currentPlaygroundCifText !== null) {
        await loadPlaygroundCif(currentPlaygroundCifText, block);
    }
    // Restore modes the new options did not set themselves; unsupported
    // modes are skipped by the viewer.
    const modes = {};
    if (optionsPartial.hydrogenMode === undefined) {
        modes.hydrogen = previousModes.hydrogen;
    }
    if (optionsPartial.disorderMode === undefined) {
        modes.disorder = previousModes.disorder;
    }
    if (optionsPartial.symmetryMode === undefined) {
        modes.symmetry = previousModes.symmetry;
    }
    if (Object.keys(modes).length > 0) {
        await viewer.setModifierModes(modes);
    }
    applySavedStartingView();
    adaptButtons();
}

let playgroundLoadSequence = 0;
let currentPlaygroundCifText = null;
let currentPlaygroundName = 'structure';
let playgroundHasStructure = false;

/**
 * Stores an uploaded CIF and shows its block selector only when useful.
 * @param {string} cifText - Newly loaded CIF text.
 * @param {number} [initialBlock] - Initially selected block index.
 * @returns {number} Initially selected block index.
 */
function configurePlaygroundBlocks(cifText, initialBlock = 0) {
    currentPlaygroundCifText = cifText;
    const select = document.getElementById('cif-block-select');
    select.replaceChildren();
    const cif = new CIF(cifText);
    const names = cif.getBlockNames();
    const blockCount = cif.rawCifBlocks.length;
    for (let index = 0; index < blockCount; index++) {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = names[index] ? `data_${names[index]}` : `Block ${index + 1}`;
        select.appendChild(option);
    }
    select.hidden = blockCount <= 1;
    select.value = String(initialBlock);
    return initialBlock;
}

/**
 * Loads an uploaded playground CIF, adding a deferred density map when its
 * standard reflection data can be handled automatically.
 * @param {string} cifText - Uploaded CIF contents.
 * @param {number|string} [cifBlock] - Block index or name.
 * @returns {Promise<void>}
 */
async function loadPlaygroundCif(cifText, cifBlock = 0) {
    const loadSequence = ++playgroundLoadSequence;
    scalarFieldDisplay = createScalarFieldDisplayState();
    updateScalarFieldLevelDisplay();
    const calculateDensity = hasSupportedReflectionData(cifText, cifBlock);
    const result = await viewer.loadCIF(cifText, cifBlock, {
        differenceDensity: calculateDensity,
    });
    updateScalarFieldLevelDisplay();
    if (loadSequence !== playgroundLoadSequence) {
        return;
    }
    if (!result.success) {
        updateStatus('Error loading structure: ' + result.error, 'error');
        return;
    }

    playgroundHasStructure = true;
    applySavedStartingView();
    adaptButtons();
    if (!result.differenceDensityStarted) {
        updateStatus('Structure loaded successfully', 'success');
        return;
    }

    clearStatus();
    const density = await result.differenceDensity;
    if (loadSequence !== playgroundLoadSequence || density.cancelled) {
        return;
    }
    if (!density.success) {
        updateStatus(`Structure loaded; difference density failed: ${density.error}`, 'error');
        return;
    }

    clearStatus();
}

/**
 * Updates the active structure with reflection data from a separate CIF/FCF.
 * Cell compatibility and density progress are owned and reported by the viewer.
 * @param {string} cifText - Reflection-only CIF/FCF contents.
 * @param {number|string} [cifBlock] - Reflection block index or name.
 * @param {string} [fileName] - Source filename used as collection identity.
 * @returns {Promise<void>}
 */
async function loadPlaygroundDifferenceDensity(cifText, cifBlock = 0, fileName = '') {
    if (!playgroundHasStructure) {
        updateStatus('Load a coordinate CIF before adding a reflection-only CIF/FCF.', 'error');
        return;
    }

    const loadSequence = ++playgroundLoadSequence;
    clearStatus();
    const result = await viewer.loadDifferenceDensity(cifText, cifBlock, {
        fieldId: fileName ? `file:${fileName}` : undefined,
        fieldName: fileName || 'Difference density',
    });
    if (loadSequence !== playgroundLoadSequence || result.cancelled) {
        return;
    }
    if (!result.success) {
        updateStatus(`Difference density failed: ${result.error}`, 'error');
        return;
    }
    clearStatus();
}

/**
 * Loads a Cube scalar field over the active structure without replacing it.
 * @param {string} cubeText - Complete Cube file contents.
 * @param {string} [fileName] - Filename used for conservative property inference.
 */
async function loadPlaygroundCube(cubeText, fileName = '') {
    if (!playgroundHasStructure) {
        updateStatus('Load a coordinate CIF before adding a Cube file.', 'error');
        return;
    }
    const loadSequence = ++playgroundLoadSequence;
    clearStatus();
    const property = /(?:density|charge|rho)/i.test(fileName) ? 'density' : 'generic';
    const result = await viewer.loadCube(cubeText, {
        property,
        fieldId: fileName ? `file:${fileName}` : undefined,
        fieldName: fileName || property,
    });
    if (loadSequence !== playgroundLoadSequence || result.cancelled) {
        return;
    }
    if (!result.success) {
        updateStatus(`Cube field failed: ${result.error}`, 'error');
        return;
    }
    clearStatus();
}

/**
 * Routes coordinate-bearing files to a full load and reflection-only files to
 * the density loader for the current structure.
 * @param {string} cifText - Uploaded or dropped CIF/Cube text.
 * @param {string} [fileName] - Source filename used to route Cube files.
 * @returns {Promise<void>}
 */
async function loadPlaygroundText(cifText, fileName = '') {
    if (/\.(?:cube|cub)$/i.test(fileName)) {
        await loadPlaygroundCube(cifText, fileName);
        return;
    }
    const { coordinateBlock, reflectionBlock } = classifyPlaygroundCif(cifText);
    if (coordinateBlock !== null) {
        // Remember the base name for exported image filenames.
        currentPlaygroundName = fileName.replace(/\.[^.]+$/, '') || 'structure';
        await loadPlaygroundCif(
            cifText,
            configurePlaygroundBlocks(cifText, coordinateBlock),
        );
        return;
    }
    if (reflectionBlock !== null) {
        await loadPlaygroundDifferenceDensity(cifText, reflectionBlock, fileName);
        return;
    }
    updateStatus('No atom coordinates or supported reflection data found.', 'error');
}

/**
 * Initializes the file upload button and drag-and-drop functionality
 * Handles reading and loading CIF files into the viewer
 */
function initializeFileUpload() {
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('cif-upload');
    uploadButton.innerHTML = SVG_ICONS['upload'];

    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; 
        }
    
        try {
            updateStatus('Reading file...', 'info');
            const text = await file.text();
            await loadPlaygroundText(text, file.name);
        } catch (error) {
            console.error('Error reading file:', error);
            updateStatus('Error reading file: ' + error.message, 'error');
        }

    });

    // Drag and drop support
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const file = e.dataTransfer.files[0];
        if (!file || !/\.(?:cif|fcf|cube|cub)$/i.test(file.name)) {
            updateStatus('Please drop a CIF, FCF, or Cube file', 'error');
            return;
        }

        try {
            updateStatus('Reading file...', 'info');
            const text = await file.text();
            await loadPlaygroundText(text, file.name);
        } catch (error) {
            console.error('Error reading file:', error);
            updateStatus('Error reading file: ' + error.message, 'error');
        }
    });
}

/** Reloads the currently uploaded CIF when another data block is selected. */
function initializeBlockSelector() {
    const select = document.getElementById('cif-block-select');
    select.addEventListener('change', async () => {
        if (currentPlaygroundCifText === null) {
            return;
        }
        updateStatus(`Loading ${select.selectedOptions[0]?.textContent ?? 'CIF block'}...`, 'info');
        await loadPlaygroundCif(currentPlaygroundCifText, Number(select.value));
    });
}

/** Makes the compact density-level readout double as its visibility toggle. */
function initializeDensityLevelButton() {
    document.getElementById('density-level').addEventListener('click', () => {
        if (scalarFieldDisplay.available) {
            viewer.cycleScalarField();
        }
    });
}

/** Measures the selected atoms using the action implied by their selection count. */
function initializeMeasurementButton() {
    const button = document.getElementById('measurement-button');
    updateMeasurementButton([]);
    button.addEventListener('click', () => {
        try {
            viewer.measureSelectedAtoms();
            updateStatus('Measurement added', 'success');
        } catch (error) {
            updateStatus(error.message, 'error');
        }
    });
}

/**
 * Initializes the hydrogen display toggle button
 * Sets up event listeners to cycle through different hydrogen display modes
 */
function initializeHydrogenButton() {
    const hydrogenButton = document.getElementById('hydrogen-button');
    hydrogenButton.innerHTML = SVG_ICONS['hydrogen']['none'];
    hydrogenButton.addEventListener('click', async () => {
        const result = await viewer.cycleModifierMode('hydrogen');
        if (result.success) {
            hydrogenButton.innerHTML = SVG_ICONS['hydrogen'][viewer.modifiers.hydrogen.mode];
        }
    });
}

/**
 * Initializes the disorder display toggle button
 * Sets up event listeners to cycle through different disorder display modes
 */
function initializeDisorderButton() {
    const disorderButton = document.getElementById('disorder-button');
        
    disorderButton.addEventListener('click', async () => {
        const result = await viewer.cycleModifierMode('disorder');
        if (result.success) {
            disorderButton.innerHTML = getDisorderIcon(SVG_ICONS['disorder'], viewer.modifiers.disorder.mode);
        }
    });
}

/**
 * Initializes the symmetry display toggle button
 * Sets up event listeners to cycle through different symmetry display modes
 */
function initializeSymmetryButton() {
    const symmetryButton = document.getElementById('symmetry-button');
    symmetryButton.addEventListener('click', async () => {
        const result = await viewer.cycleModifierMode('symmetry');
        if (result.success) {
            symmetryButton.innerHTML = SVG_ICONS['symmetry'][viewer.modifiers.symmetry.mode];
        }
    });
}

/**
 * Initializes all UI components and their event handlers
 */
function initializeUI() {
    initializeFileUpload();
    initializeBlockSelector();
    initializeDensityLevelButton();
    initializeMeasurementButton();
    initializeHydrogenButton();
    initializeDisorderButton();
    initializeSymmetryButton();
    initializeSettingsOverlay({
        getViewer: () => viewer,
        recreateViewer,
        adaptButtons,
        updateStatus,
        getStructureName: () => currentPlaygroundName,
    });
}

/**
 * Updates the display state of UI buttons based on available structure modification options
 * Shows or hides buttons based on whether their corresponding modifiers can be applied
 */
function adaptButtons() {
    const hydrogenButton = document.getElementById('hydrogen-button');
    const hasHydrogen = viewer.numberModifierModes('hydrogen') > 1;
    hydrogenButton.style.display = hasHydrogen ? 'flex' : 'none';
    if (hasHydrogen) {
        hydrogenButton.innerHTML = SVG_ICONS['hydrogen'][viewer.modifiers.hydrogen.mode];
    }

    const disorderButton = document.getElementById('disorder-button');
    const hasDisorder = viewer.numberModifierModes('disorder') > 1;
    disorderButton.style.display = hasDisorder ? 'flex' : 'none';
    if (hasDisorder) {
        disorderButton.innerHTML = getDisorderIcon(SVG_ICONS['disorder'], viewer.modifiers.disorder.mode);
    }

    const symmetryButton = document.getElementById('symmetry-button');
    const hasSymmetryConnection = viewer.numberModifierModes('symmetry') > 1;
    symmetryButton.style.display = hasSymmetryConnection ? 'flex' : 'none';
    if (hasSymmetryConnection) {
        symmetryButton.innerHTML = SVG_ICONS['symmetry'][viewer.modifiers.symmetry.mode];
    }
}

initializeUI();

/** Loads the playground's original disorder example, including density work if supported. */
async function loadInitialStructure() {
    try {
        const baseUrl = import.meta.env.BASE_URL;
        const response = await fetch(`${baseUrl}cif/disorder.cif`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const cifText = await response.text();
        // Cache the text so a settings-driven viewer recreation can restore it.
        currentPlaygroundCifText = cifText;
        const calculateDensity = hasSupportedReflectionData(cifText);
        const result = await viewer.loadCIF(cifText, 0, {
            differenceDensity: calculateDensity,
        });
        if (!result.success) {
            throw new Error(result.error);
        }
        playgroundHasStructure = true;
        applySavedStartingView();
        adaptButtons();
        if (!result.differenceDensityStarted) {
            return;
        }
        const density = await result.differenceDensity;
        if (!density.success) {
            updateStatus(`Structure loaded; difference density failed: ${density.error}`, 'error');
        }
    } catch (error) {
        console.error('Error loading initial structure:', error);
        updateStatus('Error loading initial structure. Try uploading your own CIF file.', 'error');
    }
}

loadInitialStructure();
