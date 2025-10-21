import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'test/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    server: {
      deps: {
        inline: ['vitest-package-exports'],
      },
    },
  },
})
