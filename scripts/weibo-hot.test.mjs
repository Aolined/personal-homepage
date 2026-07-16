import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeiboHotService, normalizeWeiboHotSearch } from './weibo-hot.mjs';

test('normalizes Weibo realtime topics and constructs safe search links', () => {
  const items = normalizeWeiboHotSearch({ data: { realtime: [
    { word: '人工智能新进展', num: 920000, label_name: '新' },
    { word: '<script>', num: 9999999 },
  ] } });

  assert.deepEqual(items, [{
    rank: 1,
    title: '人工智能新进展',
    hot: 920000,
    tag: '新',
    url: 'https://s.weibo.com/weibo?q=%23%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E6%96%B0%E8%BF%9B%E5%B1%95%23',
  }]);
});

test('serves stale Weibo data after an upstream failure', async () => {
  let calls = 0;
  const service = createWeiboHotService({
    ttlMs: 0,
    now: () => Date.UTC(2026, 6, 16),
    onError: () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls > 1) throw new Error('offline');
      return { ok: true, json: async () => ({ data: { realtime: [{ word: '测试话题', num: 10 }] } }) };
    },
  });

  const live = await service.getHotSearch();
  const stale = await service.getHotSearch({ force: true });

  assert.equal(live.status, 'live');
  assert.equal(live.source, 'weibo');
  assert.equal(stale.status, 'stale');
  assert.equal(stale.data[0].title, '测试话题');
});
