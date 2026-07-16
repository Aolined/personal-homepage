import { requestJsonIpv4 } from './ai-hot.mjs';

const WEIBO_HOT_URL = 'https://weibo.com/ajax/side/hotSearch';
const MAX_ITEMS = 10;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > maxLength || /[<>\u0000-\u001f]/.test(text)) return '';
  return text;
}

export function normalizeWeiboHotSearch(payload) {
  const topics = payload && typeof payload === 'object' ? payload.data?.realtime : null;
  if (!Array.isArray(topics)) return [];

  return topics
    .map((topic) => {
      if (!topic || typeof topic !== 'object') return null;
      const title = cleanText(topic.word, 80);
      if (!title) return null;
      const hot = Math.max(0, Math.round(Number(topic.num) || 0));
      const tag = cleanText(topic.label_name, 4);
      return {
        title,
        hot,
        tag,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${title}#`)}`,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
    .map((topic, index) => ({ rank: index + 1, ...topic }));
}

export function createWeiboHotService({ fetchImpl = requestJsonIpv4, now = Date.now, ttlMs = 120_000, onError = (error) => console.warn(`Weibo hot search refresh failed: ${error.message}`) } = {}) {
  let cache = null;

  async function refresh() {
    const refreshedAt = now();
    const response = await fetchImpl(WEIBO_HOT_URL, {
      headers: {
        Accept: 'application/json',
        Referer: 'https://weibo.com/hot/search',
        'User-Agent': 'Mozilla/5.0 (compatible; AolinedHomepage/1.0)',
      },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const data = normalizeWeiboHotSearch(await response.json());
    if (!data.length) throw new Error('Weibo returned no usable topics');
    cache = { data, source: 'weibo', status: 'live', updatedAt: new Date(refreshedAt).toISOString(), cachedAt: refreshedAt };
    return cache;
  }

  return {
    async getHotSearch({ force = false } = {}) {
      if (!force && cache && now() - cache.cachedAt < ttlMs) return { ...cache, cachedAt: undefined };
      try {
        return { ...await refresh(), cachedAt: undefined };
      } catch (error) {
        onError(error);
        if (cache) return { ...cache, status: 'stale', cachedAt: undefined };
        return { data: [], source: 'weibo', status: 'unavailable', updatedAt: null };
      }
    },
  };
}
