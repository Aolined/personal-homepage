import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStatic } from './build-static.mjs';

test('buildStatic produces a complete deployable bundle', async () => {
  const root = join(import.meta.dirname, '..');
  const outDir = await mkdtemp(join(tmpdir(), 'aolined-dist-'));
  try {
    await buildStatic({ root, outDir, log: () => {} });

    for (const expected of [
      'index.html',
      'styles.css',
      'snake.html',
      'src/app.js',
      'src/content.js',
      'assets/audio/kaishi-dongle.mp3',
      'assets/about-warm.webp',
      '_headers',
    ]) {
      const info = await stat(join(outDir, expected));
      assert.ok(info.isFile(), `expected ${expected} to be a file`);
    }

    const headers = await readFile(join(outDir, '_headers'), 'utf8');
    assert.match(headers, /Content-Security-Policy/);
    assert.match(headers, /X-Frame-Options/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
