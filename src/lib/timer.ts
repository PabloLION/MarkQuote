/**
 * A cancelable timer utility that encapsulates the common pattern of
 * scheduling a callback with setTimeout and tracking/canceling it.
 *
 * Replaces the verbose pattern:
 * ```typescript
 * let timer: ReturnType<typeof setTimeout> | undefined;
 * timer = setTimeout(() => { ... }, delay);
 * if (timer) { clearTimeout(timer); timer = undefined; }
 * ```
 */
export class Timer {
  private handle: ReturnType<typeof setTimeout> | undefined;

  /**
   * Schedule a callback to run after the specified delay.
   * Cancels any previously scheduled callback.
   */
  schedule(callback: () => void, delayMs: number): void {
    this.cancel();
    this.handle = setTimeout(() => {
      this.handle = undefined;
      callback();
    }, delayMs);
  }

  /**
   * Cancel any scheduled callback. Safe to call even if no callback is scheduled.
   */
  cancel(): void {
    if (this.handle !== undefined) {
      clearTimeout(this.handle);
      this.handle = undefined;
    }
  }

  /**
   * Returns true if a callback is currently scheduled.
   */
  isActive(): boolean {
    return this.handle !== undefined;
  }
}
