import './polyfills';
import sinonChrome from 'sinon-chrome';

const STORAGE_KEY = 'markquote-dev-storage';

type StorageMap = Record<string, unknown>;

type StorageKeys = string | string[] | Record<string, unknown> | undefined;

type MaybeCallback<T> = ((value: T) => void) | undefined;

type PersistenceMode = 'localStorage' | 'memory';

type DevHelpers = {
  emitMessage: (payload: unknown) => void;
  clearStorage: () => void;
  readonly store: StorageMap;
};

declare global {
  interface Window {
    __MARKQUOTE_DEV__?: DevHelpers;
  }
}

const hasWindow = typeof window !== 'undefined';
const hasLocalStorage = hasWindow && 'localStorage' in window;

function readPersistedStore(mode: PersistenceMode): StorageMap {
  if (mode === 'memory' || !hasLocalStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StorageMap) : {};
  } catch (error) {
    console.warn('Unable to access localStorage for dev storage mock.', error);
    return {};
  }
}

function persistStore(mode: PersistenceMode, store: StorageMap) {
  if (mode === 'memory' || !hasLocalStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('Unable to persist dev storage mock to localStorage.', error);
  }
}

function resolveStorageResult(store: StorageMap, keys: StorageKeys): StorageMap {
  if (keys === undefined) {
    return { ...store };
  }

  if (typeof keys === 'string') {
    return { [keys]: store[keys] };
  }

  if (Array.isArray(keys)) {
    const result: StorageMap = {};
    keys.forEach((key) => {
      result[key] = store[key];
    });
    return result;
  }

  const result: StorageMap = { ...keys };
  for (const key in keys) {
    if (Object.hasOwn(store, key)) {
      result[key] = store[key];
    }
  }
  return result;
}

function callMaybe<T>(callback: MaybeCallback<T>, value: T) {
  if (typeof callback === 'function') {
    callback(value);
  }
}

function configureStorageArea(storeRef: { current: StorageMap }, mode: PersistenceMode) {
  const configure = (area: typeof sinonChrome.storage.sync) => {
    const getImpl = (keys?: StorageKeys, callback?: (items: StorageMap) => void) => {
      const result = resolveStorageResult(storeRef.current, keys);
      callMaybe(callback, result);
      return Promise.resolve(result);
    };

    area.get.callsFake((keys?: unknown, callback?: (items: StorageMap) => void) => {
      if (typeof keys === 'function') {
        return getImpl(undefined, keys as (items: StorageMap) => void);
      }

      return getImpl(keys as StorageKeys, callback);
    });

    const setImpl = (items: Record<string, unknown>, callback?: () => void) => {
      storeRef.current = { ...storeRef.current, ...items };
      persistStore(mode, storeRef.current);
      callMaybe(callback, undefined);
      return Promise.resolve();
    };

    area.set.callsFake((items: Record<string, unknown>, callback?: () => void) =>
      setImpl(items, callback),
    );

    const removeImpl = (keys: string | string[], callback?: () => void) => {
      const toRemove = Array.isArray(keys) ? keys : [keys];
      toRemove.forEach((key) => {
        delete storeRef.current[key];
      });
      persistStore(mode, storeRef.current);
      callMaybe(callback, undefined);
      return Promise.resolve();
    };

    area.remove.callsFake((keys: string | string[], callback?: () => void) =>
      removeImpl(keys, callback),
    );

    area.clear.callsFake((callback?: () => void) => {
      storeRef.current = {};
      persistStore(mode, storeRef.current);
      callMaybe(callback, undefined);
      return Promise.resolve();
    });
  };

  configure(sinonChrome.storage.sync);
  configure(sinonChrome.storage.local);
}

function configureRuntime() {
  sinonChrome.runtime.openOptionsPage.callsFake(() => {
    if (hasWindow) {
      window.location.href = '/options.html';
    }
  });

  sinonChrome.runtime.sendMessage.callsFake((message: unknown) => {
    sinonChrome.runtime.onMessage.dispatch(message, {} as chrome.runtime.MessageSender, () => {});
    return Promise.resolve();
  });
}

function configureTabs() {
  sinonChrome.tabs.create.callsFake((createProperties: chrome.tabs.CreateProperties) => {
    if (hasWindow) {
      const url = createProperties.url ?? 'about:blank';
      window.open(url, '_blank');
    }
    return Promise.resolve({ id: Math.floor(Math.random() * 1000) } as chrome.tabs.Tab);
  });
}

export type EnsureChromeMockOptions = {
  persistence?: PersistenceMode;
};

export function ensureChromeMock(options: EnsureChromeMockOptions = {}) {
  const persistence: PersistenceMode =
    options.persistence ?? (hasLocalStorage ? 'localStorage' : 'memory');
  const storeRef = { current: readPersistedStore(persistence) };

  sinonChrome.reset();
  configureStorageArea(storeRef, persistence);
  configureRuntime();
  configureTabs();

  Object.defineProperty(sinonChrome.runtime, 'lastError', {
    configurable: true,
    enumerable: true,
    get() {
      return undefined;
    },
  });

  const globalWithChrome = globalThis as typeof globalThis & {
    chrome?: typeof chrome;
  };
  globalWithChrome.chrome = sinonChrome as unknown as typeof chrome;

  if (hasWindow) {
    window.__MARKQUOTE_DEV__ = {
      emitMessage(payload: unknown) {
        sinonChrome.runtime.onMessage.dispatch(
          payload,
          {} as chrome.runtime.MessageSender,
          () => {},
        );
      },
      clearStorage() {
        storeRef.current = {};
        persistStore(persistence, storeRef.current);
      },
      get store() {
        return { ...storeRef.current };
      },
    };
  }
}

export function getSinonChrome() {
  return sinonChrome;
}
