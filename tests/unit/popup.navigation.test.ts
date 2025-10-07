import { describe, expect, it, vi } from "vitest";
import { createPopupNavigation } from "../../src/surfaces/popup/helpers/navigation.js";

describe("popup navigation", () => {
  const openWindow = vi.fn();
  const feedbackUrl = "https://example.com/feedback";
  const inlineUrl = "https://example.com/inline";

  it("opens options via runtime when available", () => {
    const openOptionsPage = vi.fn();
    const navigation = createPopupNavigation({
      openWindow,
      feedbackUrl,
      inlineModeUrl: inlineUrl,
      runtime: { openOptionsPage } as unknown as typeof chrome.runtime,
    });

    navigation.openOptions();

    expect(openOptionsPage).toHaveBeenCalledTimes(1);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("falls back to window when runtime options page is unavailable", () => {
    openWindow.mockClear();
    const navigation = createPopupNavigation({
      openWindow,
      feedbackUrl,
      inlineModeUrl: inlineUrl,
    });

    navigation.openOptions();

    expect(openWindow).toHaveBeenCalledWith("options.html", "_blank");
  });

  it("uses command API when available for shortcut settings", () => {
    const openShortcutSettings = vi.fn();
    const navigation = createPopupNavigation({
      openWindow,
      feedbackUrl,
      inlineModeUrl: inlineUrl,
      commands: { openShortcutSettings } as unknown as typeof chrome.commands & {
        openShortcutSettings?: () => void;
      },
    });

    navigation.openShortcuts();

    expect(openShortcutSettings).toHaveBeenCalledTimes(1);
    expect(openWindow).not.toHaveBeenCalledWith("chrome://extensions/shortcuts", "_blank");
  });

  it("falls back to extension shortcut URL when command API missing", () => {
    openWindow.mockClear();
    const navigation = createPopupNavigation({
      openWindow,
      feedbackUrl,
      inlineModeUrl: inlineUrl,
    });

    navigation.openShortcuts();

    expect(openWindow).toHaveBeenCalledWith("chrome://extensions/shortcuts", "_blank");
  });

  it("opens feedback and inline issue via provided URLs", () => {
    openWindow.mockClear();
    const navigation = createPopupNavigation({
      openWindow,
      feedbackUrl,
      inlineModeUrl: inlineUrl,
    });

    navigation.openFeedback();
    navigation.openInlineModeIssue();

    expect(openWindow).toHaveBeenNthCalledWith(1, feedbackUrl, "_blank", "noopener");
    expect(openWindow).toHaveBeenNthCalledWith(2, inlineUrl, "_blank", "noopener");
  });
});
