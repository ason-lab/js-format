// build.mjs — esbuild bundler for asun-format
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

mkdirSync('dist', { recursive: true });

// ESM bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  outfile: 'dist/asun-format.js',
  minify: false,
});

// CJS bundle
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/asun-format.cjs',
  minify: false,
});

// Minified IIFE for CDN (<script> tag usage)
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'AsunFormat',
  outfile: 'dist/asun-format.min.js',
  minify: true,
});

// Copy CSS
cpSync('src/asun-format.css', 'dist/asun-format.css');

console.log('✓ dist/asun-format.js  dist/asun-format.cjs  dist/asun-format.min.js  dist/asun-format.css');
