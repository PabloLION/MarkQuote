import { chmodSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const hooksSource = join(repoRoot, "scripts", "git-hooks");
const hooksTarget = join(repoRoot, ".git", "hooks");

try {
  mkdirSync(hooksTarget, { recursive: true });
  rmSync(join(hooksTarget, "pre-commit"), { force: true });
  symlinkSync(join(hooksSource, "pre-commit"), join(hooksTarget, "pre-commit"));
  chmodSync(join(hooksTarget, "pre-commit"), 0o755);
  console.log("Git hooks installed.");
} catch (error) {
  console.error("Failed to install git hooks:", error);
  process.exit(1);
}
