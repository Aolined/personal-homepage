import { defineConfig } from 'vite';

const baseHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export const productionCsp = [
  "default-src 'self'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default defineConfig({
  server: {
    headers: {
      ...baseHeaders,
      'Content-Security-Policy': productionCsp.replace(
        "style-src 'self'",
        "style-src 'self' 'unsafe-inline'",
      ),
    },
  },
  preview: {
    headers: {
      ...baseHeaders,
      'Content-Security-Policy': productionCsp,
    },
  },
});
