import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    // Ignora archivos no-código en el root del proyecto: ofimática (Word,
    // Excel, PowerPoint) suele quedarse con lock exclusivo en Windows y
    // hace petar el watcher con EBUSY.
    watch: {
      ignored: [
        '**/*.pptx',
        '**/*.docx',
        '**/*.xlsx',
        '**/*.pdf',
        '**/~$*', // temporales de Office
      ],
    },
  },
})
