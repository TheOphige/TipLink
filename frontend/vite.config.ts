import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';

export default defineConfig({
  plugins: [
    react(),
    NodeGlobalsPolyfillPlugin({
      buffer: true,
    }),
  ],
  define: {
    'process.env': {}, 
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
});