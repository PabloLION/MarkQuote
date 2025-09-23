import { initializeOptions } from './options.js';

document.addEventListener('DOMContentLoaded', () => {
  const dispose = initializeOptions();

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
