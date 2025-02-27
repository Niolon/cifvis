/**
 * @vi-environment jsdom
 */

vi.mock('./ortep3d/structure-settings.js', () => ({
    default: {
        camera: {
            minDistance: 1,
            maxDistance: 100,
            initialPosition: [0, 0, 10],
        },
        selection: {
            mode: 'multiple',
            markerMult: 1.3,
            highlightEmissive: 0xaaaaaa,
            markerColors: [0xff0000, 0x00ff00],
        },
        elementProperties: {
            'C': { radius: 0.76, atomColor: '#000000' },
            'O': { radius: 0.66, atomColor: '#ff0000' },
            'H': { radius: 0.31, atomColor: '#ffffff' },
        },
    },
}));

import { CrystalViewer } from './ortep3d/crystal-viewer.js';
import { formatValueEsd } from './formatting.js';
import { CifViewWidget } from './widget.js';
import { 
    BondGenerator, DisorderFilter, HydrogenFilter, SymmetryGrower, AtomLabelFilter,
} from './structure/structure-modifiers.js';

// Mock CrystalViewer
vi.mock('./ortep3d/crystal-viewer.js');
vi.mock('./formatting.js');

customElements.define('cifview-widget', CifViewWidget);

describe('CifViewWidget', () => {
    let mockCrystalViewer;
    let mockSelectionCallback;
    let mockFetch;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock CrystalViewer instance
        mockCrystalViewer = {
            loadStructure: vi.fn().mockResolvedValue({ success: true }),
            cycleModifierMode: vi.fn().mockResolvedValue({ success: true, mode: 'constant' }),
            numberModifierModes: vi.fn().mockReturnValue(2),
            updateStructure: vi.fn().mockResolvedValue({ success: true }),
            setupNewStructure: vi.fn().mockResolvedValue({ success: true }),
            state: { baseStructure: {}, currentCifContent: 'mockCifContent' },
            selections: {
                onChange: vi.fn(),
            },
            controls: {
                handleResize: vi.fn(),
            },
            dispose: vi.fn(),
            modifiers: {
                missingbonds: new BondGenerator(),
                hydrogen: new HydrogenFilter(),
                disorder: new DisorderFilter(),
                symmetry: new SymmetryGrower(),
                removeatoms: new AtomLabelFilter(),
            },
        };
        CrystalViewer.mockImplementation(() => mockCrystalViewer);

        // Mock selection callback storage
        mockSelectionCallback = null;
        mockCrystalViewer.selections.onChange.mockImplementation(callback => {
            mockSelectionCallback = callback;
        });

        // Mock fetch
        mockFetch = vi.fn().mockResolvedValue({
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
        widget.setAttribute(
            'icons',
            '{"hydrogen": {"none":"custom1.svg","constant":"custom2.svg","anisotropic":"custom3.svg"}}',
        );
        document.body.appendChild(widget);

        const icons = widget.icons;
        expect(icons.hydrogen).toHaveProperty('none', 'custom1.svg');
        expect(icons.hydrogen).toHaveProperty('constant', 'custom2.svg');
        expect(icons.hydrogen).toHaveProperty('anisotropic', 'custom3.svg');
    });

    test('handles icon parsing errors: Invalid JSON', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{invalid:json}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error),
        );
        
        consoleSpy.mockRestore();
    });

    test('handles icon parsing errors: Invalid Category', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{"somethingMadeUp": "entry"}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error),
        );
        
        consoleSpy.mockRestore();
    });

    test('handles icon parsing errors: Invalid Entry in category', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        // Set invalid icons after widget is mounted
        widget.setAttribute('icons', '{"hydrogen": {"entry": "new.svg"}}');
        await new Promise(resolve => setTimeout(resolve, 0));
    
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse custom icons'),
            expect.any(Error),
        );
        
        consoleSpy.mockRestore();
    });

    test('handles structure loading errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    // New tests for added functionality

    test('handles hydrogen-mode attribute changes', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        widget.setAttribute('hydrogen-mode', 'constant');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockCrystalViewer.modifiers.hydrogen.mode).toBe('constant');
        expect(mockCrystalViewer.updateStructure).toHaveBeenCalled();
    });

    test('handles disorder-mode attribute changes', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        widget.setAttribute('disorder-mode', 'group1');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockCrystalViewer.modifiers.disorder.mode).toBe('group1');
        expect(mockCrystalViewer.updateStructure).toHaveBeenCalled();
    });

    test('handles symmetry-mode attribute changes', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        widget.setAttribute('symmetry-mode', 'bonds-yes-hbonds-yes');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(mockCrystalViewer.modifiers.symmetry.mode).toBe('bonds-yes-hbonds-yes');
        expect(mockCrystalViewer.setupNewStructure).toHaveBeenCalled();
    });

    test('parses options attribute', async () => {
        const options = {
            camera: {
                minDistance: 2,
                maxDistance: 50,
            },
            selection: {
                mode: 'single',
            },
            elementProperties: {
                'C': { radius: 0.8 },
                'N': { radius: 0.7 },
            },
        };
        
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('options', JSON.stringify(options));
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        // Check that CrystalViewer was created with merged options
        expect(CrystalViewer.mock.calls[0][1]).toMatchObject({
            camera: {
                minDistance: 2,
                maxDistance: 50,
                initialPosition: [0, 0, 10],
            },
            selection: {
                mode: 'single',
                markerMult: 1.3,
            },
            elementProperties: expect.objectContaining({
                'C': { radius: 0.8, atomColor: '#000000' },
                'N': { radius: 0.7 },
                'O': { radius: 0.66, atomColor: '#ff0000' },
            }),
        });
    });

    test('handles option changes by recreating viewer', async () => {
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        // Initial viewer creation
        expect(CrystalViewer).toHaveBeenCalledTimes(1);
        
        // Change options
        widget.setAttribute('options', JSON.stringify({ camera: { minDistance: 3 } }));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Should dispose old viewer and create new one
        expect(mockCrystalViewer.dispose).toHaveBeenCalled();
        expect(CrystalViewer).toHaveBeenCalledTimes(2);
        
        // Should reload structure if one was already loaded
        expect(mockCrystalViewer.loadStructure).toHaveBeenCalledWith('mockCifContent');
    });

    test('handles filtered-atoms attribute', async () => {
        const filterSpy = vi.spyOn(mockCrystalViewer.modifiers.removeatoms, 'setFilteredLabels');
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        widget.setAttribute('filtered-atoms', 'C1,O1,N4');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Should set filtered atoms and mode
        expect(mockCrystalViewer.modifiers.removeatoms.setFilteredLabels)
            .toHaveBeenCalledWith(['C1', 'O1', 'N4']);
        expect(mockCrystalViewer.modifiers.removeatoms.mode).toBe('on');
        filterSpy.mockRestore();
    });

    test('turns off atom filtering when filtered-atoms is empty', async () => {
        const filterSpy = vi.spyOn(mockCrystalViewer.modifiers.removeatoms, 'setFilteredLabels');
        const widget = document.createElement('cifview-widget');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        // First set some atoms to filter
        widget.setAttribute('filtered-atoms', 'C1,O1');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Then clear the filter
        widget.setAttribute('filtered-atoms', '');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Should set filtered atoms and turn mode off
        expect(mockCrystalViewer.modifiers.removeatoms.setFilteredLabels)
            .toHaveBeenCalledWith([]);
        expect(mockCrystalViewer.modifiers.removeatoms.mode).toBe('off');
        filterSpy.mockRestore();
    });

    test('handles initial attribute modes during creation', async () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('hydrogen-mode', 'constant');
        widget.setAttribute('disorder-mode', 'group1');
        widget.setAttribute('symmetry-mode', 'bonds-yes-hbonds-yes');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        // Check that options were passed to CrystalViewer
        expect(CrystalViewer.mock.calls[0][1]).toMatchObject({
            hydrogenMode: 'constant',
            disorderMode: 'group1',
            symmetryMode: 'bonds-yes-hbonds-yes',
        });
    });

    test('updates H-bond selection information in caption', async () => {
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('caption', 'Test Structure');
        document.body.appendChild(widget);

        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete

        // Simulate selection with H-bond
        const mockSelections = [
            {
                type: 'hbond',
                data: { 
                    donorAtomLabel: 'O1', 
                    hydrogenAtomLabel: 'H1',
                    acceptorAtomLabel: 'N1',
                },
                color: 0xff0000,
            },
        ];
        mockSelectionCallback(mockSelections);

        const caption = widget.querySelector('.crystal-caption');
        expect(caption.innerHTML).toContain('O1→N1');
        expect(caption.innerHTML).toContain('color:#ff0000');
    });

    test('handles invalid options JSON', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const widget = document.createElement('cifview-widget');
        widget.setAttribute('options', '{invalid:json}');
        document.body.appendChild(widget);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Let initial setup complete
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse options'),
            expect.any(Error),
        );
        
        consoleSpy.mockRestore();
    });
});