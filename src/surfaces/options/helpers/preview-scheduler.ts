export interface PreviewScheduler {
  schedule(): void;
  dispose(): void;
}

export function createPreviewScheduler(update: () => void): PreviewScheduler {
  const hasAnimationFrame =
    typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";
  const cancelAnimationFrameFn =
    hasAnimationFrame && typeof window.cancelAnimationFrame === "function"
      ? (handle: number) => window.cancelAnimationFrame(handle)
      : undefined;
  const requestAnimationFrameFn =
    hasAnimationFrame && typeof window.requestAnimationFrame === "function"
      ? (callback: FrameRequestCallback) => window.requestAnimationFrame(callback)
      : undefined;
  let frameHandle: number | undefined;

  const flush = () => {
    frameHandle = undefined;
    update();
  };

  return {
    schedule(): void {
      if (!hasAnimationFrame || !requestAnimationFrameFn) {
        update();
        return;
      }

      if (frameHandle !== undefined && cancelAnimationFrameFn) {
        cancelAnimationFrameFn(frameHandle);
      }

      frameHandle = requestAnimationFrameFn(flush);
    },
    dispose(): void {
      if (frameHandle !== undefined && cancelAnimationFrameFn) {
        cancelAnimationFrameFn(frameHandle);
      }
      frameHandle = undefined;
    },
  };
}
