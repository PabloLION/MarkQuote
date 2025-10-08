import type { Page } from "@playwright/test";

export interface SelectTextOptions {
  expectedText?: string;
}

/**
 * Selects the full text content of the first element matching `selector` and optionally asserts the
 * selected text equals `expectedText`. Returns the selected text for further assertions.
 */
export async function selectElementText(
  page: Page,
  selector: string,
  options: SelectTextOptions = {},
): Promise<string> {
  const { expectedText } = options;
  const selected = await page.evaluate(
    ({ selector, expectedText: expected }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`Unable to find element for selector: ${selector}`);
      }

      const selection = window.getSelection();
      if (!selection) {
        throw new Error("Selection API unavailable in page.");
      }

      const range = document.createRange();
      range.selectNodeContents(element);

      selection.removeAllRanges();
      selection.addRange(range);

      const text = selection.toString();
      if (expected && text.trim() !== expected.trim()) {
        throw new Error(`Unexpected selection text: ${text}`);
      }
      return text;
    },
    { selector, expectedText },
  );

  return selected;
}
