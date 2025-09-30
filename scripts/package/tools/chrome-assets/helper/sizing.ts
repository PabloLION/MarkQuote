import type { LaunchOptions } from "./extension.js";

export type CaptureKind = "options" | "overview" | "promoSmall" | "promoMarquee" | "popup";

export interface ViewportSize {
  width: number;
  height: number;
}

export type FrameSizing = "window" | "viewport";

interface CaptureSizingConfig {
  viewport: ViewportSize;
  frame: FrameSizing;
}

export const CAPTURE_SIZING: Record<CaptureKind, CaptureSizingConfig> = {
  options: {
    viewport: { width: 1280, height: 800 },
    frame: "viewport",
  },
  overview: {
    viewport: { width: 1280, height: 800 },
    frame: "window",
  },
  promoSmall: {
    viewport: { width: 440, height: 280 },
    frame: "viewport",
  },
  promoMarquee: {
    viewport: { width: 1400, height: 560 },
    frame: "viewport",
  },
  popup: {
    viewport: { width: 320, height: 520 },
    frame: "viewport",
  },
};

export function getViewportSize(kind: CaptureKind): ViewportSize {
  return CAPTURE_SIZING[kind].viewport;
}

export function shouldMatchWindow(kind: CaptureKind): boolean {
  return CAPTURE_SIZING[kind].frame === "window";
}

export function getLaunchOptionsForCapture(kind: CaptureKind): LaunchOptions {
  if (shouldMatchWindow(kind)) {
    return {
      windowSize: getViewportSize(kind),
      devtoolsUndocked: true,
    };
  }

  return {};
}
