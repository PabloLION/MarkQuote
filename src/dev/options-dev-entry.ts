import type { initializeOptions as InitializeOptions } from '../options.js';
import { ensureChromeMock } from './chrome-dev-mock.js';
import { mountDevNav } from './dev-nav.js';
import { injectPublicPageMarkup } from './load-static-page.js';

type ViteHotModule<TModule> = {
  accept: (path: string, handler: (mod: TModule) => void) => void;
  dispose: (handler: () => void) => void;
};

ensureChromeMock();
mountDevNav('options');

function requireDevRoot(): HTMLElement {
  const element = document.getElementById('dev-root');

  if (!(element instanceof HTMLElement)) {
    throw new Error('Unable to find #dev-root for options dev preview.');
  }

  return element;
}

const mountPoint = requireDevRoot();

let cleanupMarkup: (() => void) | undefined;
let disposeOptions: (() => void) | undefined;

const optionsMarkupUrl = new URL('../../public/options.html', import.meta.url);

async function mountOptions() {
  cleanupMarkup?.();
  mountPoint.innerHTML = '';
  cleanupMarkup = await injectPublicPageMarkup(optionsMarkupUrl, mountPoint);

  const { initializeOptions } = (await import('../options.js')) as {
    initializeOptions: typeof InitializeOptions;
  };
  disposeOptions?.();
  disposeOptions = initializeOptions();
}

void mountOptions();

const hot = (
  import.meta as ImportMeta & {
    hot?: ViteHotModule<{ initializeOptions: typeof InitializeOptions }>;
  }
).hot;

if (hot) {
  hot.accept('../options.js', (mod) => {
    disposeOptions?.();
    disposeOptions = mod.initializeOptions();
  });

  hot.dispose(() => {
    disposeOptions?.();
    cleanupMarkup?.();
  });
}
