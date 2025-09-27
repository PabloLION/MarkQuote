import { initializeOptions } from "./options.js";

function boot(): void {
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
