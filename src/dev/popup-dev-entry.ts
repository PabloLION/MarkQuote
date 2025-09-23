import { ensureChromeMock } from './chrome-dev-mock';
import { mountDevNav } from './dev-nav';
import { injectPublicPageMarkup } from './load-static-page';
import type { initializePopup as InitializePopup } from '../popup';

ensureChromeMock();
mountDevNav('popup');

const mountPoint = document.getElementById('dev-root');

if (!mountPoint) {
  throw new Error('Unable to find #dev-root for popup dev preview.');
}

let cleanupMarkup: (() => void) | undefined;
let disposePopup: (() => void) | undefined;

const popupMarkupUrl = new URL('../../public/popup.html', import.meta.url);

async function mountPopup() {
  cleanupMarkup?.();
  mountPoint.innerHTML = '';
  cleanupMarkup = await injectPublicPageMarkup(popupMarkupUrl, mountPoint);

  const { initializePopup } = await import('../popup') as { initializePopup: typeof InitializePopup };
  disposePopup?.();
  disposePopup = initializePopup();
}

void mountPopup();

if (import.meta.hot) {
  import.meta.hot.accept('../popup', async (mod) => {
    disposePopup?.();
    disposePopup = mod.initializePopup();
  });

  import.meta.hot.dispose(() => {
    disposePopup?.();
    cleanupMarkup?.();
  });
}
