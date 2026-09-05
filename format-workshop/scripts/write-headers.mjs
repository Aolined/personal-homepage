// Writes the production security headers Cloudflare Pages should serve.
// ffmpeg.wasm needs COOP/COEP (SharedArrayBuffer); without these the
// converter crashes in the browser. Vite only sets these in dev/preview,
// so we inject them into dist/_headers at build time.
//
// Usage: node scripts/write-headers.mjs  (after vite build -> ./dist)
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'dist');
const headers = `/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, '_headers'), headers, 'utf8');
console.log('dist/_headers written (COOP/COEP + CSP).');
