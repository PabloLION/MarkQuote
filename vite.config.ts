import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    minify: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        selection: resolve(__dirname, 'src/selection.ts'),
        offscreen: resolve(__dirname, 'src/offscreen.ts'),
        settings: resolve(__dirname, 'src/settings.ts'),
        popup: resolve(__dirname, 'public/popup.html'),
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
          dest: '.'
        }
      ]
    })
  ]
});
