import type { TriggerSource } from "../lib/constants.js";
import type { ErrorContext } from "./error-context.js";

/** Enumerates the origin of a copy request so diagnostics can attribute failures accurately. */
export type CopySource = TriggerSource;

/** Shape of entries persisted in the popup-visible error log. */
export type LoggedError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
};
