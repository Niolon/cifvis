<script setup>
import { ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const output = ref('Click the button to run this example.');

async function run() {
    output.value = 'Loading...';
    try {
        const { CIF } = await loadCifvis();
        const response = await fetch(withBase('/cif/urea.cif'));
        const cifText = await response.text();
        const cif = new CIF(cifText);
        const block = cif.getBlock(0);
        const loop = block.get('_atom_site');
        const labels = loop.get('_atom_site_label');
        output.value = [
            `Block name: ${block.dataBlockName}`,
            `Loop columns: ${loop.getHeaders().join(', ')}`,
            '',
            'First 3 atom labels:',
            ...labels.slice(0, 3).map((label, i) => `  [${i}] ${label}`),
        ].join('\n');
    } catch (error) {
        output.value = `Error: ${error.message}`;
    }
}
</script>

<template>
    <div>
        <div class="cifvis-demo-controls">
            <button type="button" @click="run">Parse urea.cif</button>
        </div>
        <div class="cifvis-demo-output">{{ output }}</div>
    </div>
</template>
