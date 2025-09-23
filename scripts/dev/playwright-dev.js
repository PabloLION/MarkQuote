import { spawn, execSync } from 'node:child_process';
import readline from 'node:readline';
import process from 'node:process';
import { chromium } from 'playwright';

const viteArgs = ['dev', '--', '--host', '--open', 'false'];
const viteProcess = spawn('pnpm', viteArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, MQ_VITE_NO_OPEN: '1' },
});

let serverUrl;
const devPath = process.env.MQ_PLAYWRIGHT_PATH ?? '/dev/index.html';
let launchingBrowser = false;
let browser = null;
let browserContext = null;
let shuttingDown = false;

const ansiRegex = /\u001b\[[0-9;]*m/g;

const stdoutInterface = readline.createInterface({ input: viteProcess.stdout });
stdoutInterface.on('line', line => {
  console.log(line);
  if (serverUrl || launchingBrowser) {
    return;
  }

  const sanitized = line.replace(ansiRegex, '');
  const match = sanitized.match(/Local:\s+(https?:\/\/[^\s]+)/i);
  if (match) {
    serverUrl = match[1];
    launchingBrowser = true;
    launchBrowser(serverUrl).catch(error => {
      console.error('[playwright] Failed to launch browser:', error);
      shuttingDown = true;
      terminate('SIGINT');
    });
  }
});

viteProcess.stderr.setEncoding('utf8');
viteProcess.stderr.on('data', chunk => {
  process.stderr.write(chunk);
});

viteProcess.on('exit', (code, signal) => {
  stdoutInterface.close();
  shuttingDown = true;
  (async () => {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.warn('[playwright] Error closing browser during shutdown:', error);
      }
    }
    if (signal) {
      process.exit(0);
    } else {
      process.exit(code ?? 0);
    }
  })().catch(error => {
    console.error('[runner] Error during shutdown:', error);
    process.exit(1);
  });
});

const terminationSignals = ['SIGINT', 'SIGTERM'];
terminationSignals.forEach(sig => {
  process.on(sig, () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[runner] Received ${sig}, shutting down...`);
    terminate(sig);
  });
});

function terminate(signal) {
  if (browserContext) {
    browserContext.close().catch(() => {});
    browserContext = null;
  }
  if (browser) {
    browser.close().catch(() => {});
  }
  if (viteProcess.exitCode === null) {
    viteProcess.kill(signal);
  }
}

function detectSystemColorScheme() {
  const override = process.env.MQ_PLAYWRIGHT_COLOR_SCHEME;
  const allowed = ['light', 'dark', 'no-preference'];
  if (override) {
    if (!allowed.includes(override)) {
      console.warn(`[playwright] Ignoring invalid MQ_PLAYWRIGHT_COLOR_SCHEME value: ${override}`);
    } else {
      return override;
    }
  }

  try {
    if (process.platform === 'darwin') {
      try {
        const output = execSync('defaults read -g AppleInterfaceStyle', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim()
          .toLowerCase();
        if (output === 'dark') {
          return 'dark';
        }
        return 'light';
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

async function launchBrowser(baseUrl) {
  const channel = process.env.MQ_PLAYWRIGHT_CHANNEL ?? 'chrome';
  const targetUrl = new URL(devPath, baseUrl).toString();
  console.log(`[playwright] Launching ${channel} for ${targetUrl}`);

  browser = await chromium.launch({
    channel,
    headless: false,
  });

  const colorScheme = detectSystemColorScheme();
  if (colorScheme) {
    console.log(`[playwright] Applying color scheme preference: ${colorScheme}`);
  }

  browserContext = await browser.newContext(
    colorScheme
      ? {
          colorScheme,
        }
      : {},
  );

  browser.on('disconnected', () => {
    if (!shuttingDown && viteProcess.exitCode === null) {
      console.log('[playwright] Browser closed, stopping Vite dev server.');
      terminate('SIGTERM');
    }
  });

  const page = await browserContext.newPage();

  const attemptNavigation = async (label, options) => {
    try {
      await page.goto(targetUrl, options);
      console.log(`[playwright] Opened ${targetUrl} (${label})`);
      return true;
    } catch (error) {
      const message = error?.message ?? String(error);
      const toleratedErrors = [
        'ERR_HTTP_RESPONSE_CODE_FAILURE',
        'ERR_CONNECTION_REFUSED',
        'ERR_FAILED',
      ];
      if (toleratedErrors.some(code => message.includes(code))) {
        console.warn(`[playwright] Navigation ${label} failed: ${message.trim()}`);
        return false;
      }
      throw error;
    }
  };

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
