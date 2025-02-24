/**
 * @jest-environment jsdom
 */

jest.mock('virtual:svg-icons', () => ({
    SVG_ICONS: {
        hydrogen: {
            none: '<svg>H-none</svg>',
            constant: '<svg>H-constant</svg>',
            anisotropic: '<svg>H-aniso</svg>',
        },
        disorder: {
            all: '<svg>D-all</svg>',
            group1: '<svg>D-g1</svg>',
            group2: '<svg>D-g2</svg>',
        },
        symmetry: {
            'bonds-yes-hbonds-yes': '<svg>S-yy</svg>',
            'bonds-yes-hbonds-no': '<svg>S-yn</svg>',
            'bonds-no-hbonds-no': '<svg>S-nn</svg>',
        },
    },
}), { virtual: true });

import { CrystalViewer } from './ortep3d/crystal-viewer.js';
import { formatValueEsd } from './formatting.js';
import { CifViewWidget } from './widget.js';
import { BondGenerator, DisorderFilter, HydrogenFilter, SymmetryGrower } from './structure/structure-modifiers.js';


// Mock CrystalViewer
jest.mock('./ortep3d/crystal-viewer.js');
jest.mock('./formatting.js');

customElements.define('cifview-widget', CifViewWidget);

describe('CifViewWidget', () => {
    let mockCrystalViewer;
    let mockSelectionCallback;
    let mockFetch;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock CrystalViewer instance
        mockCrystalViewer = {
            loadStructure: jest.fn().mockResolvedValue({ success: true }),
            cycleModifierMode: jest.fn().mockResolvedValue({ success: true, mode: 'constant' }),
            numberModifierModes: jest.fn().mockReturnValue(2),
            state: { baseStructure: {} },
            selections: {
                onChange: jest.fn(),
            },
            controls: {
                handleResize: jest.fn(),
            },
            dispose: jest.fn(),
            modifiers : {
                missingbonds: new BondGenerator(
                    {'H': {'radius': 0.8}},
                    1.1,
                ),
                hydrogen: new HydrogenFilter(),
                disorder: new DisorderFilter(),
                symmetry: new SymmetryGrower(),
            },
        };
        CrystalViewer.mockImplementation(() => mockCrystalViewer);

        // Mock selection callback storage
        mockSelectionCallback = null;
        mockCrystalViewer.selections.onChange.mockImplementation(callback => {
            mockSelectionCallback = callback;
        });

        // Mock fetch
        mockFetch = jest.fn().mockResolvedValue({
            text: () => Promise.resolve('mock cif data'),
        });
        global.fetch = mockFetch;

        // Mock formatValueEsd
        formatValueEsd.mockImplementation((value) => `${value} ± SU`);
    });

    afterEach(() => {
        // Clean up any widgets that were added to the DOM
        document.body.innerHTML = '';
    });

    test('initializes with default properties', () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);

        expect(widget.baseCaption).toBe('');
        expect(widget.selections).toEqual([]);
        expect(widget.customIcons).toBeNull();
        expect(CrystalViewer).toHaveBeenCalled();
    });

    test('loads structure from URL', async () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('src', 'test.cif');
        document.body.appendChild(widget);

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        expect(mockFetch).toHaveBeenCalledWith('test.cif');
        expect(mockCrystalViewer.loadStructure).toHaveBeenCalledWith('mock cif data');
    });

    test('loads structure from data attribute', async () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('data', 'direct cif data');
        document.body.appendChild(widget);

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        expect(mockCrystalViewer.loadStructure).toHaveBeenCalledWith('direct cif data');
    });

    test('sets up buttons based on available modes', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        widget.setAttribute('data', 'direct cif data');

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        const buttons = widget.querySelectorAll('.control-button');
        expect(buttons).toHaveLength(3); // One for each modifier type
        expect(buttons[0].className).toContain('hydrogen-button');
        expect(buttons[1].className).toContain('disorder-button');
        expect(buttons[2].className).toContain('symmetry-button');
    });

    test('cycles modifier modes on button click', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        widget.setAttribute('data', 'direct cif data');

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        const button = widget.querySelector('.hydrogen-button');
        await button.click();

        expect(mockCrystalViewer.cycleModifierMode).toHaveBeenCalledWith('hydrogen');
    });

    test('updates caption with selections', async () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('caption', 'Test Structure');
        document.body.appendChild(widget);

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        // Simulate selection change
        const mockSelections = [
            {
                type: 'atom',
                data: { label: 'C1', atomType: 'C' },
                color: 0xff0000,
            },
            {
                type: 'bond',
                data: {
                    atom1Label: 'C1',
                    atom2Label: 'O1',
                    bondLength: 1.5,
                    bondLengthSU: 0.02,
                },
                color: 0x00ff00,
            },
        ];
        mockSelectionCallback(mockSelections);

        const caption = widget.querySelector('.crystal-caption');
        expect(caption.innerHTML).toContain('Test Structure.');
        expect(caption.innerHTML).toContain('C1 (C)');
        expect(caption.innerHTML).toContain('C1-O1: 1.5 ± SU Å');
        expect(caption.innerHTML).toContain('color:#ff0000');
        expect(caption.innerHTML).toContain('color:#00ff00');
    });

    test('cleans up on disconnect', () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        widget.remove();

        expect(mockCrystalViewer.dispose).toHaveBeenCalled();
    });

    test('parses custom icons', () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('icons', '{"hydrogen": {"none":"custom1.svg","constant":"custom2.svg","anisotropic":"custom3.svg"}}');
        document.body.appendChild(widget);

        const icons = widget.icons;
        expect(icons.hydrogen).toHaveProperty('none', 'custom1.svg');
        expect(icons.hydrogen).toHaveProperty('constant', 'custom2.svg');
        expect(icons.hydrogen).toHaveProperty('anisotropic', 'custom3.svg');
    });

    test('handles icon parsing errors: Invalid JSON', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{invalid:json}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error)
        );
        
        consoleSpy.mockRestore();
    });

    test('handles icon parsing errors: Invalid Category', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{"somethingMadeUp": "entry"}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error)
        );
        
        consoleSpy.mockRestore();
    });

    test('handles icon parsing errors: Invalid Entry in category', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{"hydrogen": {"entry": "new.svg"}}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error)
        );
        
        consoleSpy.mockRestore();
    });

    test('handles structure loading errors', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockCrystalViewer.loadStructure.mockRejectedValue(new Error('Load failed'));

        const widget = document.createElement('cifview-widget');
        widget.setAttribute('src', 'test.cif');
        document.body.appendChild(widget);

        await new Promise(resolve => setTimeout(resolve, 0)); // Let promises resolve

        expect(consoleSpy).toHaveBeenCalledWith(
            'Error loading structure:',
            expect.any(Error),
        );
        
        consoleSpy.mockRestore();
    });

    test('updates caption without selections', () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('caption', 'Test Structure');
        document.body.appendChild(widget);

        const caption = widget.querySelector('.crystal-caption');
        expect(caption.textContent).toBe('Test Structure');
    });

    test('handles attribute changes', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
    
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
    
        // Set and wait for caption change
        widget.setAttribute('caption', 'New Caption');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(widget.baseCaption).toBe('New Caption');
    
        // Set and wait for src change
        widget.setAttribute('src', 'new.cif');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockFetch).toHaveBeenCalledWith('new.cif');
        expect(mockCrystalViewer.loadStructure).toHaveBeenCalledWith('mock cif data');
    
        // Set and wait for data change
        widget.setAttribute('data', 'new data');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockCrystalViewer.loadStructure).toHaveBeenCalledWith('new data');
    });
});