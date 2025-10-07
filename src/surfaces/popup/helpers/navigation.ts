interface NavigationDeps {
  openWindow: (url: string, target: string, features?: string) => void;
  runtime?: typeof chrome.runtime;
  commands?: typeof chrome.commands & { openShortcutSettings?: () => void };
  feedbackUrl: string;
  inlineModeUrl: string;
}

export interface PopupNavigation {
  openOptions: () => void;
  openShortcuts: () => void;
  openFeedback: () => void;
  openInlineModeIssue: () => void;
}

export function createPopupNavigation(deps: NavigationDeps): PopupNavigation {
  const openExternal = (url: string, features = "noopener") =>
    deps.openWindow(url, "_blank", features);

  const openOptions = () => {
    if (deps.runtime?.openOptionsPage) {
      deps.runtime.openOptionsPage();
      return;
    }
    deps.openWindow("options.html", "_blank");
  };

  const openShortcuts = () => {
    const commands =
      deps.commands ??
      (chrome.commands as typeof chrome.commands & {
        openShortcutSettings?: () => void;
      });
    if (typeof commands.openShortcutSettings === "function") {
      commands.openShortcutSettings();
      return;
    }
    deps.openWindow("chrome://extensions/shortcuts", "_blank");
  };

  const openFeedback = () => {
    openExternal(deps.feedbackUrl);
  };

  const openInlineModeIssue = () => {
    openExternal(deps.inlineModeUrl);
  };

  return {
    openOptions,
    openShortcuts,
    openFeedback,
    openInlineModeIssue,
  };
}
