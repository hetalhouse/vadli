import { defineConfig } from 'vite'

// The demo app. `base` is relative so the build works on GitHub Pages under /vadli/.
export default defineConfig({
  root: 'demo',
  base: './',
  build: { outDir: '../demo-dist', emptyOutDir: true },
})
