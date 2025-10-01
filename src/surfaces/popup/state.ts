import type { ErrorContext } from "../../background/error-context.js";

export type RuntimeMessage =
  | {
      type: "copied-text-preview";
      text: string;
    }
  | {
      type: "copy-protected";
      url?: string;
    }
  | {
      type: "popup-ready";
    };

export type LoggedExtensionError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
};

export const FEEDBACK_URL = "https://github.com/PabloLION/MarkQuote/issues";
export const DEFAULT_STATUS_MESSAGE =
  "Select text on a page, then trigger MarkQuote to copy it as a Markdown reference.";
export const COPIED_STATUS_MESSAGE = "Markdown copied to clipboard.";
export const PROTECTED_STATUS_MESSAGE =
  "This page is protected, so MarkQuote can't access the selection. Try another tab.";
export const SAMPLE_PREVIEW =
  "> This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown)";

export type ForcedPopupState =
  | { kind: "default" }
  | { kind: "copied"; preview: string }
  | { kind: "protected" };

export type PopupDevPreviewApi = {
  showDefault: () => void;
  showSuccess: (text: string) => void;
  showProtected: () => void;
};
