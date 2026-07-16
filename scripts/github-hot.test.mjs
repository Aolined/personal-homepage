import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubHotService, normalizeGithubRepositories } from './github-hot.mjs';

test('normalizes GitHub repositories into ranked safe links', () => {
  const items = normalizeGithubRepositories({ items: [
    { full_name: 'openai/example', html_url: 'https://github.com/openai/example', description: 'An AI example', stargazers_count: 320, forks_count: 20, language: 'Python' },
    { full_name: '<bad>', html_url: 'https://evil.example/repo', stargazers_count: 9999 },
  ] });

  assert.deepEqual(items, [{
    rank: 1,
    title: 'openai/example',
    hot: 360,
    tag: 'Python',
    url: 'https://github.com/openai/example',
    detail: 'An AI example',
  }]);
});

test('serves stale GitHub data after an upstream failure', async () => {
  let calls = 0;
  const service = createGithubHotService({
    ttlMs: 0,
    now: () => Date.UTC(2026, 6, 16),
    onError: () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls > 1) throw new Error('offline');
      return { ok: true, json: async () => ({ items: [{ full_name: 'a/b', html_url: 'https://github.com/a/b', stargazers_count: 10 }] }) };
    },
  });

  const live = await service.getHotSearch();
  const stale = await service.getHotSearch({ force: true });

  assert.equal(live.status, 'live');
  assert.equal(live.source, 'github');
  assert.equal(stale.status, 'stale');
  assert.equal(stale.data[0].title, 'a/b');
});
