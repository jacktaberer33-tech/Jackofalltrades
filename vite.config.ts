import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The normal build (`npm run build`) bundles everything for hosting on Netlify, Vercel, etc.
//
// The artifact build (`npm run build:artifact`) makes one self-contained HTML page for a
// shareable preview: React loads from cdnjs, everything else is inlined.
const REACT_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
];

function reactFromCdn(): Plugin {
  return {
    name: 'react-from-cdn',
    transformIndexHtml() {
      return REACT_CDN.map((src) => ({ tag: 'script', attrs: { src }, injectTo: 'head' as const }));
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode !== 'artifact') {
    return { plugins: [react()] };
  }
  return {
    plugins: [reactFromCdn(), viteSingleFile()],
    esbuild: {
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      jsxInject: `import React from 'react'`,
    },
    build: {
      outDir: 'dist-artifact',
      rollupOptions: {
        external: ['react', 'react-dom', 'react-dom/client'],
        output: {
          format: 'iife',
          globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
        },
      },
    },
  };
});
