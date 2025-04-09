import { CrystalViewer } from './ortep3d/crystal-viewer.js';
import { SVG_ICONS } from './generated/svg-icons.js';
import { formatValueEsd } from './formatting.js';
import defaultSettings from './ortep3d/structure-settings.js';

const defaultStyles = `
  cifview-widget {
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    height: 100%;
    position: relative;
    background: #fafafa;
    border-radius: 8px;
    overflow: hidden;
  }
  
  cifview-widget .crystal-container {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  
  cifview-widget .crystal-caption {
    padding: 12px 16px;
    background: #ffffff;
    border-top: 1px solid #eaeaea;
    color: #333;
    font-size: 14px;
    line-height: 1.5;
  }

  cifview-widget .button-container {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 1000;
  }

  cifview-widget .control-button {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  cifview-widget .control-button:hover {
    background: #ffffff;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  cifview-widget .control-button svg {
    width: 24px;
    height: 24px;
  }
`;

export class CifViewWidget extends HTMLElement {
    static get observedAttributes() {
        return [
            'caption', 'src', 'data', 'icons', 'filtered-atoms', 'options', 'hydrogen-mode', 'disorder-mode',
            'symmetry-mode',
        ];
    }

    constructor() {
        super();
        if (!document.getElementById('cifview-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'cifview-styles';
            styleSheet.textContent = defaultStyles;
            document.head.appendChild(styleSheet);
        }
        
        this.viewer = null;
        this.baseCaption = '';
        this.selections = [];
        this.customIcons = null;
        this.userOptions = {};
        this.defaultCaption = 'Generated with <a href="https://github.com/Niolon/cifvis">CifVis</a>.';
    }

    get icons() {
        return { ...SVG_ICONS, ...this.customIcons };
    }

    async connectedCallback() {
        this.baseCaption = this.getAttribute('caption') || this.defaultCaption;
        
        // Parse options before creating the viewer
        this.parseOptions();
        this.parseInitialModes();
        
        const container = document.createElement('div');
        container.className = 'crystal-container';
        this.appendChild(container);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        container.appendChild(buttonContainer);
        this.buttonContainer = buttonContainer;  // Store reference to button container

        const caption = document.createElement('div');
        caption.className = 'crystal-caption';
        caption.innerHTML = this.baseCaption;
        this.appendChild(caption);
        this.captionElement = caption;

        // Create viewer with merged options
        this.viewer = new CrystalViewer(container, this.userOptions);
        
        this.viewer.selections.onChange(selections => {
            this.selections = selections;
            this.updateCaption();
        });
        
        this.customIcons = this.parseCustomIcons();
        await this.updateFilteredAtoms();

        // Load structure first to determine which buttons to show
        const src = this.getAttribute('src');
        const data = this.getAttribute('data');
        if (src) {
            await this.loadFromUrl(src); 
        } else if (data) {
            await this.loadFromString(data); 
        }
    }

    parseOptions() {
        const optionsAttr = this.getAttribute('options');
        if (!optionsAttr) {
            return; 
        }

        try {
            const parsedOptions = JSON.parse(optionsAttr);
            this.userOptions = this.mergeOptions(parsedOptions);
        } catch (e) {
            console.warn('Failed to parse options:', e);
        }
    }

    mergeOptions(userOptions) {
        // Deep merge of user options with default settings
        const merged = { ...defaultSettings };

        // Handle top-level properties
        Object.keys(userOptions).forEach(key => {
            if (key === 'elementProperties') {
                // Special handling for elementProperties to preserve defaults
                merged.elementProperties = { ...merged.elementProperties };
                
                // Merge element properties
                Object.keys(userOptions.elementProperties || {}).forEach(element => {
                    merged.elementProperties[element] = {
                        ...(merged.elementProperties[element] || {}),
                        ...userOptions.elementProperties[element],
                    };
                });
            } else if (typeof userOptions[key] === 'object' && userOptions[key] !== null) {
                // Merge nested objects (like camera, selection, interaction)
                merged[key] = {
                    ...(merged[key] || {}),
                    ...userOptions[key],
                };
            } else {
                // Direct assignment for primitive values
                merged[key] = userOptions[key];
            }
        });

        return merged;
    }

    parseInitialModes() {
        // Get initial modes from attributes
        const hydrogenMode = this.getAttribute('hydrogen-mode');
        const disorderMode = this.getAttribute('disorder-mode');
        const symmetryMode = this.getAttribute('symmetry-mode');
        
        // Set in options if provided
        if (hydrogenMode) {
            this.userOptions.hydrogenMode = hydrogenMode;
        }
        
        if (disorderMode) {
            this.userOptions.disorderMode = disorderMode;
        }
        
        if (symmetryMode) {
            this.userOptions.symmetryMode = symmetryMode;
        }
    }

    clearButtons() {
        if (this.buttonContainer) {
            while (this.buttonContainer.firstChild) {
                this.buttonContainer.removeChild(this.buttonContainer.firstChild);
            }
        }
    }

    setupButtons() {
        if (!this.viewer || !this.viewer.state.baseStructure) {
            return; 
        }

        this.clearButtons();
        
        if (this.viewer.numberModifierModes('hydrogen') > 1) {
            this.addButton(this.buttonContainer, 'hydrogen', 'Toggle Hydrogen Display');
        }
        if (this.viewer.numberModifierModes('disorder') > 2) {
            this.addButton(this.buttonContainer, 'disorder', 'Toggle Disorder Display');
        }
        if (this.viewer.numberModifierModes('symmetry') > 1) {
            this.addButton(this.buttonContainer, 'symmetry', 'Toggle Symmetry Display');
        }
    }

    parseCustomIcons() {
        try {
            let iconSource;
            try {
                iconSource = JSON.parse(this.getAttribute('icons'));
            } catch {
                throw new Error('Failed to parse custom icon definition. Needs to be valid JSON.');
            }
            if (!iconSource) {
                return null;
            }

            const customNames = Object.getOwnPropertyNames(iconSource);

            const modifierNames = Object.getOwnPropertyNames(this.viewer.modifiers);

            const invalidNames = customNames.filter(name => !modifierNames.includes(name));

            if (invalidNames.length > 0) {
                throw new Error(
                    `One or more invalid categories for custom icons: ${invalidNames.join(', ')}.`
                    + ` Valid categories: ${modifierNames.join(', ')}`,
                ); 
            }

            const customIcons = {};
            const invalidIcons = [];

            for (const customName of customNames) {
                customIcons[customName] = {};
                const validNames = Object.values(this.viewer.modifiers[customName].MODES);
                const newNames = Object.getOwnPropertyNames(iconSource[customNames]);
                newNames.forEach(name => {
                    if (!validNames.includes(name)) {
                        invalidIcons.push([customName, name]);
                    } else {
                        customIcons[customName][name] = iconSource[customName][name];
                    }
                });
            }

            if (invalidIcons.length > 0) {
                const listString = invalidIcons.map(([category, item]) => `${category}: ${item}`).join(' ,');
                throw new Error(`The following custom icons do not map to a valid mode: ${listString}`);
            }
            return customIcons;
        } catch (e) {
            console.warn('Failed to parse custom icons:', e);
            return null;
        }
    }

    async updateFilteredAtoms() {
        const filteredAtomsString = this.getAttribute('filtered-atoms');
        this.viewer.modifiers.removeatoms.setFilteredLabels(filteredAtomsString || '');
        if (filteredAtomsString && filteredAtomsString.trim()) {
            this.viewer.modifiers.removeatoms.mode = 'on';
        } else {
            this.viewer.modifiers.removeatoms.mode = 'off';
        }
        this.setupButtons();
    }

    addButton(container, type, altText) {
        const button = document.createElement('button');
        button.className = `control-button ${type}-button`;
        const mode = this.viewer.modifiers[type].mode;
        button.innerHTML = this.icons[type][mode];
        button.title = altText;
        
        const svgElement = button.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('alt', altText);
            svgElement.setAttribute('role', 'img');
            svgElement.setAttribute('aria-label', altText);
        }
        
        container.appendChild(button);

        button.addEventListener('click', async () => {
            const result = await this.viewer.cycleModifierMode(type);
            if (result.success) {
                button.innerHTML = this.icons[type][result.mode];
            }
        });
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (!this.viewer) {
            return; 
        }

        // eslint-disable-next-line default-case
        switch (name) {
            case 'caption':
                this.baseCaption = (newValue && newValue === '') ? this.defaultCaption : newValue;
                this.updateCaption();
                break;
            case 'src':
                if (newValue) {
                    await this.loadFromUrl(newValue); 
                }
                break;
            case 'data':
                if (newValue) {
                    await this.loadFromString(newValue); 
                }
                break;
            case 'icons':
                this.customIcons = this.parseCustomIcons();
                break;
            case 'filtered-atoms':
                await this.updateFilteredAtoms();
                await this.viewer.updateStructure();
                break;
            case 'options':
                this.parseOptions();
                // Recreate viewer with new options
                if (this.viewer) {
                    const container = this.querySelector('.crystal-container');
                    const currentCifContent = this.viewer.state.currentCifContent;

                    this.viewer.dispose();
                    this.viewer = new CrystalViewer(container, this.userOptions);
                    this.viewer.selections.onChange(selections => {
                        this.selections = selections;
                        this.updateCaption();
                    });
                    
                    // Reload structure if we already had one
                    if (currentCifContent) {
                        await this.viewer.loadStructure(currentCifContent);
                        this.setupButtons();
                    }
                }
                break;
            case 'hydrogen-mode':
                if (this.viewer.modifiers.hydrogen) {
                    this.viewer.modifiers.hydrogen.mode = newValue;
                    await this.viewer.updateStructure();
                    this.setupButtons();
                }
                break;
            case 'disorder-mode':
                if (this.viewer.modifiers.disorder) {
                    this.viewer.modifiers.disorder.mode = newValue;
                    await this.viewer.updateStructure();
                    this.setupButtons();
                }
                break;
            case 'symmetry-mode':
                if (this.viewer.modifiers.symmetry) {
                    this.viewer.modifiers.symmetry.mode = newValue;
                    await this.viewer.setupNewStructure();
                    this.setupButtons();
                }
                break;
        }
    }

    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to load CIF file: ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Received no or invalid content for src.');
            }
            
            const text = await response.text();
            
            if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                throw new Error('Received no or invalid content for src.');
            }
            
            const result = await this.viewer.loadStructure(text);
            
            if (result.success) {
                this.setupButtons();  // Setup buttons after loading
            } else {
                throw new Error(result.error ||'Unknown Error');
            }
        } catch (error) {
            this.createErrorDiv(error);
        }    
    }
    
    async loadFromString(data) {
        try {
            await this.viewer.loadStructure(data);
            this.setupButtons();  // Setup buttons after loading
        } catch (error) {
            this.createErrorDiv(error);
        }
    }

    createErrorDiv(error) {
        console.error('Error loading structure:', error);
            
        // Sanitize error message
        const sanitizedMessage = this.sanitizeHTML(error.message);
        
        // Update caption to show sanitized error message
        this.baseCaption = `Error loading structure: ${sanitizedMessage}`;
        this.updateCaption();
        
        // Optional: Create an error display in the viewer area
        if (this.viewer) {
            const container = this.querySelector('.crystal-container');
            if (container) {
                // Clear the container
                while (container.firstChild) {
                    container.firstChild.remove();
                }
                
                // Add error message
                const errorDiv = document.createElement('div');
                errorDiv.style.display = 'flex';
                errorDiv.style.justifyContent = 'center';
                errorDiv.style.alignItems = 'center';
                errorDiv.style.height = '100%';
                errorDiv.style.padding = '20px';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.color = '#d32f2f';
                
                // Create elements programmatically instead of using innerHTML
                const contentDiv = document.createElement('div');
                
                const heading = document.createElement('h3');
                heading.textContent = 'Error Loading Structure';
                contentDiv.appendChild(heading);
                
                const messagePara = document.createElement('p');
                messagePara.textContent = sanitizedMessage;
                contentDiv.appendChild(messagePara);
                
                const helpPara = document.createElement('p');
                helpPara.textContent = 'Please check that the file exists and is a valid CIF file.';
                contentDiv.appendChild(helpPara);
                
                errorDiv.appendChild(contentDiv);
                container.appendChild(errorDiv);
            }
        }
    }
    
    /**
     * Sanitizes HTML strings to prevent XSS attacks
     * @param {string} html - The potentially unsafe HTML string
     * @returns {string} - Sanitized string with HTML entities escaped
     */
    sanitizeHTML(html) {
        if (!html) {
            return '';
        };
        return String(html)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    updateCaption() {
        let caption = this.baseCaption;
        
        if (this.selections.length > 0) {
            if (!caption.endsWith('.')) {
                caption += '.';
            }
            caption += ' Selected Atoms and Bonds: ';
            
            const selectionInfo = this.selections.map(selection => {
                const color = '#' + selection.color.toString(16).padStart(6, '0');
                let info = '';
                if (selection.type === 'atom') {
                    info = `${selection.data.label} (${selection.data.atomType})`;
                } else if (selection.type === 'bond') {
                    const bondLengthString = formatValueEsd(selection.data.bondLength, selection.data.bondLengthSU);
                    info = `${selection.data.atom1Label}-${selection.data.atom2Label}: ${bondLengthString} Å`;
                } else if (selection.type === 'hbond') {
                    info = `${selection.data.donorAtomLabel}→${selection.data.acceptorAtomLabel}`;
                }
                return `<span style="color:${color}">${info}</span>`;
            }).join(', ');
            
            caption += selectionInfo + '.';
        }
        
        this.captionElement.innerHTML = caption;
        this.viewer.controls.handleResize();
    }

    disconnectedCallback() {
        if (this.viewer) {
            this.viewer.dispose();
        }
    }
}