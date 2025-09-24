import { execSync, spawn } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';
import { chromium, type Browser, type BrowserContext } from 'playwright';

const devPath = process.env.MQ_PLAYWRIGHT_PATH ?? '/dev/index.html';
const ansiRegex = /\u001b\[[0-9;]*m/g;

const state: {
  serverUrl?: string;
  launchingBrowser: boolean;
  browser: Browser | null;
  browserContext: BrowserContext | null;
  shuttingDown: boolean;
} = {
  serverUrl: undefined,
  launchingBrowser: false,
  browser: null,
  browserContext: null,
  shuttingDown: false,
};

const viteArgs = ['dev', '--', '--host', '--open', 'false'];
const viteProcess = spawn('pnpm', viteArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, MQ_VITE_NO_OPEN: '1' },
});

function stripAnsi(input: string): string {
  return input.replace(ansiRegex, '');
}

function extractServerUrl(line: string): string | undefined {
  const sanitized = stripAnsi(line);
  const match = sanitized.match(/Local:\s+(https?:\/\/[^\s]+)/i);
  return match ? match[1] : undefined;
}

async function closeBrowser(): Promise<void> {
  if (state.browserContext) {
    try {
      await state.browserContext.close();
    } catch (error) {
      console.warn('[playwright] Error closing browser context:', error);
    }
    state.browserContext = null;
  }

  if (state.browser) {
    try {
      await state.browser.close();
    } catch (error) {
      console.warn('[playwright] Error closing browser:', error);
    }
    state.browser = null;
  }
}

