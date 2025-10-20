import clipboardy from "clipboardy";

export class ClipboardSupportError extends Error {
  constructor(operation: "read" | "write", cause: unknown) {
    const hint = buildSupportHint();
    const details = cause instanceof Error ? cause.message : String(cause);
    super(
      `System clipboard unavailable while attempting to ${operation}. ${hint} (clipboardy: ${details})`,
      { cause: cause instanceof Error ? cause : undefined },
    );
    this.name = "ClipboardSupportError";
  }
}

export interface SystemClipboardSnapshot {
  readonly initialValue: string;
  restore(): Promise<void>;
}

export async function snapshotSystemClipboard(): Promise<SystemClipboardSnapshot> {
  const initialValue = await readClipboard();
  return {
    initialValue,
    async restore() {
      await writeClipboard(initialValue);
    },
  };
}

export async function readSystemClipboard(): Promise<string> {
  return readClipboard();
}

export async function waitForSystemClipboard(
  expected: string,
  message: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 5_000, pollIntervalMs = 100 } = options;
  const deadline = Date.now() + timeoutMs;
  let lastValue = "";

  while (Date.now() <= deadline) {
    lastValue = await readClipboard();
    if (lastValue === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`${message} Last clipboard value: ${lastValue}`);
}

async function readClipboard(): Promise<string> {
  try {
    return await clipboardy.read();
  } catch (error) {
    throw new ClipboardSupportError("read", error);
  }
}

async function writeClipboard(value: string): Promise<void> {
  try {
    await clipboardy.write(value);
  } catch (error) {
    throw new ClipboardSupportError("write", error);
  }
}

function buildSupportHint(): string {
  switch (process.platform) {
    case "linux":
      return "Install `xclip` or `xsel` (e.g., `sudo apt-get install xclip`).";
    case "darwin":
      return "Ensure `pbcopy`/`pbpaste` are available (headless macOS runners must enable the pasteboard service).";
    default:
      return "Ensure the host clipboard is available to clipboardy in this environment.";
  }
}
