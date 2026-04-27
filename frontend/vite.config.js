import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const proxyConfig = {
  target: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:8069',
  changeOrigin: true,
  secure: process.env.NODE_ENV === 'production',
  cookieDomainRewrite: process.env.NODE_ENV === 'production' ? "your-domain.com" : "localhost",
  cookiePathRewrite: { "*": "/" },
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes) => {
      const setCookie = proxyRes.headers['set-cookie'];
      if (setCookie) {
        proxyRes.headers['set-cookie'] = setCookie.map(c =>
          c.replace(/; SameSite=None/gi, '; SameSite=Lax')
           .replace(/; Secure/gi, process.env.NODE_ENV === 'production' ? '; Secure' : '')
           .replace(/Domain=[^;]+;?\s*/gi, '')
        );
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api':     proxyConfig,
      '/web':     proxyConfig,
      '/webhook': { target: 'http://localhost:8069', changeOrigin: true, secure: false },
    },
  },

  build: {
    // Increase chunk size warning threshold
    chunkSizeWarningLimit: 600,
    // Minify with oxc (default for Vite 8 with rolldown)
    minify: 'oxc',
    // Enable CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for vendor libraries
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (['react', 'react-dom', 'react-router-dom'].some(p => id.includes(`/node_modules/${p}/`))) {
              return 'vendor-react';
            }
            if (['lucide-react', 'sonner', 'clsx', 'tailwind-merge', 'class-variance-authority'].some(p => id.includes(`/node_modules/${p}/`))) {
              return 'vendor-ui';
            }
            if (['react-hook-form', '@hookform', 'zod'].some(p => id.includes(`/node_modules/${p}/`))) {
              return 'vendor-forms';
            }
            if (id.includes('/node_modules/date-fns/')) {
              return 'vendor-date';
            }
            if (id.includes('/node_modules/zustand/')) {
              return 'vendor-state';
            }
          }
        },
      },
    },
  },

  resolve: {
    conditions: ['style', 'browser', 'module', 'import', 'default'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Optimize deps pre-bundling for faster cold starts
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      'lucide-react', 'sonner', 'zustand',
      'clsx', 'tailwind-merge',
    ],
  },
})
