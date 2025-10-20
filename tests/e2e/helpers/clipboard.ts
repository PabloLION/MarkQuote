import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

export interface ClipboardSnapshot {
  initialText: string;
  restore(): Promise<void>;
}

/**
 * Generates a unique nonce to embed in clipboard assertions. Including an optional label makes test
 * failures easier to triage when multiple flows run sequentially.
 */
export function mintClipboardNonce(label: string = "clipboard"): string {
  const timestamp = Date.now().toString(36);
  const uuid = randomUUID();
  return `markquote-${label}-${timestamp}-${uuid}`;
}

/**
 * Ensures the provided clipboard payload contains the nonce produced by {@link mintClipboardNonce}.
 * Throws when the nonce was not propagated, mirroring Vitest's assertion semantics.
 */
export function assertClipboardContainsNonce(payload: string, nonce: string): void {
  if (!payload.includes(nonce)) {
    throw new Error(
      `Clipboard payload did not include expected nonce. Expected substring: ${nonce}. Received: ${payload}`,
    );
  }
}

/**
 * Reads the current clipboard contents from the page's context. Assumes the caller already granted
 * the appropriate clipboard permissions for the active origin.
 */
export async function readClipboardText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : error ? String(error) : "unknown error";
      throw new Error(`Clipboard read failed: ${detail}`);
    }
  });
}

/**
 * Writes the provided text to the clipboard from the page context. Requires clipboard-write
 * permission to succeed.
 */
export async function writeClipboardText(page: Page, text: string): Promise<void> {
  await page.evaluate(async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : error ? String(error) : "unknown error";
      throw new Error(`Clipboard write failed: ${detail}`);
    }
  }, text);
}

/**
 * Captures the current clipboard text and returns a snapshot that can restore the prior value once
 * the test finishes.
 */
export async function snapshotClipboard(page: Page): Promise<ClipboardSnapshot> {
  const initialText = await readClipboardText(page);
  return {
    initialText,
    async restore() {
      await writeClipboardText(page, initialText);
    },
  };
}

export interface WaitForClipboardNonceOptions {
  attempts?: number;
  delayMs?: number;
}

export async function waitForClipboardNonce(
  page: Page,
  nonce: string,
  message: string,
  options: WaitForClipboardNonceOptions = {},
): Promise<string> {
  const { attempts = 40, delayMs = 250 } = options;
  let lastValue = "";

  for (let index = 0; index < attempts; index += 1) {
    try {
      await page.bringToFront();
    } catch (_error) {
      // Some extension pages may reject focus changes; ignore and proceed with the read attempt.
    }
    lastValue = await readClipboardText(page);
    if (lastValue.includes(nonce)) {
      return lastValue;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  throw new Error(`${message} Last clipboard value: ${lastValue}`);
}
