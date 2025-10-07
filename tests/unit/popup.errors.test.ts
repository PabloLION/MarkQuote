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
  const reportErrorsButton = document.createElement("button");
  const dismissErrorsButton = document.createElement("button");

  return {
    message,
    messageText,
    preview,
    previewCode: null,
    optionsButton: null,
    hotkeysButton: null,
    feedbackButton: null,
    inlineModeButton: null,
    problemBadge,
    errorContainer,
    errorList,
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
      optionsButton: null,
      hotkeysButton: null,
      feedbackButton: null,
      inlineModeButton: null,
      problemBadge: null,
      errorContainer: null,
      errorList: null,
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
});
