<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

const container = ref(null);

let renderer = null;
let frame = 0;
let ortep = null;
let removeListeners = null;

onMounted(async () => {
    const [{ CIF, CrystalStructure, ORTEP3JsStructure }, THREE] = await Promise.all([
        loadCifvis(),
        import('three'),
    ]);
    const el = container.value;
    if (!el) {
        return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(5, 5, 5);
    scene.add(light);

    const cifText = await (await fetch(withBase('/cif/urea.cif'))).text();
    const structure = CrystalStructure.fromCIF(new CIF(cifText).getBlock(0));
    ortep = new ORTEP3JsStructure(structure);
    const group = ortep.getGroup();
    scene.add(group);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    };
    const onUp = () => {
        dragging = false;
    };
    const onMove = (e) => {
        if (!dragging) {
            return;
        }
        group.rotation.y += (e.clientX - lastX) * 0.01;
        group.rotation.x += (e.clientY - lastY) * 0.01;
        lastX = e.clientX;
        lastY = e.clientY;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    removeListeners = () => {
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointermove', onMove);
    };

    const animate = () => {
        frame = requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();
});

onUnmounted(() => {
    cancelAnimationFrame(frame);
    removeListeners?.();
    ortep?.dispose();
    renderer?.dispose();
    renderer = null;
});
</script>

<template>
    <div ref="container" class="cifvis-demo-container"></div>
</template>
