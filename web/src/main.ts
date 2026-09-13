import './styles/index.css';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { applyShellClasses, applyViewportMeta, readShape } from './runtime';

router.afterEach((to) => {
  if (to.name === 'state') return;
  const shape = readShape();
  const page = to.name === 'home' ? 'home' : 'square';
  applyShellClasses(shape, page);
  if (page === 'square') applyViewportMeta(shape);
});

createApp(App).use(router).mount('#app');

void router.isReady().then(() => {
  document.documentElement.dataset.ready = '1';
});
