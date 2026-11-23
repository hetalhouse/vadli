import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Vadli',
      fileName: 'vadli',
    },
    cssFileName: 'vadli',
    emptyOutDir: true,
  },
})
