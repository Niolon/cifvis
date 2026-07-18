import DefaultTheme from 'vitepress/theme';
import { loadCifvis } from './cifvis-loader.js';
import CifDemo from './components/CifDemo.vue';
import OptionsTable from './components/OptionsTable.vue';
import ParseDemo from './components/ParseDemo.vue';
import CustomGuiDemo from './components/CustomGuiDemo.vue';
import ThreeJsDemo from './components/ThreeJsDemo.vue';
import ThemingDemo from './components/ThemingDemo.vue';
import ComparisonDemo from './components/ComparisonDemo.vue';
import EmbeddingDemo from './components/EmbeddingDemo.vue';
import MeasureDemo from './components/MeasureDemo.vue';
import './custom.css';

if (!import.meta.env.SSR) {
    // Registers <cifview-widget> once for every docs page.
    loadCifvis();
}

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('CifDemo', CifDemo);
        app.component('OptionsTable', OptionsTable);
        app.component('ParseDemo', ParseDemo);
        app.component('CustomGuiDemo', CustomGuiDemo);
        app.component('ThreeJsDemo', ThreeJsDemo);
        app.component('ThemingDemo', ThemingDemo);
        app.component('ComparisonDemo', ComparisonDemo);
        app.component('EmbeddingDemo', EmbeddingDemo);
        app.component('MeasureDemo', MeasureDemo);
    },
};
