import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createAiHotService, normalizeAiStories, requestJsonIpv4 } from './ai-hot.mjs';

test('requests public AI data over IPv4 with a bounded response', async () => {
  let requestOptions;
  const fakeGet = (_url, options, onResponse) => {
    requestOptions = options;
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.destroy = (error) => request.emit('error', error);
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      onResponse(response);
      response.emit('data', Buffer.from('{"hits":[]}'));
      response.emit('end');
    });
    return request;
  };

  const response = await requestJsonIpv4('https://hn.algolia.com/api/v1/search_by_date', {}, fakeGet);

  assert.equal(requestOptions.family, 4);
  assert.equal(response.ok, true);
  assert.deepEqual(await response.json(), { hits: [] });
});

test('deduplicates and ranks AI stories using discussion and recency', () => {
  const now = Date.UTC(2026, 6, 15);
  const recent = Math.floor((now - 60 * 60 * 1000) / 1000);
  const old = Math.floor((now - 6 * 24 * 60 * 60 * 1000) / 1000);
  const payloads = [
    { hits: [{ objectID: '101', title: 'OpenAI launches a new model', points: 100, num_comments: 10, created_at_i: recent }] },
    { hits: [
      { objectID: '101', title: 'OpenAI launches a new model', points: 100, num_comments: 10, created_at_i: recent },
      { objectID: '202', title: 'A deep look at language models', points: 200, num_comments: 0, created_at_i: old },
    ] },
  ];

  assert.deepEqual(normalizeAiStories(payloads, now), [
    { rank: 1, title: 'OpenAI launches a new model', hot: 120, tag: '新', url: 'https://news.ycombinator.com/item?id=101' },
    { rank: 2, title: 'A deep look at language models', hot: 200, tag: '热', url: 'https://news.ycombinator.com/item?id=202' },
  ]);
});

test('drops malformed stories and limits output to ten items', () => {
  const hits = [
    { objectID: 'bad', title: '<script>alert(1)</script>' },
    { objectID: '2', title: '' },
    ...Array.from({ length: 12 }, (_, index) => ({ objectID: String(100 + index), title: `AI topic ${index + 1}`, points: 20 - index, num_comments: 1, created_at_i: 1000 })),
  ];

  const items = normalizeAiStories([{ hits }], 1000 * 1000);

  assert.equal(items.length, 10);
  assert.equal(items[0].title, 'AI topic 1');
  assert.equal(items[9].rank, 10);
});

test('serves the last successful AI result as stale when refresh fails', async () => {
  let requestCount = 0;
  let now = Date.UTC(2026, 6, 15);
  const service = createAiHotService({
    queries: ['OpenAI'],
    ttlMs: 0,
    now: () => now,
    onError: () => {},
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount > 1) throw new Error('offline');
      return { ok: true, json: async () => ({ hits: [{ objectID: '9', title: 'Cached AI story', points: 8, num_comments: 2, created_at_i: Math.floor(now / 1000) }] }) };
    },
  });

  const live = await service.getHotSearch();
  now += 1000;
  const stale = await service.getHotSearch();

  assert.equal(live.status, 'live');
  assert.equal(live.source, 'hn-ai');
  assert.equal(stale.status, 'stale');
  assert.equal(stale.data[0].title, 'Cached AI story');
  assert.equal(stale.updatedAt, live.updatedAt);
});

test('bypasses a fresh cache only when manual refresh is forced', async () => {
  let requestCount = 0;
  const now = Date.UTC(2026, 6, 15);
  const service = createAiHotService({
    queries: ['OpenAI'],
    now: () => now,
    fetchImpl: async () => {
      requestCount += 1;
      return { ok: true, json: async () => ({ hits: [{ objectID: String(requestCount), title: `AI story ${requestCount}`, points: 10, created_at_i: Math.floor(now / 1000) }] }) };
    },
  });

  const first = await service.getHotSearch();
  const cached = await service.getHotSearch();
  const forced = await service.getHotSearch({ force: true });

  assert.equal(first.data[0].title, 'AI story 1');
  assert.equal(cached.data[0].title, 'AI story 1');
  assert.equal(forced.data[0].title, 'AI story 2');
  assert.equal(requestCount, 2);
});
