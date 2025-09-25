import { ensureChromeMock } from './chrome-dev-mock.js';
import { mountDevNav } from './dev-nav.js';
import { injectPublicPageMarkup } from './load-static-page.js';

type PageKey = Parameters<typeof mountDevNav>[0];

type Dispose = () => void;

type ViteHotModule<TModule> = {
  accept: (path: string, handler: (mod: TModule) => void) => void;
  dispose: (handler: () => void) => void;
};

interface DevSurfaceOptions<TModule> {
  navKey: PageKey;
  markupPath: string;
  mountPointId?: string;
  hotModulePath: string;
  loadModule: () => Promise<TModule>;
  resolveInitializer: (module: TModule) => () => Dispose;
}

function requireMountPoint(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Unable to find #${id} for dev preview surface.`);
  }
  return element;
}

export function bootstrapDevSurface<TModule>(options: DevSurfaceOptions<TModule>): void {
  ensureChromeMock();
  mountDevNav(options.navKey);

  const mountPoint = requireMountPoint(options.mountPointId ?? 'dev-root');
  const markupUrl = new URL(options.markupPath, import.meta.url);

  let cleanupMarkup: Dispose | undefined;
  let disposeSurface: Dispose | undefined;

  async function mountSurface(): Promise<void> {
    cleanupMarkup?.();
    mountPoint.innerHTML = '';
    cleanupMarkup = await injectPublicPageMarkup(markupUrl, mountPoint);

    const module = await options.loadModule();
    disposeSurface?.();
    disposeSurface = options.resolveInitializer(module)();
  }

  void mountSurface();

  const hot = (
    import.meta as ImportMeta & {
      hot?: ViteHotModule<TModule>;
    }
  ).hot;

  if (hot) {
    hot.accept(options.hotModulePath, (module) => {
      disposeSurface?.();
      disposeSurface = options.resolveInitializer(module)();
    });

    hot.dispose(() => {
      disposeSurface?.();
      cleanupMarkup?.();
    });
  }
}
