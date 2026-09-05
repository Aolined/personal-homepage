// Builds the deployable static bundle for Cloudflare Pages (output dir: dist/).
// The homepage is plain HTML/CSS/JS with zero runtime dependencies, so the
// "build" step is a deterministic copy of the exact files the site references,
// plus the security headers Cloudflare should serve (_headers).
//
// Usage: npm run build   (writes ./dist)

import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

// Static entrypoints referenced by index.html / src/*.js. Keep this list in
// sync with the site; `assets/` is copied wholesale (it is small and fully
// referenced by the homepage).
const STATIC_FILES = ['index.html', 'styles.css', 'snake.html'];
const STATIC_DIRS = ['src', 'assets'];

// Mirrors scripts/server.mjs securityHeaders so edge-hosting behaves like the
// Node server did. Written as dist/_headers for Cloudflare Pages.
const HEADERS = `/*
  Content-Security-Policy: default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
`;

export async function buildStatic({ root = rootDir, outDir = join(rootDir, 'dist'), log = console.log } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let copiedFiles = 0;
  let copiedBytes = 0;

  for (const name of STATIC_FILES) {
    const source = join(root, name);
    if (!existsSync(source)) throw new Error(`Missing static file: ${name}`);
    const target = join(outDir, name);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: true });
    const { size } = await stat(target);
    copiedFiles += 1;
    copiedBytes += size;
  }

  for (const dir of STATIC_DIRS) {
    const source = join(root, dir);
    if (!existsSync(source)) throw new Error(`Missing static directory: ${dir}`);
    await cp(source, join(outDir, dir), { recursive: true, force: true });
  }

  await writeFile(join(outDir, '_headers'), HEADERS, 'utf8');

  if (log) log(`Built dist/ with ${copiedFiles} files (${(copiedBytes / 1024 / 1024).toFixed(2)} MB) + dirs ${STATIC_DIRS.join(', ')}`);
  return outDir;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await buildStatic();


