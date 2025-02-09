import { CrystalViewer } from './ortep3d/crystal-viewer.js';
import { SVG_ICONS } from 'virtual:svg-icons';
import { formatValueEsd } from './formatting.js';

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
        return ['caption', 'src', 'data', 'icons'];
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
    }

    get icons() {
        const defaultIcons = {
            hydrogen: { none: '', constant: '', anisotropic: '' },
            disorder: { all: '', group1: '', group2: '' },
            symmetry: { 
                'bonds-yes-hbonds-yes': '',
                'bonds-yes-hbonds-no': '',
                'bonds-no-hbonds-no': '',
            },
        };
        return { ...defaultIcons, ...SVG_ICONS, ...this.customIcons };
    }

    async connectedCallback() {
        this.baseCaption = this.getAttribute('caption') || '';
        this.customIcons = this.parseCustomIcons();
        
        const container = document.createElement('div');
        container.className = 'crystal-container';
        this.appendChild(container);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        container.appendChild(buttonContainer);
        this.buttonContainer = buttonContainer;  // Store reference to button container

        const caption = document.createElement('div');
        caption.className = 'crystal-caption';
        caption.textContent = this.baseCaption;
        this.appendChild(caption);
        this.captionElement = caption;

        this.viewer = new CrystalViewer(container);
        this.viewer.selections.onChange(selections => {
            this.selections = selections;
            this.updateCaption();
        });

        // Load structure first to determine which buttons to show
        const src = this.getAttribute('src');
        const data = this.getAttribute('data');
        if (src) {
            await this.loadFromUrl(src); 
        } else if (data) {
            await this.loadFromString(data); 
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
        
        const hasHydrogens = this.viewer.modifiers.hydrogen.getApplicableModes(this.viewer.state.baseStructure).length > 1;
        const hasDisorder = this.viewer.modifiers.disorder.getApplicableModes(this.viewer.state.baseStructure).length > 1;
        const hasSymmetry = this.viewer.modifiers.symmetry.getApplicableModes(this.viewer.state.baseStructure).length > 1;

        if (hasHydrogens) {
            this.addButton(this.buttonContainer, 'hydrogen', 'none', 'Toggle Hydrogen Display');
        }
        if (hasDisorder) {
            this.addButton(this.buttonContainer, 'disorder', 'all', 'Toggle Disorder Display');
        }
        if (hasSymmetry) {
            this.addButton(this.buttonContainer, 'symmetry', 'bonds-no-hbonds-no', 'Toggle Symmetry Display');
        }
    }

    parseCustomIcons() {
        try {
            const iconSources = {
                hydrogen: {
                    src: this.getAttribute('hydrogen-icons'),
                    modes: ['none', 'constant', 'anisotropic'],
                },
                disorder: {
                    src: this.getAttribute('disorder-icons'),
                    modes: ['all', 'group1', 'group2'],
                },
                symmetry: {
                    src: this.getAttribute('symmetry-icons'),
                    modes: ['bonds-yes-hbonds-yes', 'bonds-yes-hbonds-no', 'bonds-no-hbonds-no'],
                },
            };

            const icons = {};
            for (const [type, config] of Object.entries(iconSources)) {
                if (config.src) {
                    const files = config.src.split(',');
                    icons[type] = {};
                    config.modes.forEach((mode, index) => {
                        if (files[index]) {
                            icons[type][mode] = files[index].trim();
                        }
                    });
                }
            }
            return Object.keys(icons).length ? icons : null;
        } catch (e) {
            console.warn('Failed to parse custom icons:', e);
            return null;
        }
    }

    addButton(container, type, mode, altText) {
        const button = document.createElement('button');
        button.className = `control-button ${type}-button`;
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
            const result = await this.viewer[`cycle${type.charAt(0).toUpperCase() + type.slice(1)}Mode`]();
            if (result.success) {
                button.innerHTML = this.icons[type][result.mode];
            }
        });
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (!this.viewer) {
            return; 
        }

        switch (name) {
        case 'caption':
            this.baseCaption = newValue;
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
        }
    }

    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            await this.viewer.loadStructure(text);
            this.setupButtons();  // Setup buttons after loading
        } catch (error) {
            console.error('Error loading structure:', error);
        }
    }

    async loadFromString(data) {
        try {
            await this.viewer.loadStructure(data);
            this.setupButtons();  // Setup buttons after loading
        } catch (error) {
            console.error('Error loading structure:', error);
        }
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
                }
                return `<span style="color:${color}">${info}</span>`;
            }).join(', ');
            
            caption += selectionInfo + '.';
        }
        
        this.captionElement.innerHTML = caption;
    }

    disconnectedCallback() {
        if (this.viewer) {
            this.viewer.dispose();
        }
    }
}

customElements.define('cifview-widget', CifViewWidget);