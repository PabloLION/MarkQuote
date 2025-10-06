const POPUP_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DEV_POPUP_ENTRY: string = "/src/surfaces/popup/main.ts";

type ModuleImporter = (specifier: string) => Promise<unknown>;

const MODULE_LOAD_TIMEOUT_MS = 10_000;

type VitestAwareImportMeta = ImportMeta & { vitest?: boolean };

function isRunningUnderVitest(meta: ImportMeta): boolean {
  return Boolean((meta as VitestAwareImportMeta).vitest);
}

let importModule: ModuleImporter = (specifier) => import(/* @vite-ignore */ specifier);

export function __setPopupModuleImporter(mock?: ModuleImporter): void {
  importModule = mock ?? ((specifier) => import(/* @vite-ignore */ specifier));
}

async function importWithTimeout(specifier: string): Promise<unknown> {
  const importPromise = importModule(specifier);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      importPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Module load timed out: ${specifier}`));
        }, MODULE_LOAD_TIMEOUT_MS);
      }),
    ]);
    return await importPromise;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

// Covered via Chrome runtime integration; unit tests cannot load extension popup HTML.
export async function loadPopupModule(): Promise<void> {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const isDev = POPUP_DEV_HOSTS.has(hostname) || port === "5173";

  if (isDev) {
    await importWithTimeout(DEV_POPUP_ENTRY);
    return;
  }

  const moduleUrl = chrome?.runtime?.id ? chrome.runtime.getURL("popup.js") : "./popup.js";
  await importWithTimeout(moduleUrl);
}

// Triggered only on real popup failures; relies on DOM styling outside unit-test environment.
export function renderBootstrapError(): void {
  const statusContainer = document.getElementById("message");
  const statusText = document.getElementById("message-text");
  const preview = document.getElementById("preview");

  if (statusContainer instanceof HTMLElement && statusText instanceof HTMLElement) {
    statusContainer.removeAttribute("hidden");
    statusContainer.dataset.label = "Error";
    statusContainer.dataset.variant = "warning";
    statusText.textContent =
      "MarkQuote failed to load. Reopen the popup or reload the extension to try again.";
  } else {
    const fallback = document.createElement("div");
    fallback.textContent =
      "MarkQuote failed to load. Reopen the popup or reload the extension to try again.";
    fallback.style.cssText =
      "padding:12px;margin:12px 0;border-radius:8px;border:1px solid #d93025;color:#d93025;font-weight:600;";
    document.body.prepend(fallback);
  }

  if (preview instanceof HTMLElement) {
    preview.setAttribute("hidden", "true");
  }
}

export async function bootstrapPopup(): Promise<void> {
  try {
    await loadPopupModule();
  } catch (error) {
    console.error("Unable to bootstrap popup entry", error);
    renderBootstrapError();
  }
}

if (!isRunningUnderVitest(import.meta)) {
  void bootstrapPopup();
}
