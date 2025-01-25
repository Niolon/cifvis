import { CrystalViewer } from '..';
import { formatValueEsd } from '..';

// Status message handling
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

// Initialize the viewer
const viewer = new CrystalViewer(document.body);
viewer.animate();
viewer.onSelectionChange(selections => {
    const container = document.getElementById('selection-container');
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
            box.innerHTML = `
                <div class="selection-title">Atom: ${item.data.label}</div>
                <div class="selection-info">
                    <span>Type:</span><span>${item.data.atomType}</span>
                    <span>X:</span><span>${item.data.fractX.toFixed(4)}</span>
                    <span>Y:</span><span>${item.data.fractY.toFixed(4)}</span>
                    <span>Z:</span><span>${item.data.fractZ.toFixed(4)}</span>
                </div>
            `;
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
            const dhLength = formatValueEsd(item.data.donorHydrogenDistance, item.data.donorHydrogenDistanceSU);
            const haLength = formatValueEsd(item.data.acceptorHydrogenDistance, item.data.acceptorHydrogenDistanceSU);
            const daLength = formatValueEsd(item.data.donorAcceptorDistance, item.data.donorAcceptorDistanceSU);
            const angle = formatValueEsd(item.data.hBondAngle, item.data.hBondAngleSU);

            box.innerHTML = `
                <div class="selection-title">H-Bond: ${item.data.donorAtomLabel} - ${item.data.hydrogenAtomLabel} ··· ${item.data.acceptorAtomLabel}</div>
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
});
// File upload handling
function initializeFileUpload() {
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('cif-upload');

    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        try {
            updateStatus('Reading file...', 'info');
            const text = await file.text();
            const result = await viewer.loadStructure(text);
            if (result.success) {
                updateStatus('Structure loaded successfully', 'success');
                clearSelections();
                adaptButtons();
            } else {
                updateStatus('Error loading structure: ' + result.error, 'error');
            }
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
        if (!file || !file.name.endsWith('.cif')) {
            updateStatus('Please drop a CIF file', 'error');
            return;
        }

        try {
            updateStatus('Reading file...', 'info');
            const text = await file.text();
            const result = await viewer.loadStructure(text);
            if (result.success) {
                updateStatus('Structure loaded successfully', 'success');
                clearSelections();
                adaptButtons();
            } else {
                updateStatus('Error loading structure: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error reading file:', error);
            updateStatus('Error reading file: ' + error.message, 'error');
        }
    });
}

function clearSelections() {
    const container = document.getElementById('selection-container');

    while (container.firstChild) {
        container.firstChild.remove();
    }
}

// Hydrogen mode button
function initializeHydrogenButton() {
    const hydrogenButton = document.getElementById('hydrogen-button');
    hydrogenButton.addEventListener('click', async () => {
        const result = await viewer.cycleHydrogenMode();
        if (result.success) {
            const hydrogenIcon = hydrogenButton.querySelector('img');
            hydrogenIcon.src = `svg/hydrogen-${result.mode}.svg`;
        }
        clearSelections()
    });
}

// Disorder mode button
function initializeDisorderButton() {
    const disorderButton = document.getElementById('disorder-button');
        
    disorderButton.addEventListener('click', async () => {
        const result = await viewer.cycleDisorderMode();
        if (result.success) {
            const disorderIcon = disorderButton.querySelector('img');
            disorderIcon.src = `svg/disorder-${result.mode}.svg`;
        }
        clearSelections()
    });
}

function initializeSymmetryButton() {
    const symmetryButton = document.getElementById('symmetry-button');
    symmetryButton.addEventListener('click', async () => {
        const result = await viewer.cycleSymmetryMode();
        if (result.success) {
            const symmetryIcon = symmetryButton.querySelector('img');
            symmetryIcon.src = `svg/symmetry-${result.mode}.svg`;
        }

        clearSelections()
    });
}

// Add to initializeUI():
function initializeUI() {
    initializeFileUpload();
    initializeHydrogenButton();
    initializeDisorderButton();
    initializeSymmetryButton();
}

function adaptButtons() {
    const disorderButton = document.getElementById('disorder-button');
    const hasDisorder = viewer.hasDisorderGroups();
    disorderButton.style.display = hasDisorder ? 'flex' : 'none';
    if (hasDisorder) {
        const disorderIcon = disorderButton.querySelector('img');
        disorderIcon.src = `svg/disorder-${viewer.modifiers.disorder.mode}.svg`;
    }

    const symmetryButton = document.getElementById('symmetry-button');
    const hasSymmetryConnection = viewer.modifiers.symmetry.getApplicableModes(viewer.state.baseStructure).length > 1;
    symmetryButton.style.display = hasSymmetryConnection ? 'flex' : 'none';
    if (hasSymmetryConnection) {
        const symmetryIcon = symmetryButton.querySelector('img');
        symmetryIcon.src = `svg/symmetry-${viewer.modifiers.symmetry.mode}.svg`;
    }
}

initializeUI();

// Load initial structure
const baseUrl = import.meta.env.BASE_URL;
fetch(`${baseUrl}cif/disorder1.cif`)
    .then(res => res.text())
    .then(text => {
        const result = viewer.loadStructure(text);
        adaptButtons();
        return result;
    })
    .catch(error => {
        console.error('Error loading initial structure:', error);
        updateStatus('Error loading initial structure. Try uploading your own CIF file.', 'error');
    });