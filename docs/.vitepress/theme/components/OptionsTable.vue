<script setup>
import { computed } from 'vue';
import optionsData from '../../data/options-data.json';
import { descriptions, extraRows } from '../../data/option-descriptions.js';

const props = defineProps({
    group: { type: String, required: true },
    prefix: { type: String, default: '' },
});

function normalize(path, entry) {
    if (typeof entry === 'string') {
        return { description: entry };
    }
    return entry ?? { description: '' };
}

const rows = computed(() => {
    const generated = (optionsData[props.group] ?? []).map((row) => {
        const extra = normalize(row.path, descriptions[row.path]);
        return {
            ...row,
            type: extra.type ?? row.type,
            default: extra.default ?? row.default,
            description: extra.description ?? '',
        };
    });
    for (const extra of extraRows[props.group] ?? []) {
        const index = generated.findIndex((row) => row.path === extra.after);
        const row = {
            path: extra.path,
            type: extra.type ?? '',
            default: extra.default ?? '',
            description: extra.description ?? '',
        };
        if (index === -1) {
            generated.push(row);
        } else {
            generated.splice(index + 1, 0, row);
        }
    }
    if (props.prefix) {
        return generated.filter((row) => row.path.startsWith(props.prefix));
    }
    return generated;
});
</script>

<template>
    <div class="options-table-wrapper">
        <table>
            <thead>
                <tr>
                    <th>Option</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in rows" :key="row.path">
                    <td><code>{{ row.path }}</code></td>
                    <td>{{ row.type }}</td>
                    <td><code v-if="row.default">{{ row.default }}</code></td>
                    <td v-html="row.description"></td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
