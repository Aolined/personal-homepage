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

test('Render blueprint deploys Echo Music as an isolated public guest service', async () => {
  const render = await read('render.yaml');

  assert.match(render, /name:\s*aolined-echo-music/);
  assert.match(render, /rootDir:\s*echo-music/);
  assert.match(render, /startCommand:\s*npm run web/);
  assert.match(render, /key:\s*PUBLIC_GUEST_MODE\s*\n\s*value:\s*"true"/);
  assert.match(render, /key:\s*ECHO_MUSIC_PUBLIC_URL\s*\n\s*value:\s*"https:\/\/aolined-echo-music\.onrender\.com"/);
});

test('Render blueprint deploys Format Workshop with cross-origin isolation headers', async () => {
  const render = await read('render.yaml');

  assert.match(render, /name:\s*aolined-format-workshop/);
  assert.match(render, /runtime:\s*static/);
  assert.match(render, /rootDir:\s*format-workshop/);
  assert.match(render, /staticPublishPath:\s*\.\/dist/);
  assert.match(render, /name:\s*Cross-Origin-Opener-Policy\s*\n\s*value:\s*same-origin/);
  assert.match(render, /name:\s*Cross-Origin-Embedder-Policy\s*\n\s*value:\s*require-corp/);
});
