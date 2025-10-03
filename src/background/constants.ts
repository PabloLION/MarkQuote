export const DEFAULT_TITLE = "Page Title";
export const DEFAULT_URL = "https://example.com";
export const E2E_SELECTION_MESSAGE = "e2e:selection";
export const E2E_LAST_FORMATTED_MESSAGE = "e2e:get-last-formatted";
export const E2E_SET_OPTIONS_MESSAGE = "e2e:set-options";
export const ERROR_STORAGE_KEY = "markquote-error-log";
export const ACTIVE_TAB_PERMISSION_MESSAGE =
  'Chrome only grants keyboard shortcuts access after you allow the site in the extension\'s "Site access" settings.';

export const isE2ETest = (import.meta.env?.VITE_E2E ?? "").toLowerCase() === "true";
