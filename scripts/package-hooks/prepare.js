import { execSync } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const hooksSource = join(repoRoot, "scripts", "git-hooks");
const hooksTarget = join(repoRoot, ".git", "hooks");
try {
  mkdirSync(join(repoRoot, ".git"), { recursive: true });
  const existing = (() => {
    try {
      return lstatSync(hooksTarget);
    } catch {
      return undefined;
    }
  })();

  const hookNames = ["pre-commit", "pre-merge-commit"];

  const ensureExecutable = (hookName) => {
    try {
      chmodSync(join(hooksSource, hookName), 0o755);
    } catch (error) {
      console.warn(`Warning: unable to chmod hook ${hookName}:`, error);
    }
  };

  hookNames.forEach(ensureExecutable);

  if (existing?.isSymbolicLink()) {
    const current = readlinkSync(hooksTarget);
    const currentResolved = resolve(repoRoot, current);
    if (currentResolved !== hooksSource) {
      rmSync(hooksTarget, { force: true });
      symlinkSync(hooksSource, hooksTarget, "dir");
      console.log("Git hooks symlink updated.");
    } else {
      console.log("Git hooks symlink already up to date.");
    }
  } else {
    if (existing) {
      rmSync(hooksTarget, { recursive: true, force: true });
    }
    symlinkSync(hooksSource, hooksTarget, "dir");
    console.log("Git hooks directory symlink created.");
  }
} catch (error) {
  console.error("Failed to install git hooks:", error);
  process.exit(1);
}

let mergeFfDisabled = false;

try {
  const current = execSync("git config --get merge.ff", {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  }).trim();
  mergeFfDisabled = current === "false";
} catch (error) {
  mergeFfDisabled = false;
}

if (!mergeFfDisabled) {
  try {
    execSync("git config --local merge.ff false", {
      cwd: repoRoot,
      stdio: "ignore",
    });
    mergeFfDisabled = true;
    console.log("Configured git merge.ff=false (no fast-forward merges).");
  } catch (error) {
    console.warn(
      "Warning: unable to set git merge.ff=false automatically. Please run `git config --local merge.ff false` manually.",
    );
  }
} else {
  console.log("Git merge.ff already set to false (no fast-forward merges).");
}
