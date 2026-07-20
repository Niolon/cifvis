<script setup>
import { withBase } from 'vitepress';
import { loadCifvis } from '../cifvis-loader.js';

defineOptions({ inheritAttrs: false });

const props = defineProps({
    src: { type: String, required: true },
    label: { type: String, default: '' },
});

loadCifvis();

const resolvedSrc = withBase(props.src);
</script>

<template>
    <div class="cif-demo">
        <span v-if="label" class="cifvis-example-label">{{ label }}</span>
        <cifview-widget :src="resolvedSrc" v-bind="$attrs"></cifview-widget>
    </div>
</template>
