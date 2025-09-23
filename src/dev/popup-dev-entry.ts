import type { initializePopup as InitializePopup } from '../popup.js';
import { ensureChromeMock } from './chrome-dev-mock.js';
import { mountDevNav } from './dev-nav.js';
import { injectPublicPageMarkup } from './load-static-page.js';

type ViteHotModule<TModule> = {
  accept: (path: string, handler: (mod: TModule) => void) => void;
  dispose: (handler: () => void) => void;
};

ensureChromeMock();
mountDevNav('popup');

function requireDevRoot(): HTMLElement {
  const element = document.getElementById('dev-root');

  if (!(element instanceof HTMLElement)) {
    throw new Error('Unable to find #dev-root for popup dev preview.');
  }

  return element;
}

const mountPoint = requireDevRoot();

let cleanupMarkup: (() => void) | undefined;
let disposePopup: (() => void) | undefined;

const popupMarkupUrl = new URL('../../public/popup.html', import.meta.url);

async function mountPopup() {
  cleanupMarkup?.();
  mountPoint.innerHTML = '';
  cleanupMarkup = await injectPublicPageMarkup(popupMarkupUrl, mountPoint);

  const { initializePopup } = (await import('../popup.js')) as {
    initializePopup: typeof InitializePopup;
  };
  disposePopup?.();
  disposePopup = initializePopup();
}

void mountPopup();

const hot = (
  import.meta as ImportMeta & {
    hot?: ViteHotModule<{ initializePopup: typeof InitializePopup }>;
  }
).hot;

if (hot) {
  hot.accept('../popup.js', (mod) => {
    disposePopup?.();
    disposePopup = mod.initializePopup();
  });

  hot.dispose(() => {
    disposePopup?.();
    cleanupMarkup?.();
  });
}