function detectSystemColorScheme(): 'light' | 'dark' | 'no-preference' | undefined {
  const override = process.env.MQ_PLAYWRIGHT_COLOR_SCHEME;
  const allowed = ['light', 'dark', 'no-preference'];
  if (override) {
    if (!allowed.includes(override)) {
      console.warn(`[playwright] Ignoring invalid MQ_PLAYWRIGHT_COLOR_SCHEME value: ${override}`);
    } else {
      return override as 'light' | 'dark' | 'no-preference';
    }
  }

  try {
    if (process.platform === 'darwin') {
      try {
        const output = execSync('defaults read -g AppleInterfaceStyle', {
          stdio: ['ignore', 'pipe', 'ignore'],
        })
          .toString()
          .trim()
          .toLowerCase();
        return output === 'dark' ? 'dark' : 'light';
      } catch {
        return 'light';
      }
    }

    if (process.platform === 'win32') {
      const query = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
        { stdio: ['ignore', 'pipe', 'ignore'] },
      )
        .toString()
        .trim();
      const match = query.match(/AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i);
      if (match) {
        return match[1] === '0' ? 'dark' : 'light';
      }
      return undefined;
    }

    if (process.platform === 'linux') {
      try {
        const colorScheme = execSync('gsettings get org.gnome.desktop.interface color-scheme', {
          stdio: ['ignore', 'pipe', 'ignore'],
        })
          .toString()
          .trim()
          .replace(/'/g, '')
          .toLowerCase();
        if (colorScheme.includes('dark')) {
          return 'dark';
        }
        if (colorScheme.includes('default') || colorScheme.includes('light')) {
          return 'light';
        }
      } catch {
        try {
          const theme = execSync('gsettings get org.gnome.desktop.interface gtk-theme', {
            stdio: ['ignore', 'pipe', 'ignore'],
          })
            .toString()
            .trim()
            .replace(/'/g, '')
            .toLowerCase();
          if (theme.includes('dark')) {
            return 'dark';
          }
          if (theme) {
            return 'light';
          }
        } catch {
          return undefined;
        }
      }
    }
  } catch (error) {
    console.warn('[playwright] Unable to detect system color scheme:', error);
  }

  return undefined;
}

async function launchBrowser(baseUrl: string): Promise<void> {
  const channel = process.env.MQ_PLAYWRIGHT_CHANNEL ?? 'chrome';
  const targetUrl = new URL(devPath, baseUrl).toString();
  console.log(`[playwright] Launching ${channel} for ${targetUrl}`);

  state.browser = await chromium.launch({
    channel,
    headless: false,
  });

  const colorScheme = detectSystemColorScheme();
  if (colorScheme) {
    console.log(`[playwright] Applying color scheme preference: ${colorScheme}`);
  }

  state.browserContext = await state.browser.newContext(
    colorScheme
      ? {
          colorScheme,
        }
      : {},
  );

  state.browser.on('disconnected', () => {
    if (!state.shuttingDown && viteProcess.exitCode === null) {
      console.log('[playwright] Browser closed, stopping Vite dev server.');
      terminate('SIGTERM');
    }
  });

  const page = await state.browserContext.newPage();

  async function attemptNavigation(label: string, options: Parameters<typeof page.goto>[1]) {
    try {
      await page.goto(targetUrl, options);
      console.log(`[playwright] Opened ${targetUrl} (${label})`);
      return true;
    } catch (error) {
      const message = error?.message ?? String(error);
      const toleratedErrors = ['ERR_HTTP_RESPONSE_CODE_FAILURE', 'ERR_CONNECTION_REFUSED', 'ERR_FAILED'];
      if (toleratedErrors.some((code) => message.includes(code))) {
        console.warn(`[playwright] Navigation ${label} failed: ${message.trim()}`);
        return false;
      }
      throw error;
    }
  }

  const loaded = await attemptNavigation('domcontentloaded', {
    waitUntil: 'domcontentloaded',
  });

  if (!loaded) {
    await page.waitForTimeout(1000);
    await attemptNavigation('retry-load', {
      waitUntil: 'load',
      timeout: 60_000,
    });
  }
}

async function handleServerReady(url: string): Promise<void> {
  if (state.serverUrl || state.launchingBrowser) {
    return;
  }

  state.serverUrl = url;
  state.launchingBrowser = true;

  try {
    await launchBrowser(url);
  } catch (error) {
    console.error('[playwright] Failed to launch browser:', error);
    state.shuttingDown = true;
    terminate('SIGINT');
  }
}

async function shutdown(signal?: NodeJS.Signals, code?: number): Promise<void> {
  state.shuttingDown = true;
  await closeBrowser();

  if (viteProcess.exitCode === null) {
    try {
      viteProcess.kill(signal ?? 'SIGTERM');
    } catch (error) {
      if (error && (error as NodeJS.ErrnoException).code !== 'ESRCH') {
        console.warn('[runner] Failed to terminate Vite process:', error);
      }
    }
  }

  if (signal) {
    process.exit(0);
  } else {
    process.exit(code ?? 0);
  }
}

function terminate(signal: NodeJS.Signals): void {
  if (!state.shuttingDown) {
    shutdown(signal).catch((error) => {
      console.error('[runner] Error during shutdown:', error);
      process.exit(1);
    });
  }
}

function registerSignalHandlers(): void {
  ['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, () => {
      if (state.shuttingDown) {
        return;
      }
      console.log(`[runner] Received ${sig}, shutting down...`);
      terminate(sig as NodeJS.Signals);
    });
  });
}

function attachViteListeners(): void {
  const stdoutInterface = readline.createInterface({ input: viteProcess.stdout });

  stdoutInterface.on('line', (line) => {
    console.log(line);
    if (state.serverUrl || state.launchingBrowser) {
      return;
    }
    const url = extractServerUrl(line);
    if (url) {
      void handleServerReady(url);
    }
  });

  viteProcess.stderr.setEncoding('utf8');
  viteProcess.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  viteProcess.on('exit', (code, signal) => {
    stdoutInterface.close();
    shutdown(signal ?? undefined, code ?? undefined).catch((error) => {
      console.error('[runner] Error during shutdown:', error);
      process.exit(1);
    });
  });
}

attachViteListeners();
registerSignalHandlers();
