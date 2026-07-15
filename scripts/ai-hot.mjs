import { get as httpsGet } from 'node:https';

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search_by_date';
const DEFAULT_QUERIES = ['OpenAI', 'Claude AI', 'Gemini AI', 'DeepSeek', 'LLM', 'AI agent'];
const MAX_ITEMS = 10;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function requestJsonIpv4(rawUrl, options = {}, getImpl = httpsGet) {
  return new Promise((resolve, reject) => {
    const request = getImpl(rawUrl, { family: 4, headers: options.headers }, (response) => {
      let body = '';
      let bytes = 0;

      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('Upstream response is too large'));
          return;
        }
        body += chunk;
      });
      response.on('end', () => {
        const status = Number(response.statusCode) || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => JSON.parse(body),
        });
      });
    });

    request.setTimeout?.(5000, () => request.destroy(new Error('Upstream request timed out')));
    request.on('error', reject);
  });
}

function normalizeTitle(value) {
  if (typeof value !== 'string') return '';
  const title = value.trim();
  if (!title || title.length > 160 || /[<>\u0000-\u001f]/.test(title)) return '';
  return title;
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.round(count) : 0;
}

export function normalizeAiStories(payloads, now = Date.now()) {
  const stories = new Map();

  for (const payload of payloads) {
    const hits = payload && typeof payload === 'object' ? payload.hits : null;
    if (!Array.isArray(hits)) continue;
    for (const hit of hits) {
      if (!hit || typeof hit !== 'object') continue;
      const id = String(hit.objectID || '');
      const title = normalizeTitle(hit.title);
      if (!/^\d+$/.test(id) || !title || stories.has(id)) continue;

      const points = normalizeCount(hit.points);
      const comments = normalizeCount(hit.num_comments);
      const createdAt = normalizeCount(hit.created_at_i) * 1000;
      const ageHours = Math.max(0, (now - createdAt) / (60 * 60 * 1000));
      const hot = points + comments * 2;
      const score = hot + Math.max(0, 168 - ageHours) * 2;
      stories.set(id, { id, title, hot, score, ageHours });
    }
  }

  return [...stories.values()]
    .sort((left, right) => right.score - left.score || right.hot - left.hot)
    .slice(0, MAX_ITEMS)
    .map((story, index) => ({
      rank: index + 1,
      title: story.title,
      hot: story.hot,
      tag: story.ageHours <= 24 ? '新' : story.hot >= 200 ? '热' : '',
      url: `https://news.ycombinator.com/item?id=${story.id}`,
    }));
}

function buildSearchUrl(query, now) {
  const url = new URL(HN_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', '30');
  url.searchParams.set('numericFilters', `created_at_i>${Math.floor((now - WEEK_MS) / 1000)}`);
  return url.href;
}

export function createAiHotService({ fetchImpl = requestJsonIpv4, queries = DEFAULT_QUERIES, now = Date.now, ttlMs = 120_000, onError = (error) => console.warn(`AI hot search refresh failed: ${error.message}`) } = {}) {
  let cache = null;

  async function refresh() {
    const refreshedAt = now();
    const results = await Promise.allSettled(queries.map(async (query) => {
      const response = await fetchImpl(buildSearchUrl(query, refreshedAt), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AolinedHomepage/1.0',
        },
      });
      if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
      return response.json();
    }));
    const payloads = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const data = normalizeAiStories(payloads, refreshedAt);
    if (!data.length) throw new Error('AI sources returned no usable items');

    cache = {
      data,
      source: 'hn-ai',
      status: 'live',
      updatedAt: new Date(refreshedAt).toISOString(),
      cachedAt: refreshedAt,
    };
    return cache;
  }

  return {
    async getHotSearch({ force = false } = {}) {
      if (!force && cache && now() - cache.cachedAt < ttlMs) return { ...cache, cachedAt: undefined };
      try {
        const result = await refresh();
        return { ...result, cachedAt: undefined };
      } catch (error) {
        onError(error);
        if (cache) return { ...cache, status: 'stale', cachedAt: undefined };
        return { data: [], source: 'hn-ai', status: 'unavailable', updatedAt: null };
      }
    },
  };
}
