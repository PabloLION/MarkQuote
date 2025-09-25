import sinonChrome from 'sinon-chrome';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializePopup } from '../../src/popup';

const INLINE_MODE_ISSUE_QUERY =
  'https://github.com/PabloLION/MarkQuote/issues?q=is%3Aissue+inline+mode';

const FEEDBACK_URL = 'https://github.com/PabloLION/MarkQuote';

function mountPopupDom() {
  document.body.innerHTML = `
    <header>
      <button id="options-button"></button>
      <button id="hotkeys-button"></button>
      <button id="feedback-button"></button>
      <button id="inline-mode-button"></button>
    </header>
    <div id="message"></div>
    <pre id="preview"></pre>
  `;
}

describe('popup', () => {
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    mountPopupDom();
    sinonChrome.reset();
    sinonChrome.runtime.sendMessage.resolves();
    globalThis.chrome = sinonChrome as unknown as typeof chrome;
    dispose = initializePopup();
  });

  afterEach(() => {
    dispose?.();
    sinonChrome.reset();
  });

  it('renders copied message preview when receiving events', () => {
    const payload = { type: 'copied-text-preview', text: 'Example markdown' } as const;

    sinonChrome.runtime.onMessage.dispatch(payload, {} as chrome.runtime.MessageSender, () => {});

    expect(document.getElementById('message')?.textContent).toBe('Copied!');
    expect(document.getElementById('preview')?.textContent).toBe('Example markdown');
  });

  it('opens options page when the options button is clicked', () => {
    const optionsButton = document.getElementById('options-button');
    optionsButton?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(sinonChrome.runtime.openOptionsPage.calledOnce).toBe(true);
  });

  it('opens shortcuts page when the hotkey button is clicked', () => {
    sinonChrome.tabs.create.resetHistory();

    const hotkeysButton = document.getElementById('hotkeys-button');
    hotkeysButton?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(sinonChrome.tabs.create.calledOnceWith({ url: 'chrome://extensions/shortcuts' })).toBe(true);
  });

  it('opens feedback repository and inline mode issue when buttons are clicked', () => {
    sinonChrome.tabs.create.resetHistory();

    document.getElementById('feedback-button')?.dispatchEvent(new Event('click'));
    document.getElementById('inline-mode-button')?.dispatchEvent(new Event('click'));

    expect(sinonChrome.tabs.create.callCount).toBe(2);
    expect(sinonChrome.tabs.create.getCall(0).args[0]).toEqual({ url: FEEDBACK_URL });
    expect(sinonChrome.tabs.create.getCall(1).args[0]).toEqual({ url: INLINE_MODE_ISSUE_QUERY });
  });

  it('requests a selection copy when initialized', () => {
    expect(sinonChrome.runtime.sendMessage.calledWith({ type: 'request-selection-copy' })).toBe(true);
  });
});
