import { ensureChromeMock } from "./chrome-dev-mock.js";
import { mountDevNav } from "./dev-nav.js";

type PopupDevPreviewApi = {
  showDefault: () => void;
  showSuccess: (text: string) => void;
  showProtected: () => void;
};

type PreviewKey = "default" | "success" | "protected";

interface PreviewConfig {
  key: PreviewKey;
  title: string;
  description: string;
  apply: (api: PopupDevPreviewApi) => void;
}

type FrameRegistry = Record<
  PreviewKey,
  { frame: HTMLIFrameElement; apply: () => void } | undefined
>;

type Cleanup = () => void;

ensureChromeMock();
mountDevNav("popup-explorer");

const cleanupCallbacks: Cleanup[] = [];

function requireRoot(): HTMLElement {
  const element = document.getElementById("dev-root");
  if (!element) {
    throw new Error("Unable to find #dev-root for popup dev preview.");
  }
  return element;
}

function injectStyles(target: HTMLElement): void {
  const style = document.createElement("style");
  style.textContent = `
    #popup-preview-layout {
      padding: 24px;
      display: grid;
      gap: 24px;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 116, 144, 0.06));
      min-height: 100vh;
      box-sizing: border-box;
      color: #0f172a;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #popup-preview-layout h1 {
      margin: 0;
      font-size: 1.25rem;
      letter-spacing: 0.01em;
    }

    #popup-preview-layout p {
      margin: 4px 0 0;
      color: rgba(15, 23, 42, 0.75);
      max-width: 640px;
    }

    #popup-preview-config {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid rgba(59, 130, 246, 0.25);
      background: rgba(37, 99, 235, 0.08);
      max-width: 720px;
    }

    #popup-preview-config label {
      display: grid;
      gap: 6px;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(15, 23, 42, 0.65);
    }

    #popup-preview-config textarea {
      width: 100%;
      min-height: 110px;
      border-radius: 10px;
      border: 1px solid rgba(59, 130, 246, 0.45);
      padding: 10px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 0.85rem;
      background: rgba(15, 23, 42, 0.04);
      color: inherit;
      resize: vertical;
    }

    #popup-preview-grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      align-items: start;
    }

    .popup-preview-card {
      display: grid;
      gap: 16px;
      padding: 18px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.5);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12);
      backdrop-filter: blur(6px);
    }

    .popup-preview-card h2 {
      margin: 0;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(15, 23, 42, 0.82);
    }

    .popup-preview-card p {
      margin: 0;
      font-size: 0.82rem;
      color: rgba(15, 23, 42, 0.72);
    }

    .popup-preview-frame-wrapper {
      display: flex;
      justify-content: center;
    }

    .popup-preview-card iframe {
      width: 340px;
      height: 560px;
      border-radius: 20px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      background: #111827;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.24);
    }

    @media (prefers-color-scheme: dark) {
      #popup-preview-layout {
        color: #e2e8f0;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(14, 165, 233, 0.14));
      }

      #popup-preview-layout p {
        color: rgba(226, 232, 240, 0.78);
      }

      #popup-preview-config {
        border-color: rgba(96, 165, 250, 0.45);
        background: rgba(37, 99, 235, 0.16);
      }

      #popup-preview-config label {
        color: rgba(226, 232, 240, 0.65);
      }

      #popup-preview-config textarea {
        border-color: rgba(96, 165, 250, 0.45);
        background: rgba(15, 23, 42, 0.55);
      }

      .popup-preview-card {
        background: rgba(17, 24, 39, 0.92);
        border-color: rgba(148, 163, 184, 0.35);
        box-shadow: 0 18px 36px rgba(2, 6, 23, 0.45);
      }

      .popup-preview-card h2 {
        color: rgba(226, 232, 240, 0.88);
      }

      .popup-preview-card p {
        color: rgba(203, 213, 225, 0.76);
      }

      .popup-preview-card iframe {
        border-color: rgba(148, 163, 184, 0.4);
        background: #0f172a;
      }
    }
  `;
  target.appendChild(style);
  cleanupCallbacks.push(() => style.remove());
}

function waitForDevApi(
  frame: HTMLIFrameElement,
  callback: (api: PopupDevPreviewApi) => void,
): void {
  let cancelled = false;

  const check = () => {
    if (cancelled) {
      return;
    }

    const win = frame.contentWindow as
      | (Window & { __MARKQUOTE_POPUP_DEV__?: PopupDevPreviewApi })
      | null;
    const api = win?.__MARKQUOTE_POPUP_DEV__;
    if (api) {
      callback(api);
    } else {
      setTimeout(check, 50);
    }
  };

  check();

  cleanupCallbacks.push(() => {
    cancelled = true;
  });
}

