/**
 * Shared error utilities for consistent error handling across the extension.
 */

const LOG_PREFIX = "[MarkQuote]";

/**
 * Chrome extension runtime disconnect errors that occur when the receiving
 * context is no longer available (e.g., popup closed, service worker idle).
 * These are expected during normal operation and should not be logged as errors.
 */
export function isTransientDisconnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.includes("Receiving end does not exist");
}

/**
 * Extracts a human-readable message from any error type.
 * Uses String() coercion for objects to call their toString() method.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Logs a debug message with the MarkQuote prefix.
 */
export function logDebug(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.debug(LOG_PREFIX, message, meta);
  } else {
    console.debug(LOG_PREFIX, message);
  }
}

/**
 * Logs an info message with the MarkQuote prefix.
 */
export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.info(LOG_PREFIX, message, meta);
  } else {
    console.info(LOG_PREFIX, message);
  }
}

/**
 * Logs a warning message with the MarkQuote prefix.
 */
export function logWarn(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.warn(LOG_PREFIX, message, meta);
  } else {
    console.warn(LOG_PREFIX, message);
  }
}

/**
 * Logs an error message with the MarkQuote prefix.
 */
export function logError(message: string, error?: unknown, meta?: Record<string, unknown>): void {
  if (error && meta) {
    console.error(LOG_PREFIX, message, error, meta);
  } else if (error) {
    console.error(LOG_PREFIX, message, error);
  } else if (meta) {
    console.error(LOG_PREFIX, message, meta);
  } else {
    console.error(LOG_PREFIX, message);
  }
}
