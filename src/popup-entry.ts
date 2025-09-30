import { initializePopup } from "./popup.js";

async function bootstrap(): Promise<void> {
  const isDevEnvironment =
    window.location.hostname === "localhost" || window.location.port === "5173";

  if (isDevEnvironment) {
    const { ensureChromeMock } = await import("./dev/chrome-dev-mock.js");
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
