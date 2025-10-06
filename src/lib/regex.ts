import safeRegex from "safe-regex";

import { SAFE_REGEX_ALLOWLIST } from "../options-schema.js";

export const MAX_REGEX_PATTERN_LENGTH = 500;

export function isPatternAllowed(pattern: string): boolean {
  if (SAFE_REGEX_ALLOWLIST.has(pattern)) {
    return true;
  }
  return safeRegex(pattern);
}

export function describePattern(pattern: string): { preview: string; length: number } {
  const trimmed = pattern.trim();
  const normalized = trimmed.replace(/\s+/g, " ");
  const preview = normalized.length > 64 ? `${normalized.slice(0, 63)}…` : normalized;
  return {
    preview,
    length: pattern.length,
  };
}

export function compileRegex(
  pattern: string,
  onError: (error: unknown) => void,
): RegExp | undefined {
  if (!pattern) {
    return undefined;
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    console.error("Regex pattern exceeds maximum length.", describePattern(pattern));
    return undefined;
  }

  try {
    if (!isPatternAllowed(pattern)) {
      console.error("Refusing to compile unsafe regular expression.", describePattern(pattern));
      return undefined;
    }
    return new RegExp(pattern);
  } catch (error) {
    onError(error);
    return undefined;
  }
}
