import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Everything (JS, CSS, icons) is inlined into one index.html, so the page can
// be saved with Cmd/Ctrl+S and used fully offline.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
