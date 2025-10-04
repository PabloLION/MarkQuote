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
});
