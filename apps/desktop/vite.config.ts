import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente dalla root del progetto
  const rootDir = path.resolve(__dirname, '../../');
  const env = loadEnv(mode, rootDir, '');
  
  console.log('Loading env from:', rootDir);
  console.log('VITE_GOOGLE_CLIENT_ID:', env.VITE_GOOGLE_CLIENT_ID ? 'Found' : 'Not found');
  
  return {
  define: {
    // Inietta le variabili d'ambiente come costanti nel codice
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || ''),
    'import.meta.env.VITE_GOOGLE_CLIENT_SECRET': JSON.stringify(env.VITE_GOOGLE_CLIENT_SECRET || ''),
    'import.meta.env.VITE_OUTLOOK_CLIENT_ID': JSON.stringify(env.VITE_OUTLOOK_CLIENT_ID || ''),
    'import.meta.env.VITE_OUTLOOK_CLIENT_SECRET': JSON.stringify(env.VITE_OUTLOOK_CLIENT_SECRET || ''),
  },
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mail-client/core': path.resolve(__dirname, '../../packages/core/src'),
      '@mail-client/ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@tauri-apps/api',
      '@tauri-apps/api/shell',
      '@tauri-apps/api/path',
      'imapflow',
      'nodemailer',
      'mailparser',
      'better-sqlite3',
      'libsodium-wrappers',
    ],
  },
  ssr: {
    noExternal: ['@mail-client/core', '@mail-client/ui-kit'],
    external: [
      '@tauri-apps/api',
      '@tauri-apps/api/shell',
      '@tauri-apps/api/path',
      'imapflow',
      'nodemailer',
      'mailparser',
      'better-sqlite3',
      'libsodium-wrappers',
    ],
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      external: [
        'imapflow',
        'nodemailer',
        'mailparser',
        'better-sqlite3',
        'libsodium-wrappers',
      ],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  envDir: rootDir, // Specifica la directory da cui caricare il .env
  };
});

