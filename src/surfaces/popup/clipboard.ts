import { E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE } from "../../background/constants.js";

export async function copyMarkdownToClipboard(text: string): Promise<boolean> {
  const value = typeof text === "string" ? text : "";
  const isE2EEnabled = (import.meta.env?.VITE_E2E ?? "").toLowerCase() === "true";

  const notifyE2eClipboard = async (payload: string) => {
    if (!isE2EEnabled) {
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: E2E_RECORD_CLIPBOARD_PAYLOAD_MESSAGE,
        text: payload,
      });
    } catch {
      // Ignore instrumentation failures in test environments.
    }
  };

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      await notifyE2eClipboard(value);
      return true;
    }
  } catch (error) {
    console.warn("navigator.clipboard.writeText failed; falling back to execCommand.", error);
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    console.warn('document.execCommand("copy") failed.', error);
  }

  textarea.remove();
  if (!success) {
    console.warn('document.execCommand("copy") returned false; manual copy prompt may be needed.');
    return false;
  }

  await notifyE2eClipboard(value);
  return true;
}
