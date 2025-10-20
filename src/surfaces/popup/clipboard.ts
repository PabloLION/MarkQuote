export async function copyMarkdownToClipboard(text: string): Promise<boolean> {
  const value = typeof text === "string" ? text : "";

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
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

  return true;
}
