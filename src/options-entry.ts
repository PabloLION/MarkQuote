import { initializeOptions } from './options';

document.addEventListener('DOMContentLoaded', () => {
  const dispose = initializeOptions();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      dispose?.();
    });
  }
});
