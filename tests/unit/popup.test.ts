import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSinonChrome } from "../../src/dev/chrome-dev-mock.js";
import { initializePopup } from "../../src/surfaces/popup/page.js";

const sinonChrome = getSinonChrome();

const INLINE_MODE_ISSUE_QUERY = "https://github.com/PabloLION/MarkQuote/issues/3";

const FEEDBACK_URL = "https://github.com/PabloLION/MarkQuote/issues";

type CommandsShim = typeof chrome.commands & {
  openShortcutSettings?: () => void;
};

const getSinonCommands = (): CommandsShim =>
  (sinonChrome as unknown as { commands: CommandsShim }).commands;

function mountPopupDom() {
  document.body.innerHTML = `
    <header>
      <button id="options-button"></button>
      <button id="hotkeys-button"></button>
      <button id="inline-mode-button" data-feedback-link="${INLINE_MODE_ISSUE_QUERY}"></button>
      <button id="feedback-button"><span id="problem-badge"></span></button>
    </header>
    <div id="error-container" hidden>
      <div class="error-header"></div>
      <ul id="error-list"></ul>
      <button id="report-errors-button"></button>
      <button id="dismiss-errors-button"></button>
    </div>
    <div id="message" class="status-message" hidden>
      <div id="message-text" class="status-text"></div>
      <pre id="preview" class="status-preview" hidden><code></code></pre>
    </div>
  `;
}

describe("popup", () => {
  describe("with chrome runtime", () => {
    let dispose: (() => void) | undefined;
    let windowOpenSpy: MockInstance;
    let clipboardWriteSpy: ReturnType<typeof vi.fn>;
    const originalShortcutOpener = getSinonCommands().openShortcutSettings;
    let openShortcutSettingsSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mountPopupDom();
      sinonChrome.reset();
      sinonChrome.runtime.sendMessage.resolves();
      clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: clipboardWriteSpy },
      });
      windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
      openShortcutSettingsSpy = vi.fn();
      getSinonCommands().openShortcutSettings = openShortcutSettingsSpy;
      globalThis.chrome = sinonChrome as unknown as typeof chrome;
      dispose = initializePopup();
    });

    afterEach(() => {
      dispose?.();
      windowOpenSpy.mockRestore();
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
      if (originalShortcutOpener) {
        getSinonCommands().openShortcutSettings = originalShortcutOpener;
      } else {
        delete getSinonCommands().openShortcutSettings;
      }
      sinonChrome.reset();
    });

    it("shows the default message and hides the preview initially", () => {
      expect(document.getElementById("message")?.hasAttribute("hidden")).toBe(false);
      expect(document.getElementById("message-text")?.textContent).toBe(
        "Select text on a page, then trigger MarkQuote to copy it as a Markdown reference.",
      );
      expect(document.getElementById("message")?.dataset.label).toBe("Tip");
      expect(document.getElementById("preview")?.hasAttribute("hidden")).toBe(true);
    });

    it("renders copied message preview when receiving events", () => {
      const payload = { type: "copied-text-preview", text: "Example markdown" } as const;

      sinonChrome.runtime.onMessage.dispatch(payload, {} as chrome.runtime.MessageSender, () => {});

      expect(document.getElementById("message-text")?.textContent).toBe(
        "Markdown copied to clipboard.",
      );
      expect(document.getElementById("message")?.dataset.label).toBe("Copied");
      expect(document.getElementById("message")?.dataset.variant).toBe("success");
      const previewElement = document.getElementById("preview");
      expect(previewElement?.hasAttribute("hidden")).toBe(false);
      expect(previewElement?.textContent).toBe("Example markdown");
      expect(clipboardWriteSpy).toHaveBeenCalledWith("Example markdown");
    });

    it("opens options page when the options button is clicked", () => {
      const optionsButton = document.getElementById("options-button");
      optionsButton?.dispatchEvent(new Event("click", { bubbles: true }));

      expect(sinonChrome.runtime.openOptionsPage.calledOnce).toBe(true);
    });

    it("opens shortcuts page when the hotkey button is clicked", () => {
      const hotkeysButton = document.getElementById("hotkeys-button");
      hotkeysButton?.dispatchEvent(new Event("click", { bubbles: true }));

      expect(openShortcutSettingsSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it("opens feedback repository and inline mode issue when buttons are clicked", () => {
      document.getElementById("feedback-button")?.dispatchEvent(new Event("click"));
      document.getElementById("inline-mode-button")?.dispatchEvent(new Event("click"));

      expect(windowOpenSpy).toHaveBeenCalledTimes(2);
      expect(windowOpenSpy).toHaveBeenNthCalledWith(1, FEEDBACK_URL, "_blank", "noopener");
      expect(windowOpenSpy).toHaveBeenNthCalledWith(
        2,
        INLINE_MODE_ISSUE_QUERY,
        "_blank",
        "noopener",
      );
    });

    it("requests a selection copy when initialized", () => {
      expect(sinonChrome.runtime.sendMessage.calledWith({ type: "request-selection-copy" })).toBe(
        true,
      );
    });
  });

  describe("fallback behaviour", () => {
    let dispose: (() => void) | undefined;
    let windowOpenSpy: MockInstance;

    beforeEach(() => {
      mountPopupDom();
      sinonChrome.reset();
      sinonChrome.runtime.sendMessage.resolves();
      windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);
      delete getSinonCommands().openShortcutSettings;
      globalThis.chrome = sinonChrome as unknown as typeof chrome;
      dispose = initializePopup();
    });

    afterEach(() => {
      dispose?.();
      windowOpenSpy.mockRestore();
      sinonChrome.reset();
    });

    it("falls back to window.open when shortcut settings API is unavailable", () => {
      document.getElementById("hotkeys-button")?.dispatchEvent(new Event("click"));

      expect(windowOpenSpy).toHaveBeenCalledWith("chrome://extensions/shortcuts", "_blank");
    });
  });

  describe("without chrome runtime", () => {
    it("returns a no-op disposer and warns", () => {
      mountPopupDom();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalChrome = globalThis.chrome;
      (globalThis as unknown as { chrome?: typeof chrome }).chrome = undefined;

      const disposer = initializePopup();

      expect(typeof disposer).toBe("function");
      expect(warnSpy).toHaveBeenCalled();

      disposer();
      warnSpy.mockRestore();
      globalThis.chrome = originalChrome;
    });
  });
});
