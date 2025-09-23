import { ensureChromeMock } from './chrome-dev-mock';
import { mountDevNav } from './dev-nav';

ensureChromeMock();
mountDevNav('home');

const devRoot = document.getElementById('dev-root');

if (devRoot && !devRoot.children.length) {
  const info = document.createElement('p');
  info.innerHTML =
    'Development helpers are available via <code>window.__MARKQUOTE_DEV__</code>. Use the navigation to switch between surfaces.';

  devRoot.querySelector('main')?.prepend(info);
}
