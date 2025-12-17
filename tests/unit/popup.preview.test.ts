import { describe, expect, it, vi } from "vitest";
import { PREVIEW_LIMITS } from "../../src/lib/constants.js";
import type { PopupDom } from "../../src/surfaces/popup/dom.js";
import { createPreviewController } from "../../src/surfaces/popup/preview.js";

function buildDom(): PopupDom {
  const message = document.createElement("div");
  const messageText = document.createElement("span");
  const preview = document.createElement("pre");
  const previewCode = document.createElement("code");
  preview.appendChild(previewCode);
  const previewStats = document.createElement("span");
  previewStats.hidden = true;
  const previewToggle = document.createElement("button");
  previewToggle.hidden = true;

  return {
    message,
    messageText,
    preview,
    previewCode,
    previewStats,
    previewToggle,
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
  };
}

describe("popup preview controller", () => {
  it("renders short text without truncation", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render("Hello, world!");

    expect(dom.previewCode?.textContent).toBe("Hello, world!");
    expect(dom.preview.hidden).toBe(false);
    expect(controller.isTruncated()).toBe(false);
    expect(dom.previewToggle?.hidden).toBe(true);
  });

  it("shows stats for all content", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render("Line 1\nLine 2\nLine 3");

    expect(dom.previewStats?.textContent).toContain("chars");
    expect(dom.previewStats?.textContent).toContain("lines");
    expect(dom.previewStats?.hidden).toBe(false);
  });

  it("truncates text exceeding character limit", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const longText = "a".repeat(PREVIEW_LIMITS.MAX_CHARS + 100);

    controller.render(longText);

    expect(controller.isTruncated()).toBe(true);
    expect(dom.previewCode?.textContent?.length).toBeLessThan(longText.length);
    expect(dom.previewCode?.textContent).toContain("…");
    expect(dom.previewToggle?.hidden).toBe(false);
    expect(dom.previewToggle?.textContent).toBe("Show more");
  });

  it("truncates text exceeding line limit", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const manyLines = Array(PREVIEW_LIMITS.MAX_LINES + 5)
      .fill("Short line")
      .join("\n");

    controller.render(manyLines);

    expect(controller.isTruncated()).toBe(true);
    const displayedLines = dom.previewCode?.textContent?.split("\n").length ?? 0;
    expect(displayedLines).toBeLessThanOrEqual(PREVIEW_LIMITS.MAX_LINES + 1); // +1 for ellipsis
    expect(dom.previewToggle?.hidden).toBe(false);
  });

  it("toggles between truncated and full preview", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const longText = "a".repeat(PREVIEW_LIMITS.MAX_CHARS + 100);

    controller.render(longText);
    const truncatedLength = dom.previewCode?.textContent?.length ?? 0;

    controller.toggleExpanded();

    expect(dom.previewCode?.textContent?.length).toBe(longText.length);
    expect(dom.previewToggle?.textContent).toBe("Show less");

    controller.toggleExpanded();

    expect(dom.previewCode?.textContent?.length).toBe(truncatedLength);
    expect(dom.previewToggle?.textContent).toBe("Show more");
  });

  it("handles toggle button click", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const longText = "a".repeat(PREVIEW_LIMITS.MAX_CHARS + 100);

    controller.render(longText);

    dom.previewToggle?.click();

    expect(dom.previewToggle?.textContent).toBe("Show less");
  });

  it("ignores toggle when not truncated", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render("Short text");
    const originalContent = dom.previewCode?.textContent;

    controller.toggleExpanded();

    expect(dom.previewCode?.textContent).toBe(originalContent);
  });

  it("clears preview and hides elements", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render("Some text");
    controller.clear();

    expect(dom.previewCode?.textContent).toBe("");
    expect(dom.preview.hidden).toBe(true);
    expect(dom.previewStats?.hidden).toBe(true);
    expect(dom.previewToggle?.hidden).toBe(true);
  });

  it("handles null and undefined text", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render(null);
    expect(dom.preview.hidden).toBe(true);

    controller.render(undefined);
    expect(dom.preview.hidden).toBe(true);
  });

  it("handles empty and whitespace-only text", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);

    controller.render("");
    expect(dom.preview.hidden).toBe(true);

    controller.render("   \n\t  ");
    expect(dom.preview.hidden).toBe(true);
  });

  it("resets expansion state on new render", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const longText = "a".repeat(PREVIEW_LIMITS.MAX_CHARS + 100);

    controller.render(longText);
    controller.toggleExpanded();
    expect(dom.previewToggle?.textContent).toBe("Show less");

    controller.render(longText);
    expect(dom.previewToggle?.textContent).toBe("Show more");
  });

  it("formats stats with locale separators", () => {
    const dom = buildDom();
    const controller = createPreviewController(dom);
    const longText = "a".repeat(1500);

    controller.render(longText);

    // Should contain formatted number (e.g., "1,500")
    expect(dom.previewStats?.textContent).toMatch(/1[,.]?500/);
  });

  it("works without previewStats and previewToggle elements", () => {
    const dom = buildDom();
    dom.previewStats = null;
    dom.previewToggle = null;

    const controller = createPreviewController(dom);
    const longText = "a".repeat(PREVIEW_LIMITS.MAX_CHARS + 100);

    // Should not throw
    controller.render(longText);
    expect(controller.isTruncated()).toBe(true);

    // Should not throw
    controller.toggleExpanded();
  });

  it("falls back to preview element when previewCode is null", () => {
    const dom = buildDom();
    dom.previewCode = null;

    const controller = createPreviewController(dom);
    controller.render("Test text");

    expect(dom.preview.textContent).toBe("Test text");
  });
});
