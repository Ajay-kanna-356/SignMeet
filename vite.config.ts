import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url'; // <--- Import this

// 1. Manually define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Allows you to use imports like '@/components/Button'
    },
  },
  build: {
    // Output to 'dist' folder
    outDir: 'dist',
    emptyOutDir: true, // Clean the folder before building
    
    // We need to disable minification for debugging (optional, turn on for production)
    minify: false,
    
    rollupOptions: {
      input: {
        // 1. The Content Script (The React Overlay)
        content: path.resolve(__dirname, 'src/content/index.tsx'),
        
        // 2. The Background Script (The Logic)
        background: path.resolve(__dirname, 'src/background/index.ts'),
        
        // 3. The Popup (Optional UI) - Create a simple index.html if you need one
        // popup: path.resolve(__dirname, 'index.html'), 
      },
      output: {
        // This removes the random hash (e.g., content.28374.js -> content.js)
        // so your manifest.json always points to the right file.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});