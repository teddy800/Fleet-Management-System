import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8069',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: { "*": "/" },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map(c =>
                c.replace(/; SameSite=None/gi, '; SameSite=Lax')
                 .replace(/; Secure/gi, '')
              );
            }
          });
        },
      },
      '/web': {
        target: 'http://localhost:8069',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: { "*": "/" },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map(c =>
                c.replace(/; SameSite=None/gi, '; SameSite=Lax')
                 .replace(/; Secure/gi, '')
              );
            }
          });
        },
      },
      '/webhook': {
        target: 'http://localhost:8069',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: { "*": "/" },
      },
    },
  },
  resolve: {
    conditions: ['style', 'browser', 'module', 'import', 'default'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
