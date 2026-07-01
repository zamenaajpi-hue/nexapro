import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',

    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['nexa-messenger.ddns.net'],
      hmr: process.env.DISABLE_HMR === 'true' ? false : { clientPort: 3000 },
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('@capacitor/')) return 'vendor-capacitor';

            if (
              id.includes('socket.io-client') ||
              id.includes('engine.io-client')
            ) {
              return 'vendor-realtime';
            }

            if (id.includes('lucide-react')) return 'vendor-icons';

            if (id.includes('motion')) return 'vendor-motion';

            return undefined;
          },
        },
      },
    },
  };
});