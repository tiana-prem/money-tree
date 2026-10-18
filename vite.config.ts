import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'zustand', 'lucide-react'] } },
    },
    chunkSizeWarningLimit: 600,
  },
  test: { environment: 'node' },
} as any);
