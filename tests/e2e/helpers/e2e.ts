import type { Page } from "@playwright/test";
import type { OptionsPayload } from "../../../src/options-schema.js";

export async function sendSelectionMessage(
  page: Page,
  payload: { markdown: string; title: string; url: string },
): Promise<void> {
  await page.evaluate((message) => {
    chrome.runtime.sendMessage({ type: "e2e:selection", ...message });
  }, payload);
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

export async function primeSelectionStub(
  page: Page,
  payload: { markdown: string; title: string; url: string },
): Promise<void> {
  const result = await page.evaluate((message) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:prime-selection", ...message }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, payload);

  if (!result?.ok) {
    throw new Error(`Failed to prime selection stub: ${result?.error ?? "unknown error"}`);
  }
}

export async function triggerHotkeyCommand(page: Page, tabId?: number): Promise<void> {
  const result = await page.evaluate((id) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage({ type: "e2e:trigger-command", tabId: id }, (response) => {
        resolve(response ?? { ok: false, error: "No response received" });
      });
    });
  }, tabId);

  if (!result?.ok) {
    throw new Error(`Failed to trigger command: ${result?.error ?? "unknown error"}`);
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

export async function getBackgroundErrors(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    return new Promise<unknown>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "e2e:get-error-log" }, (response) => {
        if (!response) {
          reject(new Error("No response received"));
          return;
        }

        resolve(response.errors ?? []);
      });
    });
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
