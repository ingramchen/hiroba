import { createRouter, createWebHistory } from 'vue-router';
import HomeLive from './live/HomeLive.vue';
import SquareLive from './live/SquareLive.vue';
import ReservedPage from './pages/ReservedPage.vue';
import { canonicalPath } from '@hiroba/shared';

const devRoutes = import.meta.env.DEV
  ? [{ path: '/__state/:id', name: 'state', component: () => import('./dev/StateGallery.vue') }]
  : [];

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...devRoutes,
    { path: '/', name: 'home', component: HomeLive },
    { path: '/-/:rest(.*)', name: 'reserved', component: ReservedPage },
    { path: '/:topic', name: 'square', component: SquareLive, props: true },
    { path: '/:pathMatch(.*)*', name: 'path', component: ReservedPage },
  ],
});

router.beforeEach((to) => {
  if (to.name === 'state' || to.name === 'reserved') {
    return true;
  }
  const path = canonicalPath(to.path);
  const target = { path, query: to.query, hash: to.hash };
  if (router.resolve(target).fullPath === to.fullPath) {
    return true;
  }
  return { ...target, replace: true };
});
