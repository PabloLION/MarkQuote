import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyMarkdownToClipboard } from "../../src/surfaces/popup/clipboard.js";

const originalClipboard = navigator.clipboard;
const originalExecCommand = (document as Document & { execCommand?: (command: string) => boolean })
  .execCommand;

describe("popup clipboard", () => {
  beforeEach(() => {
    if (originalExecCommand === undefined) {
      // Ensure execCommand exists for tests.
      Object.defineProperty(document, "execCommand", {
        value: vi.fn(),
        configurable: true,
      });
    }
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    } else {
      // @ts-expect-error restore undefined clipboard
      delete navigator.clipboard;
    }

    if (originalExecCommand !== undefined) {
      Object.defineProperty(document, "execCommand", {
        value: originalExecCommand,
        configurable: true,
      });
    } else {
      // @ts-expect-error restore undefined execCommand
      delete document.execCommand;
    }

    vi.restoreAllMocks();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const result = await copyMarkdownToClipboard("Hello");

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Hello");
  });

  it("falls back to execCommand when clipboard API throws", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard failure"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const execMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execMock,
      configurable: true,
    });

    const result = await copyMarkdownToClipboard("Hi");

    expect(result).toBe(true);
    expect(execMock).toHaveBeenCalledWith("copy");
  });

  it("returns false when execCommand fails", async () => {
    // @ts-expect-error ensure clipboard path absent
    delete navigator.clipboard;
    const execMock = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", {
      value: execMock,
      configurable: true,
    });

    const result = await copyMarkdownToClipboard("Fallback");

    expect(result).toBe(false);
    expect(execMock).toHaveBeenCalledWith("copy");
  });
});
