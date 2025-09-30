import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");

function loadJson<T>(relativePath: string): T {
  const absolute = path.join(repoRoot, relativePath);
  const raw = readFileSync(absolute, "utf8");
  return JSON.parse(raw) as T;
}

describe("project metadata", () => {
  it("keeps package and manifest descriptions in sync", () => {
    const pkg = loadJson<{ description?: string }>("package.json");
    const manifest = loadJson<{ description?: string }>("public/manifest.json");

    expect(pkg.description?.trim()).toBe(manifest.description?.trim());
  });
});
