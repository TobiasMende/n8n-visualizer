import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'happy-dom', globals: true },
  resolve: {
    alias: {
      '#shared': r('shared'),
      '~~': root,
      '@@': root,
      '~': r('app'),
      '@': r('app'),
    },
  },
})
