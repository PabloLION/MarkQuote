import type { PopupDom } from "./dom.js";
import type { LoggedExtensionError } from "./state.js";

export interface PopupErrorController {
  refresh(): Promise<void>;
  dispose(): void;
}

export function createErrorController(
  dom: PopupDom,
  runtime: typeof chrome.runtime | undefined,
  openFeedback: () => void,
): PopupErrorController {
  const { errorContainer, errorList, problemBadge, reportErrorsButton, dismissErrorsButton } = dom;

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
      errorList.innerHTML = "";
      return;
    }

    errorContainer.hidden = false;
    problemBadge.removeAttribute("hidden");
    problemBadge.textContent = String(Math.min(errors.length, 99));

    errorList.innerHTML = "";
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

  if (reportErrorsButton) {
    reportErrorsButton.addEventListener("click", handleReportErrors);
    cleanupFns.push(() => reportErrorsButton.removeEventListener("click", handleReportErrors));
  }

  if (dismissErrorsButton) {
    dismissErrorsButton.addEventListener("click", handleDismissErrors);
    cleanupFns.push(() => dismissErrorsButton.removeEventListener("click", handleDismissErrors));
  }

  return {
    refresh,
    dispose() {
      for (const fn of cleanupFns) {
        fn();
      }
    },
  };
}
