export type CopySource = "popup" | "hotkey" | "context-menu" | "e2e" | "unknown";

export type LoggedError = {
  message: string;
  context: string;
  timestamp: number;
};
