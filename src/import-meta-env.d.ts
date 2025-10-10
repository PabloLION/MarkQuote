declare interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_E2E?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
