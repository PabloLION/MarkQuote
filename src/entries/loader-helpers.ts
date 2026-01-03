export type ModuleImporter = (specifier: string) => Promise<unknown>;

export const LOADER_TIMEOUT_MS = 5_000; // Fast fail ensures users see fallback messaging promptly.

type VitestAwareImportMeta = ImportMeta & { vitest?: boolean };

type ImportController = {
  importWithTimeout: (specifier: string) => Promise<unknown>;
  setModuleImporter: (mock?: ModuleImporter) => void;
};

function dynamicImport(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ specifier);
}

export function createImportController(): ImportController {
  let importer: ModuleImporter = dynamicImport;

  return {
    async importWithTimeout(specifier: string): Promise<unknown> {
      const importPromise = importer(specifier);
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      try {
        await Promise.race([
          importPromise,
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Module load timed out: ${specifier}`));
            }, LOADER_TIMEOUT_MS);
          }),
        ]);
        return await importPromise;
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    },
    setModuleImporter(mock?: ModuleImporter): void {
      importer = mock ?? dynamicImport;
    },
  };
}

export function isRunningUnderVitest(meta: ImportMeta): boolean {
  if ((meta as VitestAwareImportMeta).vitest) {
    return true;
  }
  if (process?.env?.VITEST) {
    return true;
  }
  /* v8 ignore next 6 - fallback detection path, earlier checks succeed in vitest */
  if (
    typeof globalThis === "object" &&
    (globalThis as { __vitest_worker__?: boolean }).__vitest_worker__
  ) {
    return true;
  }
  return false;
}
