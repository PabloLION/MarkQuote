import {
  createImportController,
  isRunningUnderVitest,
  type ModuleImporter,
} from "./loader-helpers.js";

// Vite injects this at build time when SMOKE_BUILD_TIME env var is set
declare const __SMOKE_BUILD_TIME__: string;

const POPUP_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DEV_POPUP_ENTRY: string = "/src/surfaces/popup/main.ts";

const { importWithTimeout, setModuleImporter } = createImportController();

export function __setPopupModuleImporter(mock?: ModuleImporter): void {
  setModuleImporter(mock);
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

function renderSmokeBuildTimestamp(): void {
  // __SMOKE_BUILD_TIME__ is replaced by Vite at build time
  // It will be empty string for normal builds, timestamp for smoke builds
  // When empty, this entire function is tree-shaken from the release build
  const buildTime = typeof __SMOKE_BUILD_TIME__ !== "undefined" ? __SMOKE_BUILD_TIME__ : "";
  if (!buildTime) return;

  const el = document.createElement("div");
  el.textContent = `Smoke #${buildTime}`;
  el.style.cssText = "font-size:10px;color:#888;text-align:left;margin-top:8px;";
  document.body.appendChild(el);
}

/* v8 ignore next 8 - bootstrap wrapper with error boundary */
export async function bootstrapPopup(): Promise<void> {
  renderSmokeBuildTimestamp();
  try {
    await loadPopupModule();
  } catch (error) {
    console.error("Unable to bootstrap popup entry", error);
    renderBootstrapError();
  }
}

/* v8 ignore next 3 - production entry point, skipped in vitest */
if (!isRunningUnderVitest(import.meta)) {
  void bootstrapPopup();
}
