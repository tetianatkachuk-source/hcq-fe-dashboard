// Bundle web/app.ts → docs/live/app.js using esbuild.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(repoRoot, 'web/app.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: resolve(repoRoot, 'docs/live/app.js'),
  platform: 'browser',
  logLevel: 'info',
  sourcemap: false,
  minify: true,
});
console.log('[build:live] done');
