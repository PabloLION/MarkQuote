import { PREVIEW_LIMITS } from "../../lib/constants.js";
import type { PopupDom } from "./dom.js";

export interface PreviewController {
  render(text: string | null | undefined): void;
  clear(): void;
  /** Returns true if the current preview is truncated */
  isTruncated(): boolean;
  /** Toggles between truncated and full preview */
  toggleExpanded(): void;
  /** Cleans up event listeners */
  dispose(): void;
}

interface TruncationResult {
  text: string;
  truncated: boolean;
  fullLength: number;
  fullLineCount: number;
}

/**
 * Truncates text based on character and line limits.
 * Returns both the truncated text and metadata about the original.
 */
function truncatePreview(text: string): TruncationResult {
  const lines = text.split("\n");
  const fullLength = text.length;
  const fullLineCount = lines.length;

  // Check if truncation is needed
  const needsCharTruncation = fullLength > PREVIEW_LIMITS.MAX_CHARS;
  const needsLineTruncation = fullLineCount > PREVIEW_LIMITS.MAX_LINES;

  if (!needsCharTruncation && !needsLineTruncation) {
    return { text, truncated: false, fullLength, fullLineCount };
  }

  // Apply line truncation first
  let result = text;
  if (needsLineTruncation) {
    result = lines.slice(0, PREVIEW_LIMITS.MAX_LINES).join("\n");
  }

  // Apply character truncation
  if (result.length > PREVIEW_LIMITS.MAX_CHARS) {
    result = result.slice(0, PREVIEW_LIMITS.MAX_CHARS);
    // Find last word boundary to avoid cutting mid-word
    const lastSpace = result.lastIndexOf(" ");
    if (lastSpace > PREVIEW_LIMITS.MAX_CHARS * PREVIEW_LIMITS.WORD_BOUNDARY_RATIO) {
      result = result.slice(0, lastSpace);
    }
  }

  return {
    text: `${result.trimEnd()}…`,
    truncated: true,
    fullLength,
    fullLineCount,
  };
}

/**
 * Formats a content stats string (e.g., "1,234 chars · 45 lines").
 */
function formatContentStats(charCount: number, lineCount: number): string {
  const chars = charCount.toLocaleString();
  const lines = lineCount.toLocaleString();
  return `${chars} chars · ${lines} lines`;
}

export function createPreviewController(dom: PopupDom): PreviewController {
  const { preview, previewCode, previewStats, previewToggle } = dom;
  /* v8 ignore next - previewCode element always exists in test DOM; fallback handles malformed popup HTML */
  const target = previewCode ?? preview;

  let fullText = "";
  let isExpanded = false;
  let currentTruncation: TruncationResult | null = null;
  const cleanupFns: Array<() => void> = [];

  const updateDisplay = () => {
    if (!currentTruncation) {
      target.textContent = "";
      preview.hidden = true;
      if (previewStats) previewStats.hidden = true;
      if (previewToggle) previewToggle.hidden = true;
      return;
    }

    const textToShow = isExpanded ? fullText : currentTruncation.text;
    target.textContent = textToShow;
    preview.hidden = false;

    // Update stats display
    if (previewStats) {
      previewStats.textContent = formatContentStats(
        currentTruncation.fullLength,
        currentTruncation.fullLineCount,
      );
      previewStats.hidden = false;
    }

    // Update toggle button
    if (previewToggle) {
      if (currentTruncation.truncated) {
        previewToggle.textContent = isExpanded ? "Show less" : "Show more";
        previewToggle.hidden = false;
      } else {
        previewToggle.hidden = true;
      }
    }
  };

  const controller: PreviewController = {
    render(text) {
      if (typeof text !== "string" || text.trim().length === 0) {
        fullText = "";
        isExpanded = false;
        currentTruncation = null;
        updateDisplay();
        return;
      }

      fullText = text;
      isExpanded = false;
      currentTruncation = truncatePreview(text);
      updateDisplay();
    },
    clear() {
      controller.render(null);
    },
    isTruncated() {
      return currentTruncation?.truncated ?? false;
    },
    toggleExpanded() {
      if (!currentTruncation?.truncated) return;
      isExpanded = !isExpanded;
      updateDisplay();
    },
    dispose() {
      for (const fn of cleanupFns) {
        fn();
      }
    },
  };

  // Wire up toggle button click handler
  if (previewToggle) {
    const handleToggle = () => controller.toggleExpanded();
    previewToggle.addEventListener("click", handleToggle);
    cleanupFns.push(() => previewToggle.removeEventListener("click", handleToggle));
  }

  return controller;
}
