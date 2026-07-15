import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { resolveStaticPath } from './server-path.mjs';

test('resolves normal static files inside the site root', () => {
  const root = resolve('homepage');
  assert.equal(resolveStaticPath(root, '/styles.css'), resolve(root, 'styles.css'));
  assert.equal(resolveStaticPath(root, '/'), resolve(root, 'index.html'));
});

test('rejects traversal into a sibling with the same path prefix', () => {
  const root = resolve('homepage');
  assert.equal(resolveStaticPath(root, '/../homepage-secret/secret.txt'), null);
  assert.equal(resolveStaticPath(root, '/../../outside.txt'), null);
});
