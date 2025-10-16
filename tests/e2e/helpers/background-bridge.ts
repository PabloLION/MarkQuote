import type { Page } from "@playwright/test";
import type {
  ClipboardTelemetryEvent as BackgroundClipboardTelemetryEvent,
  ClipboardTelemetryOrigin,
} from "../../../src/background/copy-pipeline.js";
import type { CopySource } from "../../../src/background/types.js";
import type { OptionsPayload } from "../../../src/options-schema.js";

export interface HotkeyDiagnostics {
  eventTabId: number | null;
  resolvedTabId: number | null;
  stubSelectionUsed: boolean;
  injectionAttempted: boolean;
  injectionSucceeded: boolean | null;
  injectionError: string | null;
  timestamp: number;
}

export type ClipboardTelemetryEvent = BackgroundClipboardTelemetryEvent & {
  origin: ClipboardTelemetryOrigin;
  source: CopySource;
};

export async function clearClipboardTelemetry(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:clear-clipboard-telemetry" }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  });

  if (!result?.ok) {
    throw new Error(`Failed to clear clipboard telemetry: ${result?.error ?? "unknown error"}`);
  }
}

export async function setClipboardTelemetryTag(page: Page, tag: string | null): Promise<void> {
  const result = await page.evaluate((value) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:set-clipboard-tag", tag: value }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, tag);

  if (!result?.ok) {
    throw new Error(
      `Failed to set clipboard telemetry tag: ${result?.error ?? "unknown error setting tag"}`,
    );
  }
}

export async function readClipboardTelemetry(page: Page): Promise<ClipboardTelemetryEvent[]> {
  const response = await page.evaluate(() => {
    return new Promise<{ events?: ClipboardTelemetryEvent[] }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:get-clipboard-telemetry" }, (payload) => {
        resolve((payload as { events?: ClipboardTelemetryEvent[] }) ?? {});
      });
    });
  });

  return response.events ?? [];
}

export async function getLatestClipboardEventForTag(
  page: Page,
  tag: string,
): Promise<ClipboardTelemetryEvent | null> {
  const events = await readClipboardTelemetry(page);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const candidate = events[index];
    if (candidate?.tag === tag) {
      return candidate;
    }
  }
  return null;
}

export async function waitForClipboardTelemetry(
  page: Page,
  options: { tag: string; timeoutMs?: number; pollIntervalMs?: number },
): Promise<ClipboardTelemetryEvent> {
  const { tag, timeoutMs = 5_000, pollIntervalMs = 100 } = options;
  const deadline = Date.now() + timeoutMs;
  let previewEvent: ClipboardTelemetryEvent | null = null;

  while (Date.now() <= deadline) {
    const event = await getLatestClipboardEventForTag(page, tag);
    if (event) {
      if (event.origin !== "preview") {
        return event;
      }
      previewEvent = event;
    }
    await page.waitForTimeout(pollIntervalMs);
  }

  if (previewEvent) {
    return previewEvent;
  }

  throw new Error(`Clipboard telemetry for ${tag} did not arrive within ${timeoutMs}ms.`);
}

export async function setOptionsPayload(page: Page, options: OptionsPayload): Promise<void> {
  const result = await page.evaluate((candidate) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:set-options", options: candidate }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, options);

  if (!result?.ok) {
    throw new Error(
      `Failed to set options via runtime message: ${result?.error ?? "unknown error"}`,
    );
  }
}

export async function readLastFormatted(
  page: Page,
): Promise<{ formatted: string; error?: string }> {
  return page.evaluate(() => {
    return new Promise<{ formatted: string; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:get-last-formatted" }, (response) => {
        resolve(response ?? { formatted: "", error: "No response received" });
      });
    });
  });
}

export async function resetPreviewState(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:reset-preview-state" }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  });

  if (!result?.ok) {
    throw new Error(`Failed to reset preview state: ${result?.error ?? "unknown error"}`);
  }
}

export async function readClipboardPayload(page: Page): Promise<string> {
  const response = await page.evaluate(() => {
    return new Promise<{ payload?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:get-clipboard-payload" }, (payload) => {
        resolve((payload as { payload?: string }) ?? {});
      });
    });
  });

  return response.payload ?? "";
}

export async function resetHotkeyDiagnostics(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:reset-hotkey-diagnostics" }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  });

  if (!result?.ok) {
    throw new Error(
      `Failed to reset hotkey diagnostics: ${result?.error ?? "unknown error resetting diagnostics"}`,
    );
  }
}

