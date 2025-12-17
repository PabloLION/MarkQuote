import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Timer } from "../../../src/lib/timer.js";

describe("Timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a callback to run after the specified delay", () => {
    const timer = new Timer();
    const callback = vi.fn();

    timer.schedule(callback, 1000);

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels previously scheduled callback when scheduling a new one", () => {
    const timer = new Timer();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    timer.schedule(firstCallback, 1000);
    timer.schedule(secondCallback, 500);

    vi.advanceTimersByTime(500);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(firstCallback).not.toHaveBeenCalled();
  });

  it("cancel() stops a scheduled callback from running", () => {
    const timer = new Timer();
    const callback = vi.fn();

    timer.schedule(callback, 1000);
    timer.cancel();

    vi.advanceTimersByTime(2000);
    expect(callback).not.toHaveBeenCalled();
  });

  it("cancel() is safe to call when no callback is scheduled", () => {
    const timer = new Timer();
    expect(() => timer.cancel()).not.toThrow();
  });

  it("cancel() is safe to call multiple times", () => {
    const timer = new Timer();
    const callback = vi.fn();

    timer.schedule(callback, 1000);
    timer.cancel();
    timer.cancel();
    timer.cancel();

    expect(() => timer.cancel()).not.toThrow();
  });

  it("isActive() returns true when a callback is scheduled", () => {
    const timer = new Timer();
    expect(timer.isActive()).toBe(false);

    timer.schedule(() => {}, 1000);
    expect(timer.isActive()).toBe(true);
  });

  it("isActive() returns false after callback executes", () => {
    const timer = new Timer();
    timer.schedule(() => {}, 1000);

    vi.advanceTimersByTime(1000);
    expect(timer.isActive()).toBe(false);
  });

  it("isActive() returns false after cancel()", () => {
    const timer = new Timer();
    timer.schedule(() => {}, 1000);

    timer.cancel();
    expect(timer.isActive()).toBe(false);
  });

  it("allows re-scheduling after callback executes", () => {
    const timer = new Timer();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    timer.schedule(firstCallback, 100);
    vi.advanceTimersByTime(100);
    expect(firstCallback).toHaveBeenCalledTimes(1);

    timer.schedule(secondCallback, 200);
    vi.advanceTimersByTime(200);
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it("allows re-scheduling after cancel()", () => {
    const timer = new Timer();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    timer.schedule(firstCallback, 100);
    timer.cancel();

    timer.schedule(secondCallback, 200);
    vi.advanceTimersByTime(200);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });
});
