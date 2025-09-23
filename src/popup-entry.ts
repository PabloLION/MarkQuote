import { initializePopup } from './popup.js';

document.addEventListener('DOMContentLoaded', () => {
  const dispose = initializePopup();

  const hot = (
    import.meta as ImportMeta & {
      hot?: {
        dispose: (handler: () => void) => void;
      };
    }
  ).hot;

  hot?.dispose(() => {
    dispose?.();
  });
});
