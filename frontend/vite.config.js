import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const proxyConfig = {
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
    // Minify with esbuild (default, fastest)
    minify: 'esbuild',
    // Enable CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for vendor libraries
        manualChunks: {
          // React core — loaded once, cached forever
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI components — shared across all pages
          'vendor-ui': ['lucide-react', 'sonner', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          // Form/validation — only needed on form pages
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Date utilities
          'vendor-date': ['date-fns'],
          // State management
          'vendor-state': ['zustand'],
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
