import { ensureChromeMock } from './chrome-dev-mock';
import { mountDevNav } from './dev-nav';

ensureChromeMock();
mountDevNav('home');

const root = document.getElementById('dev-root');

if (root) {
  root.innerHTML = `
    <section style="padding: 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 24px auto;">
      <h1 style="margin-bottom: 16px;">MarkQuote Developer Preview</h1>
      <p style="margin-bottom: 16px;">Use the links above to open the Options page or Popup shell with hot module reloading. Storage is persisted locally using <code>localStorage</code> so you can iterate without running the packaged extension.</p>
      <p style="margin-bottom: 24px;">You can trigger runtime message listeners for the popup by running <code>window.__MARKQUOTE_DEV__.emitMessage({ type: 'copied-text-preview', text: 'Example preview' })</code> in the browser console.</p>
      <div style="display: grid; gap: 12px;">
        <a href="/options.html" style="display: inline-flex; align-items: center; justify-content: center; padding: 12px 16px; border-radius: 8px; background: #1a73e8; color: #fff; text-decoration: none;">Open Options Page</a>
        <a href="/popup.html" style="display: inline-flex; align-items: center; justify-content: center; padding: 12px 16px; border-radius: 8px; background: #5f6368; color: #fff; text-decoration: none;">Open Popup Shell</a>
      </div>
    </section>
  `;
}
