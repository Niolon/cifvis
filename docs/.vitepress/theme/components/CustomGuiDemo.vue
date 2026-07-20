<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const container = ref(null);
const hydrogenLabel = ref('Hydrogen mode');
const symmetryLabel = ref('Symmetry mode');
const selectionText = ref('Click an atom or bond in the viewer above to see selection data here.');

let viewer = null;

function formatLength(value) {
    return Math.round(value * 1000) / 1000;
}

onMounted(async () => {
    const { CrystalViewer } = await loadCifvis();
    if (!container.value) {
        return;
    }
    viewer = new CrystalViewer(container.value);
    const cifText = await (await fetch(withBase('/cif/urea.cif'))).text();
    await viewer.loadCIF(cifText);

    viewer.selections.onChange((selections) => {
        if (selections.length === 0) {
            selectionText.value = 'Click an atom or bond in the viewer above to see selection data here.';
            return;
        }
        selectionText.value = selections.map((s) => {
            if (s.type === 'atom') {
                return `Atom ${s.data.label} (${s.data.atomType})`;
            }
            if (s.type === 'bond') {
                return `Bond ${s.data.atom1Label}-${s.data.atom2Label}: ${formatLength(s.data.bondLength)} Å`;
            }
            return `H-bond ${s.data.donorAtomLabel}...${s.data.acceptorAtomLabel}`;
        }).join(' | ');
    });
});

onUnmounted(() => {
    viewer?.dispose();
    viewer = null;
});

async function cycle(name) {
    if (!viewer) {
        return;
    }
    const result = await viewer.cycleModifierMode(name);
    if (result.success && name === 'hydrogen') {
        hydrogenLabel.value = `Hydrogen: ${result.mode}`;
    }
    if (result.success && name === 'symmetry') {
        symmetryLabel.value = `Symmetry: ${result.mode}`;
    }
}
</script>

<template>
    <div>
        <div class="cifvis-demo-container">
            <div style="position:absolute;top:10px;right:10px;display:flex;gap:8px;z-index:10;" class="cifvis-demo-controls">
                <button type="button" @click="cycle('hydrogen')">{{ hydrogenLabel }}</button>
                <button type="button" @click="cycle('symmetry')">{{ symmetryLabel }}</button>
            </div>
            <div ref="container" style="position:absolute;inset:0;"></div>
        </div>
        <p style="font-size:0.9em;color:var(--vp-c-text-2);">{{ selectionText }}</p>
    </div>
</template>
