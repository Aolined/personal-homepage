// Writes the production security headers Cloudflare Pages should serve.
// ffmpeg.wasm needs COOP/COEP (SharedArrayBuffer) and the wasm is loaded from
// an external host (VITE_FFMPEG_WASM_URL), so we allow that host in connect-src.
// Vite only sets these in dev/preview, so we inject them into dist/_headers.
//
// Usage: node scripts/write-headers.mjs  (after vite build -> ./dist)
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'dist');

// Read the configured wasm host (set as VITE_FFMPEG_WASM_URL in Cloudflare
// build settings). Fall back to jsDelivr to match the app's default.
const wasmUrl = process.env.VITE_FFMPEG_WASM_URL || 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm';
const wasmHost = new URL(wasmUrl).origin;

const connectSrc = `'self' blob: ${wasmHost}`;

const headers = `/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src ${connectSrc}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, '_headers'), headers, 'utf8');
console.log('dist/_headers written (COOP/COEP + CSP, wasm host: ' + wasmHost + ').');
