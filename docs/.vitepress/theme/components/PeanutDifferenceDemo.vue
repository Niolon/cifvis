<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const container = ref(null);
const status = ref('Loading both CIF models…');
const renderStyle = ref('cutout-3d');
const switching = ref(true);

const ADP_FIELDS = ['u11', 'u22', 'u33', 'u12', 'u13', 'u23'];
const RENDER_STYLES = [
    { value: 'solid-3d', label: 'Solid 3D' },
    { value: 'cutout-3d', label: 'Grid 3D' },
    { value: 'cutout-2d', label: 'Publication 2D' },
];
let viewer = null;
let unmounted = false;
let differenceStructure = null;

async function createViewer(style, viewState = null) {
    const { CrystalViewer } = await loadCifvis();
    if (unmounted || !container.value || !differenceStructure) {
        return false;
    }

    viewer?.dispose();
    viewer = null;
    const nextViewer = new CrystalViewer(container.value, {
        adpRepresentation: 'rmsd-peanut',
        renderStyle: style,
        peanutScale: 3,
        atomLabels: { show: 'all', colorMode: 'atom' },
    });
    viewer = nextViewer;
    try {
        await nextViewer.loadStructure(differenceStructure);
    } catch (error) {
        if (viewer === nextViewer) {
            viewer = null;
            nextViewer.dispose();
        }
        throw error;
    }
    if (unmounted || !container.value || viewer !== nextViewer) {
        if (viewer === nextViewer) {
            viewer = null;
            nextViewer.dispose();
        }
        return false;
    }
    if (viewState) {
        nextViewer.setViewState(viewState);
    }
    return true;
}

async function selectRenderStyle(style) {
    if (switching.value || style === renderStyle.value || !differenceStructure || !viewer) {
        return;
    }
    switching.value = true;
    const viewState = viewer.getViewState();
    renderStyle.value = style;
    status.value = `Switching to ${RENDER_STYLES.find(mode => mode.value === style).label}…`;
    try {
        const created = await createViewer(style, viewState);
        if (!unmounted && created) {
            status.value = 'Comparison − reference ADP tensors';
        }
    } catch (error) {
        if (!unmounted) {
            status.value = `Could not change display mode: ${error.message}`;
        }
    } finally {
        if (!unmounted) {
            switching.value = false;
        }
    }
}

onMounted(async () => {
    try {
        const { CIF, CrystalStructure, UAnisoADP } = await loadCifvis();
        const [referenceText, comparisonText] = await Promise.all([
            fetch(withBase('/cif/urea-adp-reference.cif')).then(response => response.text()),
            fetch(withBase('/cif/urea-adp-comparison.cif')).then(response => response.text()),
        ]);
        if (unmounted || !container.value) {
            return;
        }

        const reference = CrystalStructure.fromCIF(new CIF(referenceText).getBlock(0));
        const difference = CrystalStructure.fromCIF(new CIF(comparisonText).getBlock(0));
        const referenceByLabel = new Map(reference.atoms.map(atom => [atom.label, atom]));
        for (const atom of difference.atoms) {
            const referenceAtom = referenceByLabel.get(atom.label);
            if (!(atom.adp instanceof UAnisoADP) || !(referenceAtom?.adp instanceof UAnisoADP)) {
                throw new Error(`Matched anisotropic ADPs are required for ${atom.label}`);
            }
            atom.adp = new UAnisoADP(...ADP_FIELDS.map(
                field => atom.adp[field] - referenceAtom.adp[field],
            ));
        }

        differenceStructure = difference;
        const created = await createViewer(renderStyle.value);
        if (!unmounted && created) {
            status.value = 'Comparison − reference ADP tensors';
        }
    } catch (error) {
        if (!unmounted) {
            status.value = `Could not load the PEANUT difference: ${error.message}`;
        }
    } finally {
        if (!unmounted) {
            switching.value = false;
        }
    }
});

onUnmounted(() => {
    unmounted = true;
    viewer?.dispose();
    viewer = null;
    differenceStructure = null;
});
</script>

<template>
    <div>
        <div class="cifvis-demo-controls" aria-label="PEANUT display mode">
            <strong>Display mode:</strong>
            <button
                v-for="mode in RENDER_STYLES"
                :key="mode.value"
                type="button"
                :disabled="switching"
                :aria-pressed="renderStyle === mode.value"
                @click="selectRenderStyle(mode.value)">
                {{ mode.label }}
            </button>
        </div>
        <div ref="container" class="cifvis-demo-container"></div>
        <div class="cifvis-demo-controls" aria-label="PEANUT difference legend">
            <span><strong>Positive:</strong> atom body + ring-colour grid</span>
            <span><strong>Negative:</strong> ring-colour body + atom-colour grid</span>
            <span style="margin-left:auto;color:var(--vp-c-text-2);">{{ status }}</span>
        </div>
    </div>
</template>
