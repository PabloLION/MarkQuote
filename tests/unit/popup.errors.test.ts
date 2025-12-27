import { describe, expect, it, vi } from "vitest";
import type { PopupDom } from "../../src/surfaces/popup/dom.js";
import { createErrorController } from "../../src/surfaces/popup/errors.js";

function buildDom(): PopupDom {
  const message = document.createElement("div");
  const messageText = document.createElement("span");
  message.append(messageText);
  const preview = document.createElement("div");

  const problemBadge = document.createElement("span");
  problemBadge.setAttribute("hidden", "true");

  const errorContainer = document.createElement("section");
  errorContainer.hidden = true;

  const errorList = document.createElement("ul");
  const copyDetailsButton = document.createElement("button");
  const reportErrorsButton = document.createElement("button");
  const dismissErrorsButton = document.createElement("button");

  return {
    message,
    messageText,
    preview,
    previewCode: null,
    previewStats: null,
    previewToggle: null,
    optionsButton: null,
    hotkeysButton: null,
    feedbackButton: null,
    inlineModeButton: null,
    problemBadge,
    errorContainer,
    errorList,
    copyDetailsButton,
    reportErrorsButton,
    dismissErrorsButton,
  } satisfies PopupDom;
}

describe("popup error controller", () => {
  it("renders errors and updates badge", async () => {
    const dom = buildDom();
    const openFeedback = vi.fn();
    const runtime = {
      sendMessage: vi
        .fn()
        .mockResolvedValueOnce({
          errors: [
            { message: "Boom", context: "inject-selection", timestamp: 1 },
            { message: "Second", context: "hotkey-open-popup", timestamp: 2 },
          ],
        })
        .mockResolvedValue({ ok: true }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, openFeedback);

    await controller.refresh();

    expect(dom.errorContainer?.hidden).toBe(false);
    expect(dom.problemBadge?.textContent).toBe("2");
    expect(dom.errorList?.childElementCount).toBe(2);

    dom.reportErrorsButton?.click();
    expect(openFeedback).toHaveBeenCalled();
    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: "clear-error-log" });

    await vi.waitFor(() => {
      expect(runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    controller.dispose();
    dom.reportErrorsButton?.click();
  });

  it("returns no-op controller when DOM missing elements", async () => {
    const dom = {
      message: document.createElement("div"),
      messageText: document.createElement("span"),
      preview: document.createElement("div"),
      previewCode: null,
      previewStats: null,
      previewToggle: null,
      optionsButton: null,
      hotkeysButton: null,
      feedbackButton: null,
      inlineModeButton: null,
      problemBadge: null,
      errorContainer: null,
      errorList: null,
      copyDetailsButton: null,
      reportErrorsButton: null,
      dismissErrorsButton: null,
    } satisfies PopupDom;

    const controller = createErrorController(dom, undefined, () => {});
    await expect(controller.refresh()).resolves.toBeUndefined();
    controller.dispose();
  });

  it("handles runtime failures when fetching errors", async () => {
    const dom = buildDom();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = {
      sendMessage: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    expect(dom.problemBadge?.hasAttribute("hidden")).toBe(true);
    expect(dom.errorList?.childElementCount).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith("Failed to load error log", expect.any(Error));

    warnSpy.mockRestore();
  });

  it("logs failures when clearing the error log", async () => {
    const dom = buildDom();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = {
      sendMessage: vi
        .fn()
        .mockResolvedValueOnce({ errors: [] })
        .mockRejectedValue(new Error("clear failed")),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.dismissErrorsButton?.click();
    await vi.waitFor(() => {
      expect(runtime.sendMessage).toHaveBeenCalledWith({ type: "clear-error-log" });
    });
    expect(warnSpy).toHaveBeenCalledWith("Failed to clear error log", expect.any(Error));

    warnSpy.mockRestore();
    controller.dispose();
  });

  it("ignores malformed error payloads", async () => {
    const dom = buildDom();
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({ errors: "not-an-array" }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    expect(dom.errorContainer?.hidden).toBe(true);
    expect(dom.errorList?.childElementCount).toBe(0);
  });

  it("refreshes gracefully when runtime is unavailable", async () => {
    const dom = buildDom();
    const controller = createErrorController(dom, undefined, () => {});

    await controller.refresh();
    expect(dom.problemBadge?.hasAttribute("hidden")).toBe(true);

    dom.dismissErrorsButton?.click();
    await expect(controller.refresh()).resolves.toBeUndefined();
    controller.dispose();
  });

  it("copies error details as markdown to clipboard", async () => {
    const dom = buildDom();
    const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteSpy },
    });

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        errors: [
          {
            message: "Test error",
            context: "inject-selection",
            timestamp: 1700000000000,
            diagnostics: {
              source: "popup",
              tabUrl: "example.com",
              tabId: 42,
              extensionVersion: "1.0.3",
              userAgent: "Mozilla/5.0",
            },
          },
        ],
      }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.copyDetailsButton?.click();

    await vi.waitFor(() => {
      expect(clipboardWriteSpy).toHaveBeenCalled();
    });

    const copiedText = clipboardWriteSpy.mock.calls[0][0] as string;
    expect(copiedText).toContain("## MarkQuote Error Report");
    expect(copiedText).toContain("**Extension Version:** 1.0.3");
    expect(copiedText).toContain("**User Agent:** Mozilla/5.0");
    expect(copiedText).toContain("#### inject-selection");
    expect(copiedText).toContain("**Source:** popup");
    expect(copiedText).toContain("**Tab Host:** example.com");
    expect(copiedText).toContain("**Tab ID:** 42");

    controller.dispose();
  });

  it("includes stack trace in collapsible details", async () => {
    const dom = buildDom();
    const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteSpy },
    });

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        errors: [
          {
            message: "Error with stack",
            context: "hotkey-open-popup",
            timestamp: 1700000000000,
            diagnostics: {
              stack: "Error: Test\n    at foo.js:10\n    at bar.js:20",
              extensionVersion: "1.0.3",
              userAgent: "Chrome",
            },
          },
        ],
      }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.copyDetailsButton?.click();

    await vi.waitFor(() => {
      expect(clipboardWriteSpy).toHaveBeenCalled();
    });

    const copiedText = clipboardWriteSpy.mock.calls[0][0] as string;
    expect(copiedText).toContain("<details>");
    expect(copiedText).toContain("<summary>Stack Trace</summary>");
    expect(copiedText).toContain("Error: Test");
    expect(copiedText).toContain("at foo.js:10");
    expect(copiedText).toContain("</details>");

    controller.dispose();
  });

  it("shows Copied! feedback on successful copy", async () => {
    const dom = buildDom();
    const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteSpy },
    });

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        errors: [{ message: "Test", context: "init", timestamp: 1 }],
      }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.copyDetailsButton?.click();

    await vi.waitFor(() => {
      expect(dom.copyDetailsButton?.textContent).toBe("Copied!");
    });

    controller.dispose();
  });

  it("restores button text after Copied! timeout", async () => {
    vi.useFakeTimers();

    try {
      const dom = buildDom();
      dom.copyDetailsButton!.textContent = "Copy details";
      const clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: clipboardWriteSpy },
      });

      const runtime = {
        sendMessage: vi.fn().mockResolvedValue({
          errors: [{ message: "Test", context: "init", timestamp: 1 }],
        }),
      } as unknown as typeof chrome.runtime;

      const controller = createErrorController(dom, runtime, () => {});
      await controller.refresh();

      dom.copyDetailsButton?.click();

      // Flush microtasks to let async click handler complete (without advancing timers)
      await Promise.resolve();
      await Promise.resolve();

      expect(dom.copyDetailsButton?.textContent).toBe("Copied!");

      // Advance past the 1500ms restoration timeout
      await vi.advanceTimersByTimeAsync(1500);

      expect(dom.copyDetailsButton?.textContent).toBe("Copy details");

      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles clipboard write failure gracefully", async () => {
    const dom = buildDom();
    const clipboardWriteSpy = vi.fn().mockRejectedValue(new Error("Not allowed"));
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteSpy },
    });

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        errors: [{ message: "Test", context: "init", timestamp: 1 }],
      }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.copyDetailsButton?.click();

    await vi.waitFor(() => {
      expect(clipboardWriteSpy).toHaveBeenCalled();
    });

    // Button text should remain unchanged on failure
    expect(dom.copyDetailsButton?.textContent).toBe("");

    controller.dispose();
  });

  it("skips copy when no errors available", async () => {
    const dom = buildDom();
    const clipboardWriteSpy = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteSpy },
    });

    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({ errors: [] }),
    } as unknown as typeof chrome.runtime;

    const controller = createErrorController(dom, runtime, () => {});
    await controller.refresh();

    dom.copyDetailsButton?.click();

    // Give it some time to potentially call clipboard
    await new Promise((r) => setTimeout(r, 50));
    expect(clipboardWriteSpy).not.toHaveBeenCalled();

    controller.dispose();
  });
});
