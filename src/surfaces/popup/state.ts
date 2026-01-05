import type { ErrorContext } from "../../background/error-context.js";
import type { DiagnosticMetadata } from "../../background/types.js";
import { type MESSAGE_TYPE, STATUS_MESSAGES, URLS } from "../../lib/constants.js";

export type RuntimeMessage =
  | {
      type: typeof MESSAGE_TYPE.COPIED_TEXT_PREVIEW;
      text: string;
    }
  | {
      type: typeof MESSAGE_TYPE.COPY_PROTECTED;
      url?: string;
    }
  | {
      type: typeof MESSAGE_TYPE.NO_SELECTION;
    }
  | {
      type: typeof MESSAGE_TYPE.POPUP_READY;
    };

export type LoggedExtensionError = {
  message: string;
  context: ErrorContext;
  timestamp: number;
  /** Structured diagnostic metadata for GitHub issue reports */
  diagnostics?: DiagnosticMetadata;
};

// Re-export from shared constants for backward compatibility
export const FEEDBACK_URL = URLS.FEEDBACK;
export const DEFAULT_STATUS_MESSAGE = STATUS_MESSAGES.DEFAULT;
export const COPIED_STATUS_MESSAGE = STATUS_MESSAGES.COPIED;
export const PROTECTED_STATUS_MESSAGE = STATUS_MESSAGES.PROTECTED;
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
