import type { ErrorContext } from "./error-context.js";

export type CopySource = "popup" | "hotkey" | "context-menu" | "e2e" | "unknown";

export type LoggedError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
};
