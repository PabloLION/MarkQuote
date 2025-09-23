import { ensureChromeMock } from './chrome-dev-mock';
import { mountDevNav } from './dev-nav';

ensureChromeMock();
mountDevNav('home');

const devRoot = document.getElementById('dev-root');

// Dev-only utilities are registered globally via window.__MARKQUOTE_DEV__.
// The static markup in dev/index.html explains how to use them.
