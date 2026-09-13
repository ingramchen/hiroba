<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import SquarePage from '../pages/SquarePage.vue';
import SysConsole from '../sys/SysConsole.vue';
import LoadingPage from '../pages/LoadingPage.vue';
import BlankPage from '../pages/BlankPage.vue';
import { STATES } from '../fixtures/states';
import { OVERLAYS } from './overlays';
import { applyShellClasses, applyViewportMeta, clearLoading } from '../runtime';

const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const state = computed(() => STATES[id.value]);

const PAGES = {
  home: HomePage,
  square: SquarePage,
  sys: SysConsole,
  loading: LoadingPage,
  blank: BlankPage,
} as const;

const component = computed(() => (state.value ? PAGES[state.value.page] : null));

function sync() {
  const s = state.value;
  if (!s) return;
  applyShellClasses(
    s.shape,
    s.pageClass ??
      (s.page === 'square' || s.page === 'blank' ? 'square' : s.page === 'sys' ? 'sys' : 'home'),
  );
  applyViewportMeta(s.viewportMeta === false ? 'DESKTOP' : s.shape);
}
sync();
clearLoading();
</script>

<template>
  <template v-if="state && component">
    <template v-if="state.overlaysFirst">
      <component
        :is="OVERLAYS[o.kind]"
        v-for="(o, i) in state.overlays ?? []"
        :key="i"
        v-bind="o.props"
      />
    </template>
    <component :is="component" v-bind="state.props" />
    <template v-if="!state.overlaysFirst">
      <component
        :is="OVERLAYS[o.kind]"
        v-for="(o, i) in state.overlays ?? []"
        :key="i"
        v-bind="o.props"
      />
    </template>
  </template>
  <div v-else>unknown state {{ id }}</div>
</template>