export async function triggerHotkeyCommand(
  page: Page,
  options: { tabId?: number; forcePinned?: boolean } = {},
): Promise<void> {
  const result = await page.evaluate((payload) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:trigger-command", ...payload }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, options);

  if (!result?.ok) {
    throw new Error(`Failed to trigger command: ${result?.error ?? "unknown error"}`);
  }
}

export async function setHotkeyPinnedState(page: Page, pinned: boolean | null): Promise<void> {
  const result = await page.evaluate((state) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:set-hotkey-pinned", pinned: state }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, pinned);

  if (!result?.ok) {
    throw new Error(
      `Failed to set hotkey pinned state: ${result?.error ?? "unknown error setting pinned state"}`,
    );
  }
}

export async function triggerContextCopy(
  page: Page,
  options: { tabId?: number; source?: string } = {},
): Promise<void> {
  const result = await page.evaluate((payload) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:context-copy", ...payload }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, options);

  if (!result?.ok) {
    throw new Error(`Failed to trigger context copy: ${result?.error ?? "unknown error"}`);
  }
}

export async function getBackgroundErrors(
  page: Page,
): Promise<Array<{ message: string; context: string; timestamp: number }>> {
  return page.evaluate(() => {
    return new Promise<Array<{ message: string; context: string; timestamp: number }>>(
      (resolve, reject) => {
        chrome.runtime.sendMessage({ type: "e2e:get-error-log" }, (response) => {
          if (!response) {
            reject(new Error("No response received"));
            return;
          }

          resolve(
            (response.errors ?? []) as Array<{
              message: string;
              context: string;
              timestamp: number;
            }>,
          );
        });
      },
    );
  });
}

export async function clearBackgroundErrors(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:clear-error-log" }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  });

  if (!result?.ok) {
    throw new Error(`Failed to clear background errors: ${result?.error ?? "unknown error"}`);
  }
}

export async function seedBackgroundError(
  page: Page,
  payload: { context: string; message?: string },
): Promise<void> {
  const result = await page.evaluate((message) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:seed-error", ...message }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, payload);

  if (!result?.ok) {
    throw new Error(`Failed to seed background error: ${result?.error ?? "unknown error"}`);
  }
}

export async function resetExtensionState(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:reset-storage" }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  });

  if (!result?.ok) {
    throw new Error(`Failed to reset extension state: ${result?.error ?? "unknown error"}`);
  }
}

export async function getActiveTab(page: Page): Promise<{
  id: number | null;
  windowId: number | null;
  url: string | null;
  title: string | null;
}> {
  const response = await page.evaluate(() => {
    return new Promise<
      | { id: number | null; windowId: number | null; url: string | null; title: string | null }
      | { ok: false; error?: string }
    >((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:get-active-tab" }, (payload) => {
        resolve(payload ?? { ok: false, error: "No response received" });
      });
    });
  });

  if ("ok" in response && response.ok === false) {
    throw new Error(response.error ?? "Failed to read active tab");
  }

  return response as {
    id: number | null;
    windowId: number | null;
    url: string | null;
    title: string | null;
  };
}

export async function getHotkeyDiagnostics(page: Page): Promise<HotkeyDiagnostics> {
  const response = await page.evaluate(() => {
    return new Promise<HotkeyDiagnostics | { ok: false; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:get-hotkey-diagnostics" }, (payload) => {
        resolve(
          (payload as HotkeyDiagnostics | { ok: false; error?: string }) ?? {
            ok: false,
            error: "No response received",
          },
        );
      });
    });
  });

  if ("ok" in response && response.ok === false) {
    throw new Error(response.error ?? "Failed to read hotkey diagnostics");
  }

  return response as HotkeyDiagnostics;
}

export async function findTabByUrl(
  page: Page,
  urlPattern: string,
): Promise<{
  id: number | null;
  windowId: number | null;
  url: string | null;
  title: string | null;
}> {
  const response = await page.evaluate((pattern) => {
    return new Promise<
      | { id: number | null; windowId: number | null; url: string | null; title: string | null }
      | { ok: false; error?: string }
    >((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:find-tab", url: pattern }, (payload) => {
        resolve(payload ?? { ok: false, error: "No response received" });
      });
    });
  }, urlPattern);

  if ("ok" in response && response.ok === false) {
    throw new Error(response.error ?? "Failed to locate tab");
  }

  return response as {
    id: number | null;
    windowId: number | null;
    url: string | null;
    title: string | null;
  };
}
