// Edge runtime port of scripts/{ai-hot,weibo-hot,github-hot}.mjs.
// Uses only the platform `fetch` API so it runs on Cloudflare Pages
// Functions (and can be reused for EdgeOne Pages Functions later).
// The original Node implementations in scripts/ are left untouched.

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search_by_date';
const DEFAULT_QUERIES = ['OpenAI', 'Claude AI', 'Gemini AI', 'DeepSeek', 'LLM', 'AI agent'];
const WEIBO_HOT_URL = 'https://weibo.com/ajax/side/hotSearch';
const GITHUB_SEARCH_URL = 'https://api.github.com/search/repositories';
const MAX_ITEMS = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > maxLength || /[<>\u0000-\u001f]/.test(text)) return '';
  return text;
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

export const SOURCES = ['ai', 'github', 'weibo'];

// ---------------------------------------------------------------------------
// AI stories (Hacker News keyword search)
// ---------------------------------------------------------------------------
function buildAiSearchUrl(query, now) {
  const url = new URL(HN_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', '30');
  url.searchParams.set('numericFilters', `created_at_i>${Math.floor((now - WEEK_MS) / 1000)}`);
  return url.href;
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

// ---------------------------------------------------------------------------
// Weibo hot search
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GitHub trending repositories (created this week, sorted by stars)
// ---------------------------------------------------------------------------
function safeRepositoryUrl(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.origin !== 'https://github.com' || parts.length !== 2) return '';
    return `https://github.com/${parts[0]}/${parts[1]}`;
  } catch {
    return '';
  }
}

export function normalizeGithubRepositories(payload) {
  const repositories = payload && typeof payload === 'object' ? payload.items : null;
  if (!Array.isArray(repositories)) return [];

  return repositories
    .map((repository) => {
      if (!repository || typeof repository !== 'object') return null;
      const title = cleanText(repository.full_name, 100);
      const url = safeRepositoryUrl(repository.html_url);
      if (!title || !url || url.slice('https://github.com/'.length).toLowerCase() !== title.toLowerCase()) return null;
      const stars = Math.max(0, Number(repository.stargazers_count) || 0);
      const forks = Math.max(0, Number(repository.forks_count) || 0);
      return {
        title,
        hot: Math.round(stars + forks * 2),
        tag: cleanText(repository.language, 20),
        url,
        detail: cleanText(repository.description, 160),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
    .map((repository, index) => ({ rank: index + 1, ...repository }));
}

// ---------------------------------------------------------------------------
// Refresh + in-memory cache (per isolate), mirrors scripts/*.mjs semantics:
//   - cached within ttlMs unless force=true
//   - degraded to stale on upstream failure, unavailable with no cache
// ---------------------------------------------------------------------------
function buildGithubSearchUrl(now) {
  const since = new Date(now - WEEK_MS).toISOString().slice(0, 10);
  const url = new URL(GITHUB_SEARCH_URL);
  url.searchParams.set('q', `created:>=${since}`);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(MAX_ITEMS));
  return url.href;
}

function buildSourceRequest(source, now) {
  switch (source) {
    case 'ai':
      return {
        label: 'hn-ai',
        requests: DEFAULT_QUERIES.map((query) => buildAiSearchUrl(query, now)),
        headers: { Accept: 'application/json', 'User-Agent': 'AolinedHomepage/1.0' },
        parse: normalizeAiStories,
        aggregate: true,
      };
    case 'weibo':
      return {
        label: 'weibo',
        requests: [WEIBO_HOT_URL],
        headers: {
          Accept: 'application/json',
          Referer: 'https://weibo.com/hot/search',
          'User-Agent': 'Mozilla/5.0 (compatible; AolinedHomepage/1.0)',
        },
        parse: normalizeWeiboHotSearch,
        aggregate: false,
      };
    case 'github':
      return {
        label: 'github',
        requests: [buildGithubSearchUrl(now)],
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'AolinedHomepage/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        parse: normalizeGithubRepositories,
        aggregate: false,
      };
    default:
      throw new RangeError(`Unsupported trend source: ${source}`);
  }
}

export function createHotSearchService({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  ttlMs = 120_000,
  onError = (error) => console.warn(`Hot search refresh failed: ${error.message}`),
} = {}) {
  const cacheBySource = new Map();

  async function refresh(source) {
    const refreshedAt = now();
    const spec = buildSourceRequest(source, refreshedAt);

    const results = await Promise.allSettled(
      spec.requests.map(async (url) => {
        const response = await fetchImpl(url, { headers: spec.headers });
        if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
        return response.json();
      }),
    );

    const payloads = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const data = spec.aggregate ? spec.parse(payloads, refreshedAt) : spec.parse(payloads[0]);
    if (!Array.isArray(data) || !data.length) throw new Error(`${source} returned no usable items`);

    const entry = {
      data,
      source: spec.label,
      status: 'live',
      updatedAt: new Date(refreshedAt).toISOString(),
      cachedAt: refreshedAt,
    };
    cacheBySource.set(source, entry);
    return entry;
  }

  return {
    async getHotSearch(source, { force = false } = {}) {
      if (!SOURCES.includes(source)) {
        return { data: [], source, status: 'unavailable', updatedAt: null };
      }
      const cached = cacheBySource.get(source);
      if (!force && cached && now() - cached.cachedAt < ttlMs) {
        return { ...cached, cachedAt: undefined };
      }
      try {
        return { ...(await refresh(source)), cachedAt: undefined };
      } catch (error) {
        onError(error);
        if (cached) return { ...cached, status: 'stale', cachedAt: undefined };
        return { data: [], source, status: 'unavailable', updatedAt: null };
      }
    },
  };
}
