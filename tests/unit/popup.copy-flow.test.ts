import { afterEach, describe, expect, it, vi } from "vitest";
import { copyMarkdownToClipboard } from "../../src/surfaces/popup/clipboard.js";
import { createCopyFlow } from "../../src/surfaces/popup/helpers/copy-flow.js";
import { COPIED_STATUS_MESSAGE, PROTECTED_STATUS_MESSAGE } from "../../src/surfaces/popup/state.js";

vi.mock("../../src/surfaces/popup/clipboard.js", () => ({
  copyMarkdownToClipboard: vi.fn().mockResolvedValue(true),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const createPreview = () => ({
  render: vi.fn(),
  clear: vi.fn(),
});

const createMessages = () => ({
  set: vi.fn(),
  clear: vi.fn(),
});

describe("popup copy flow", () => {
  it("renders preview and copies to clipboard", async () => {
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    const handled = await copyFlow.handleMessage({ type: "copied-text-preview", text: "Hello" });

    expect(handled).toBe(true);
    expect(preview.render).toHaveBeenCalledWith("Hello");
    expect(messages.set).toHaveBeenCalledWith(COPIED_STATUS_MESSAGE, {
      label: "Copied",
      variant: "success",
    });
    expect(copyMarkdownToClipboard).toHaveBeenCalledWith("Hello");
  });

  it("shows warning when fallback copy fails", async () => {
    (copyMarkdownToClipboard as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    await copyFlow.handleMessage({ type: "copied-text-preview", text: "Hi" });

    expect(messages.set).toHaveBeenLastCalledWith(
      "Unable to copy automatically. Text is ready below.",
      expect.objectContaining({ variant: "warning" }),
    );
  });

  it("handles permission errors from the Clipboard API", async () => {
    const permissionError = new DOMException("Permission denied", "NotAllowedError");
    (copyMarkdownToClipboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(permissionError);
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    await copyFlow.handleMessage({ type: "copied-text-preview", text: "Draft" });

    expect(messages.set).toHaveBeenLastCalledWith(
      "Clipboard permission denied. Copy manually below.",
      expect.objectContaining({ variant: "warning" }),
    );
  });

  it("handles quota errors from the Clipboard API", async () => {
    const quotaError = new DOMException("Quota exceeded", "QuotaExceededError");
    (copyMarkdownToClipboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(quotaError);
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    await copyFlow.handleMessage({ type: "copied-text-preview", text: "Limit" });

    expect(messages.set).toHaveBeenLastCalledWith(
      "Clipboard quota exceeded. Copy manually below.",
      expect.objectContaining({ variant: "warning" }),
    );
  });

  it("handles generic clipboard failures", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    (copyMarkdownToClipboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    await copyFlow.handleMessage({ type: "copied-text-preview", text: "Generic" });

    expect(messages.set).toHaveBeenLastCalledWith(
      "Unable to copy automatically. Text is ready below.",
      expect.objectContaining({ variant: "warning" }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[MarkQuote] Clipboard copy failed",
      expect.objectContaining({ reason: "boom" }),
    );

    warnSpy.mockRestore();
  });

  it("normalizes non-error clipboard rejections", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    (copyMarkdownToClipboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce("string failure");
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    await copyFlow.handleMessage({ type: "copied-text-preview", text: "Text" });

    expect(messages.set).toHaveBeenLastCalledWith(
      "Unable to copy automatically. Text is ready below.",
      expect.objectContaining({ variant: "warning" }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[MarkQuote] Clipboard copy failed",
      expect.objectContaining({ reason: "string failure" }),
    );

    warnSpy.mockRestore();
  });

  it("handles protected messages", async () => {
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    const handled = await copyFlow.handleMessage({ type: "copy-protected" });

    expect(handled).toBe(true);
    expect(preview.clear).toHaveBeenCalledTimes(1);
    expect(messages.set).toHaveBeenCalledWith(PROTECTED_STATUS_MESSAGE, {
      label: "Protected",
      variant: "warning",
    });
  });

  it("returns false for unknown messages", async () => {
    const preview = createPreview();
    const messages = createMessages();
    const copyFlow = createCopyFlow({ preview, messages });

    const handled = await copyFlow.handleMessage({ type: "other" as "copy-protected" });

    expect(handled).toBe(false);
    expect(preview.render).not.toHaveBeenCalled();
  });
});
