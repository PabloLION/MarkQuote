const DEV_OPTIONS_ENTRY: string = "/src/surfaces/options/main.ts";

type ModuleImporter = (specifier: string) => Promise<unknown>;

const MODULE_LOAD_TIMEOUT_MS = 10_000;

type VitestAwareImportMeta = ImportMeta & { vitest?: boolean };

function isRunningUnderVitest(meta: ImportMeta): boolean {
  return Boolean((meta as VitestAwareImportMeta).vitest);
}

let importModule: ModuleImporter = (specifier) => import(/* @vite-ignore */ specifier);

export function __setOptionsModuleImporter(mock?: ModuleImporter): void {
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

// Mirrors browser behaviour when mounting the options page; excluded from unit coverage because it
// depends on Chrome extension APIs and async module loading.
export async function loadOptionsModule(): Promise<void> {
  const isExtensionContext = Boolean(globalThis.chrome?.runtime?.id);
  if (!isExtensionContext) {
    await importWithTimeout(DEV_OPTIONS_ENTRY);
    return;
  }

  const moduleUrl = chrome.runtime.getURL("options.js");
  await importWithTimeout(moduleUrl);
}

// Displays the inline error banner when the options bundle cannot boot; relies on DOM fragments
// provided only in browser surfaces, so we document and exclude it from coverage metrics.
export function renderOptionsError(error: unknown): void {
  console.error("Failed to boot options page.", error);

  const statusElement = document.getElementById("status");
  if (statusElement instanceof HTMLElement) {
    statusElement.textContent =
      "MarkQuote options failed to load. Refresh this tab or reopen the options page.";
    statusElement.setAttribute("role", "alert");
    return;
  }

  const fallback = document.createElement("p");
  fallback.textContent =
    "MarkQuote options failed to load. Refresh this tab or reopen the options page.";
  fallback.style.cssText =
    "margin:16px 0;padding:12px;border:1px solid #d93025;border-radius:8px;color:#d93025;font-weight:600;";
  document.body.prepend(fallback);
}

export async function bootstrapOptions(): Promise<void> {
  try {
    await loadOptionsModule();
  } catch (error) {
    renderOptionsError(error);
  }
}

if (!isRunningUnderVitest(import.meta)) {
  void bootstrapOptions();
}
