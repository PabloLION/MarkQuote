import clipboardy from "clipboardy";

export interface SystemClipboardSnapshot {
  readonly initialValue: string;
  restore(): Promise<void>;
}

export async function snapshotSystemClipboard(): Promise<SystemClipboardSnapshot> {
  const initialValue = await clipboardy.read();
  return {
    initialValue,
    async restore() {
      await clipboardy.write(initialValue);
    },
  };
}

export async function readSystemClipboard(): Promise<string> {
  return clipboardy.read();
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
    lastValue = await clipboardy.read();
    if (lastValue === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`${message} Last clipboard value: ${lastValue}`);
}
