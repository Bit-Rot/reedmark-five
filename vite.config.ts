import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const variant = mode === 'pool' ? 'pool' : 'fixed';
  const outDir = `dist/${variant}`;
  // The design-data editor ships with the fixed build only.
  const input: Record<string, string> = { main: resolve(import.meta.dirname, 'index.html') };
  if (variant === 'fixed') input.editor = resolve(import.meta.dirname, 'editor/index.html');
  return {
    base: './',
    define: { __VARIANT__: JSON.stringify(variant) },
    build: {
      outDir,
      rollupOptions: { input },
    },
    plugins: variant === 'fixed' ? [{
      name: 'publish-data',
      // Publish data/*.json next to the site so the editor can fall back to the deployed copy.
      closeBundle() {
        if (existsSync('data')) cpSync('data', `${outDir}/data`, { recursive: true });
      },
    }] : [],
  };
});
