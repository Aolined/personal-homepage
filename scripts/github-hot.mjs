import { requestJsonIpv4 } from './ai-hot.mjs';

const GITHUB_SEARCH_URL = 'https://api.github.com/search/repositories';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 10;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > maxLength || /[<>\u0000-\u001f]/.test(text)) return '';
  return text;
}

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

function buildSearchUrl(now) {
  const since = new Date(now - WEEK_MS).toISOString().slice(0, 10);
  const url = new URL(GITHUB_SEARCH_URL);
  url.searchParams.set('q', `created:>=${since}`);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(MAX_ITEMS));
  return url.href;
}

export function createGithubHotService({ fetchImpl = requestJsonIpv4, now = Date.now, ttlMs = 120_000, onError = (error) => console.warn(`GitHub hot search refresh failed: ${error.message}`) } = {}) {
  let cache = null;

  async function refresh() {
    const refreshedAt = now();
    const response = await fetchImpl(buildSearchUrl(refreshedAt), {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AolinedHomepage/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const data = normalizeGithubRepositories(await response.json());
    if (!data.length) throw new Error('GitHub returned no usable repositories');
    cache = { data, source: 'github', status: 'live', updatedAt: new Date(refreshedAt).toISOString(), cachedAt: refreshedAt };
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
        return { data: [], source: 'github', status: 'unavailable', updatedAt: null };
      }
    },
  };
}
