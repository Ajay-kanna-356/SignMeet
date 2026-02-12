
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
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't wipe
        minify: false,
        lib: {
            entry: path.resolve(__dirname, 'src/background/index.ts'),
            name: 'SignMeetBackground',
            formats: ['es'],
            fileName: () => 'assets/background.js',
        },
        rollupOptions: {
            output: {
                extend: true,
                inlineDynamicImports: true, // Force single file
            },
        }
    },
});
