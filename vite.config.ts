import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // サイトの正規オリジン。sitemap.xml / robots.txt（scripts/generate-sitemap.mjs）と同じ SITE_URL を参照する
  const siteUrl = process.env.SITE_URL?.replace(/\/+$/, '') ?? ''
  if (command === 'build' && !siteUrl) {
    throw new Error('SITE_URL environment variable is not set (e.g. SITE_URL=https://example.com)')
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
    define: {
      // 開発時に未設定なら空文字 → 実行時に window.location.origin へフォールバック
      __SITE_URL__: JSON.stringify(siteUrl),
    },
    test: {
      include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    },
  }
})
