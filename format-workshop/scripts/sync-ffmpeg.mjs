import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destination = resolve(root, 'public', 'ffmpeg');
const files = ['ffmpeg-core.js']; // wasm 走外部 URL,不打包进 Pages(受25MB限制)

await mkdir(destination, { recursive: true });
await Promise.all(
  files.map((file) => copyFile(resolve(source, file), resolve(destination, file))),
);

console.log('FFmpeg core assets are ready in public/ffmpeg.');
