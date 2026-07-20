<script setup>
import { ref } from 'vue';
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

loadCifvis();

const widget = ref(null);
const bg = ref('#fafafa');
const captionBg = ref('#ffffff');
const captionColor = ref('#333333');
const buttonBg = ref('#ffffff');

const src = withBase('/cif/urea.cif');

function setVar(name, value) {
    widget.value?.style.setProperty(name, value);
}

function apply() {
    setVar('--cifvis-bg', bg.value);
    setVar('--cifvis-caption-bg', captionBg.value);
    setVar('--cifvis-caption-color', captionColor.value);
    setVar('--cifvis-button-bg', buttonBg.value);
    setVar('--cifvis-button-hover-bg', buttonBg.value);
}

function reset() {
    ['--cifvis-bg', '--cifvis-caption-bg', '--cifvis-caption-color', '--cifvis-button-bg', '--cifvis-button-hover-bg']
        .forEach((name) => widget.value?.style.removeProperty(name));
    bg.value = '#fafafa';
    captionBg.value = '#ffffff';
    captionColor.value = '#333333';
    buttonBg.value = '#ffffff';
}

function dark() {
    bg.value = '#1e1e2f';
    captionBg.value = '#2a2a3d';
    captionColor.value = '#eeeeee';
    buttonBg.value = '#3a3a52';
    apply();
    setVar('--cifvis-button-hover-bg', '#4a4a66');
}
</script>

<template>
    <div>
        <div class="cifvis-demo-controls">
            <label>Background <input type="color" v-model="bg" @input="apply"></label>
            <label>Caption background <input type="color" v-model="captionBg" @input="apply"></label>
            <label>Caption text <input type="color" v-model="captionColor" @input="apply"></label>
            <label>Button background <input type="color" v-model="buttonBg" @input="apply"></label>
            <button type="button" @click="reset">Reset to defaults</button>
            <button type="button" @click="dark">Dark preset</button>
        </div>
        <cifview-widget
            ref="widget"
            :src="src"
            style="aspect-ratio: 16 / 9;"
            caption="Adjust the controls above to see the --cifvis-* custom properties in action.">
        </cifview-widget>
    </div>
</template>
