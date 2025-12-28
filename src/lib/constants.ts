/**
 * Centralized runtime constants for MarkQuote extension.
 * Organized by domain to enable tree-shaking of unused constants.
 */

// =============================================================================
// TRIGGER SOURCES
// =============================================================================

/**
 * Copy trigger sources - identifies how a copy action was initiated.
 * Used for diagnostics and behavior customization.
 */
export const TRIGGER_SOURCE = {
  POPUP: "popup",
  HOTKEY: "hotkey",
  CONTEXT_MENU: "context-menu",
  E2E: "e2e",
  UNKNOWN: "unknown",
} as const;

export type TriggerSource = (typeof TRIGGER_SOURCE)[keyof typeof TRIGGER_SOURCE];

// =============================================================================
// RUNTIME MESSAGE TYPES
// =============================================================================

/**
 * Message types for chrome.runtime communication between surfaces.
 */
export const MESSAGE_TYPE = {
  // Popup ↔ Background
  COPIED_TEXT_PREVIEW: "copied-text-preview",
  COPY_PROTECTED: "copy-protected",
  POPUP_READY: "popup-ready",
  POPUP_CLOSED: "popup-closed",
  REQUEST_SELECTION_COPY: "request-selection-copy",
  GET_ERROR_LOG: "get-error-log",
  CLEAR_ERROR_LOG: "clear-error-log",
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

// =============================================================================
// TIMEOUTS (milliseconds)
// =============================================================================

/**
 * Timeout values used throughout the extension.
 */
export const TIMEOUTS = {
  /** Delay between popup preview retry attempts */
  POPUP_PREVIEW_RETRY_MS: 100,
  /** How long to wait for popup to signal readiness after hotkey copy */
  HOTKEY_POPUP_MS: 1000,
  /** How long to show status messages in options page */
  STATUS_DISPLAY_MS: 3000,
  /** How long to show the "Confirm clear" button before reverting */
  CLEAR_CONFIRMATION_MS: 5000,
  /** Maximum time to wait for entry loaders before showing error */
  LOADER_MS: 5000,
  /** How long to show "Copied!" feedback before reverting button text */
  COPIED_FEEDBACK_MS: 1500,
} as const;

// =============================================================================
// LIMITS & CAPS
// =============================================================================

/**
 * Numeric limits and caps for various features.
 */
export const LIMITS = {
  /** Maximum errors to store in error log (UX: keeps list scannable) */
  ERROR_LOG_MAX_ENTRIES: 10,
  /** Maximum badge count to display (Chrome shows "99+" style) */
  BADGE_MAX_COUNT: 99,
  /** Maximum retries for popup preview notification */
  POPUP_PREVIEW_MAX_RETRIES: 3,
  /** Maximum clipboard content size in bytes */
  CLIPBOARD_MAX_BYTES: 1_000_000,
  /** Maximum regex pattern length for safety */
  REGEX_PATTERN_MAX_LENGTH: 500,
  /** Truncation length for regex preview */
  REGEX_PREVIEW_LENGTH: 64,
} as const;

// =============================================================================
// UI COLORS
// =============================================================================

/**
 * Color constants for consistent UI styling.
 * These match the design tokens in shared.css.
 */
export const COLORS = {
  /** Error/danger color for badges and error states */
  ERROR: "#d93025",
} as const;

// =============================================================================
// STORAGE KEYS
// =============================================================================

/**
 * Chrome storage keys for persisted data.
 */
export const STORAGE_KEYS = {
  /** Session storage: pending copy sources awaiting popup confirmation */
  PENDING_COPY_SOURCES: "markquote/pending-copy-sources",
  /** Local storage: error log entries */
  ERROR_LOG: "markquote-error-log",
} as const;

// =============================================================================
// STATUS MESSAGES
// =============================================================================

/**
 * User-facing status messages for the popup.
 */
export const STATUS_MESSAGES = {
  DEFAULT: "Select text on a page, then trigger MarkQuote to copy it as a Markdown reference.",
  COPIED: "Markdown copied to clipboard.",
  PROTECTED: "This page is protected, so MarkQuote can't access the selection. Try another tab.",
} as const;

/**
 * Specific guidance for protected page types.
 * These provide actionable information when the extension can't access page content.
 */
export const PROTECTED_PAGE_MESSAGES = {
  /** Chrome internal pages (chrome://, chrome-extension://) */
  CHROME_INTERNAL:
    "Extensions cannot access browser settings pages. Please navigate to a regular web page.",
  /** File protocol pages */
  FILE_PROTOCOL:
    "Enable 'Allow access to file URLs' in extension settings (chrome://extensions) to copy from local files.",
  /** Other extension pages */
  EXTENSION_PAGE: "Extensions cannot access pages from other extensions. Try a regular web page.",
  /** Edge internal pages */
  EDGE_INTERNAL:
    "Extensions cannot access browser settings pages. Please navigate to a regular web page.",
  /** Firefox internal pages */
  FIREFOX_INTERNAL:
    "Extensions cannot access browser settings pages. Please navigate to a regular web page.",
} as const;

// =============================================================================
// PREVIEW LIMITS
// =============================================================================

/**
 * Limits for preview display in the popup.
 */
export const PREVIEW_LIMITS = {
  /** Maximum characters to show before truncation */
  MAX_CHARS: 500,
  /** Maximum lines to show before truncation */
  MAX_LINES: 10,
  /** Threshold ratio for word boundary truncation (0.8 = last 20% of text) */
  WORD_BOUNDARY_RATIO: 0.8,
} as const;

// =============================================================================
// URLS
// =============================================================================

/**
 * External URLs used in the extension.
 */
export const URLS = {
  FEEDBACK: "https://github.com/PabloLION/MarkQuote/issues",
} as const;

// =============================================================================
// CONTEXT MENU IDS
// =============================================================================

/**
 * Chrome context menu item IDs.
 */
export const CONTEXT_MENU_IDS = {
  COPY: "markquote",
  OPTIONS: "markquote-options",
} as const;
