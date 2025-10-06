import { afterEach, describe, expect, it, vi } from "vitest";
import { createPreviewScheduler } from "../../src/surfaces/options/helpers/preview-scheduler.js";

describe("preview scheduler", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it("falls back to immediate invocation when requestAnimationFrame is unavailable", () => {
    // @ts-expect-error force absence for test
    window.requestAnimationFrame = undefined;
    const update = vi.fn();
    const scheduler = createPreviewScheduler(update);

    scheduler.schedule();

    expect(update).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it("deduplicates frames when requestAnimationFrame exists", () => {
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    window.cancelAnimationFrame = vi.fn();

    const update = vi.fn();
    const scheduler = createPreviewScheduler(update);

    scheduler.schedule();
    scheduler.schedule();

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);

    for (const callback of callbacks) {
      callback(performance.now());
    }

    expect(update).toHaveBeenCalledTimes(2);

    scheduler.dispose();
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled frame when disposed before flush", () => {
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return 42;
    });
    window.cancelAnimationFrame = vi.fn();

    const update = vi.fn();
    const scheduler = createPreviewScheduler(update);

    scheduler.schedule();
    scheduler.dispose();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(update).not.toHaveBeenCalled();
  });

  it("allows dispose to be called multiple times without side effects", () => {
    window.requestAnimationFrame = vi.fn().mockReturnValue(99);
    window.cancelAnimationFrame = vi.fn();

    const update = vi.fn();
    const scheduler = createPreviewScheduler(update);

    scheduler.schedule();
    scheduler.dispose();
    scheduler.dispose();

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });
});
