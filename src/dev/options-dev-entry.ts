import type { initializeOptions as InitializeOptions } from '../options';
import { ensureChromeMock } from './chrome-dev-mock';
import { mountDevNav } from './dev-nav';
import { injectPublicPageMarkup } from './load-static-page';

ensureChromeMock();
mountDevNav('options');

const mountPoint = document.getElementById('dev-root');

if (!mountPoint) {
  throw new Error('Unable to find #dev-root for options dev preview.');
}

let cleanupMarkup: (() => void) | undefined;
let disposeOptions: (() => void) | undefined;

const optionsMarkupUrl = new URL('../../public/options.html', import.meta.url);

async function mountOptions() {
  cleanupMarkup?.();
  mountPoint.innerHTML = '';
  cleanupMarkup = await injectPublicPageMarkup(optionsMarkupUrl, mountPoint);

  const { initializeOptions } = (await import('../options')) as {
    initializeOptions: typeof InitializeOptions;
  };
  disposeOptions?.();
  disposeOptions = initializeOptions();
}

void mountOptions();

if (import.meta.hot) {
  import.meta.hot.accept('../options', async (mod) => {
    disposeOptions?.();
    disposeOptions = mod.initializeOptions();
  });

  import.meta.hot.dispose(() => {
    disposeOptions?.();
    cleanupMarkup?.();
  });
}
