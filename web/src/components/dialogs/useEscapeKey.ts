import { onBeforeUnmount, onMounted } from 'vue';

export function useEscapeKey(onEscape: () => void): void {
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onEscape();
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown, true));
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true));
}
