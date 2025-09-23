import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    const shouldSuppressOpen = process.env.MQ_VITE_NO_OPEN === '1';
    return {
      root: '.',
      publicDir: resolve(__dirname, 'public'),
      server: {
        open: shouldSuppressOpen ? false : '/dev/index.html',
        fs: {
          allow: [
            resolve(__dirname, 'dev'),
            resolve(__dirname, 'src'),
            resolve(__dirname, 'public'),
          ],
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
    };
  }

  return {
    build: {
      minify: false,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.ts'),
          content: resolve(__dirname, 'src/content.ts'),
          selection: resolve(__dirname, 'src/selection.ts'),
          offscreen: resolve(__dirname, 'src/offscreen.ts'),
          options: resolve(__dirname, 'src/options-entry.ts'),
          popup: resolve(__dirname, 'src/popup-entry.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
      outDir: 'dist',
      emptyOutDir: true,
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'public/*',
            dest: '.',
          },
        ],
      }),
    ],
  };
});
