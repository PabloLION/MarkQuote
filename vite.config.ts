import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

interface PackageJson {
  version?: string;
}

function getPackageVersion(): string {
  const packagePath = resolve(__dirname, "package.json");
  const content = readFileSync(packagePath, "utf-8");
  const pkg: PackageJson = JSON.parse(content);
  return pkg.version ?? "0.0.0";
}

export default defineConfig(({ command }) => {
  if (command === "serve") {
    const shouldSuppressOpen = process.env.MQ_VITE_NO_OPEN === "1";
    return {
      root: ".",
      publicDir: resolve(__dirname, "public"),
      server: {
        open: shouldSuppressOpen ? false : "/dev/index.html",
        fs: {
          allow: [
            resolve(__dirname, "dev"),
            resolve(__dirname, "src"),
            resolve(__dirname, "public"),
          ],
        },
      },
      resolve: {
        alias: {
          "@": resolve(__dirname, "src"),
        },
      },
    };
  }

  // Default: smoke build with timestamp. Set RELEASE_BUILD=1 for clean release.
  const isReleaseBuild = process.env.RELEASE_BUILD === "1";
  const smokeTimestamp = isReleaseBuild
    ? ""
    : new Date().toLocaleTimeString("en-GB", { hour12: false });
  const version = getPackageVersion();

  return {
    define: {
      __SMOKE_BUILD_TIME__: JSON.stringify(smokeTimestamp),
      __SMOKE_BUILD_VERSION__: JSON.stringify(isReleaseBuild ? "" : version),
    },
    build: {
      minify: false,
      rollupOptions: {
        input: {
          background: resolve(__dirname, "src/background/index.ts"),
          selection: resolve(__dirname, "src/content-scripts/selection.ts"),
          options: resolve(__dirname, "src/surfaces/options/main.ts"),
          popup: resolve(__dirname, "src/surfaces/popup/main.ts"),
          "options-loader": resolve(__dirname, "src/entries/options-loader.ts"),
          "popup-loader": resolve(__dirname, "src/entries/popup-loader.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
        },
      },
      outDir: "dist",
      emptyOutDir: true,
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "public/*",
            dest: ".",
          },
        ],
      }),
    ],
  };
});
