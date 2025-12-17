import type { TriggerSource } from "../lib/constants.js";
import type { ErrorContext } from "./error-context.js";

/** Enumerates the origin of a copy request so diagnostics can attribute failures accurately. */
export type CopySource = TriggerSource;

/**
 * Structured diagnostic metadata captured with each error.
 * Enables detailed GitHub issue reports without PII.
 */
export type DiagnosticMetadata = {
  /** Copy trigger source (popup, hotkey, context-menu, e2e, unknown) */
  source?: TriggerSource;
  /** Tab URL where error occurred (hostname only for privacy) */
  tabUrl?: string;
  /** Tab ID for correlation */
  tabId?: number;
  /** Error stack trace if available */
  stack?: string;
  /** Extension version from manifest */
  extensionVersion: string;
  /** Browser user agent string */
  userAgent: string;
};

/** Shape of entries persisted in the popup-visible error log. */
export type LoggedError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
  /** Structured diagnostic metadata for GitHub issue reports */
  diagnostics?: DiagnosticMetadata;
};
