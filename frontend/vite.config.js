import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O build vai para ../web, que é a pasta publicada no GitHub Pages (leonardogmendoza.github.io/busca-job-ia/web/)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../web', emptyOutDir: true, target: ['es2020', 'safari14'] }
});
