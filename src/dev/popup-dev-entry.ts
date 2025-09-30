import { ensureChromeMock } from "./chrome-dev-mock.js";
import { mountDevNav } from "./dev-nav.js";

ensureChromeMock();
mountDevNav("popup");

const root = document.getElementById("dev-root");
if (!root) {
  throw new Error("Unable to find #dev-root for popup preview.");
}

const samplePreview = encodeURIComponent(
  "> This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown)",
);

root.innerHTML = `
  <style>
    .popup-preview-shell {
      min-height: 100vh;
      padding: 32px clamp(16px, 4vw, 48px) 48px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.08));
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #0f172a;
    }

    .popup-preview-shell h1 {
      margin: 0;
      font-size: 1.45rem;
      letter-spacing: 0.02em;
    }

    .popup-preview-shell p {
      margin: 8px 0 0;
      max-width: 680px;
      line-height: 1.5;
    }

    .preview-grid {
      margin-top: 28px;
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }

    .preview-card {
      background: rgba(255, 255, 255, 0.92);
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      padding: 20px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
      display: grid;
      gap: 16px;
    }

    .preview-card h2 {
      margin: 0;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .preview-card p {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(15, 23, 42, 0.72);
    }

    .preview-frame {
      width: 320px;
      height: 520px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.55);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
      background: #111827;
    }

    .preview-links {
      margin-top: 32px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .preview-links a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.15);
      border: 1px solid rgba(37, 99, 235, 0.25);
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
      transition: background-color 140ms ease, border-color 140ms ease;
    }

    .preview-links a:hover {
      background: rgba(37, 99, 235, 0.22);
      border-color: rgba(37, 99, 235, 0.45);
    }

    @media (prefers-color-scheme: dark) {
      .popup-preview-shell {
        color: #e2e8f0;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(14, 165, 233, 0.16));
      }

      .preview-card {
        background: rgba(17, 24, 39, 0.92);
        border-color: rgba(148, 163, 184, 0.25);
        box-shadow: 0 18px 36px rgba(2, 6, 23, 0.45);
      }

      .preview-card p {
        color: rgba(203, 213, 225, 0.76);
      }

      .preview-frame {
        background: #0f172a;
        border-color: rgba(148, 163, 184, 0.35);
      }

      .preview-links a {
        background: rgba(96, 165, 250, 0.18);
        border-color: rgba(96, 165, 250, 0.28);
        color: #93c5fd;
      }

      .preview-links a:hover {
        background: rgba(96, 165, 250, 0.28);
        border-color: rgba(147, 197, 253, 0.45);
      }
    }
  </style>
  <section class="popup-preview-shell">
    <header>
      <h1>Popup State Explorer</h1>
      <p>
        Each iframe below loads the real popup bundle with a query string that forces a particular
        state. Use these links to spot-check styling quickly while the dev server runs.
      </p>
    </header>

    <div class="preview-links">
      <a href="/popup.html?state=default" target="_blank" rel="noopener">Open default in new tab</a>
      <a href="/popup.html?state=copied&preview=${samplePreview}" target="_blank" rel="noopener"
        >Open copied preview in new tab</a
      >
      <a href="/popup.html?state=protected" target="_blank" rel="noopener"
        >Open protected state in new tab</a
      >
    </div>

    <section class="preview-grid">
      <article class="preview-card">
        <div>
          <h2>Awaiting selection</h2>
          <p>Initial state rendered when the popup opens without a selection.</p>
        </div>
        <iframe
          class="preview-frame"
          title="Popup default state"
          src="/popup.html?state=default"
        ></iframe>
      </article>

      <article class="preview-card">
        <div>
          <h2>Copied</h2>
          <p>Success banner with the sample Markdown preview injected via the query string.</p>
        </div>
        <iframe
          class="preview-frame"
          title="Popup copied state"
          src="/popup.html?state=copied&preview=${samplePreview}"
        ></iframe>
      </article>

      <article class="preview-card">
        <div>
          <h2>Protected tab</h2>
          <p>Warning shown when Chrome prevents content access (e.g., on chrome:// pages).</p>
        </div>
        <iframe
          class="preview-frame"
          title="Popup protected state"
          src="/popup.html?state=protected"
        ></iframe>
      </article>
    </section>
  </section>
`;
