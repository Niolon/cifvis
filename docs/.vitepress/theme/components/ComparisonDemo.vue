<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

loadCifvis();

const left = ref(null);
const right = ref(null);
const status = ref('Loading structures…');
const coupled = ref(true);
const src = withBase('/cif/sucrose.cif');

let coupling = null;
let couple = null;
let unmounted = false;

onMounted(async () => {
    const mod = await loadCifvis();
    couple = mod.coupleViewerInteractions;
    const widgets = [left.value, right.value];
    while (!unmounted && !widgets.every((widget) => widget?.viewer?.state?.baseStructure)) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    if (unmounted) {
        return;
    }
    coupling = couple(widgets);
    await coupling.synchronizeFrom(widgets[0]);
    status.value = 'Coupling active';
});

onUnmounted(() => {
    unmounted = true;
    coupling?.dispose();
    coupling = null;
});

async function toggle() {
    if (coupling) {
        coupling.dispose();
        coupling = null;
        coupled.value = false;
        status.value = 'Coupling paused';
    } else if (couple) {
        coupling = couple([left.value, right.value]);
        await coupling.synchronizeFrom(left.value);
        coupled.value = true;
        status.value = 'Coupling active';
    }
}

async function realign() {
    if (coupling) {
        await coupling.synchronizeFrom(left.value);
    }
}
</script>

<template>
    <div>
        <div class="cifvis-demo-grid">
            <div>
                <span class="cifvis-example-label">Solid 3D</span>
                <cifview-widget
                    ref="left"
                    :src="src"
                    options='{"renderStyle":"solid-3d","renderMode":"onDemand"}'
                    caption="Solid representation">
                </cifview-widget>
            </div>
            <div>
                <span class="cifvis-example-label">Cutaway 3D</span>
                <cifview-widget
                    ref="right"
                    :src="src"
                    options='{"renderStyle":"cutout-3d","renderMode":"onDemand"}'
                    caption="Cutaway representation">
                </cifview-widget>
            </div>
        </div>
        <div class="cifvis-demo-controls">
            <button type="button" :aria-pressed="coupled" @click="toggle">
                {{ coupled ? 'Pause coupling' : 'Resume coupling' }}
            </button>
            <button type="button" @click="realign">Align from solid view</button>
            <span style="font-weight:600;color:var(--vp-c-text-2);">{{ status }}</span>
        </div>
    </div>
</template>
