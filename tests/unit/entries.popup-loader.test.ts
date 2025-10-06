import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalChrome: typeof chrome | undefined = globalThis.chrome;
const realLocation = window.location;

function stubWindowLocation(url: string): void {
  const urlObj = new URL(url);
  const locationStub: Partial<Location> = {
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    toString: () => urlObj.toString(),
    href: urlObj.href,
    origin: urlObj.origin,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
  };

  Object.defineProperty(window, "location", {
    configurable: true,
    value: locationStub as Location,
  });
}

function restoreWindowLocation(): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: realLocation,
  });
}

describe("entries/popup-loader", () => {
  beforeEach(() => {
    delete (globalThis as { chrome?: typeof chrome }).chrome;
    document.body.innerHTML = "";
    stubWindowLocation("https://example.com/popup.html");
  });

  afterEach(() => {
    if (originalChrome) {
      (globalThis as { chrome?: typeof chrome }).chrome = originalChrome;
    } else {
      delete (globalThis as { chrome?: typeof chrome }).chrome;
    }
    restoreWindowLocation();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("loads the dev popup entry when running on localhost", async () => {
    const importer = vi.fn().mockResolvedValue(undefined);

    await vi.resetModules();
    stubWindowLocation("http://localhost:5173/popup.html");
    const module = await import("../../src/entries/popup-loader.js");
    module.__setPopupModuleImporter(importer);
    await module.loadPopupModule();

    expect(importer).toHaveBeenCalledWith("/src/surfaces/popup/main.ts");
  });

  it("loads the packaged popup bundle when running inside the extension", async () => {
    const importer = vi.fn().mockResolvedValue(undefined);
    const getUrl = vi.fn().mockReturnValue("chrome-extension://id/popup.js");

    await vi.resetModules();
    globalThis.chrome = {
      runtime: {
        id: "id",
        getURL: getUrl,
      },
    } as unknown as typeof chrome;

    stubWindowLocation("https://markquote.app/popup.html");

    const module = await import("../../src/entries/popup-loader.js");
    module.__setPopupModuleImporter(importer);
    await module.loadPopupModule();

    expect(getUrl).toHaveBeenCalledWith("popup.js");
    expect(importer).toHaveBeenCalledWith("chrome-extension://id/popup.js");
  });

  it("falls back to the local popup bundle when chrome.runtime is unavailable", async () => {
    const importer = vi.fn().mockResolvedValue(undefined);

    await vi.resetModules();
    (globalThis as { chrome?: typeof chrome }).chrome = {} as typeof chrome;
    stubWindowLocation("https://markquote.app/popup.html");
    const module = await import("../../src/entries/popup-loader.js");
    module.__setPopupModuleImporter(importer);
    await module.loadPopupModule();

    expect(importer).toHaveBeenCalledWith("./popup.js");
  });

  it("reveals the inline error message when elements exist", async () => {
    const container = document.createElement("div");
    container.id = "message";
    container.setAttribute("hidden", "true");
    const text = document.createElement("span");
    text.id = "message-text";
    const preview = document.createElement("div");
    preview.id = "preview";
    document.body.append(container, text, preview);

    const module = await import("../../src/entries/popup-loader.js");
    module.renderBootstrapError();

    expect(container.hasAttribute("hidden")).toBe(false);
    expect(container.dataset.variant).toBe("warning");
    expect(text.textContent).toContain("failed to load");
    expect(preview.getAttribute("hidden")).toBe("true");
  });

  it("injects a fallback banner when status elements are missing", async () => {
    const module = await import("../../src/entries/popup-loader.js");
    module.renderBootstrapError();

    const fallback = document.body.firstElementChild as HTMLElement | null;
    expect(fallback?.textContent).toContain("failed to load");
    expect(fallback?.style.border).toContain("solid");
  });

  it("logs bootstrap failures and renders the error banner", async () => {
    const importer = vi.fn().mockRejectedValue(new Error("fatal"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const container = document.createElement("div");
    container.id = "message";
    container.setAttribute("hidden", "true");
    const text = document.createElement("span");
    text.id = "message-text";
    const preview = document.createElement("div");
    preview.id = "preview";
    document.body.append(container, text, preview);

    await vi.resetModules();
    const module = await import("../../src/entries/popup-loader.js");
    module.__setPopupModuleImporter(importer);

    await module.bootstrapPopup();

    expect(consoleSpy).toHaveBeenCalled();
    expect(container.dataset.variant).toBe("warning");
    expect(preview.getAttribute("hidden")).toBe("true");
  });

  it("rejects when popup module loading times out", async () => {
    vi.useFakeTimers();

    try {
      const importer = vi.fn(() => new Promise(() => {}));

      await vi.resetModules();
      stubWindowLocation("http://localhost:5173/popup.html");
      const module = await import("../../src/entries/popup-loader.js");
      module.__setPopupModuleImporter(importer);

      const loadPromise = module.loadPopupModule();
      const expectation = expect(loadPromise).rejects.toThrow("Module load timed out");

      await vi.advanceTimersByTimeAsync(10_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
