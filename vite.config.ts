import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'dezignee-plugin'],
      output: { banner: "'use client';" },
    },
  },
  plugins: [dts({ include: ['src'], exclude: ['src/**/__tests__/**'], entryRoot: '.' })],
});
