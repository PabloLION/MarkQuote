import { initializePopup } from './popup';

document.addEventListener('DOMContentLoaded', () => {
  const dispose = initializePopup();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      dispose?.();
    });
  }
});
