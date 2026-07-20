<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const container = ref(null);
const atoms = ref([]);          // [{ label, color, xyz: [x, y, z] }] in click order
const mode = ref('chain');      // 'chain' | 'plane'

let viewer = null;

// --- Plain vector helpers (framework-free, mirrored in the page's code tabs) ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => Math.hypot(...a);
const unit = (a) => {
    const n = norm(a);
    return n > 1e-9 ? a.map((c) => c / n) : null;
};
const degrees = (radians) => radians * 180 / Math.PI;

function distance(a, b) {
    return norm(sub(b, a));
}

function angle(a, b, c) {
    const u = unit(sub(a, b));
    const v = unit(sub(c, b));
    if (!u || !v) {
        return null;
    }
    return degrees(Math.acos(Math.min(1, Math.max(-1, dot(u, v)))));
}

function torsion(a, b, c, d) {
    const b1 = sub(b, a);
    const b2 = sub(c, b);
    const b3 = sub(d, c);
    const n1 = cross(b1, b2);
    const n2 = cross(b2, b3);
    const axis = unit(b2);
    if (!axis || norm(n1) < 1e-9 || norm(n2) < 1e-9) {
        return null;
    }
    return degrees(Math.atan2(dot(cross(n1, n2), axis), dot(n1, n2)));
}

function planeDistance(point, p1, p2, p3) {
    const normal = unit(cross(sub(p2, p1), sub(p3, p1)));
    if (!normal) {
        return null;
    }
    return dot(sub(point, p1), normal);
}

const fmt = (value, digits = 3) => value === null ? 'undefined (collinear)' : value.toFixed(digits);
const chipColor = (color) => `#${(color ?? 0x888888).toString(16).padStart(6, '0')}`;

const measurements = computed(() => {
    const list = atoms.value;
    const rows = [];
    if (mode.value === 'chain') {
        for (let i = 0; i + 1 < list.length; i++) {
            rows.push({
                kind: 'Distance',
                path: `${list[i].label}–${list[i + 1].label}`,
                value: `${fmt(distance(list[i].xyz, list[i + 1].xyz))} Å`,
            });
        }
        for (let i = 0; i + 2 < list.length; i++) {
            rows.push({
                kind: 'Angle',
                path: `${list[i].label}–${list[i + 1].label}–${list[i + 2].label}`,
                value: `${fmt(angle(list[i].xyz, list[i + 1].xyz, list[i + 2].xyz), 2)}°`,
            });
        }
        for (let i = 0; i + 3 < list.length; i++) {
            rows.push({
                kind: 'Torsion',
                path: list.slice(i, i + 4).map((a) => a.label).join('–'),
                value: `${fmt(torsion(...list.slice(i, i + 4).map((a) => a.xyz)), 2)}°`,
            });
        }
    } else if (list.length >= 3) {
        const [p1, p2, p3, ...rest] = list;
        rows.push({
            kind: 'Plane',
            path: `${p1.label}, ${p2.label}, ${p3.label}`,
            value: 'defines the plane',
        });
        for (const atom of rest) {
            rows.push({
                kind: 'Distance to plane',
                path: atom.label,
                value: `${fmt(planeDistance(atom.xyz, p1.xyz, p2.xyz, p3.xyz))} Å`,
            });
        }
    }
    return rows;
});

const hint = computed(() => {
    const n = atoms.value.length;
    if (mode.value === 'chain') {
        if (n === 0) {
            return 'Click atoms in the viewer to fill the list.';
        }
        if (n === 1) {
            return 'Add a second atom for a distance.';
        }
        if (n === 2) {
            return 'Add a third atom for an angle.';
        }
        if (n === 3) {
            return 'Add a fourth atom for a torsion.';
        }
        return 'Consecutive distances, angles, and torsions along the list.';
    }
    if (n < 3) {
        return 'Select at least three atoms to define the plane.';
    }
    return 'The first three atoms define the plane; every further atom gets its signed distance.';
});

onMounted(async () => {
    const { CrystalViewer } = await loadCifvis();
    if (!container.value) {
        return;
    }
    viewer = new CrystalViewer(container.value, { hydrogenMode: 'constant' });
    container.value.cifvisViewer = viewer; // console/debug access
    const cifText = await (await fetch(withBase('/cif/sucrose.cif'))).text();
    await viewer.loadCIF(cifText);

    viewer.selections.onChange((selections) => {
        const cell = viewer?.state?.baseStructure?.cell;
        if (!cell) {
            return;
        }
        atoms.value = selections
            .filter((s) => s.type === 'atom')
            .map((s) => ({
                label: s.data.label,
                color: s.color,
                xyz: [...s.data.position.toCartesian(cell)],
            }));
    });
});

onUnmounted(() => {
    viewer?.dispose();
    viewer = null;
});

function clearList() {
    viewer?.selections.clear();
}

function removeLast() {
    if (!viewer || atoms.value.length === 0) {
        return;
    }
    const keep = atoms.value.slice(0, -1).map((a) => a.label);
    viewer.selections.clear();
    if (keep.length > 0) {
        viewer.selectAtoms(keep);
    }
}
</script>

<template>
    <div>
        <div ref="container" class="cifvis-demo-container"></div>
        <div class="cifvis-demo-controls">
            <button type="button" :class="{ 'measure-mode-active': mode === 'chain' }" @click="mode = 'chain'">
                Chain (distance / angle / torsion)
            </button>
            <button type="button" :class="{ 'measure-mode-active': mode === 'plane' }" @click="mode = 'plane'">
                Plane (first three atoms)
            </button>
            <button type="button" :disabled="atoms.length === 0" @click="removeLast">Remove last</button>
            <button type="button" :disabled="atoms.length === 0" @click="clearList">Clear list</button>
        </div>
        <p style="font-size:0.9em;color:var(--vp-c-text-2);margin:4px 0;">
            <template v-if="atoms.length === 0">List empty — {{ hint }}</template>
            <template v-else>
                <span v-for="(atom, i) in atoms" :key="i" class="measure-chip">
                    <span class="measure-chip-dot" :style="{ background: chipColor(atom.color) }"></span>{{ atom.label }}
                </span>
                — {{ hint }}
            </template>
        </p>
        <table v-if="measurements.length > 0" class="measure-table">
            <thead>
                <tr><th>Measurement</th><th>Atoms</th><th>Value</th></tr>
            </thead>
            <tbody>
                <tr v-for="(row, i) in measurements" :key="i">
                    <td>{{ row.kind }}</td>
                    <td>{{ row.path }}</td>
                    <td style="font-variant-numeric: tabular-nums;">{{ row.value }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.measure-mode-active {
    border-color: var(--vp-c-brand-1) !important;
    color: var(--vp-c-brand-1);
}

.measure-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 8px;
    font-family: var(--vp-font-family-mono);
    font-size: 0.95em;
}

.measure-chip-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}

.measure-table {
    display: table;
    width: 100%;
    margin: 8px 0 16px;
}
</style>
