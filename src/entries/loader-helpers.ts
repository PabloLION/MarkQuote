export type ModuleImporter = (specifier: string) => Promise<unknown>;

export const LOADER_TIMEOUT_MS = 10_000; // Aligns with extension UI bootstrap expectations.

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
  return Boolean((meta as VitestAwareImportMeta).vitest);
}
