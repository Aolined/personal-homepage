import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('package metadata provides dependency-free start and test commands', async () => {
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.equal(packageJson.scripts.start, 'node scripts/server.mjs');
  assert.match(packageJson.scripts.test, /scripts\/server\.test\.mjs/);
  assert.deepEqual(packageJson.dependencies || {}, {});
});

test('public repository ignores local artifacts and secrets', async () => {
  const gitignore = await read('.gitignore');

  for (const marker of ['node_modules/', '*.log', '.tmp-*.png', '.env', '*.pem', '.agents/']) {
    assert.match(gitignore, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Render blueprint uses the health check and npm start', async () => {
  const render = await read('render.yaml');

  assert.match(render, /runtime:\s*node/);
  assert.match(render, /startCommand:\s*npm start/);
  assert.match(render, /plan:\s*free/);
  assert.match(render, /healthCheckPath:\s*\/healthz/);
  assert.match(render, /key:\s*TRUST_PROXY/);
});
