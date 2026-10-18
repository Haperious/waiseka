import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
  test: {
    // Route handler tests sit next to their route.ts (app/ colocation is not routable)
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
})
