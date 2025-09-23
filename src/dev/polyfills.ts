const globalObject = globalThis as Record<string, unknown>;

if (typeof globalObject.global === 'undefined') {
  globalObject.global = globalThis;
}

if (typeof globalObject.process === 'undefined') {
  globalObject.process = {
    env: {},
    nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => {
      queueMicrotask(() => cb(...args));
    },
  };
}

export {};
