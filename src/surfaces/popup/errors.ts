/**
 * Manages the popup's error log UI, wiring the background diagnostics into the visible badge list
 * and providing affordances to clear/report issues.
 */
import { TIMEOUTS } from "../../lib/constants.js";
import type { PopupDom } from "./dom.js";
import type { LoggedExtensionError } from "./state.js";

/**
 * Formats errors as markdown for GitHub issue reporting.
 * Returns a string ready to paste into a GitHub issue body.
 */
function formatErrorsAsMarkdown(errors: LoggedExtensionError[]): string {
  const lines: string[] = [
    "## MarkQuote Error Report",
    "",
    `**Errors:** ${errors.length}`,
    `**Generated:** ${new Date().toISOString()}`,
    "",
  ];

  // Extract common metadata from the first error with diagnostics
  const sampleDiagnostics = errors.find((e) => e.diagnostics)?.diagnostics;
  if (sampleDiagnostics) {
    lines.push("### Environment");
    lines.push("");
    lines.push(`- **Extension Version:** ${sampleDiagnostics.extensionVersion}`);
    lines.push(`- **User Agent:** ${sampleDiagnostics.userAgent}`);
    lines.push("");
  }

  lines.push("### Errors");
  lines.push("");

  for (const error of errors) {
    const timestamp = new Date(error.timestamp).toISOString();
    lines.push(`#### ${error.context}`);
    lines.push("");
    lines.push(`- **Timestamp:** ${timestamp}`);
    lines.push(`- **Message:** ${error.message}`);

    if (error.diagnostics) {
      const diag = error.diagnostics;
      if (diag.source) lines.push(`- **Source:** ${diag.source}`);
      if (diag.tabUrl) lines.push(`- **Tab Host:** ${diag.tabUrl}`);
      if (diag.tabId !== undefined) lines.push(`- **Tab ID:** ${diag.tabId}`);
      if (diag.stack) {
        lines.push("");
        lines.push("<details>");
        lines.push("<summary>Stack Trace</summary>");
        lines.push("");
        lines.push("```");
        lines.push(diag.stack);
        lines.push("```");
        lines.push("");
        lines.push("</details>");
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Copies text to clipboard using the Clipboard API.
 * Returns true if successful, false otherwise.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface PopupErrorController {
  refresh(): Promise<void>;
  dispose(): void;
}

/**
 * Creates a controller that keeps the popup's error log UI in sync with the background worker and
 * wires report/dismiss actions.
 */
export function createErrorController(
  dom: PopupDom,
  runtime: typeof chrome.runtime | undefined,
  openFeedback: () => void,
): PopupErrorController {
  const {
    errorContainer,
    errorList,
    problemBadge,
    copyDetailsButton,
    reportErrorsButton,
    dismissErrorsButton,
  } = dom;

  if (!errorContainer || !errorList || !problemBadge) {
    return {
      async refresh() {
        /* nothing to refresh */
      },
      dispose() {
        /* nothing to dispose */
      },
    };
  }

  const cleanupFns: Array<() => void> = [];

  const renderErrors = (errors: LoggedExtensionError[]) => {
    if (errors.length === 0) {
      errorContainer.hidden = true;
      problemBadge.setAttribute("hidden", "true");
      problemBadge.textContent = "";
      errorList.replaceChildren();
      return;
    }

    errorContainer.hidden = false;
    problemBadge.removeAttribute("hidden");
    problemBadge.textContent = String(Math.min(errors.length, 99));

    // Re-render the limited (≤99) list each refresh; the volume is small and keeps the DOM logic
    // straightforward when entries are cleared or reordered.
    errorList.replaceChildren();
    errors.forEach((entry) => {
      const item = document.createElement("li");
      const timestamp = new Date(entry.timestamp).toLocaleString();
      item.textContent = `[${timestamp}] ${entry.context}: ${entry.message}`;
      errorList.append(item);
    });
  };

  const fetchErrors = async (): Promise<LoggedExtensionError[]> => {
    if (!runtime) {
      return [];
    }

    try {
      const response = (await runtime.sendMessage({ type: "get-error-log" })) as {
        errors?: LoggedExtensionError[];
      };
      return Array.isArray(response?.errors) ? response.errors : [];
    } catch (error) {
      console.warn("Failed to load error log", error);
      return [];
    }
  };

  const clearErrors = async () => {
    if (!runtime) {
      return;
    }

    try {
      await runtime.sendMessage({ type: "clear-error-log" });
    } catch (error) {
      console.warn("Failed to clear error log", error);
    }
  };

  const refresh = async () => {
    const errors = await fetchErrors();
    renderErrors(errors);
  };

  const handleReportErrors = () => {
    openFeedback();
    void clearErrors().then(() => {
      void refresh();
    });
  };

  const handleDismissErrors = () => {
    void clearErrors().then(() => {
      void refresh();
    });
  };

  // Cache errors for copy operation
  let cachedErrors: LoggedExtensionError[] = [];

  const handleCopyDetails = async () => {
    const errors = cachedErrors.length > 0 ? cachedErrors : await fetchErrors();
    if (errors.length === 0) {
      return;
    }

    const markdown = formatErrorsAsMarkdown(errors);
    const success = await copyToClipboard(markdown);
    if (success && copyDetailsButton) {
      const originalText = copyDetailsButton.textContent;
      copyDetailsButton.textContent = "Copied!";
      setTimeout(() => {
        copyDetailsButton.textContent = originalText;
      }, TIMEOUTS.COPIED_FEEDBACK_MS);
    }
  };

  // Update cachedErrors when rendering
  const originalRenderErrors = renderErrors;
  const trackingRenderErrors = (errors: LoggedExtensionError[]) => {
    cachedErrors = errors;
    originalRenderErrors(errors);
  };

  // Override refresh to use tracking render
  const trackingRefresh = async () => {
    const errors = await fetchErrors();
    trackingRenderErrors(errors);
  };

  if (copyDetailsButton) {
    copyDetailsButton.addEventListener("click", handleCopyDetails);
    cleanupFns.push(() => copyDetailsButton.removeEventListener("click", handleCopyDetails));
  }

  if (reportErrorsButton) {
    reportErrorsButton.addEventListener("click", handleReportErrors);
    cleanupFns.push(() => reportErrorsButton.removeEventListener("click", handleReportErrors));
  }

  if (dismissErrorsButton) {
    dismissErrorsButton.addEventListener("click", handleDismissErrors);
    cleanupFns.push(() => dismissErrorsButton.removeEventListener("click", handleDismissErrors));
  }

  return {
    refresh: trackingRefresh,
    dispose() {
      for (const fn of cleanupFns) {
        fn();
      }
    },
  };
}
