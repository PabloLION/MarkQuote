import { ensureChromeMock } from "./chrome-dev-mock.js";
import { mountDevNav } from "./dev-nav.js";

ensureChromeMock();
mountDevNav("home");

const _devRoot = document.getElementById("dev-root");

// Dev-only utilities are registered globally via window.__MARKQUOTE_DEV__.
// The static markup in dev/index.html explains how to use them.
