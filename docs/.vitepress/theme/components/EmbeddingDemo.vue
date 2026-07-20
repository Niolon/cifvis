<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const container = ref(null);
const chart = ref(null);
const info = ref('Click atoms in the viewer — the chart highlights their elements.');

let viewer = null;
let counts = {};
let highlighted = new Set();

function drawChart() {
    const canvas = chart.value;
    if (!canvas) {
        return;
    }
    const ctx = canvas.getContext('2d');
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    if (entries.length === 0) {
        return;
    }
    const max = Math.max(...entries.map(([, n]) => n));
    const barWidth = Math.min(60, (width - 20) / entries.length - 10);
    const baseline = height - 24;
    const styles = getComputedStyle(canvas);
    const textColor = styles.getPropertyValue('color') || '#333';
    entries.forEach(([element, count], i) => {
        const x = 15 + i * (barWidth + 10);
        const barHeight = (baseline - 15) * (count / max);
        ctx.fillStyle = highlighted.has(element) ? '#e8734a' : '#5b8dbe';
        ctx.fillRect(x, baseline - barHeight, barWidth, barHeight);
        ctx.fillStyle = textColor;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(element, x + barWidth / 2, baseline + 14);
        ctx.fillText(String(count), x + barWidth / 2, baseline - barHeight - 4);
    });
}

onMounted(async () => {
    const { CIF, CrystalStructure, CrystalViewer } = await loadCifvis();
    if (!container.value) {
        return;
    }
    viewer = new CrystalViewer(container.value);
    const cifText = await (await fetch(withBase('/cif/fullerene.cif'))).text();
    await viewer.loadCIF(cifText);

    const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
    counts = {};
    for (const atom of structure.atoms) {
        counts[atom.atomType] = (counts[atom.atomType] ?? 0) + 1;
    }
    drawChart();

    viewer.selections.onChange((selections) => {
        highlighted = new Set(
            selections.filter((s) => s.type === 'atom').map((s) => s.data.atomType),
        );
        info.value = highlighted.size > 0
            ? `Selected element(s): ${[...highlighted].join(', ')}`
            : 'Click atoms in the viewer — the chart highlights their elements.';
        drawChart();
    });
});

onUnmounted(() => {
    viewer?.dispose();
    viewer = null;
});
</script>

<template>
    <div>
        <div style="display:grid;grid-template-columns:minmax(240px,3fr) minmax(180px,2fr);gap:16px;align-items:stretch;">
            <div ref="container" class="cifvis-demo-container" style="margin:0;aspect-ratio:auto;min-height:320px;"></div>
            <div style="border:1px solid var(--vp-c-divider);border-radius:8px;padding:8px;">
                <span class="cifvis-example-label">Atoms per element (asymmetric unit)</span>
                <canvas ref="chart" style="width:100%;height:280px;color:var(--vp-c-text-1);"></canvas>
            </div>
        </div>
        <p style="font-size:0.9em;color:var(--vp-c-text-2);">{{ info }}</p>
    </div>
</template>
