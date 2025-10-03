import type { ErrorContext } from "./error-context.js";

/** Enumerates the origin of a copy request so diagnostics can attribute failures accurately. */
export type CopySource = "popup" | "hotkey" | "context-menu" | "e2e" | "unknown";

/** Shape of entries persisted in the popup-visible error log. */
export type LoggedError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
};
