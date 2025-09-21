import { vi, beforeEach } from 'vitest';

const createStorageMock = () => {
  let store: Record<string, any> = {};
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, any>) => {
      if (keys === undefined) {
        return { ...store };
      }
      if (typeof keys === 'string') {
        return { [keys]: store[keys] };
      }
      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach(key => {
          result[key] = store[key];
        });
        return result;
      }
      const result: Record<string, any> = { ...keys };
      for (const key in keys) {
        if (store[key] !== undefined) {
          result[key] = store[key];
        }
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, any>) => {
      store = { ...store, ...items };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      keysToRemove.forEach(key => {
        delete store[key];
      });
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
  };
};

// Set up the global chrome mock before each test
beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      sync: createStorageMock(),
      local: createStorageMock(), // Also mock local for completeness
    },
    runtime: {
      lastError: undefined,
      // Add other runtime properties if needed
    },
    // Add other chrome APIs if needed
  });
});
