
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't wipe dist (assuming main build runs first or we manage order)
        copyPublicDir: false, // build:camera already copies public/ to dist/ — skip it here to avoid Windows file-lock (EPERM) on large .glb files
        minify: false,
        lib: {
            entry: path.resolve(__dirname, 'src/content/index.tsx'),
            name: 'SignMeetContent',
            formats: ['iife'],
            fileName: () => 'assets/content.js',
        },
        rollupOptions: {
            output: {
                extend: true,
                inlineDynamicImports: true, // Force single file
            },
        }
    },
});