function injectChromeBridge(markup: string): string {
  const bridgeScript = `\n    <script>\n      window.chrome = parent.chrome;\n      window.__MARKQUOTE_DEV__ = parent.__MARKQUOTE_DEV__;\n    </script>\n  `;

  if (markup.includes('<script src="popup.js"></script>')) {
    return markup.replace(
      '<script src="popup.js"></script>',
      `${bridgeScript}\n    <script type="module" src="/src/popup-entry.ts"></script>`,
    );
  }

  return markup.replace(
    "</head>",
    `${bridgeScript}\n    <script type="module" src="/src/popup-entry.ts"></script>\n  </head>`,
  );
}

async function init(): Promise<void> {
  const popupMarkup = await fetch("/popup.html").then((response) => {
    if (!response.ok) {
      throw new Error(`Unable to load popup.html: ${response.status} ${response.statusText}`);
    }
    return response.text();
  });

  const frameMarkup = injectChromeBridge(popupMarkup);

  const root = requireRoot();
  root.innerHTML = "";
  injectStyles(root);

  const layout = document.createElement("div");
  layout.id = "popup-preview-layout";
  root.appendChild(layout);

  const heading = document.createElement("header");
  heading.innerHTML = `
    <div>
      <h1>Popup State Explorer</h1>
      <p>Each preview loads the real popup bundle inside an isolated frame so you can compare states side-by-side while iterating.</p>
    </div>
  `;
  layout.appendChild(heading);

  const configSection = document.createElement("section");
  configSection.id = "popup-preview-config";
  configSection.innerHTML = `
    <p>Adjust the sample markdown used for the "Copied" scenario. The change is applied instantly to the corresponding preview.</p>
    <label>
      Sample markdown
      <textarea id="popup-preview-sample"></textarea>
    </label>
  `;
  layout.appendChild(configSection);

  const sampleInput = configSection.querySelector<HTMLTextAreaElement>("#popup-preview-sample");
  const defaultSample = `> This was addressed in 2014 when long-standing Markdown contributors released CommonMark, an unambiguous specification and test suite for Markdown.\n> Source: [Wiki:Markdown](https://en.wikipedia.org/wiki/Markdown)`;
  if (sampleInput) {
    sampleInput.value = defaultSample;
  }

  const grid = document.createElement("div");
  grid.id = "popup-preview-grid";
  layout.appendChild(grid);

  const frames: FrameRegistry = {
    default: undefined,
    success: undefined,
    protected: undefined,
  };

  const configs: PreviewConfig[] = [
    {
      key: "default",
      title: "Awaiting selection",
      description: "Initial state shown when the user opens the popup without selecting text.",
      apply: (api) => api.showDefault(),
    },
    {
      key: "success",
      title: "Copied",
      description:
        "Markdown preview after we copy a selection. Sample text reflects the editor above.",
      apply: (api) => api.showSuccess(sampleInput?.value.trim() || defaultSample),
    },
    {
      key: "protected",
      title: "Protected tab",
      description:
        "Message rendered when Chrome blocks access on restricted pages (e.g., chrome://).",
      apply: (api) => api.showProtected(),
    },
  ];

  function registerFrame(config: PreviewConfig): void {
    const card = document.createElement("article");
    card.className = "popup-preview-card";
    card.innerHTML = `
      <div>
        <h2>${config.title}</h2>
        <p>${config.description}</p>
      </div>
    `;

    const frameWrapper = document.createElement("div");
    frameWrapper.className = "popup-preview-frame-wrapper";

    const frame = document.createElement("iframe");
    frame.srcdoc = frameMarkup;
    frameWrapper.appendChild(frame);
    card.appendChild(frameWrapper);
    grid.appendChild(card);

    const applyState = () => {
      waitForDevApi(frame, config.apply);
    };

    frame.addEventListener("load", applyState);
    cleanupCallbacks.push(() => frame.removeEventListener("load", applyState));

    frames[config.key] = { frame, apply: applyState };
    applyState();
  }

  configs.forEach(registerFrame);

  const refreshSuccessPreview = () => {
    const entry = frames.success;
    entry?.apply();
  };

  if (sampleInput) {
    const handleInput = () => {
      refreshSuccessPreview();
    };
    sampleInput.addEventListener("input", handleInput);
    cleanupCallbacks.push(() => sampleInput.removeEventListener("input", handleInput));
  }

  const hot = (
    import.meta as ImportMeta & {
      hot?: { dispose: (handler: () => void) => void };
    }
  ).hot;

  hot?.dispose(() => {
    cleanupCallbacks.splice(0).forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn("Popup preview cleanup failed", error);
      }
    });
  });
}

void init();
