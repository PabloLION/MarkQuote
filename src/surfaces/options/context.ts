import type { OptionsPayload } from "../../options-schema.js";
import type { OptionsDom } from "./dom.js";

declare global {
  interface ChromeStorageSyncArea extends chrome.storage.SyncStorageArea {}
}

export interface OptionsContext {
  draft: OptionsPayload;
  readonly dom: OptionsDom;
  readonly storage: chrome.storage.SyncStorageArea | undefined;
  readonly previewSample: {
    title: string;
    url: string;
  };
  statusTimeout?: ReturnType<typeof setTimeout>;
}

export function createOptionsContext(
  dom: OptionsDom,
  storage: chrome.storage.SyncStorageArea | undefined,
  draft: OptionsPayload,
): OptionsContext {
  return {
    draft,
    dom,
    storage,
    previewSample: {
      title: "Markdown - Wikipedia",
      url: "https://www.amazon.com/dp/B01KBIJ53I",
    },
  };
}
