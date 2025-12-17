/**
 * Options persistence utilities for the background service worker.
 * Handles storage initialization and migration of user options.
 */

import { logInfo, logWarn } from "../lib/errors.js";
import {
  CURRENT_OPTIONS_VERSION,
  DEFAULT_OPTIONS,
  normalizeStoredOptions,
  type OptionsPayload,
  validateOptionsPayload,
} from "../options-schema.js";
import { ERROR_CONTEXT } from "./error-context.js";
import { recordError } from "./errors.js";

/**
 * Persists the latest options payload to sync storage while retaining backwards
 * compatibility with earlier schema versions.
 */
export async function persistOptions(payload: OptionsPayload): Promise<void> {
  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    logWarn("chrome.storage.sync is unavailable; cannot persist options.");
    return;
  }

  const normalized = normalizeStoredOptions({ options: payload });
  await storageArea.set({
    options: normalized,
    format: normalized.format,
    titleRules: normalized.titleRules,
    urlRules: normalized.urlRules,
    showConfirmationPopup: normalized.showConfirmationPopup,
  });
}

/**
 * Ensures sync storage contains a valid options payload. This handles first-run
 * defaults as well as migrations from prior versions.
 */
export async function initializeOrMigrateOptions(): Promise<void> {
  const storageArea = chrome.storage?.sync;
  if (!storageArea) {
    logWarn("chrome.storage.sync is unavailable; cannot initialize options.");
    return;
  }

  try {
    const snapshot = await storageArea.get([
      "options",
      "format",
      "titleRules",
      "urlRules",
      "rules",
    ]);

    const hasExistingData = Object.values(snapshot).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (value && typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return Boolean(value);
    });

    if (!hasExistingData) {
      await storageArea.set({
        options: DEFAULT_OPTIONS,
        format: DEFAULT_OPTIONS.format,
        titleRules: DEFAULT_OPTIONS.titleRules,
        urlRules: DEFAULT_OPTIONS.urlRules,
        showConfirmationPopup: DEFAULT_OPTIONS.showConfirmationPopup,
      });
      return;
    }

    const normalized = normalizeStoredOptions(snapshot);

    if (!validateOptionsPayload(snapshot.options)) {
      logInfo("Normalizing legacy options payload before continuing.");
      await storageArea.set({
        options: normalized,
        format: normalized.format,
        titleRules: normalized.titleRules,
        urlRules: normalized.urlRules,
        showConfirmationPopup: normalized.showConfirmationPopup,
      });
      return;
    }

    const existingOptions = snapshot.options as { version?: number } | undefined;
    if (existingOptions?.version !== CURRENT_OPTIONS_VERSION) {
      await storageArea.set({
        options: normalized,
        format: normalized.format,
        titleRules: normalized.titleRules,
        urlRules: normalized.urlRules,
        showConfirmationPopup: normalized.showConfirmationPopup,
      });
    }
  } catch (error) {
    logWarn("Failed to initialize options storage.", { error });
    void recordError(ERROR_CONTEXT.InitializeOptions, error);
  }
}
