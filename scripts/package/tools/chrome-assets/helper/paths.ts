import path from "node:path";
import { fileURLToPath } from "node:url";

const captureDir = fileURLToPath(new URL(".", import.meta.url));
export const repoRoot = path.resolve(captureDir, "..", "..", "..", "..");
export const packageDir = path.join(repoRoot, "scripts", "package");
export const distDir = path.join(repoRoot, "dist");
export const assetsDir = path.join(repoRoot, "docs", "storefront", "chrome-web-store", "assets");
export const templatesDir = path.join(
  repoRoot,
  "docs",
  "storefront",
  "chrome-web-store",
  "templates",
);
export const iconsDir = path.join(repoRoot, "public", "icons");
export const manifestPath = path.join(repoRoot, "public", "manifest.json");
