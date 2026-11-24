import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const variant = mode === 'pool' ? 'pool' : 'fixed';
  return {
    base: './',
    define: { __VARIANT__: JSON.stringify(variant) },
    build: { outDir: `dist/${variant}` },
  };
});