export const ERROR_CONTEXT = {
  InjectSelectionScript: "inject-selection-script",
  HotkeyOpenPopup: "hotkey-open-popup",
  HotkeyPopupTimeout: "hotkey-popup-timeout",
  OpenPopupForHotkey: "open-popup-for-hotkey",
  InitializeOptions: "initialize-options",
  RequestSelectionCopy: "request-selection-copy",
  QueryTabsForCopy: "query-tabs-for-copy",
  RestorePendingSources: "restore-pending-copy-sources",
  PersistPendingSources: "persist-pending-copy-sources",
  ContextMenusRemoveAll: "context-menus-remove-all",
  ContextMenusCreate: "context-menus-create",
  NotifyPopupPreview: "notify-popup-preview",
  TabClipboardWrite: "tab-clipboard-write",
  PersistOptionsE2E: "persist-options-e2e",
  InvalidOptionsPayload: "invalid-options-payload",
} as const;

export type ErrorContext = (typeof ERROR_CONTEXT)[keyof typeof ERROR_CONTEXT];
