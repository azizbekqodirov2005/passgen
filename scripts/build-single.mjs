/**
 * Builds a single self-contained HTML file (dist-single/passgen.html).
 *
 * Why: PassGen is local-first, so one portable file is a convenient way to run
 * it from any static host or to share a working demo. The file contains the
 * same application code as the normal build — only the bundling differs.
 *
 * Usage: npm run build:single
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'dist-single-build');
const finalDir = join(root, 'dist-single');

await build({
  root,
  // Ignore vite.config.ts: that config splits React into its own chunk, which
  // cannot be combined with a single inlined bundle.
  configFile: false,
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
  logLevel: 'warn',
});

const files = await readdir(outDir);
const jsFile = files.find((name) => name.endsWith('.js'));
const cssFile = files.find((name) => name.endsWith('.css'));
if (!jsFile || !cssFile) {
  throw new Error('Build output is missing the JS or CSS asset.');
}

const [html, js, css] = await Promise.all([
  readFile(join(outDir, 'index.html'), 'utf8'),
  readFile(join(outDir, jsFile), 'utf8'),
  readFile(join(outDir, cssFile), 'utf8'),
]);

const inlined = html
  .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/u, '')
  .replace(/<link rel="stylesheet"[^>]*href="[^"]*"[^>]*>/u, '')
  .replace('</head>', `  <style>\n${css}\n  </style>\n  </head>`)
  .replace('</body>', `  <script type="module">\n${js}\n  </script>\n  </body>`);

await mkdir(finalDir, { recursive: true });
await writeFile(join(finalDir, 'passgen.html'), inlined, 'utf8');

const sizeKb = (Buffer.byteLength(inlined, 'utf8') / 1024).toFixed(1);
console.log(`dist-single/passgen.html  ${sizeKb} kB`);
