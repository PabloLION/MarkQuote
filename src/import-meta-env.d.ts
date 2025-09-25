declare interface ImportMetaEnv {
  readonly VITE_E2E?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
