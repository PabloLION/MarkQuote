/**
 * Prints a formatted smoke test checklist to the terminal.
 * Run with: pnpm smoke
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

interface PackageJson {
  version?: string;
}

async function getVersion(): Promise<string> {
  const packagePath = path.join(rootDir, "package.json");
  const content = await fs.readFile(packagePath, "utf-8");
  const pkg: PackageJson = JSON.parse(content);
  return pkg.version ?? "unknown";
}

function printChecklist(version: string): void {
  const checklist = `
╔═══════════════════════════════════════════════════════════════════╗
║           MarkQuote Smoke Test Checklist (v${version.padEnd(8)})            ║
╚═══════════════════════════════════════════════════════════════════╝

Setup:
  pnpm build
  Load dist/ in chrome://extensions (Developer mode → Load unpacked)

─────────────────────────────────────────────────────────────────────
Manual-Only Tests (Playwright cannot automate these):
─────────────────────────────────────────────────────────────────────

  [ ] 1. Toolbar icon click (pinned) → popup opens with preview
  [ ] 2. Keyboard shortcut (Alt+C) with pinned icon → popup opens
  [ ] 3. Protected chrome:// page → shows "Chrome internal pages" message
  [ ] 4. Protected file:// page → shows "Local file pages" message
  [ ] 5. Always-on confirmation toggle → popup auto-opens after copy

─────────────────────────────────────────────────────────────────────
Feature Verification (also covered by E2E, but verify visually):
─────────────────────────────────────────────────────────────────────

  [ ] 6. Context menu "Copy as Markdown Quote" → copies blockquote
  [ ] 7. Keyboard shortcut (unpinned) → copies to clipboard
  [ ] 8. Options page rule editing → changes persist after reload
  [ ] 9. Error badge appears on extension icon after failed copy
  [ ] 10. Error list displays in popup with "Copy details" button
  [ ] 11. "Copy details" generates markdown error report
  [ ] 12. "Dismiss" clears errors and removes badge
  [ ] 13. Long preview shows "Show more" toggle
  [ ] 14. Icon renders correctly at all sizes

─────────────────────────────────────────────────────────────────────
Full documentation: docs/dev/smoke-test-plan.md
─────────────────────────────────────────────────────────────────────
`;

  console.log(checklist);
}

async function main(): Promise<void> {
  const version = await getVersion();
  printChecklist(version);
}

main().catch((error) => {
  console.error("Failed to print smoke checklist:", error);
  process.exit(1);
});
