import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom'],
              echarts: [
                'echarts/core',
                'echarts/charts',
                'echarts/components',
                'echarts/renderers'
              ],
              capacitor: [
                '@capacitor/core',
                '@capacitor/app',
                '@capacitor/filesystem',
                '@capacitor/share',
                '@capacitor/splash-screen'
              ]
            }
          }
        }
      }
    };
});
