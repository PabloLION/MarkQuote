import { initializePopup } from "./page.js";

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV) {
    const { ensureChromeMock } = await import("../../dev/chrome-dev-mock.js");
    ensureChromeMock();
  }

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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootstrap();
  });
} else {
  void bootstrap();
}
